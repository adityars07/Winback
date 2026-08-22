"""
Winback — Action Executor (simulated)
Simulates payment recovery actions with configurable success rates.
"""

import random
from models import Transaction

# Success rates for each action type
ACTION_SUCCESS_RATES = {
    "retry_payment": 0.70,
    "send_payment_link": 0.40,
    "send_reminder_whatsapp": 0.25,
}


def execute_action(txn: Transaction, final_action: str) -> dict:
    """
    Execute a recovery action (simulated).
    Mutates the transaction object in-place and returns an outcome dict.
    """
    outcome = {
        "action": final_action,
        "txn_id": txn.txn_id,
        "customer_id": txn.customer_id,
        "amount": txn.amount,
        "success": False,
        "message": "",
    }

    if final_action == "retry_payment":
        success = random.random() < ACTION_SUCCESS_RATES["retry_payment"]
        txn.attempt_number += 1
        if success:
            txn.status = "recovered"
            txn.recovered_amount = txn.amount
            outcome["success"] = True
            outcome["message"] = f"✅ Retried payment for ₹{txn.amount:,.2f} — SUCCESS"
        else:
            outcome["message"] = f"❌ Retried payment for ₹{txn.amount:,.2f} — FAILED (will retry in next batch)"

    elif final_action == "send_payment_link":
        txn.customer_contact_count_48h += 1
        success = random.random() < ACTION_SUCCESS_RATES["send_payment_link"]
        if success:
            txn.status = "recovered"
            txn.recovered_amount = txn.amount
            outcome["success"] = True
            outcome["message"] = f"✅ Sent payment link to {txn.customer_id} for ₹{txn.amount:,.2f} — RECOVERED"
        else:
            outcome["message"] = f"📩 Sent payment link to {txn.customer_id} for ₹{txn.amount:,.2f} — awaiting response"

    elif final_action == "send_reminder_whatsapp":
        txn.customer_contact_count_48h += 1
        success = random.random() < ACTION_SUCCESS_RATES["send_reminder_whatsapp"]
        if success:
            txn.status = "recovered"
            txn.recovered_amount = txn.amount
            outcome["success"] = True
            outcome["message"] = f"✅ Sent WhatsApp reminder to {txn.customer_id} for ₹{txn.amount:,.2f} — RECOVERED"
        else:
            outcome["message"] = f"💬 Sent WhatsApp reminder to {txn.customer_id} for ₹{txn.amount:,.2f} — awaiting response"

    elif final_action == "escalate_to_human":
        txn.status = "escalated"
        outcome["message"] = f"🧑‍💼 Escalated {txn.txn_id} (₹{txn.amount:,.2f}) to human agent"

    elif final_action == "mark_unrecoverable":
        txn.status = "unrecoverable"
        outcome["message"] = f"🚫 Marked {txn.txn_id} (₹{txn.amount:,.2f}) as unrecoverable"

    else:
        outcome["message"] = f"⚠️ Unknown action '{final_action}' for {txn.txn_id}"

    txn.final_action_taken = final_action

    # Log to console
    status_label = txn.status.upper()
    print(f"[ACTION] {txn.txn_id}: {final_action} → {txn.customer_id} for ₹{txn.amount:,.2f} — outcome: {status_label}")

    return outcome
