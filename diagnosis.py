"""
Winback — Diagnosis Agent
Calls Groq LLM (llama-3.3-70b-versatile) to diagnose payment failures.
Includes exponential backoff retry and fallback heuristic for maximum resilience.
"""

import json
import os
import time
import logging
from groq import Groq
from models import Transaction

logger = logging.getLogger("winback.diagnosis")

SYSTEM_PROMPT = """You are a payment recovery diagnosis assistant for a fintech platform. Given a failed transaction record, classify the likely root cause and recommend exactly one recovery action from this fixed list: retry_payment, send_payment_link, send_reminder_whatsapp, escalate_to_human, mark_unrecoverable.

Rules:
- If failure_code is insufficient_funds or bank_timeout and attempt_number < 3, prefer retry_payment.
- If failure_code is card_expired or mandate_declined, prefer send_payment_link.
- If failure_code is checkout_dropoff, prefer send_reminder_whatsapp.
- If attempt_number >= 3 or customer_contact_count_48h >= 2, prefer escalate_to_human or mark_unrecoverable.
- You do not decide whether the action is actually allowed — that is handled by a separate policy engine. Just give your best recommendation.

Respond with ONLY a JSON object with keys: diagnosis, recommended_action, confidence (high/medium/low). No other text."""

VALID_ACTIONS = {
    "retry_payment",
    "send_payment_link",
    "send_reminder_whatsapp",
    "escalate_to_human",
    "mark_unrecoverable",
}


def _txn_to_dict(txn: Transaction) -> dict:
    return {
        "txn_id": txn.txn_id,
        "customer_id": txn.customer_id,
        "customer_name": txn.customer_name,
        "type": txn.type,
        "amount": txn.amount,
        "failure_code": txn.failure_code,
        "attempt_number": txn.attempt_number,
        "last_attempt_ts": txn.last_attempt_ts.isoformat() if txn.last_attempt_ts else None,
        "mandate_window_end": txn.mandate_window_end.isoformat() if txn.mandate_window_end else None,
        "customer_contact_count_48h": txn.customer_contact_count_48h,
    }


def _fallback_diagnosis(txn: Transaction, reason: str = "Rule-based heuristic") -> dict:
    """Fallback diagnosis engine when LLM API is unavailable or rate limited."""
    code = txn.failure_code
    attempts = txn.attempt_number
    contacts = txn.customer_contact_count_48h

    if attempts >= 3 or contacts >= 2:
        action = "escalate_to_human"
        diagnosis = f"Multiple attempts ({attempts}) or contacts ({contacts}) recorded. Escalating for manual intervention."
        confidence = "medium"
    elif code in ("insufficient_funds", "bank_timeout") and attempts < 3:
        action = "retry_payment"
        diagnosis = f"Transient {code.replace('_', ' ')} error on attempt #{attempts}. Auto-retry recommended."
        confidence = "high"
    elif code in ("card_expired", "mandate_declined"):
        action = "send_payment_link"
        diagnosis = f"Instrument issue ({code.replace('_', ' ')}). Customer needs to update payment details via link."
        confidence = "high"
    elif code == "checkout_dropoff":
        action = "send_reminder_whatsapp"
        diagnosis = "Checkout session abandoned by customer. Nudge via WhatsApp recommended."
        confidence = "high"
    else:
        action = "escalate_to_human"
        diagnosis = f"Unresolved {code} issue. Escalated to human operator."
        confidence = "low"

    return {
        "diagnosis": f"{diagnosis} [{reason}]",
        "recommended_action": action,
        "confidence": confidence,
    }


def diagnose_transaction(txn: Transaction) -> dict:
    """
    Call Groq LLM with retry & fallback.
    Returns dict: {diagnosis, recommended_action, confidence}
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key or api_key == "your_key_here":
        logger.warning(f"GROQ_API_KEY not configured. Using fallback heuristic for {txn.txn_id}.")
        return _fallback_diagnosis(txn, reason="LLM API key not set")

    txn_dict = _txn_to_dict(txn)
    max_retries = 3

    for attempt in range(max_retries):
        try:
            client = Groq(api_key=api_key)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(txn_dict)},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )

            result = json.loads(response.choices[0].message.content)

            # Validate output keys & actions
            action = result.get("recommended_action")
            if action not in VALID_ACTIONS:
                result["recommended_action"] = "escalate_to_human"
                result["confidence"] = "low"

            if not result.get("confidence"):
                result["confidence"] = "medium"

            return result

        except Exception as e:
            logger.warning(f"Groq API attempt {attempt + 1}/{max_retries} failed for {txn.txn_id}: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)

    # Fall back if all retries fail
    logger.error(f"All Groq retries failed for {txn.txn_id}. Engaging fallback heuristic.")
    return _fallback_diagnosis(txn, reason="LLM API retry limit reached")
