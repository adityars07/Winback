"""
Winback — Integration Verification Test for Deterministic Batch Execution & Mathematical Defensibility
"""

import pytest
from generate_data import seed_database
from models import SessionLocal, Transaction
from app import run_batch, _compute_summary


def test_full_batch_deterministic_execution_and_math():
    # 1. Reseed deterministic database
    seed_database(seed=42)

    db = SessionLocal()
    try:
        # Pre-execution checks
        initial_txns = db.query(Transaction).all()
        assert len(initial_txns) == 150
        
        initial_summary = _compute_summary(db)
        assert initial_summary["total_at_risk"] == 1117326.0
        assert initial_summary["total_recovered"] == 0.0
        assert initial_summary["status_counts"]["pending"] == 150

        # Execute recovery batch
        result = run_batch(db)

        # 2. Check no transactions left in pending state
        assert result["status_counts"]["pending"] == 0

        # 3. Mathematical conservation
        total_at_risk = result["total_at_risk"]
        status_amt = result["status_amounts"]
        sum_of_buckets = round(status_amt["recovered"] + status_amt["escalated"] + status_amt["unrecoverable"] + status_amt["pending"], 2)
        assert sum_of_buckets == total_at_risk

        # 4. Recoverable revenue = total_at_risk - unrecoverable
        assert result["recoverable_revenue"] == round(total_at_risk - status_amt["unrecoverable"], 2)

        # 5. Recovery bounds
        assert 0 < result["total_recovered"] <= result["recoverable_revenue"] <= total_at_risk

        # 6. Recovery rates
        assert result["effective_recovery_rate"] > 0
        assert result["gross_recovery_rate"] > 0
        assert result["effective_recovery_rate"] >= result["gross_recovery_rate"]

        # 7. Check Demo 1 (Success)
        d1 = db.query(Transaction).filter(Transaction.txn_id == "TXN-DEMO-001").first()
        assert d1 is not None
        assert d1.status == "recovered"
        assert d1.recovered_amount == 12499.00
        assert "✅" in d1.guardrail_notes

        # 8. Check Demo 2 (Policy Block)
        d2 = db.query(Transaction).filter(Transaction.txn_id == "TXN-DEMO-002").first()
        assert d2 is not None
        assert "⛔" in d2.guardrail_notes
        assert "Outside NPCI mandate retry window" in d2.guardrail_notes
        assert d2.final_action_taken == "send_payment_link"
        assert d2.status == "recovered"
        assert d2.recovered_amount == 8750.00

        # 9. Guardrail Policy Blocks
        assert result["guardrail_blocks"] > 0
        assert result["guardrail_blocked_amount"] > 0

        print(f"\n[PASS] Verified Batch Summary:")
        print(f"  Total at Risk:        INR {result['total_at_risk']:,.2f}")
        print(f"  Recoverable Revenue:  INR {result['recoverable_revenue']:,.2f}")
        print(f"  Revenue Recovered:    INR {result['total_recovered']:,.2f}")
        print(f"  Effective Recovery:   {result['effective_recovery_rate']}%")
        print(f"  Gross Recovery:       {result['gross_recovery_rate']}%")
        print(f"  Policy Blocks:        {result['guardrail_blocks']} (Safeguarding INR {result['guardrail_blocked_amount']:,.2f})")
        print(f"  Status Counts:        {result['status_counts']}")
        print(f"  Status Amounts:       {result['status_amounts']}")

    finally:
        db.close()
