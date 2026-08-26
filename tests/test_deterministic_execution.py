"""
Winback — Unit Tests for Deterministic Execution Engine
Ensures zero randomness and strict terminal state semantics for all recovery actions.
"""

import pytest
from datetime import datetime, timedelta, timezone
from models import Transaction
from executor import execute_action


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def create_txn(**kwargs) -> Transaction:
    defaults = {
        "txn_id": "txn_test_det",
        "customer_id": "cust_test_det",
        "customer_name": "Deterministic Test User",
        "customer_email": "user@test.io",
        "type": "subscription_renewal",
        "amount": 4999.0,
        "failure_code": "bank_timeout",
        "attempt_number": 1,
        "last_attempt_ts": _now(),
        "mandate_window_end": _now() + timedelta(days=5),
        "customer_contact_count_48h": 0,
        "status": "pending",
        "recovered_amount": 0.0,
    }
    defaults.update(kwargs)
    return Transaction(**defaults)


def test_retry_bank_timeout_success():
    """Transient bank_timeout on attempt 1 succeeds deterministically."""
    txn = create_txn(failure_code="bank_timeout", attempt_number=1, amount=3500.0)
    outcome = execute_action(txn, "retry_payment")

    assert outcome["success"] is True
    assert txn.status == "recovered"
    assert txn.recovered_amount == 3500.0
    assert txn.attempt_number == 2
    assert "RECOVERED" in outcome["message"]


def test_retry_insufficient_funds_attempt_1_success():
    """insufficient_funds on attempt 1 succeeds upon salary/buffer alignment."""
    txn = create_txn(failure_code="insufficient_funds", attempt_number=1, amount=1999.0)
    outcome = execute_action(txn, "retry_payment")

    assert outcome["success"] is True
    assert txn.status == "recovered"
    assert txn.recovered_amount == 1999.0


def test_retry_insufficient_funds_attempt_3_escalates():
    """insufficient_funds on attempt 3 fails retry deterministically and escalates."""
    txn = create_txn(failure_code="insufficient_funds", attempt_number=3, amount=2499.0)
    outcome = execute_action(txn, "retry_payment")

    assert outcome["success"] is False
    assert txn.status == "escalated"
    assert txn.recovered_amount == 0.0
    assert txn.attempt_number == 4


def test_send_payment_link_success():
    """Payment link sent for card_expired with contact count 0 succeeds."""
    txn = create_txn(failure_code="card_expired", customer_contact_count_48h=0, amount=2999.0)
    outcome = execute_action(txn, "send_payment_link")

    assert outcome["success"] is True
    assert txn.status == "recovered"
    assert txn.recovered_amount == 2999.0
    assert txn.customer_contact_count_48h == 1


def test_send_payment_link_high_ticket_escalates():
    """High-ticket enterprise invoice >= 50,000 escalates to Account Executive."""
    txn = create_txn(type="invoice_overdue", failure_code="invoice_overdue", amount=75000.0)
    outcome = execute_action(txn, "send_payment_link")

    assert outcome["success"] is False
    assert txn.status == "escalated"
    assert txn.recovered_amount == 0.0


def test_send_reminder_whatsapp_success():
    """WhatsApp reminder for checkout_dropoff succeeds."""
    txn = create_txn(type="checkout_abandoned", failure_code="checkout_dropoff", amount=1299.0)
    outcome = execute_action(txn, "send_reminder_whatsapp")

    assert outcome["success"] is True
    assert txn.status == "recovered"
    assert txn.recovered_amount == 1299.0
    assert txn.customer_contact_count_48h == 1


def test_escalate_to_human_outcome():
    """Direct escalation marks status as escalated with 0 recovered."""
    txn = create_txn(amount=8500.0)
    outcome = execute_action(txn, "escalate_to_human")

    assert outcome["success"] is False
    assert txn.status == "escalated"
    assert txn.recovered_amount == 0.0


def test_mark_unrecoverable_outcome():
    """Unrecoverable marks status as unrecoverable with 0 recovered."""
    txn = create_txn(amount=6000.0)
    outcome = execute_action(txn, "mark_unrecoverable")

    assert outcome["success"] is False
    assert txn.status == "unrecoverable"
    assert txn.recovered_amount == 0.0


def test_repeated_execution_is_100_percent_identical():
    """Running execute_action 50 times on identical transactions gives 100% identical outputs (zero RNG)."""
    for _ in range(50):
        t1 = create_txn(failure_code="bank_timeout", attempt_number=1, amount=5000.0)
        o1 = execute_action(t1, "retry_payment")
        assert o1["success"] is True
        assert t1.status == "recovered"
        assert t1.recovered_amount == 5000.0
