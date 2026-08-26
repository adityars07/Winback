"""
Winback — Action Executor (Deterministic Domain Engine)
Executes payment recovery actions deterministically based on payment domain rules,
NPCI regulations, and customer engagement state. No random number generators.
"""

from models import Transaction


def execute_action(txn: Transaction, final_action: str) -> dict:
    """
    Execute a recovery action with 100% deterministic domain semantics.
    Mutates the transaction object in-place and guarantees a clean terminal state:
    'recovered', 'escalated', or 'unrecoverable' (never left pending).
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
        txn.attempt_number += 1
        
        # Deterministic retry resolution:
        # 1. Transient bank timeouts on attempts 1-3 always clear on smart retry.
        # 2. Insufficient funds on attempt 1-2 within mandate window clears upon salary/buffer sync.
        # 3. Attempt >= 3 on insufficient funds fails gateway retry and escalates to manual desk.
        if txn.failure_code == "bank_timeout" and txn.attempt_number <= 3:
            txn.status = "recovered"
            txn.recovered_amount = txn.amount
            outcome["success"] = True
            outcome["message"] = f"Smart gateway retry #{txn.attempt_number} succeeded on standby banking route for INR {txn.amount:,.2f} - RECOVERED"
        elif txn.failure_code == "insufficient_funds" and txn.attempt_number <= 2:
            txn.status = "recovered"
            txn.recovered_amount = txn.amount
            outcome["success"] = True
            outcome["message"] = f"Smart mandate retry #{txn.attempt_number} aligned with balance buffer for INR {txn.amount:,.2f} - RECOVERED"
        elif txn.failure_code == "insufficient_funds" and txn.attempt_number >= 3:
            txn.status = "escalated"
            txn.recovered_amount = 0.0
            outcome["success"] = False
            outcome["message"] = f"Auto-retry #{txn.attempt_number} declined (persistent insufficient funds) - routed to manual collection desk for INR {txn.amount:,.2f}"
        else:
            # Other transient failures on low attempt count
            if txn.attempt_number <= 2:
                txn.status = "recovered"
                txn.recovered_amount = txn.amount
                outcome["success"] = True
                outcome["message"] = f"NPCI auto-retry #{txn.attempt_number} processed successfully for INR {txn.amount:,.2f} - RECOVERED"
            else:
                txn.status = "escalated"
                txn.recovered_amount = 0.0
                outcome["success"] = False
                outcome["message"] = f"Retry attempt #{txn.attempt_number} failed - escalated to finance ops for INR {txn.amount:,.2f}"

    elif final_action == "send_payment_link":
        txn.customer_contact_count_48h += 1
        
        # High-value enterprise invoices (>= 50k) require custom purchase-order human AR workflow
        if txn.amount >= 50000.0:
            txn.status = "escalated"
            txn.recovered_amount = 0.0
            outcome["success"] = False
            outcome["message"] = f"Payment link dispatched for high-ticket invoice (INR {txn.amount:,.2f}) - escalated to Key Account Manager for verification"
        elif txn.customer_contact_count_48h > 2:
            txn.status = "escalated"
            txn.recovered_amount = 0.0
            outcome["success"] = False
            outcome["message"] = f"Payment link sent to {txn.customer_id} - contact buffer limit reached (escalated to avoid spam)"
        else:
            txn.status = "recovered"
            txn.recovered_amount = txn.amount
            outcome["success"] = True
            outcome["message"] = f"Sent dynamic 1-click Razorpay payment link to {txn.customer_id} for INR {txn.amount:,.2f} - instrument updated & RECOVERED"

    elif final_action == "send_reminder_whatsapp":
        txn.customer_contact_count_48h += 1
        
        if txn.customer_contact_count_48h > 2:
            txn.status = "escalated"
            txn.recovered_amount = 0.0
            outcome["success"] = False
            outcome["message"] = f"WhatsApp reminder sent to {txn.customer_id} - customer contact frequency cap reached (escalated)"
        else:
            txn.status = "recovered"
            txn.recovered_amount = txn.amount
            outcome["success"] = True
            outcome["message"] = f"Sent interactive WhatsApp UPI 1-click intent to {txn.customer_id} for INR {txn.amount:,.2f} - converted & RECOVERED"

    elif final_action == "escalate_to_human":
        txn.status = "escalated"
        txn.recovered_amount = 0.0
        outcome["success"] = False
        outcome["message"] = f"Escalated transaction {txn.txn_id} (INR {txn.amount:,.2f}) to dedicated finance operations team"

    elif final_action == "mark_unrecoverable":
        txn.status = "unrecoverable"
        txn.recovered_amount = 0.0
        outcome["success"] = False
        outcome["message"] = f"Marked {txn.txn_id} (INR {txn.amount:,.2f}) as unrecoverable (terminal policy limit reached)"

    else:
        txn.status = "escalated"
        txn.recovered_amount = 0.0
        outcome["success"] = False
        outcome["message"] = f"Unknown action '{final_action}' for {txn.txn_id} - routed to human queue"

    txn.final_action_taken = final_action

    status_label = txn.status.upper()
    print(f"[ACTION] {txn.txn_id}: {final_action} -> {txn.customer_id} for INR {txn.amount:,.2f} - outcome: {status_label}")

    return outcome
