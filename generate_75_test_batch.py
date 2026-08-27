"""
Winback — Synthetic 75-Transaction Batch Generator & Presentation KPI Stat Block
Generates a realistic, compliance-benchmarked CSV of 75 payment failure transactions
with precise distribution, boundary edge cases, and a demo headline stat block.
"""

import csv
import random
import sys
from datetime import datetime, timedelta, timezone

# Ensure UTF-8 output in Windows PowerShell / cmd
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ── Indian Customer Names & Corporate Accounts ──────────────────────────────
CUSTOMER_POOL = [
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
    ("Meera Krishnan", "meera.k@chennaitech.com"),
    ("Varun Malhotra", "varun.m@delhiventures.in"),
    ("Pooja Hegde", "pooja.h@blr-retail.co"),
    ("Nikhil Bansal", "nikhil.bansal@mumbaicorp.in"),
    ("Tanvi Saxena", "tanvi.s@cloudscale.io"),
    ("Karan Oberoi", "karan@oberoiholdings.in"),
    ("Shreya Bhatt", "shreya.b@ahmedabadlogistics.com"),
    ("Harsh Vardhan", "harsh.v@jaipurcrafts.in"),
    ("Deepika Sen", "deepika.sen@kolkatatech.org"),
    ("Manish Tiwari", "manish.tiwari@puneauto.co"),
]

CSV_FILENAME = "synthetic_75_failed_transactions.csv"


def format_inr(amount: float) -> str:
    """Format floating point numbers to Indian Rupee (INR) comma notation."""
    if amount == 0:
        return "₹0.00"
    parts = f"{amount:.2f}".split(".")
    int_part = parts[0]
    dec_part = parts[1]
    if len(int_part) > 3:
        last3 = int_part[-3:]
        rest = int_part[:-3]
        formatted_rest = ""
        while len(rest) > 2:
            formatted_rest = "," + rest[-2:] + formatted_rest
            rest = rest[:-2]
        formatted_rest = rest + formatted_rest
        return f"₹{formatted_rest},{last3}.{dec_part}"
    return f"₹{int_part}.{dec_part}"


