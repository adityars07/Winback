"""
Winback — Unit Tests for Defensible Mathematical Metrics & Conservation Laws
Ensures:
1. Conservation of Revenue: total_at_risk == recovered_amount + escalated_amount + unrecoverable_amount + pending_amount
2. Recoverable Revenue: recoverable_revenue == total_at_risk - unrecoverable_amount
3. Mathematical Bounds: 0 <= total_recovered <= recoverable_revenue <= total_at_risk
4. Guardrail metrics: guardrail_blocks and guardrail_blocked_amount
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta, timezone

from models import Base, Transaction
from app import _compute_summary


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture
def memory_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    yield db
    db.close()


def test_metrics_empty_database(memory_db):
    """Empty database produces safe zeros without division errors."""
    summary = _compute_summary(memory_db)
    assert summary["total_at_risk"] == 0.0
    assert summary["recoverable_revenue"] == 0.0
    assert summary["total_recovered"] == 0.0
    assert summary["recovery_rate"] == 0.0
    assert summary["effective_recovery_rate"] == 0.0
    assert summary["gross_recovery_rate"] == 0.0
    assert summary["guardrail_blocks"] == 0
    assert summary["guardrail_blocked_amount"] == 0.0
    assert summary["total_transactions"] == 0


def test_metrics_conservation_law(memory_db):
    """Revenue conservation equation must hold exactly."""
    txns = [
        Transaction(
            txn_id="t1", customer_id="c1", type="subscription_renewal",
            amount=10000.0, failure_code="bank_timeout", status="recovered",
            recovered_amount=10000.0, last_attempt_ts=_now()
        ),
        Transaction(
            txn_id="t2", customer_id="c2", type="subscription_renewal",
            amount=5000.0, failure_code="insufficient_funds", status="escalated",
            recovered_amount=0.0, last_attempt_ts=_now()
        ),
        Transaction(
            txn_id="t3", customer_id="c3", type="subscription_renewal",
            amount=3000.0, failure_code="insufficient_funds", status="unrecoverable",
            recovered_amount=0.0, last_attempt_ts=_now(),
            guardrail_notes="⛔ Exceeded max retry attempts (3)."
        ),
        Transaction(
            txn_id="t4", customer_id="c4", type="checkout_abandoned",
            amount=2000.0, failure_code="checkout_dropoff", status="pending",
            recovered_amount=0.0, last_attempt_ts=_now()
        ),
    ]
    for t in txns:
        memory_db.add(t)
    memory_db.commit()

    summary = _compute_summary(memory_db)

    # 1. Total at Risk
    expected_at_risk = 20000.0
    assert summary["total_at_risk"] == expected_at_risk

    # 2. Conservation Law: sum(status_amounts) == total_at_risk
    status_amt = summary["status_amounts"]
    calculated_sum = status_amt["recovered"] + status_amt["escalated"] + status_amt["unrecoverable"] + status_amt["pending"]
    assert round(calculated_sum, 2) == expected_at_risk

    # 3. Recoverable Revenue = total_at_risk - unrecoverable
    expected_recoverable = 20000.0 - 3000.0  # 17000.0
    assert summary["recoverable_revenue"] == expected_recoverable

    # 4. Total Recovered
    assert summary["total_recovered"] == 10000.0

    # 5. Effective Recovery Rate = (10000 / 17000) * 100 = 58.82%
    expected_effective_rate = round((10000.0 / 17000.0) * 100, 2)
    assert summary["effective_recovery_rate"] == expected_effective_rate
    assert summary["recovery_rate"] == expected_effective_rate

    # 6. Gross Recovery Rate = (10000 / 20000) * 100 = 50.00%
    expected_gross_rate = 50.0
    assert summary["gross_recovery_rate"] == expected_gross_rate

    # 7. Guardrail Blocks and Blocked Amount
    assert summary["guardrail_blocks"] == 1
    assert summary["guardrail_blocked_amount"] == 3000.0

    # 8. Exact inequality bounds
    assert 0 <= summary["total_recovered"] <= summary["recoverable_revenue"] <= summary["total_at_risk"]
