"""
Winback — Unit Tests for Policy Engine (Guardrails)
"""

import pytest
from datetime import datetime, timedelta
from models import Transaction
from policy import apply_policy


def create_mock_txn(**kwargs) -> Transaction:
    defaults = {
        "txn_id": "txn_test_123",
        "customer_id": "cust_123",
        "customer_name": "Test Customer",
        "customer_email": "test@example.com",
        "type": "subscription_renewal",
        "amount": 1499.0,
        "failure_code": "insufficient_funds",
        "attempt_number": 1,
        "last_attempt_ts": datetime.utcnow(),
        "mandate_window_end": datetime.utcnow() + timedelta(days=5),
        "customer_contact_count_48h": 0,
        "status": "pending",
    }
    defaults.update(kwargs)
    return Transaction(**defaults)


def test_rule_1_max_retries_exceeded():
    """Rule 1: If attempt_number > 3 and action is retry_payment -> override to mark_unrecoverable"""
    txn = create_mock_txn(attempt_number=4)
    final_action, note = apply_policy(txn, "retry_payment")

    assert final_action == "mark_unrecoverable"
    assert "Exceeded max retry attempts (3)" in note
    assert "⛔" in note


def test_rule_1_attempt_3_allowed():
    """Attempt number == 3 should NOT trigger max retries rule"""
    txn = create_mock_txn(attempt_number=3)
    final_action, note = apply_policy(txn, "retry_payment")

    assert final_action == "retry_payment"
    assert "No guardrail triggered" in note


def test_rule_2_mandate_window_expired():
    """Rule 2: Subscription renewal past mandate_window_end + retry_payment -> override to send_payment_link"""
    past_date = datetime.utcnow() - timedelta(days=2)
    txn = create_mock_txn(
        type="subscription_renewal",
        mandate_window_end=past_date,
        attempt_number=1
    )
    final_action, note = apply_policy(txn, "retry_payment")

    assert final_action == "send_payment_link"
    assert "Outside NPCI mandate retry window" in note
    assert "⛔" in note


def test_rule_2_mandate_window_valid():
    """Subscription renewal inside mandate_window_end -> allowed"""
    future_date = datetime.utcnow() + timedelta(days=2)
    txn = create_mock_txn(
        type="subscription_renewal",
        mandate_window_end=future_date,
        attempt_number=1
    )
    final_action, note = apply_policy(txn, "retry_payment")

    assert final_action == "retry_payment"
    assert "No guardrail triggered" in note


def test_rule_3_contact_limit_reached_whatsapp():
    """Rule 3: contact count >= 2 + send_reminder_whatsapp -> override to escalate_to_human"""
    txn = create_mock_txn(customer_contact_count_48h=2)
    final_action, note = apply_policy(txn, "send_reminder_whatsapp")

    assert final_action == "escalate_to_human"
    assert "Contact limit reached (2 per 48h)" in note
    assert "⛔" in note


def test_rule_3_contact_limit_reached_link():
    """Rule 3: contact count >= 2 + send_payment_link -> override to escalate_to_human"""
    txn = create_mock_txn(customer_contact_count_48h=3)
    final_action, note = apply_policy(txn, "send_payment_link")

    assert final_action == "escalate_to_human"
    assert "Contact limit reached (2 per 48h)" in note
    assert "⛔" in note


def test_no_guardrail_triggered():
    """Normal transaction passes through untouched"""
    txn = create_mock_txn(attempt_number=1, customer_contact_count_48h=0)
    final_action, note = apply_policy(txn, "send_payment_link")

    assert final_action == "send_payment_link"
    assert "No guardrail triggered" in note
    assert "✅" in note


def test_rule_priority_rule_1_over_rule_3():
    """Rule 1 (max retries) takes precedence over Rule 3 (contact limit) when both conditions match"""
    txn = create_mock_txn(attempt_number=4, customer_contact_count_48h=2)
    final_action, note = apply_policy(txn, "retry_payment")

    assert final_action == "mark_unrecoverable"
    assert "Exceeded max retry attempts (3)" in note