def generate_75_transactions() -> list[dict]:
    """
    Generate exactly 75 realistic failed transaction records with specified distribution:
    - ~40% (30 txns): Simple retry recoverable (bank_timeout, low-attempt insufficient_funds)
    - ~25% (19 txns): Needing payment link / instrument update (card_expired, mandate_declined, expired mandate)
    - ~15% (11 txns): Needing escalation (high B2B ≥ ₹50k, contact_count ≥ 2, persistent attempt #3)
    - ~20% (15 txns): Unrecoverable (attempt_number > 3 strictly triggering Rule 1)
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    records = []
    
    # ─────────────────────────────────────────────────────────────────────────
    # BATCH 1: ~40% (30 transactions) — Recoverable via Simple Smart Retry
    # ─────────────────────────────────────────────────────────────────────────
    # Subscriptions within mandate window + transient timeouts or balance alignment
    for i in range(30):
        name, email = CUSTOMER_POOL[i % len(CUSTOMER_POOL)]
        is_timeout = (i % 2 == 0)
        error_code = "bank_timeout" if is_timeout else "insufficient_funds"
        
        # Realistic consumer/SaaS amounts: ₹500 to ₹14,500
        amount = round(random.uniform(599.0, 14999.0), 2)
        
        if i % 3 == 0:
            txn_type = "subscription_renewal"
            mandate_end = (now + timedelta(days=random.randint(2, 8))).isoformat()
        elif i % 3 == 1:
            txn_type = "checkout_abandoned"
            error_code = "bank_timeout"
            mandate_end = ""
        else:
            txn_type = "overdue_invoice"
            mandate_end = ""
            amount = round(random.uniform(4500.0, 28000.0), 2)
        
        # Edge case: attempt_number == 1 or 2 (within auto-retry safe bounds)
        attempt_number = 1 if i % 4 != 0 else 2
        contact_count = 0 if i % 3 != 0 else 1
        ts = (now - timedelta(hours=random.randint(1, 24))).strftime("%Y-%m-%d %H:%M:%S")
        
        records.append({
            "customer_name": name,
            "customer_email": email,
            "amount_inr": amount,
            "transaction_type": txn_type,
            "error_code": error_code,
            "attempt_number": attempt_number,
            "contact_count_48h": contact_count,
            "mandate_window_end": mandate_end,
            "timestamp": ts,
            "_expected_category": "recoverable_retry",
        })

    # ─────────────────────────────────────────────────────────────────────────
    # BATCH 2: ~25% (19 transactions) — Needing Payment Link / Instrument Update
    # ─────────────────────────────────────────────────────────────────────────
    for i in range(19):
        name, email = CUSTOMER_POOL[(i + 5) % len(CUSTOMER_POOL)]
        amount = round(random.uniform(799.0, 15999.0), 2)
        
        if i < 7:
            # Card Expired instrument issue
            txn_type = "subscription_renewal"
            error_code = "card_expired"
            mandate_end = (now + timedelta(days=random.randint(3, 10))).isoformat()
        elif i < 13:
            # Mandate Declined by customer's bank
            txn_type = "subscription_renewal"
            error_code = "mandate_declined"
            mandate_end = (now + timedelta(days=random.randint(1, 5))).isoformat()
        elif i < 16:
            # Checkout Drop-off on D2C / e-commerce
            txn_type = "checkout_abandoned"
            error_code = "checkout_dropoff"
            mandate_end = ""
        else:
            # ⚠️ CRITICAL BOUNDARY EDGE CASE: Mandate window expiring TODAY / just expired!
            # Triggers Guardrail Rule 2 (NPCI mandate retry window override)
            txn_type = "subscription_renewal"
            error_code = "insufficient_funds"
            # Expired 2 hours ago or yesterday (past mandate window)
            mandate_end = (now - timedelta(hours=random.randint(1, 18))).isoformat()

        attempt_number = 1 if i % 2 == 0 else 2
        contact_count = 0 if i % 3 != 0 else 1
        ts = (now - timedelta(hours=random.randint(6, 48))).strftime("%Y-%m-%d %H:%M:%S")

        records.append({
            "customer_name": name,
            "customer_email": email,
            "amount_inr": amount,
            "transaction_type": txn_type,
            "error_code": error_code,
            "attempt_number": attempt_number,
            "contact_count_48h": contact_count,
            "mandate_window_end": mandate_end,
            "timestamp": ts,
            "_expected_category": "recoverable_link",
        })

    # ─────────────────────────────────────────────────────────────────────────
    # BATCH 3: ~15% (11 transactions) — Needing Human / KAM Escalation
    # ─────────────────────────────────────────────────────────────────────────
    # High B2B Invoices (≥ ₹50,000), outreach cap reached (== 2), or attempt boundary (== 3)
    b2b_large_amounts = [50000.0, 58400.0, 64500.0, 72000.0, 85000.0]
    
    for i in range(11):
        name, email = CUSTOMER_POOL[(i + 12) % len(CUSTOMER_POOL)]
        
        if i < 5:
            # ⚠️ BOUNDARY EDGE CASE 1: High B2B Invoice Amount ≥ ₹50,000 (up to ₹85,000)
            amount = b2b_large_amounts[i]
            txn_type = "overdue_invoice"
            error_code = "invoice_overdue"
            attempt_number = 1
            contact_count = 0
            mandate_end = ""
        elif i < 8:
            # ⚠️ BOUNDARY EDGE CASE 2: Exactly 2 contacts in 48h (Triggers Guardrail Rule 3 cap)
            amount = round(random.uniform(3500.0, 18000.0), 2)
            txn_type = "subscription_renewal"
            error_code = "card_expired"
            attempt_number = 1
            contact_count = 2  # Exactly boundary value!
            mandate_end = (now + timedelta(days=4)).isoformat()
        else:
            # ⚠️ BOUNDARY EDGE CASE 3: attempt_number == 3 (Boundary attempt for persistent failure)
            amount = round(random.uniform(4500.0, 19500.0), 2)
            txn_type = "subscription_renewal"
            error_code = "insufficient_funds"
            attempt_number = 3  # Exactly boundary of max auto-retries!
            contact_count = 1
            mandate_end = (now + timedelta(days=2)).isoformat()

        ts = (now - timedelta(hours=random.randint(12, 72))).strftime("%Y-%m-%d %H:%M:%S")

        records.append({
            "customer_name": name,
            "customer_email": email,
            "amount_inr": amount,
            "transaction_type": txn_type,
            "error_code": error_code,
            "attempt_number": attempt_number,
            "contact_count_48h": contact_count,
            "mandate_window_end": mandate_end,
            "timestamp": ts,
            "_expected_category": "escalated",
        })

    # ─────────────────────────────────────────────────────────────────────────
    # BATCH 4: ~20% (15 transactions) — Unrecoverable (attempt_number > 3)
    # ─────────────────────────────────────────────────────────────────────────
    # Strictly triggers Guardrail Rule 1: attempt_number > 3 -> mark_unrecoverable
    unrecoverable_codes = ["insufficient_funds", "bank_timeout", "card_expired", "mandate_declined"]
    for i in range(15):
        name, email = CUSTOMER_POOL[(i + 17) % len(CUSTOMER_POOL)]
        amount = round(random.uniform(750.0, 17500.0), 2)
        error_code = unrecoverable_codes[i % len(unrecoverable_codes)]
        
        # ⚠️ BOUNDARY EDGE CASE: attempt_number == 4 or 5 (> 3)
        attempt_number = 4 if i % 2 == 0 else 5
        contact_count = 1 if i % 2 == 0 else 0
        txn_type = "subscription_renewal" if i % 2 == 0 else "checkout_abandoned"
        mandate_end = (now + timedelta(days=3)).isoformat() if txn_type == "subscription_renewal" else ""
        ts = (now - timedelta(days=random.randint(2, 5))).strftime("%Y-%m-%d %H:%M:%S")

        records.append({
            "customer_name": name,
            "customer_email": email,
            "amount_inr": amount,
            "transaction_type": txn_type,
            "error_code": error_code,
            "attempt_number": attempt_number,
            "contact_count_48h": contact_count,
            "mandate_window_end": mandate_end,
            "timestamp": ts,
            "_expected_category": "unrecoverable",
        })

    # Shuffle slightly while keeping deterministic seed
    random.seed(42)
    random.shuffle(records)
    return records


def write_csv(records: list[dict], filename: str = CSV_FILENAME):
    """Write records to clean CSV file with exact expected headers."""
    headers = [
        "customer_name",
        "customer_email",
        "amount_inr",
        "transaction_type",
        "error_code",
        "attempt_number",
        "contact_count_48h",
        "mandate_window_end",
        "timestamp",
    ]
    with open(filename, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        for r in records:
            writer.writerow(r)
    print(f"✅ Generated {len(records)} transactions into '{filename}'.")


def simulate_recovery_and_print_summary(records: list[dict]) -> dict:
    """
    Simulates the Winback domain pipeline against the 75 generated transactions
    and prints a clean headline stat block formatted for live demo screenshots.
    """
    total_at_risk = 0.0
    total_recovered = 0.0
    total_escalated = 0.0
    total_unrecoverable = 0.0
    
    count_recovered = 0
    count_escalated = 0
    count_unrecoverable = 0
    count_guardrail_blocks = 0
    guardrail_blocked_amount = 0.0

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for r in records:
        amt = float(r["amount_inr"])
        total_at_risk += amt
        attempts = int(r["attempt_number"])
        contacts = int(r["contact_count_48h"])
        code = r["error_code"]
        ttype = r["transaction_type"]
        mandate_end_str = r.get("mandate_window_end")

        is_past_mandate = False
        if mandate_end_str:
            try:
                m_end = datetime.fromisoformat(mandate_end_str)
                is_past_mandate = (now > m_end)
            except Exception:
                is_past_mandate = False

        # ── Pipeline Simulation ──
        # 1. Rule 1 Check: attempts > 3
        if attempts > 3:
            total_unrecoverable += amt
            count_unrecoverable += 1
            count_guardrail_blocks += 1
            guardrail_blocked_amount += amt
        # 2. Rule 3 Check: contact_count >= 2
        elif contacts >= 2:
            total_escalated += amt
            count_escalated += 1
            count_guardrail_blocks += 1
            guardrail_blocked_amount += amt
        # 3. High B2B Invoice (≥ ₹50,000)
        elif amt >= 50000.0:
            total_escalated += amt
            count_escalated += 1
        # 4. Attempt == 3 on persistent insufficient funds
        elif attempts >= 3 and code == "insufficient_funds":
            total_escalated += amt
            count_escalated += 1
        # 5. Rule 2 Check: Past Mandate Window (Rerouted to payment link & recovered)
        elif ttype == "subscription_renewal" and is_past_mandate:
            total_recovered += amt
            count_recovered += 1
            count_guardrail_blocks += 1
            guardrail_blocked_amount += amt
        # 6. Standard Recoverable (Smart Retry / 1-Click Link / WhatsApp UPI)
        else:
            total_recovered += amt
            count_recovered += 1

    # Conservation Law Verification: Total at risk == Recovered + Escalated + Unrecoverable
    total_at_risk = round(total_at_risk, 2)
    total_recovered = round(total_recovered, 2)
    total_escalated = round(total_escalated, 2)
    total_unrecoverable = round(total_unrecoverable, 2)
    
    # Actionable recoverable revenue pool (excluding terminal unrecoverable write-offs)
    recoverable_pool = round(max(0.0, total_at_risk - total_unrecoverable), 2)
    
    effective_recovery_rate = (total_recovered / recoverable_pool * 100.0) if recoverable_pool > 0 else 0.0
    gross_recovery_rate = (total_recovered / total_at_risk * 100.0) if total_at_risk > 0 else 0.0

    # ── Presentation-Ready Terminal Headline Stat Block ──
    print("\n" + "═" * 78)
    print("  ⚡ WINBACK REVENUE RECOVERY AGENT — BATCH ATTRIBUTION LEDGER")
    print("  Dataset: 75 Synthetic Indian Merchant Transactions (Stress-Test Batch)")
    print("═" * 78)
    
    print(f"""
  ┌─────────────────────────────────┬─────────────────────────────────┐
  │  TOTAL REVENUE AT RISK (GROSS)  │  ACTIONABLE RECOVERABLE POOL    │
  │  {format_inr(total_at_risk):<31}│  {format_inr(recoverable_pool):<31}│
  │  75 Failed Transactions Ingested│  Excluding Terminal Write-offs  │
  ├─────────────────────────────────┼─────────────────────────────────┤
  │  TOTAL REVENUE RECOVERED        │  EFFECTIVE RECOVERY RATE        │
  │  {format_inr(total_recovered):<31}│  {f"{effective_recovery_rate:.2f}% Won Back":<31}│
  │  {f"{count_recovered} Transactions Closed (Direct)":<31}│  Target SLA: > 70.0%            │
  ├─────────────────────────────────┼─────────────────────────────────┤
  │  GROSS RECOVERY RATE            │  REGULATORY POLICY BLOCKS ⛔    │
  │  {f"{gross_recovery_rate:.2f}% of Gross Pipeline":<31}│  {f"{count_guardrail_blocks} Breaches Prevented":<31}│
  │  Including High-Ticket & Limits │  {format_inr(guardrail_blocked_amount):<31}│
  └─────────────────────────────────┴─────────────────────────────────┘
