"""
Winback — Synthetic data generator
Creates 100 realistic failed/at-risk payment records.
Ensures at least 20% are outside their mandate window for guardrail demo.
"""

import random
import string
import uuid
from datetime import datetime, timedelta

from models import engine, Base, Transaction, SessionLocal

# ── Helpers ──────────────────────────────────────────────────────────────────

def _rand_id(prefix: str, length: int = 6) -> str:
    chars = string.ascii_letters + string.digits
    return f"{prefix}_{''.join(random.choices(chars, k=length))}"


def _random_ts(days_back: int = 14) -> datetime:
    now = datetime.utcnow()
    delta = timedelta(seconds=random.randint(0, days_back * 86400))
    return now - delta


# ── Configuration ────────────────────────────────────────────────────────────

TYPE_FAILURE_MAP = {
    "subscription_renewal": ["insufficient_funds", "card_expired", "bank_timeout", "mandate_declined"],
    "checkout_abandoned": ["checkout_dropoff", "insufficient_funds"],
    "invoice_overdue": ["invoice_overdue", "bank_timeout"],
}

AMOUNTS_RANGE = (199, 15000)
NUM_RECORDS = 100
MIN_OUTSIDE_MANDATE_PCT = 0.25  # at least 25% outside mandate window


# ── Generator ────────────────────────────────────────────────────────────────

def generate_transactions(n: int = NUM_RECORDS) -> list[dict]:
    records = []
    types = list(TYPE_FAILURE_MAP.keys())
    now = datetime.utcnow()

    # Ensure enough subscription_renewal records for mandate window demo
    # At least 30 subscription renewals so 25% of total can be outside mandate
    type_distribution = (
        ["subscription_renewal"] * 35
        + ["checkout_abandoned"] * 35
        + ["invoice_overdue"] * 30
    )
    random.shuffle(type_distribution)

    outside_mandate_count = 0
    target_outside = int(n * MIN_OUTSIDE_MANDATE_PCT)

    for i in range(n):
        txn_type = type_distribution[i] if i < len(type_distribution) else random.choice(types)
        failure_code = random.choice(TYPE_FAILURE_MAP[txn_type])
        amount = round(random.uniform(*AMOUNTS_RANGE), 2)
        attempt_number = random.choices([1, 2, 3, 4], weights=[40, 30, 20, 10])[0]
        contact_count = random.choices([0, 1, 2, 3], weights=[35, 30, 25, 10])[0]
        last_attempt = _random_ts(14)

        # Mandate window logic — only for subscription_renewal
        mandate_window_end = None
        if txn_type == "subscription_renewal":
            if outside_mandate_count < target_outside:
                # Force outside mandate window (expired 1-5 days ago)
                mandate_window_end = now - timedelta(days=random.randint(1, 5), hours=random.randint(0, 23))
                outside_mandate_count += 1
            else:
                # Inside mandate window (expires 1-10 days from now)
                mandate_window_end = now + timedelta(days=random.randint(1, 10))

        records.append({
            "txn_id": _rand_id("txn"),
            "customer_id": _rand_id("cust"),
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
            "guardrail_notes": None,
            "final_action_taken": None,
            "recovered_amount": 0.0,
        })

    return records


def seed_database():
    # Drop and recreate
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    records = generate_transactions()
    db = SessionLocal()

    for rec in records:
        db.add(Transaction(**rec))

    db.commit()
    db.close()

    # Print summary stats
    outside = sum(1 for r in records if r["mandate_window_end"] and r["mandate_window_end"] < datetime.utcnow())
    high_attempt = sum(1 for r in records if r["attempt_number"] > 3)
    high_contact = sum(1 for r in records if r["customer_contact_count_48h"] >= 2)

    print(f"[OK] Seeded {len(records)} transactions")
    print(f"  |-- Outside mandate window: {outside}")
    print(f"  |-- Attempt > 3 (will trigger max-retry guardrail): {high_attempt}")
    print(f"  |-- Contact count >= 2 (will trigger contact-limit guardrail): {high_contact}")
    print(f"  |-- Total INR at risk: {sum(r['amount'] for r in records):,.2f}")


if __name__ == "__main__":
    seed_database()
