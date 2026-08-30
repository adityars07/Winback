"""
Winback — Unit Tests for Hinglish Voice Recovery Agent Endpoint (/voice-intake)
Validates Speech-to-Compliance pipeline, Groq Hinglish extraction, Policy Engine
authority, Executor outcome, and natural Hinglish spoken audio response generation.
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


def test_voice_recovery_salary_delay_promise():
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
    assert "voice_agent_reply" in data
    assert len(data["voice_agent_reply"]) > 5

    # Check Audit event logged for AI Voice Agent Reply
    db = SessionLocal()
    txn_id = data["pipeline_result"]["txn_id"]
    voice_event = db.query(AuditEvent).filter(
        AuditEvent.txn_id == txn_id,
        AuditEvent.action == "voice_agent_reply"
    ).first()
    assert voice_event is not None
    assert "AI Voice Agent Spoke" in voice_event.details
    db.close()


def test_voice_recovery_card_expired_send_link():
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
    assert "link" in data["voice_agent_reply"].lower() or "whatsapp" in data["voice_agent_reply"].lower()


def test_voice_recovery_bank_timeout_auto_retry():
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


def test_voice_recovery_policy_block_max_retries_rule_1():
    _clean_db()
    # Customer asks for retry, but attempt count is already 4 (exceeds max limit 3)
    transcript = "Bhai ek aur baar retry karke dekh lo please, shayad is baar payment pass ho jaye."
    
    response = client.post("/voice-intake", json={
        "transcript": transcript,
        "customer_name": "Amit Kumar",
        "amount": 3200.0,
        "attempt_number": 4,
    })

    assert response.status_code == 200
    data = response.json()
    # Policy Engine overrides to mark_unrecoverable!
    assert data["pipeline_result"]["status"] == "unrecoverable"
    assert data["pipeline_result"]["final_action_taken"] == "mark_unrecoverable"
    assert "⛔" in data["pipeline_result"]["guardrail_notes"]
    assert "max retry" in data["pipeline_result"]["guardrail_notes"].lower()


def test_voice_recovery_policy_block_contact_limit_rule_3():
    _clean_db()
    # Customer asks for WhatsApp link, but already reached contact limit (2 in 48h)
    transcript = "Mera card expire hai, ek aur baar WhatsApp pe link drop kardo."
    
    response = client.post("/voice-intake", json={
        "transcript": transcript,
        "customer_name": "Deepak Shah",
        "amount": 2800.0,
        "attempt_number": 1,
        "customer_contact_count_48h": 2,
    })

    assert response.status_code == 200
    data = response.json()
    # Policy Engine overrides to escalate_to_human!
    assert data["pipeline_result"]["status"] == "escalated"
    assert data["pipeline_result"]["final_action_taken"] == "escalate_to_human"
    assert "⛔ Contact limit reached" in data["pipeline_result"]["guardrail_notes"]


def test_voice_recovery_checkout_dropoff_whatsapp_nudge():
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


def test_voice_recovery_b2b_large_invoice_escalation():
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
    assert data["pipeline_result"]["final_action_taken"] == "escalate_to_human"


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
    assert "voice_agent_reply" in data


def test_get_voice_intake_active_transactions():
    _clean_db()
    db = SessionLocal()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    t1 = Transaction(
        txn_id="txn_active_01",
        customer_id="cust_01",
        customer_name="Rohan Gupta",
        type="subscription_renewal",
        amount=12000.0,
        failure_code="insufficient_funds",
        last_attempt_ts=now,
        status="pending"
    )
    db.add(t1)
    db.commit()
    db.close()

    response = client.get("/voice-intake/active-transactions")
    assert response.status_code == 200
    data = response.json()
    assert "transactions" in data
    assert data["count"] >= 1
    assert any(t["txn_id"] == "txn_active_01" for t in data["transactions"])


def test_voice_intake_multi_turn_history():
    _clean_db()
    history = [
        {"role": "agent", "text": "Namaste Priya ji! Main Winback AI agent hoon."},
        {"role": "user", "text": "Mera card expire ho gaya hai pichle hafte."}
    ]
    response = client.post("/voice-intake", json={
        "transcript": "Haan WhatsApp pe link bhej do abhi pay kar deti hoon.",
        "customer_name": "Priya Patel",
        "amount": 3499.0,
        "history": history
    })
    assert response.status_code == 200
    data = response.json()
    assert "voice_agent_reply" in data
    assert data["pipeline_result"]["status"] in ["recovered", "promised", "escalated"]
