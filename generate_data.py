"""
Winback — Deterministic Synthetic Data Generator & Presentation Fixtures
Creates 150 reproducible failed payment records with fixed seed (zero randomness between runs).
Includes two dedicated, highlighted demo transactions at the top:
1. TXN-DEMO-001: Golden Recovery Success (Smart Retry inside NPCI mandate)
2. TXN-DEMO-002: Regulatory Policy Block (NPCI expired mandate intercepted & rerouted)
"""

import random
import string
from datetime import datetime, timedelta, timezone

from models import engine, Base, Transaction, SessionLocal

# ── Indian Customer Names Pool ──────────────────────────────────────────────
INDIAN_NAMES = [
    ("Aarav Sharma", "aarav.sharma@gmail.com"),
    ("Priya Patel", "priya.p@outlook.com"),
    ("Rohan Mehta", "rohan.mehta@yahoo.in"),
    ("Ananya Iyer", "ananya.iyer@gmail.com"),
    ("Vikram Singh", "vikram.singh@corporate.in"),
    ("Sneha Reddy", "sneha.reddy@techfirm.io"),
    ("Rahul Verma", "rahul.v@gmail.com"),
    ("Kavya Nambiar", "kavya.nambiar@startup.co"),
    ("Aditya Joshi", "aditya.j@bytemail.com"),
    ("Diya Deshmukh", "diya.d@gmail.com"),
    ("Siddharth Kapoor", "sid.kapoor@gmail.com"),
    ("Riya Nair", "riya.nair@hotmail.com"),
    ("Arjun Gupta", "arjun.gupta@fintech.in"),
    ("Ishita Agarwal", "ishita.a@workmail.com"),
    ("Devendra Choudhury", "dev.choudhury@gmail.com"),
]

TYPE_FAILURE_MAP = {
    "subscription_renewal": ["insufficient_funds", "card_expired", "bank_timeout", "mandate_declined"],
    "checkout_abandoned": ["checkout_dropoff", "insufficient_funds"],
    "invoice_overdue": ["invoice_overdue", "bank_timeout"],
}

NUM_RECORDS = 150


