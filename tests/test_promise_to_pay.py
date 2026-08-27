"""
Winback — Unit & Integration Tests for 'promise_to_pay' Action,
Webhook Ingestion, Time-Passing Evaluation Engine, and Broken Promise Guardrails.
"""

import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app import app
from models import SessionLocal, Transaction, AuditEvent, init_db

client = TestClient(app)


def _clean_db():
    init_db()
    db = SessionLocal()
    db.query(AuditEvent).delete()
    db.query(Transaction).delete()
    db.commit()
    db.close()


def _create_txn(txn_id: str, amount: float = 4999.0, attempt_number: int = 1, contact_count: int = 0, status: str = "pending", failure_code: str = "insufficient_funds") -> Transaction:
    db = SessionLocal()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    txn = Transaction(
        txn_id=txn_id,
        customer_id=f"cust_{txn_id}",
        customer_name=f"Customer {txn_id}",
        customer_email=f"{txn_id}@test.com",
        type="subscription_renewal",
        amount=amount,
        failure_code=failure_code,
        attempt_number=attempt_number,
        last_attempt_ts=now,
        mandate_window_end=now + timedelta(days=5),
        customer_contact_count_48h=contact_count,
        status=status,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    db.close()
    return txn


def test_promise_webhook_ingestion():
    _clean_db()
    txn = _create_txn("txn_prom_001", amount=5000.0)

    # 1. Post promise to webhook endpoint
    promise_date = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d")
    response = client.post("/webhook/promise-to-pay", json={
        "transaction_id": txn.txn_id,
        "promised_date": promise_date
    })

    assert response.status_code == 200
    data = response.json()
    assert data["transaction"]["status"] == "promised"
    assert data["transaction"]["final_action_taken"] == "promise_to_pay"
    assert data["transaction"]["promise_date"] is not None
    assert "promised" in data["summary"]["status_counts"]
    assert data["summary"]["status_counts"]["promised"] == 1

    # 2. Check audit event logged
    db = SessionLocal()
    event = db.query(AuditEvent).filter(AuditEvent.txn_id == "txn_prom_001", AuditEvent.action == "promise_to_pay").first()
    assert event is not None
    assert event.stage == "EXECUTE"
    assert "Automated dunning paused" in event.details
    db.close()


def test_promised_transaction_paused_from_standard_batch():
    _clean_db()
    # Create 1 pending txn and 1 promised txn
    _create_txn("txn_pending_01", amount=2000.0, status="pending")
    _create_txn("txn_promised_01", amount=3000.0, status="promised")

    # Run regular batch
    batch_res = client.post("/run-batch")
    assert batch_res.status_code == 200
    batch_data = batch_res.json()

    # Only 1 pending transaction should have been processed
    assert batch_data["processed"] == 1
    
    # Promised txn should remain 'promised' and untouched
    db = SessionLocal()
    prom_txn = db.query(Transaction).filter(Transaction.txn_id == "txn_promised_01").first()
    assert prom_txn.status == "promised"
    assert prom_txn.recovered_amount == 0.0
    db.close()


def test_promise_fulfillment_evaluation():
    _clean_db()
    _create_txn("txn_prom_fulfill", amount=7500.0, status="promised")
    
    # Set promise date in the past to trigger evaluation
    db = SessionLocal()
    t = db.query(Transaction).filter(Transaction.txn_id == "txn_prom_fulfill").first()
    t.promise_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    db.commit()
    db.close()

    # Simulate evaluation where customer paid
    eval_res = client.post("/promises/evaluate", json={
        "simulate_paid_txn_ids": ["txn_prom_fulfill"]
    })

    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["evaluated_count"] == 1
    assert eval_data["results"][0]["status"] == "recovered"
    assert eval_data["summary"]["total_recovered"] == 7500.0

    # Verify audit event for fulfillment
    db = SessionLocal()
    event = db.query(AuditEvent).filter(AuditEvent.txn_id == "txn_prom_fulfill", AuditEvent.action == "promise_fulfilled").first()
    assert event is not None
    assert event.stage == "EXECUTE"
    assert "Promise fulfilled" in event.details
    db.close()


def test_broken_promise_reentry_pipeline():
    _clean_db()
    _create_txn("txn_prom_broken_1", amount=3500.0, attempt_number=1, status="promised")
    
    # Set promise date in the past
    db = SessionLocal()
    t = db.query(Transaction).filter(Transaction.txn_id == "txn_prom_broken_1").first()
    t.promise_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2)
    db.commit()
    db.close()

    # Evaluate broken promise (simulate_default_paid = False)
    eval_res = client.post("/promises/evaluate", json={
        "simulate_default_paid": False
    })

    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["evaluated_count"] == 1
    
    db = SessionLocal()
    updated_txn = db.query(Transaction).filter(Transaction.txn_id == "txn_prom_broken_1").first()
    assert updated_txn.is_broken_promise == 1
    assert updated_txn.attempt_number == 2  # Incremented from 1 to 2
    assert "Broken Promise" in updated_txn.diagnosis
    assert updated_txn.status in ("recovered", "escalated", "unrecoverable")
    
    # Verify audit trace of broken promise detection & re-entry
    broken_event = db.query(AuditEvent).filter(AuditEvent.txn_id == "txn_prom_broken_1", AuditEvent.action == "broken_promise").first()
    assert broken_event is not None
    assert broken_event.stage == "DETECT"
    db.close()