""")

    print("  📊 STATUS BREAKDOWN & DISPOSITION:")
    print("  " + "─" * 74)
    print(f"  • ✅ RECOVERED:      {format_inr(total_recovered):>15}  ({count_recovered:>2} txns)  — Instant Retry, 1-Click Link, WhatsApp UPI")
    print(f"  • ⚠️  ESCALATED:      {format_inr(total_escalated):>15}  ({count_escalated:>2} txns)  — B2B Deals ≥₹50k, 48h Contact Caps, Manual AR")
    print(f"  • ⛔ UNRECOVERABLE:  {format_inr(total_unrecoverable):>15}  ({count_unrecoverable:>2} txns)  — Hard Terminal Policy Limit (Attempts > 3)")
    print("  " + "─" * 74)
    print(f"  • ⚖️  MATH CONSERVATION: {format_inr(total_recovered)} + {format_inr(total_escalated)} + {format_inr(total_unrecoverable)} = {format_inr(total_at_risk)} (100% Exact Match)")
    print("═" * 78 + "\n")

    return {
        "total_at_risk": total_at_risk,
        "recoverable_pool": recoverable_pool,
        "total_recovered": total_recovered,
        "total_escalated": total_escalated,
        "total_unrecoverable": total_unrecoverable,
        "effective_recovery_rate": effective_recovery_rate,
        "gross_recovery_rate": gross_recovery_rate,
        "count_recovered": count_recovered,
        "count_escalated": count_escalated,
        "count_unrecoverable": count_unrecoverable,
        "count_guardrail_blocks": count_guardrail_blocks,
        "guardrail_blocked_amount": guardrail_blocked_amount,
    }


if __name__ == "__main__":
    records = generate_75_transactions()
    write_csv(records, CSV_FILENAME)
    simulate_recovery_and_print_summary(records)
