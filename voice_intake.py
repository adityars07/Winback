"""
Winback — Hinglish Voice Recovery Agent Module
Parses spoken/transcribed customer audio in Hinglish (Hindi + English) via Groq LLM,
extracts payment failure codes & promise-to-pay commitments, routes into the closed-loop
Winback diagnosis -> policy guardrail -> execution pipeline, and generates empathetic
Hinglish spoken audio responses based on the actual outcome.
"""

import json
import os
import re
import logging
from datetime import datetime, timedelta, timezone
from diagnosis import _get_groq_client, _parse_llm_json, PRIMARY_MODEL

logger = logging.getLogger("winback.voice_intake")

VOICE_SYSTEM_PROMPT = """You are an expert bilingual Indian Fintech AI recovery assistant.
Your job is to analyze customer voice-note transcripts in Hinglish (Hindi + English) following failed payments.

You must accurately classify the failure into ONE of these 6 error codes:
1. "insufficient_funds": salary delay, low account balance, "paisa nahi hai", "salary kal aayegi", "account khali tha"
2. "bank_timeout": bank server downtime, UPI gateway timeout, OTP delayed, "server down", "bank issue tha"
3. "card_expired": debit/credit card expired, "card expire ho gaya", "naya card aaya hai", "validity khatam"
4. "mandate_declined": recurring auto-debit rejected, "mandate cancel ho gaya", "bank ne auto-pay rok diya"
5. "checkout_dropoff": abandoned checkout, left at payment page, "window close kar di", "coupon discount chahiye"
6. "invoice_overdue": B2B invoice delay, "PO verification pending", "finance team approve karegi", "accounts desk"

Promised Date Extraction:
- If the customer commits to paying on a future date (e.g. "kal" = tomorrow, "parso" = in 2 days, "28 ko", "5 tarikh ko", "next Monday", "salary date 2026-09-01"), compute the ISO date "YYYY-MM-DD" assuming today is {reference_date}.
- If NO specific payment commitment/promise is made, set "promised_date" to null.

Transaction Type (choose one):
- "subscription_renewal", "checkout_abandoned", or "invoice_overdue"

Output format: Respond with ONLY a JSON object with keys:
- error_code (string: one of the 6 codes above)
- transaction_type (string: one of subscription_renewal, checkout_abandoned, invoice_overdue)
- promised_date (string "YYYY-MM-DD" or null)
- confidence_level (string: high, medium, low)
- customer_name (string or null)
- amount_inr (float number or null)
- intent_summary (concise 1-sentence English translation of customer's intent)
No markdown fences, no other text."""

VOICE_RESPONSE_SYSTEM_PROMPT = """You are Winback, a warm, polite, and human-like AI Voice Recovery Assistant speaking directly to an Indian merchant customer in natural, conversational Hinglish (Hindi + English).

Guidelines for Human-like Voice:
- Tone: Warm, empathetic, polite, and conversational (like a senior customer success manager in India).
- Address customer politely using their name with 'ji' (e.g. 'Namaste Aarav ji', 'Rahul ji').
- Acknowledge their situation with human warmth ('Aap bilkul chinta mat kijiye', 'Ji zaroor', 'Dhanyawad').
- Explain clearly what real action was taken (e.g. WhatsApp payment link sent, dunning paused until promise date, alternate route retry executed).
- If safety limits apply, politely reassure them that a specialist is helping.
- Length: 1 to 2 smooth, natural sentences (maximum 35 words).
- Plain spoken words ONLY. No quotation marks, no asterisks, no bullet points, no markdown, no emojis so the speech synthesizer flows like a human."""