def test_broken_promise_triggers_rule_1_max_retries():
    _clean_db()
    # Transaction with attempt_number == 3 (Boundary)
    _create_txn("txn_prom_max_retry", amount=4200.0, attempt_number=3, status="promised")
    
    db = SessionLocal()
    t = db.query(Transaction).filter(Transaction.txn_id == "txn_prom_max_retry").first()
    t.promise_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    db.commit()
    db.close()

    # Evaluate broken promise -> attempt_number increments from 3 to 4 -> Rule 1 triggers!
    eval_res = client.post("/promises/evaluate", json={
        "simulate_default_paid": False
    })
    assert eval_res.status_code == 200

    db = SessionLocal()
    t = db.query(Transaction).filter(Transaction.txn_id == "txn_prom_max_retry").first()
    assert t.attempt_number == 4
    assert t.status == "unrecoverable"
    assert "⛔" in t.guardrail_notes
    assert "Exceeded max retry attempts (3)" in t.guardrail_notes
    db.close()


def test_broken_promise_triggers_rule_3_contact_limit():
    _clean_db()
    # Customer already contacted 2 times in 48h (Rule 3 cap) with card_expired needing payment link
    _create_txn("txn_prom_contact_cap", amount=6000.0, attempt_number=1, contact_count=2, status="promised", failure_code="card_expired")
    
    db = SessionLocal()
    t = db.query(Transaction).filter(Transaction.txn_id == "txn_prom_contact_cap").first()
    t.promise_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    db.commit()
    db.close()

    # Evaluate broken promise -> LLM tries link/reminder -> Rule 3 overrides to escalate_to_human!
    eval_res = client.post("/promises/evaluate", json={
        "simulate_default_paid": False
    })
    assert eval_res.status_code == 200

    db = SessionLocal()
    t = db.query(Transaction).filter(Transaction.txn_id == "txn_prom_contact_cap").first()
    assert t.status == "escalated"
    assert t.final_action_taken == "escalate_to_human"
    assert "⛔ Contact limit reached" in t.guardrail_notes
    db.close()


def test_broken_promise_rate_metric_and_csv_export():
    _clean_db()
    # Create 2 promises: 1 fulfilled, 1 broken
    _create_txn("txn_rate_1", amount=1000.0, status="promised")
    _create_txn("txn_rate_2", amount=2000.0, status="promised")
    
    past = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    db = SessionLocal()
    t1 = db.query(Transaction).filter(Transaction.txn_id == "txn_rate_1").first()
    t2 = db.query(Transaction).filter(Transaction.txn_id == "txn_rate_2").first()
    t1.promise_date = past
    t2.promise_date = past
    db.commit()
    db.close()

    # Evaluate: txn_rate_1 fulfilled (paid), txn_rate_2 broken (unpaid)
    client.post("/promises/evaluate", json={
        "simulate_paid_txn_ids": ["txn_rate_1"]
    })

    # Check /summary metric
    sum_res = client.get("/summary")
    assert sum_res.status_code == 200
    sdata = sum_res.json()
    assert sdata["total_promises"] == 2
    assert sdata["broken_promises"] == 1
    assert sdata["broken_promise_rate"] == 50.0  # 1/2 = 50.0%

    # Check CSV export headers and rows
    csv_res = client.get("/export/csv")
    assert csv_res.status_code == 200
    csv_text = csv_res.text
    assert "Promise Date" in csv_text
    assert "Is Broken Promise" in csv_text
    assert "txn_rate_1" in csv_text
    assert "txn_rate_2" in csv_text