def get_demo_pair() -> list[dict]:
    """
    Returns the two perfect presentation demo transactions:
    1. TXN-DEMO-001 (Success): High-value ₹12,499.00 renewal with active mandate window -> Smart retry succeeds.
    2. TXN-DEMO-002 (Policy Block): ₹8,750.00 renewal with expired mandate window -> Intercepted by Rule 2 & rerouted to link.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    demo_success = {
        "txn_id": "TXN-DEMO-001",
        "customer_id": "cust_aarav_sharma",
        "customer_name": "Aarav Sharma",
        "customer_email": "aarav.sharma@gmail.com",
        "type": "subscription_renewal",
        "amount": 12499.00,
        "failure_code": "bank_timeout",
        "attempt_number": 1,
        "last_attempt_ts": now - timedelta(hours=2),
        "mandate_window_end": now + timedelta(days=5),
        "customer_contact_count_48h": 0,
        "status": "pending",
        "diagnosis": None,
        "recommended_action": None,
        "confidence": None,
        "guardrail_notes": None,
        "final_action_taken": None,
        "recovered_amount": 0.0,
        "processed_at": None,
    }

    demo_block = {
        "txn_id": "TXN-DEMO-002",
        "customer_id": "cust_priya_patel",
        "customer_name": "Priya Patel",
        "customer_email": "priya.p@outlook.com",
        "type": "subscription_renewal",
        "amount": 8750.00,
        "failure_code": "insufficient_funds",
        "attempt_number": 2,
        "last_attempt_ts": now - timedelta(hours=6),
        "mandate_window_end": now - timedelta(days=2),  # Expired mandate window!
        "customer_contact_count_48h": 0,
        "status": "pending",
        "diagnosis": None,
        "recommended_action": None,
        "confidence": None,
        "guardrail_notes": None,
        "final_action_taken": None,
        "recovered_amount": 0.0,
        "processed_at": None,
    }

    return [demo_success, demo_block]


def generate_transactions(n: int = NUM_RECORDS, seed: int = 42) -> list[dict]:
    """Generate deterministic batch of transactions with fixed seed."""
    rng = random.Random(seed)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    types = list(TYPE_FAILURE_MAP.keys())

    # Start with the two perfect demo transactions
    records = get_demo_pair()
    remaining_count = n - len(records)

    for i in range(remaining_count):
        idx = i + 3
        name, email = INDIAN_NAMES[i % len(INDIAN_NAMES)]
        txn_type = types[i % len(types)]
        failures = TYPE_FAILURE_MAP[txn_type]
        failure_code = failures[i % len(failures)]
        
        # Deterministic distributed amount calculation
        base_amt = 999.0 + ((i * 387.5) % 13500.0)
        amount = round(base_amt, 2)

        # Controlled deterministic distribution for guardrails:
        if i < 20:
            # Rule 1 triggers: attempt_number > 3 (e.g., 4 or 5)
            attempt_number = 4 if i % 2 == 0 else 5
            contact_count = 0 if i % 2 == 0 else 1
            mandate_window_end = now + timedelta(days=5) if txn_type == "subscription_renewal" else None
            failure_code = "insufficient_funds"
        elif i < 50:
            # Rule 2 triggers: subscription_renewal + past mandate_window_end
            txn_type = "subscription_renewal"
            failure_code = "insufficient_funds" if i % 2 == 0 else "bank_timeout"
            attempt_number = 1 if i % 2 == 0 else 2
            contact_count = 0
            mandate_window_end = now - timedelta(days=((i % 5) + 1))
        elif i < 75:
            # Rule 3 triggers: contact count >= 2
            attempt_number = 1
            contact_count = 2 if i % 2 == 0 else 3
            mandate_window_end = now + timedelta(days=4) if txn_type == "subscription_renewal" else None
        else:
            # Normal distribution
            attempt_number = 1 if i % 3 != 0 else 2
            contact_count = 0 if i % 4 != 0 else 1
            if txn_type == "subscription_renewal":
                mandate_window_end = now + timedelta(days=((i % 7) + 2))
            else:
                mandate_window_end = None

        last_attempt = now - timedelta(days=(i % 10 + 1), hours=(i % 24))
        txn_id = f"txn_det_{idx:03d}"
        cust_id = f"cust_det_{((i * 17) % 900) + 100}"

        records.append({
            "txn_id": txn_id,
            "customer_id": cust_id,
            "customer_name": name,
            "customer_email": email,
            "type": txn_type,
            "amount": amount,
            "failure_code": failure_code,
            "attempt_number": attempt_number,
            "last_attempt_ts": last_attempt,
            "mandate_window_end": mandate_window_end,
            "customer_contact_count_48h": contact_count,
            "status": "pending",
            "diagnosis": None,
            "recommended_action": None,
            "confidence": None,
            "guardrail_notes": None,
            "final_action_taken": None,
            "recovered_amount": 0.0,
            "processed_at": None,
        })

    return records


def seed_database(seed: int = 42):
    """Drop and reseed database with 150 deterministic transactions."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    records = generate_transactions(n=NUM_RECORDS, seed=seed)
    db = SessionLocal()

    for rec in records:
        db.add(Transaction(**rec))

    db.commit()
    db.close()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    outside = sum(1 for r in records if r["mandate_window_end"] and r["mandate_window_end"] < now)
    high_attempt = sum(1 for r in records if r["attempt_number"] > 3)
    high_contact = sum(1 for r in records if r["customer_contact_count_48h"] >= 2)
    total_val = sum(r['amount'] for r in records)

    print(f"[OK] Deterministically seeded {len(records)} transactions")
    print(f"  |-- Demo 1: {records[0]['txn_id']} (INR {records[0]['amount']:,.2f} - Expected: Success)")
    print(f"  |-- Demo 2: {records[1]['txn_id']} (INR {records[1]['amount']:,.2f} - Expected: Guardrail Block)")
    print(f"  |-- Outside mandate window: {outside}")
    print(f"  |-- Attempt > 3 (Rule 1 max retry block): {high_attempt}")
    print(f"  |-- Contact count >= 2 (Rule 3 contact cap): {high_contact}")
    print(f"  |-- Total INR at risk: INR {total_val:,.2f}")


def seed_demo_pair_database():
    """Drop and seed ONLY the two demo transactions for focused demonstration."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    records = get_demo_pair()
    db = SessionLocal()

    for rec in records:
        db.add(Transaction(**rec))

    db.commit()
    db.close()

    print(f"[OK] Seeded 2 demo transactions (Total: INR {sum(r['amount'] for r in records):,.2f})")


if __name__ == "__main__":
    seed_database()
