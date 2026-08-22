"""
Winback — Diagnosis Agent
Calls Groq LLM (llama-3.3-70b-versatile) to diagnose payment failures.
"""

import json
import os
from groq import Groq
from models import Transaction

SYSTEM_PROMPT = """You are a payment recovery diagnosis assistant for a fintech platform. Given a failed transaction record, classify the likely root cause and recommend exactly one recovery action from this fixed list: retry_payment, send_payment_link, send_reminder_whatsapp, escalate_to_human, mark_unrecoverable.

Rules:
- If failure_code is insufficient_funds or bank_timeout and attempt_number < 3, prefer retry_payment.
- If failure_code is card_expired or mandate_declined, prefer send_payment_link.
- If failure_code is checkout_dropoff, prefer send_reminder_whatsapp.
- If attempt_number >= 3 or customer_contact_count_48h >= 2, prefer escalate_to_human or mark_unrecoverable.
- You do not decide whether the action is actually allowed — that is handled by a separate policy engine. Just give your best recommendation.

Respond with ONLY a JSON object with keys: diagnosis, recommended_action, confidence. No other text."""

VALID_ACTIONS = {
    "retry_payment",
    "send_payment_link",
    "send_reminder_whatsapp",
    "escalate_to_human",
    "mark_unrecoverable",
}


def _txn_to_dict(txn: Transaction) -> dict:
    """Convert a transaction ORM object to a dict for the LLM prompt."""
    return {
        "txn_id": txn.txn_id,
        "customer_id": txn.customer_id,
        "type": txn.type,
        "amount": txn.amount,
        "failure_code": txn.failure_code,
        "attempt_number": txn.attempt_number,
        "last_attempt_ts": txn.last_attempt_ts.isoformat() if txn.last_attempt_ts else None,
        "mandate_window_end": txn.mandate_window_end.isoformat() if txn.mandate_window_end else None,
        "customer_contact_count_48h": txn.customer_contact_count_48h,
    }


def diagnose_transaction(txn: Transaction) -> dict:
    """
    Call Groq LLM to diagnose a failed transaction.
    Returns dict with keys: diagnosis, recommended_action, confidence.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY environment variable is not set")

    client = Groq(api_key=api_key)
    txn_dict = _txn_to_dict(txn)

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

    # Validate the action is in the allowed set
    if result.get("recommended_action") not in VALID_ACTIONS:
        result["recommended_action"] = "escalate_to_human"
        result["diagnosis"] = result.get("diagnosis", "Unable to diagnose — defaulting to escalation.")
        result["confidence"] = "low"

    return result
