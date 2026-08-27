"""
Winback — Unit Tests for Hinglish Voice-Note Recovery Intake Endpoint (/voice-intake)
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


def test_get_voice_samples():
    response = client.get("/voice-intake/samples")
    assert response.status_code == 200
    data = response.json()
    assert "samples" in data
    assert len(data["samples"]) == 5
    assert data["samples"][0]["expected_action"] == "promise_to_pay"


def test_voice_intake_salary_delay_promise():
    _clean_db()
    transcript = "Bhai mera payment fail ho gaya, account mein balance nahi tha. Kal meri salary aayegi, 28 tarikh ko phir se retry karna, pakka ho jayega."
    
    response = client.post("/voice-intake", json={
        "transcript": transcript,
        "customer_name": "Aarav Sharma",
        "amount": 4999.0
    })

    assert response.status_code == 200
    data = response.json()
    assert data["extracted_data"]["error_code"] == "insufficient_funds"
    assert data["extracted_data"]["promised_date"] is not None
    assert data["pipeline_result"]["status"] == "promised"
    assert data["pipeline_result"]["final_action_taken"] == "promise_to_pay"
    assert "dunning paused" in data["pipeline_result"]["outcome_message"].lower()

    # Check Audit event logged
    db = SessionLocal()
    txn_id = data["pipeline_result"]["txn_id"]
    detect_event = db.query(AuditEvent).filter(AuditEvent.txn_id == txn_id, AuditEvent.stage == "DETECT").first()
    assert detect_event is not None
    assert "Ingested via Hinglish Voice Note" in detect_event.details
    db.close()


def test_voice_intake_card_expired_send_link():
    _clean_db()
    transcript = "Arre mera HDFC card expire ho gaya hai pichle hafte. Naya payment link WhatsApp pe bhej do, main naye card se abhi pay kar deta hoon."
    
    response = client.post("/voice-intake", json={
        "transcript": transcript,
        "customer_name": "Priya Patel",
        "amount": 2499.0
    })

    assert response.status_code == 200
    data = response.json()
    assert data["extracted_data"]["error_code"] == "card_expired"
    assert data["pipeline_result"]["status"] == "recovered"
    assert data["pipeline_result"]["final_action_taken"] == "send_payment_link"
    assert data["pipeline_result"]["recovered_amount"] == 2499.0


def test_voice_intake_bank_timeout_auto_retry():
    _clean_db()
    transcript = "Maine UPI PIN daala tha par SBI ka server timeout ho gaya. Paisa nahi kata mere bank se, ek baar standby route se auto-retry maar do."
    
    response = client.post("/voice-intake", json={
        "transcript": transcript,
        "customer_name": "Rohan Mehta",
        "amount": 1299.0
    })

    assert response.status_code == 200
    data = response.json()
    assert data["extracted_data"]["error_code"] == "bank_timeout"
    assert data["pipeline_result"]["status"] == "recovered"
    assert data["pipeline_result"]["final_action_taken"] == "retry_payment"


def test_voice_intake_checkout_dropoff_whatsapp_nudge():
    _clean_db()
    transcript = "Checkout pe OTP late aaya toh maine window band kar di thi. Cart mein ₹3,450 ka saman hai, koi working coupon ya Razorpay link WhatsApp pe drop karo."
    
    response = client.post("/voice-intake", json={
        "transcript": transcript,
        "customer_name": "Ananya Iyer",
        "amount": 3450.0
    })

    assert response.status_code == 200
    data = response.json()
    assert data["extracted_data"]["error_code"] == "checkout_dropoff"
    assert data["pipeline_result"]["status"] == "recovered"
    assert data["pipeline_result"]["final_action_taken"] == "send_reminder_whatsapp"


def test_voice_intake_b2b_large_invoice_escalation():
    _clean_db()
    transcript = "Hamara ₹65,000 ka corporate annual invoice pending hai. Hamari finance team vendor onboarding verify kar rahi hai, accounts manager se baat karwao please."
    
    response = client.post("/voice-intake", json={
        "transcript": transcript,
        "customer_name": "Vikram Enterprises",
        "amount": 65000.0
    })

    assert response.status_code == 200
    data = response.json()
    assert data["extracted_data"]["error_code"] == "invoice_overdue"
    assert data["pipeline_result"]["status"] == "escalated"
    assert data["pipeline_result"]["final_action_taken"] in ("escalate_to_human", "send_payment_link")
    assert data["pipeline_result"]["status"] == "escalated"


def test_voice_intake_for_existing_transaction():
    _clean_db()
    # Create an existing pending transaction
    db = SessionLocal()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    existing_txn = Transaction(
        txn_id="txn_existing_voice_01",
        customer_id="cust_existing_01",
        customer_name="Existing User",
        customer_email="existing@test.com",
        type="subscription_renewal",
        amount=8500.0,
        failure_code="bank_timeout",
        attempt_number=1,
        last_attempt_ts=now,
        mandate_window_end=now + timedelta(days=5),
        status="pending"
    )
    db.add(existing_txn)
    db.commit()
    db.close()

    # Customer sends voice note saying card is expired
    response = client.post("/voice-intake", json={
        "txn_id": "txn_existing_voice_01",
        "transcript": "Mera card expire ho gaya hai, link bhej do payment ke liye."
    })

    assert response.status_code == 200
    data = response.json()
    assert data["pipeline_result"]["txn_id"] == "txn_existing_voice_01"
    assert data["pipeline_result"]["failure_code"] == "card_expired"
    assert data["pipeline_result"]["final_action_taken"] == "send_payment_link"
    assert data["pipeline_result"]["status"] == "recovered"