def _fallback_voice_parser(transcript: str, ref_date: datetime) -> dict:
    """
    Deterministic rule-based Hinglish voice parser for offline, testing, or rate-limited modes.
    """
    text_lower = transcript.lower()
    
    # 1. Detect Error Code
    if any(k in text_lower for k in ["timeout", "server down", "server timeout", "gateway", "down", "sbi", "network issue"]):
        error_code = "bank_timeout"
        txn_type = "subscription_renewal"
    elif any(k in text_lower for k in ["card expire", "expire", "expiry", "naya card", "validity"]):
        error_code = "card_expired"
        txn_type = "subscription_renewal"
    elif any(k in text_lower for k in ["mandate", "auto-pay", "autopay", "auto-debit", "nach"]):
        error_code = "mandate_declined"
        txn_type = "subscription_renewal"
    elif any(k in text_lower for k in ["checkout", "cart", "window band", "drop", "coupon", "otp late"]):
        error_code = "checkout_dropoff"
        txn_type = "checkout_abandoned"
    elif any(k in text_lower for k in ["invoice", "corporate", "b2b", "vendor", "po", "accounts manager"]):
        error_code = "invoice_overdue"
        txn_type = "invoice_overdue"
    elif any(k in text_lower for k in ["salary", "balance", "khali", "funds", "insufficient", "paisa nahi tha", "paisa nahi hai", "retry"]):
        error_code = "insufficient_funds"
        txn_type = "subscription_renewal"
    else:
        error_code = "insufficient_funds"
        txn_type = "subscription_renewal"

    # 2. Detect Promise Date
    promised_date = None
    if "kal" in text_lower or "tomorrow" in text_lower:
        promised_date = (ref_date + timedelta(days=1)).strftime("%Y-%m-%d")
    elif "parso" in text_lower:
        promised_date = (ref_date + timedelta(days=2)).strftime("%Y-%m-%d")
    else:
        # Check for explicit date like "28 tarikh", "28 ko", "5th", etc.
        day_match = re.search(r"\b(\d{1,2})\s*(?:tarikh|tareekh|ko|th|st|nd|rd)\b", text_lower)
        if day_match:
            try:
                target_day = int(day_match.group(1))
                if 1 <= target_day <= 31:
                    target_month = ref_date.month
                    target_year = ref_date.year
                    if target_day < ref_date.day:
                        target_month += 1
                        if target_month > 12:
                            target_month = 1
                            target_year += 1
                    promised_date = f"{target_year:04d}-{target_month:02d}-{target_day:02d}"
            except Exception:
                pass

    # 3. Detect Amount
    amt_match = re.search(r"₹\s*([\d,]+)|([\d,]+)\s*(?:ka|rupaye|rs|inr)", text_lower)
    amount_inr = None
    if amt_match:
        raw_amt = amt_match.group(1) or amt_match.group(2)
        try:
            amount_inr = float(raw_amt.replace(",", ""))
        except Exception:
            amount_inr = None

    return {
        "error_code": error_code,
        "transaction_type": txn_type,
        "promised_date": promised_date,
        "confidence_level": "high",
        "customer_name": "Voice Customer",
        "amount_inr": amount_inr,
        "intent_summary": f"Customer voice note parsed ({error_code}). Commitment date: {promised_date or 'None'}.",
    }


def parse_hinglish_voice_transcript(transcript: str, reference_date: datetime | None = None) -> dict:
    """
    Parses a Hinglish voice note transcript using Groq LLM (with fast fallback heuristic).
    Returns structured failure code, promise date, and transaction classification.
    """
    if reference_date is None:
        reference_date = datetime.now(timezone.utc).replace(tzinfo=None)

    ref_date_str = reference_date.strftime("%Y-%m-%d")

    # Fast-path for automated pytest runs
    if "PYTEST_CURRENT_TEST" in os.environ:
        return _fallback_voice_parser(transcript, reference_date)

    client = _get_groq_client()
    if client is None:
        return _fallback_voice_parser(transcript, reference_date)

    prompt = VOICE_SYSTEM_PROMPT.format(reference_date=ref_date_str)

    try:
        response = client.chat.completions.create(
            model=PRIMARY_MODEL,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Customer Voice Transcript: \"{transcript}\""},
            ],
            temperature=0.1,
        )
        parsed = _parse_llm_json(response.choices[0].message.content)
        
        # Validation and normalization
        valid_codes = {
            "insufficient_funds", "bank_timeout", "card_expired",
            "mandate_declined", "checkout_dropoff", "invoice_overdue"
        }
        if not parsed.get("error_code") or parsed.get("error_code") not in valid_codes:
            parsed["error_code"] = "insufficient_funds"

        valid_types = {"subscription_renewal", "checkout_abandoned", "invoice_overdue"}
        if not parsed.get("transaction_type") or parsed.get("transaction_type") not in valid_types:
            parsed["transaction_type"] = "subscription_renewal"

        if not parsed.get("confidence_level"):
            parsed["confidence_level"] = "high"

        return parsed

    except Exception as e:
        logger.warning(f"Groq voice transcript parsing failed: {e}. Using deterministic fallback.")
        return _fallback_voice_parser(transcript, reference_date)


