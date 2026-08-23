"""
Winback — Synthetic data generator
Creates 150 realistic failed/at-risk payment records.
Guarantees transactions that trigger all 3 guardrails visibly for hackathon demo.
"""

import random
import string
from datetime import datetime, timedelta

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

AMOUNTS_RANGE = (199, 15000)
NUM_RECORDS = 150


def _rand_id(prefix: str, length: int = 6) -> str:
    chars = string.ascii_letters + string.digits
    return f"{prefix}_{''.join(random.choices(chars, k=length))}"


def _random_ts(days_back: int = 14) -> datetime:
    now = datetime.utcnow()
    delta = timedelta(seconds=random.randint(0, days_back * 86400))
    return now - delta


def generate_transactions(n: int = NUM_RECORDS) -> list[dict]:
    records = []
    types = list(TYPE_FAILURE_MAP.keys())
    now = datetime.utcnow()

    # Rule 1 triggers: attempt_number > 3 (e.g., 4 or 5)
    # Rule 2 triggers: subscription_renewal + past mandate_window_end
    # Rule 3 triggers: customer_contact_count_48h >= 2

    for i in range(n):
        name, email = random.choice(INDIAN_NAMES)
        txn_type = random.choice(types)
        failure_code = random.choice(TYPE_FAILURE_MAP[txn_type])
        amount = round(random.uniform(*AMOUNTS_RANGE), 2)
        
        # Controlled distribution for guardrails
        if i < 25:
            # Force Rule 1 candidate (attempt_number > 3)
            attempt_number = random.choice([4, 5])
            contact_count = random.choice([0, 1])
            mandate_window_end = now + timedelta(days=5) if txn_type == "subscription_renewal" else None
        elif i < 55:
            # Force Rule 2 candidate (expired mandate window for subscription renewal)
            txn_type = "subscription_renewal"
            failure_code = random.choice(["insufficient_funds", "bank_timeout"])
            attempt_number = random.choice([1, 2])
            contact_count = random.choice([0, 1])
            mandate_window_end = now - timedelta(days=random.randint(1, 7))
        elif i < 85:
            # Force Rule 3 candidate (contact count >= 2)
            attempt_number = random.choice([1, 2])
            contact_count = random.choice([2, 3])
            mandate_window_end = now + timedelta(days=5) if txn_type == "subscription_renewal" else None
        else:
            # Normal mix
            attempt_number = random.choices([1, 2, 3, 4], weights=[50, 30, 15, 5])[0]
            contact_count = random.choices([0, 1, 2], weights=[50, 35, 15])[0]
            if txn_type == "subscription_renewal":
                mandate_window_end = now + timedelta(days=random.randint(-3, 10))
            else:
                mandate_window_end = None

        last_attempt = _random_ts(14)

        records.append({
            "txn_id": _rand_id("txn"),
            "customer_id": _rand_id("cust"),
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


def seed_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    records = generate_transactions()
    db = SessionLocal()

    for rec in records:
        db.add(Transaction(**rec))

    db.commit()
    db.close()

    now = datetime.utcnow()
    outside = sum(1 for r in records if r["mandate_window_end"] and r["mandate_window_end"] < now)
    high_attempt = sum(1 for r in records if r["attempt_number"] > 3)
    high_contact = sum(1 for r in records if r["customer_contact_count_48h"] >= 2)

    print(f"[OK] Seeded {len(records)} transactions")
    print(f"  |-- Outside mandate window: {outside}")
    print(f"  |-- Attempt > 3 (will trigger max-retry guardrail): {high_attempt}")
    print(f"  |-- Contact count >= 2 (will trigger contact-limit guardrail): {high_contact}")
    print(f"  |-- Total INR at risk: {sum(r['amount'] for r in records):,.2f}")


if __name__ == "__main__":
    seed_database()
