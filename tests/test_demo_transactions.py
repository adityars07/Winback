"""
Winback — Unit Tests for Demo Presentation Transactions
Ensures both demo transactions are 100% deterministic and follow exact expected paths:
- Demo 1 (TXN-DEMO-001): Golden Recovery Success (INR 12,499.00)
- Demo 2 (TXN-DEMO-002): NPCI Mandate Guardrail Block & Override (INR 8,750.00)
"""

import pytest
from datetime import datetime, timedelta

from models import Transaction
from generate_data import get_demo_pair
from diagnosis import _fallback_diagnosis
from policy import apply_policy
from executor import execute_action


def test_demo_pair_fixture():
    """Verify demo pair generation structure and amounts."""
    pair = get_demo_pair()
    assert len(pair) == 2
    
    d1, d2 = pair[0], pair[1]
    assert d1["txn_id"] == "TXN-DEMO-001"
    assert d1["customer_name"] == "Aarav Sharma"
    assert d1["amount"] == 12499.00
    assert d1["failure_code"] == "bank_timeout"
    assert d1["attempt_number"] == 1

    assert d2["txn_id"] == "TXN-DEMO-002"
    assert d2["customer_name"] == "Priya Patel"
    assert d2["amount"] == 8750.00
    assert d2["failure_code"] == "insufficient_funds"
    assert d2["attempt_number"] == 2


def test_demo_1_golden_recovery_pipeline():
    """Demo 1 Pipeline: Bank Timeout -> Recommend retry -> Policy Approved -> Recovered INR 12,499."""
    d1_dict = get_demo_pair()[0]
    txn = Transaction(**d1_dict)

    # 1. Diagnose
    diag = _fallback_diagnosis(txn)
    assert diag["recommended_action"] == "retry_payment"
    assert diag["confidence"] == "high"

    # 2. Guardrail Policy
    final_action, guardrail_notes = apply_policy(txn, diag["recommended_action"])
    assert final_action == "retry_payment"
    assert "✅" in guardrail_notes
    assert "No guardrail triggered" in guardrail_notes

    # 3. Execute
    outcome = execute_action(txn, final_action)
    assert outcome["success"] is True
    assert txn.status == "recovered"
    assert txn.recovered_amount == 12499.00
    assert txn.final_action_taken == "retry_payment"


def test_demo_2_guardrail_block_pipeline():
    """Demo 2 Pipeline: Mandate Expired -> AI wants retry -> Rule 2 Blocks & Overrides to Payment Link -> Compliant Execution."""
    d2_dict = get_demo_pair()[1]
    txn = Transaction(**d2_dict)

    # 1. Diagnose (AI thinks retry is standard for insufficient funds)
    diag = _fallback_diagnosis(txn)
    assert diag["recommended_action"] == "retry_payment"

    # 2. Guardrail Policy: INTERCEPT & BLOCK!
    final_action, guardrail_notes = apply_policy(txn, diag["recommended_action"])
    assert final_action == "send_payment_link"  # Overridden!
    assert "⛔" in guardrail_notes
    assert "Outside NPCI mandate retry window" in guardrail_notes

    # 3. Execute
    outcome = execute_action(txn, final_action)
    assert outcome["success"] is True  # Compliant link recovery succeeds
    assert txn.status == "recovered"
    assert txn.recovered_amount == 8750.00
    assert txn.final_action_taken == "send_payment_link"
    assert txn.customer_contact_count_48h == 1