def _fallback_voice_response(
    extracted: dict,
    final_action: str,
    status: str,
    customer_name: str,
    guardrail_notes: str
) -> str:
    """Deterministic fallback voice response with warm human tone."""
    name_str = f"{customer_name} ji" if customer_name and customer_name != "Voice Customer" else "ji"
    p_date = extracted.get("promised_date")

    if final_action == "promise_to_pay" and p_date:
        return f"Aap bilkul chinta mat kijiye {name_str}! Humne aapka payment promise {p_date} tak record kar liya hai. Tab tak sabhi recovery reminders paused rahenge."
    elif final_action == "send_payment_link":
        return f"Ji bilkul {name_str}, humne aapke WhatsApp aur email par 1-click secure payment link bhej diya hai. Aap naye card se aasaani se pay kar sakte hain."
    elif final_action == "retry_payment":
        return f"Theek hai {name_str}, humne alternate standby route se auto-retry execute kar diya hai, aur aapka payment successfully pass ho gaya hai."
    elif final_action == "send_reminder_whatsapp":
        return f"Ji {name_str}! Humne aapke cart checkout ka WhatsApp reminder link bhej diya hai jisse aap easily order complete kar saken."
    elif final_action == "escalate_to_human":
        return f"Aapki account safety ke liye {name_str}, humne aapka case senior finance manager ko assign kar diya hai. Wo aapse turant connect karenge."
    elif final_action == "mark_unrecoverable":
        return f"Humne check kiya hai ki maximum retry limit reach ho chuki hai. Hamari collections team aapse personally connect karegi."
    else:
        return f"Dhanyawad {name_str}. Aapka payment status successfully update ho gaya hai."


def generate_hinglish_voice_response(
    transcript: str,
    extracted: dict,
    guardrail_notes: str,
    final_action: str,
    status: str,
    outcome_msg: str,
    customer_name: str = "Customer",
    history: list[dict] | None = None
) -> str:
    """
    Generates a natural, conversational Hinglish audio speech response based on the actual
    Policy Engine and Execution outcome, preserving multi-turn conversation context.
    """
    # Fast-path for automated pytest runs
    if "PYTEST_CURRENT_TEST" in os.environ:
        return _fallback_voice_response(extracted, final_action, status, customer_name, guardrail_notes)

    client = _get_groq_client()
    if client is None:
        return _fallback_voice_response(extracted, final_action, status, customer_name, guardrail_notes)

    messages = [{"role": "system", "content": VOICE_RESPONSE_SYSTEM_PROMPT}]

    # Include prior history turns if provided
    if history:
        for turn in history[-4:]:  # last 4 turns for context
            role = "user" if turn.get("role") == "user" else "assistant"
            text = turn.get("text", "")
            if text:
                messages.append({"role": role, "content": text})

    context_prompt = (
        f"Customer Just Spoke: \"{transcript}\"\n"
        f"Customer Name: {customer_name}\n"
        f"Extracted Issue: {extracted.get('error_code')} (Intent: {extracted.get('intent_summary')})\n"
        f"Promised Date: {extracted.get('promised_date') or 'None'}\n"
        f"Policy Engine Guardrail: {guardrail_notes}\n"
        f"Final Executed Action: {final_action}\n"
        f"Execution Outcome: {outcome_msg}\n\n"
        f"Speak naturally to the customer now in natural Hinglish (max 35 words, plain text only):"
    )
    messages.append({"role": "user", "content": context_prompt})

    try:
        response = client.chat.completions.create(
            model=PRIMARY_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=80,
        )
        content = response.choices[0].message.content.strip()
        # Clean up any surrounding quotes or markdown
        content = re.sub(r'^["\']|["\']$', '', content).strip()
        if content:
            return content
    except Exception as e:
        logger.warning(f"Groq voice response generation failed: {e}. Using deterministic fallback.")

    return _fallback_voice_response(extracted, final_action, status, customer_name, guardrail_notes)
