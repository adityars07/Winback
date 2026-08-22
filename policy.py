"""
Winback — Policy / Guardrail Engine
Pure-Python deterministic policy engine. No LLM calls.
Enforces business rules and overrides unsafe actions.
"""

from datetime import datetime
from models import Transaction


def apply_policy(txn: Transaction, recommended_action: str) -> tuple[str, str]:
    """
    Apply guardrail rules to a recommended action.
    
    Returns:
        (final_action, guardrail_notes) — the allowed/overridden action and explanation.
    
    Rules are evaluated in order; the first matching rule fires.
    """

    # Rule 1: Max retry attempts exceeded
    if txn.attempt_number > 3 and recommended_action == "retry_payment":
        return (
            "mark_unrecoverable",
            "⛔ Exceeded max retry attempts (3)."
        )

    # Rule 2: Outside NPCI mandate retry window
    if (
        txn.type == "subscription_renewal"
        and txn.mandate_window_end is not None
        and datetime.utcnow() > txn.mandate_window_end
        and recommended_action == "retry_payment"
    ):
        return (
            "send_payment_link",
            "⛔ Outside NPCI mandate retry window — cannot auto-retry, redirecting to manual payment link instead."
        )

    # Rule 3: Contact limit reached
    if (
        txn.customer_contact_count_48h >= 2
        and recommended_action in ("send_reminder_whatsapp", "send_payment_link")
    ):
        return (
            "escalate_to_human",
            "⛔ Contact limit reached (2 per 48h) — escalating instead of further outreach."
        )

    # Rule 4: No guardrail triggered
    return (
        recommended_action,
        "✅ No guardrail triggered — action approved as recommended."
    )
