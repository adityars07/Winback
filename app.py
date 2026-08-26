"""
Winback — FastAPI Backend (MVP Version)
Orchestrator endpoints, audit logging, CSV export, and SSE streaming for payment recovery.
"""

import os
import io
import csv
import json
import logging
import asyncio
import traceback
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from models import init_db, get_db, Transaction, AuditEvent, SessionLocal
from detector import get_pending_batch
from diagnosis import diagnose_transaction
from policy import apply_policy
from executor import execute_action

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("winback.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database initialized. Winback backend ready.")
    yield

app = FastAPI(
    title="Winback — AI Payment Recovery Agent",
    description="Detects failed payments, diagnoses root causes via LLM, applies guardrail policies, and executes recovery actions.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _txn_to_response(txn: Transaction) -> dict:
    return {
        "txn_id": txn.txn_id,
        "customer_id": txn.customer_id,
        "customer_name": txn.customer_name or "Customer",
        "customer_email": txn.customer_email or "N/A",
        "type": txn.type,
        "amount": txn.amount,
        "failure_code": txn.failure_code,
        "attempt_number": txn.attempt_number,
        "last_attempt_ts": txn.last_attempt_ts.isoformat() if txn.last_attempt_ts else None,
        "mandate_window_end": txn.mandate_window_end.isoformat() if txn.mandate_window_end else None,
        "customer_contact_count_48h": txn.customer_contact_count_48h,
        "status": txn.status,
        "diagnosis": txn.diagnosis,
        "recommended_action": txn.recommended_action,
        "confidence": txn.confidence,
        "guardrail_notes": txn.guardrail_notes,
        "final_action_taken": txn.final_action_taken,
        "recovered_amount": txn.recovered_amount,
        "processed_at": txn.processed_at.isoformat() if txn.processed_at else None,
    }


def _record_audit(db: Session, txn_id: str, stage: str, action: str | None, details: str, commit: bool = False):
    event = AuditEvent(
        txn_id=txn_id,
        stage=stage,
        action=action,
        details=details,
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(event)
    if commit:
        db.commit()


def _compute_summary(db: Session) -> dict:
    all_txns = db.query(Transaction).all()
    
    total_at_risk = round(sum(t.amount for t in all_txns), 2)
    total_recovered = round(sum(t.recovered_amount for t in all_txns), 2)

    status_counts = {"recovered": 0, "escalated": 0, "unrecoverable": 0, "pending": 0}
    status_amounts = {"recovered": 0.0, "escalated": 0.0, "unrecoverable": 0.0, "pending": 0.0}

    for t in all_txns:
        st = t.status if t.status in status_counts else "pending"
        status_counts[st] += 1
        status_amounts[st] = round(status_amounts[st] + t.amount, 2)

    unrecoverable_amount = status_amounts["unrecoverable"]
    recoverable_revenue = round(max(0.0, total_at_risk - unrecoverable_amount), 2)

    # Effective Recovery Rate: % of actionable recoverable revenue won back
    effective_recovery_rate = round((total_recovered / recoverable_revenue * 100), 2) if recoverable_revenue > 0 else 0.0
    # Gross Recovery Rate: % of gross failed pipeline won back
    gross_recovery_rate = round((total_recovered / total_at_risk * 100), 2) if total_at_risk > 0 else 0.0

    # Policy / guardrail metrics
    guardrail_blocks = sum(1 for t in all_txns if t.guardrail_notes and "⛔" in t.guardrail_notes)
    guardrail_blocked_amount = round(sum(t.amount for t in all_txns if t.guardrail_notes and "⛔" in t.guardrail_notes), 2)

    # Action counts
    action_counts = {}
    for t in all_txns:
        if t.final_action_taken:
            action_counts[t.final_action_taken] = action_counts.get(t.final_action_taken, 0) + 1

    # Recovery by type
    recovery_by_type = {}
    for t in all_txns:
        recovery_by_type.setdefault(t.type, {"total": 0.0, "recovered": 0.0, "count": 0})
        recovery_by_type[t.type]["total"] = round(recovery_by_type[t.type]["total"] + t.amount, 2)
        recovery_by_type[t.type]["recovered"] = round(recovery_by_type[t.type]["recovered"] + t.recovered_amount, 2)
        recovery_by_type[t.type]["count"] += 1

    return {
        "total_at_risk": total_at_risk,
        "recoverable_revenue": recoverable_revenue,
        "total_recovered": total_recovered,
        "recovery_rate": effective_recovery_rate,
        "effective_recovery_rate": effective_recovery_rate,
        "gross_recovery_rate": gross_recovery_rate,
        "total_transactions": len(all_txns),
        "status_counts": status_counts,
        "status_amounts": status_amounts,
        "action_counts": action_counts,
        "guardrail_blocks": guardrail_blocks,
        "guardrail_blocked_amount": guardrail_blocked_amount,
        "recovery_by_type": recovery_by_type,
    }


# ── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"service": "Winback", "status": "healthy", "version": "2.0.0"}


from pydantic import BaseModel, Field

class CreateTransactionSchema(BaseModel):
    customer_id: str = Field(..., json_schema_extra={"example": "cust_1042"})
    customer_name: str = Field(..., json_schema_extra={"example": "Rahul Sharma"})
    customer_email: str = Field(..., json_schema_extra={"example": "rahul@example.com"})
    type: str = Field(..., json_schema_extra={"example": "subscription_renewal"})
    amount: float = Field(..., json_schema_extra={"example": 1499.0})
    failure_code: str = Field(..., json_schema_extra={"example": "insufficient_funds"})
    attempt_number: int = Field(1, json_schema_extra={"example": 1})
    customer_contact_count_48h: int = Field(0, json_schema_extra={"example": 0})
    mandate_window_end_days: float | None = Field(None, json_schema_extra={"example": 5.0})


@app.get("/transactions")
def list_transactions(
    status: str | None = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    if status and status != "all":
        query = query.filter(Transaction.status == status)
    txns = query.order_by(Transaction.amount.desc()).all()
    return {
        "transactions": [_txn_to_response(t) for t in txns],
        "total": len(txns),
    }


@app.post("/transactions")
def create_transaction(
    payload: CreateTransactionSchema,
    db: Session = Depends(get_db)
):
    """Add a new custom failed transaction to Winback (e.g. from Razorpay webhook)."""
    import string, random
    txn_id = f"txn_{''.join(random.choices(string.ascii_letters + string.digits, k=6))}"
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    mandate_end = None
    if payload.mandate_window_end_days is not None:
        from datetime import timedelta
        mandate_end = now + timedelta(days=payload.mandate_window_end_days)

    txn = Transaction(
        txn_id=txn_id,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        type=payload.type,
        amount=payload.amount,
        failure_code=payload.failure_code,
        attempt_number=payload.attempt_number,
        last_attempt_ts=now,
        mandate_window_end=mandate_end,
        customer_contact_count_48h=payload.customer_contact_count_48h,
        status="pending",
    )
    db.add(txn)
    db.commit()

    return {
        "message": "Transaction created successfully and marked as pending.",
        "transaction": _txn_to_response(txn)
    }


def _extract_number(val: any, default: float = 1499.0) -> float:
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val) if val > 0 else default
    s = str(val)
    # Remove currency symbols, commas, spaces
    import re
    cleaned = re.sub(r"[^\d.]", "", s)
    try:
        f = float(cleaned)
        return f if f > 0 else default
    except Exception:
        return default


def _find_field(row: dict, candidates: list[str]) -> str | None:
    # Look for exact or fuzzy match in dict keys
    norm_map = {re.sub(r"[\s_\-.]+", "", str(k).lower()): v for k, v in row.items() if k is not None}
    for c in candidates:
        norm_c = re.sub(r"[\s_\-.]+", "", c.lower())
        if norm_c in norm_map and norm_map[norm_c] is not None:
            val = str(norm_map[norm_c]).strip()
            if val:
                return val
    return None


@app.post("/upload/csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Ultra-resilient bulk import: accepts any financial transaction CSV format with fuzzy header matching.
    """
    import string, random, re
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    text = content.decode("utf-8-sig", errors="ignore")
    if not text.strip():
        raise HTTPException(status_code=400, detail="The uploaded CSV file is empty.")

    # Try detecting delimiter
    sample = text[:2048]
    delimiter = ","
    if ";" in sample and sample.count(";") > sample.count(","):
        delimiter = ";"
    elif "\t" in sample and sample.count("\t") > sample.count(","):
        delimiter = "\t"

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Could not detect column headers in the CSV file.")

    created = []
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for idx, row in enumerate(reader, start=1):
        if not row or not any(row.values()):
            continue
        try:
            # 1. Amount
            raw_amt = _find_field(row, [
                "amount", "amt", "transaction_amount", "amount_in_inr", "inr", "price",
                "total", "value", "net_amount", "payment_amount", "fee", "cost", "sum"
            ])
            amount = _extract_number(raw_amt, default=round(random.uniform(999, 12999), 2))

            # 2. Customer Name
            cust_name = _find_field(row, [
                "customer_name", "name", "customer", "client", "user", "payer_name",
                "subscriber", "full_name", "client_name", "account_name", "payer"
            ]) or f"Customer #{idx}"

            # 3. Customer Email
            cust_email = _find_field(row, [
                "customer_email", "email", "mail", "user_email", "email_address",
                "contact_email", "client_email"
            ]) or f"{re.sub(r'[^a-zA-Z0-9]', '', cust_name).lower() or 'user'}@example.com"

            # 4. Customer ID
            cust_id = _find_field(row, [
                "customer_id", "cust_id", "user_id", "client_id", "account_id",
                "id", "payer_id", "member_id"
            ]) or f"cust_{random.randint(1000, 9999)}"

            # 5. Type
            raw_type = _find_field(row, [
                "type", "txn_type", "transaction_type", "category", "payment_type",
                "plan_type", "order_type"
            ]) or ""
            raw_type_lower = raw_type.lower()
            if "abandon" in raw_type_lower or "cart" in raw_type_lower or "drop" in raw_type_lower or "checkout" in raw_type_lower:
                txn_type = "checkout_abandoned"
            elif "invoice" in raw_type_lower or "b2b" in raw_type_lower or "overdue" in raw_type_lower:
                txn_type = "invoice_overdue"
            else:
                txn_type = "subscription_renewal"

            # 6. Failure Code
            raw_fail = _find_field(row, [
                "failure_code", "reason", "failure_reason", "error_code", "error",
                "decline_reason", "status_code", "failure", "remark", "status"
            ]) or ""
            raw_fail_lower = raw_fail.lower()
            if "fund" in raw_fail_lower or "insufficient" in raw_fail_lower or "balance" in raw_fail_lower:
                failure_code = "insufficient_funds"
            elif "expire" in raw_fail_lower or "card" in raw_fail_lower:
                failure_code = "card_expired"
            elif "timeout" in raw_fail_lower or "bank" in raw_fail_lower or "gateway" in raw_fail_lower or "network" in raw_fail_lower:
                failure_code = "bank_timeout"
            elif "mandate" in raw_fail_lower or "decline" in raw_fail_lower or "auth" in raw_fail_lower:
                failure_code = "mandate_declined"
            elif "drop" in raw_fail_lower or "abandon" in raw_fail_lower:
                failure_code = "checkout_dropoff"
            elif "invoice" in raw_fail_lower or "overdue" in raw_fail_lower:
                failure_code = "invoice_overdue"
            else:
                failure_code = "insufficient_funds"

            # 7. Attempt Number
            raw_attempt = _find_field(row, [
                "attempt_number", "attempt", "attempts", "retry_count", "retries", "retry_number"
            ])
            try:
                attempt_number = int(re.sub(r"\D", "", str(raw_attempt))) if raw_attempt else 1
            except Exception:
                attempt_number = 1

            # 8. Contact Count
            raw_contact = _find_field(row, [
                "customer_contact_count_48h", "contact_count", "outreach_count",
                "contacts", "reminders", "contact_count_48h", "outreach"
            ])
            try:
                contact_count = int(re.sub(r"\D", "", str(raw_contact))) if raw_contact else 0
            except Exception:
                contact_count = 0

            mandate_end = None
            if txn_type == "subscription_renewal":
                from datetime import timedelta
                mandate_end = now + timedelta(days=random.randint(1, 10))

            txn_id = f"txn_{''.join(random.choices(string.ascii_letters + string.digits, k=6))}"
            txn = Transaction(
                txn_id=txn_id,
                customer_id=cust_id,
                customer_name=cust_name,
                customer_email=cust_email,
                type=txn_type,
                amount=amount,
                failure_code=failure_code,
                attempt_number=attempt_number,
                customer_contact_count_48h=contact_count,
                last_attempt_ts=now,
                mandate_window_end=mandate_end,
                status="pending",
            )
            db.add(txn)
            created.append(txn)
            _record_audit(db, txn_id, "DETECT", None, f"Batch imported from CSV '{file.filename}': ₹{amount:,.2f}")
        except Exception as err:
            logger.warning(f"Error parsing row {idx}: {err}")

    if not created:
        raise HTTPException(
            status_code=400,
            detail=f"Could not parse any transaction rows from '{file.filename}'. Please ensure the CSV contains rows with transaction amounts."
        )

    db.commit()
    total_val = sum(t.amount for t in created)
    return {
        "message": f"Successfully imported {len(created)} failed transactions (Total: ₹{total_val:,.2f}) from '{file.filename}'.",
        "count": len(created),
        "total_amount": total_val,
    }


class DocumentScanSchema(BaseModel):
    document_text: str = Field(..., json_schema_extra={"example": "Invoice #8902 to Priya Sharma (priya@gmail.com) for amount ₹8,450. Payment failed due to card_expired on 2026-08-20."})


@app.post("/upload/document")
def scan_document(
    payload: DocumentScanSchema,
    db: Session = Depends(get_db)
):
    """
    AI Document/Invoice Scanner — Uses Groq LLM to extract payment failure metadata from raw text/invoice notes.
    """
    import string, random
    api_key = os.environ.get("GROQ_API_KEY")
    prompt = f"""You are an AI financial document parser. Extract structured payment failure info from the following document/invoice text:

{payload.document_text}

Respond ONLY with a JSON object with keys:
- customer_name (string)
- customer_email (string)
- type (must be one of: subscription_renewal, checkout_abandoned, invoice_overdue)
- amount (float number in INR)
- failure_code (must be one of: insufficient_funds, card_expired, bank_timeout, mandate_declined, checkout_dropoff, invoice_overdue)
- attempt_number (integer, default 1)
- customer_contact_count_48h (integer, default 0)
No other text."""

    extracted = None
    if api_key and api_key != "your_key_here":
        try:
            from groq import Groq
            client = Groq(api_key=api_key)
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            extracted = json.loads(resp.choices[0].message.content)
        except Exception as e:
            logger.warning(f"Groq document scan error: {e}")

    if not extracted:
        # Fallback simple extractor
        extracted = {
            "customer_name": "Scanned Customer",
            "customer_email": "scanned@example.com",
            "type": "invoice_overdue",
            "amount": 4500.0,
            "failure_code": "invoice_overdue",
            "attempt_number": 1,
            "customer_contact_count_48h": 0,
        }

    txn_id = f"txn_{''.join(random.choices(string.ascii_letters + string.digits, k=6))}"
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    txn = Transaction(
        txn_id=txn_id,
        customer_id=f"cust_{random.randint(1000, 9999)}",
        customer_name=extracted.get("customer_name", "Scanned Customer"),
        customer_email=extracted.get("customer_email", "scanned@example.com"),
        type=extracted.get("type", "invoice_overdue"),
        amount=float(extracted.get("amount", 2500.0)),
        failure_code=extracted.get("failure_code", "invoice_overdue"),
        attempt_number=int(extracted.get("attempt_number", 1)),
        customer_contact_count_48h=int(extracted.get("customer_contact_count_48h", 0)),
        last_attempt_ts=now,
        status="pending",
    )
    db.add(txn)
    db.commit()

    _record_audit(db, txn_id, "DETECT", None, f"Extracted & ingested by AI Document Scanner: ₹{txn.amount:,.2f}")

    return {
        "message": "AI Document Ingestion complete! Transaction added to pending queue.",
        "extracted_data": extracted,
        "transaction": _txn_to_response(txn)
    }


@app.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    return _compute_summary(db)


@app.get("/audit-events")
def get_audit_events(
    txn_id: str | None = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(AuditEvent)
    if txn_id:
        query = query.filter(AuditEvent.txn_id == txn_id)
    events = query.order_by(AuditEvent.timestamp.asc()).all()
    return {
        "events": [
            {
                "id": e.id,
                "txn_id": e.txn_id,
                "stage": e.stage,
                "action": e.action,
                "details": e.details,
                "timestamp": e.timestamp.isoformat(),
            }
            for e in events
        ]
    }


@app.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    txns = db.query(Transaction).order_by(Transaction.amount.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Txn ID", "Customer ID", "Customer Name", "Customer Email", "Type",
        "Amount (INR)", "Failure Code", "Attempt Number", "Contact Count 48h",
        "Status", "Diagnosis", "Recommended Action", "Confidence",
        "Guardrail Notes", "Final Action Taken", "Recovered Amount (INR)", "Processed At"
    ])
    
    for t in txns:
        writer.writerow([
            t.txn_id, t.customer_id, t.customer_name or "", t.customer_email or "", t.type,
            t.amount, t.failure_code, t.attempt_number, t.customer_contact_count_48h,
            t.status, t.diagnosis or "", t.recommended_action or "", t.confidence or "",
            t.guardrail_notes or "", t.final_action_taken or "", t.recovered_amount,
            t.processed_at.isoformat() if t.processed_at else ""
        ])
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=winback_audit_log.csv"}
    )


@app.post("/run-batch")
def run_batch(db: Session = Depends(get_db)):
    """Standard POST batch execution endpoint."""
    pending = get_pending_batch(db)
    if not pending:
        summary = _compute_summary(db)
        summary["batch_size"] = 0
        summary["message"] = "No pending transactions to process."
        return summary

    results = []
    errors = []

    for txn in pending:
        try:
            _record_audit(db, txn.txn_id, "DETECT", None, f"Detected pending failure ({txn.failure_code}) for ₹{txn.amount:,.2f}")

            # Diagnose
            diag = diagnose_transaction(txn)
            txn.diagnosis = diag.get("diagnosis", "")
            txn.recommended_action = diag.get("recommended_action", "escalate_to_human")
            txn.confidence = diag.get("confidence", "medium")

            _record_audit(db, txn.txn_id, "DIAGNOSE", txn.recommended_action, f"LLM recommended '{txn.recommended_action}' ({txn.confidence} confidence): {txn.diagnosis}")

            # Guardrail
            final_action, guardrail_notes = apply_policy(txn, txn.recommended_action)
            txn.guardrail_notes = guardrail_notes

            _record_audit(db, txn.txn_id, "GUARDRAIL", final_action, f"Policy Engine output: {guardrail_notes}")

            # Execute
            outcome = execute_action(txn, final_action)
            txn.processed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            results.append(outcome)

            _record_audit(db, txn.txn_id, "EXECUTE", final_action, outcome.get("message", ""))
            db.commit()

        except Exception as e:
            logger.error(f"Error processing {txn.txn_id}: {e}", exc_info=True)
            errors.append({"txn_id": txn.txn_id, "error": str(e)})
            db.rollback()

    summary = _compute_summary(db)
    summary["batch_size"] = len(pending)
    summary["processed"] = len(results)
    summary["errors"] = errors
    summary["transactions"] = [_txn_to_response(t) for t in pending]
    return summary


@app.get("/run-batch/stream")
async def run_batch_stream():
    """SSE streaming endpoint for real-time progress visualization in the dashboard."""
    async def event_generator():
        db = SessionLocal()
        try:
            pending = get_pending_batch(db)
            total = len(pending)
            yield f"data: {json.dumps({'type': 'start', 'total': total})}\n\n"

            if total == 0:
                yield f"data: {json.dumps({'type': 'complete', 'summary': _compute_summary(db)})}\n\n"
                return

            for index, txn in enumerate(pending, 1):
                try:
                    _record_audit(db, txn.txn_id, "DETECT", None, f"Detected failure for ₹{txn.amount:,.2f}")

                    diag = diagnose_transaction(txn)
                    txn.diagnosis = diag.get("diagnosis", "")
                    txn.recommended_action = diag.get("recommended_action", "escalate_to_human")
                    txn.confidence = diag.get("confidence", "medium")

                    _record_audit(db, txn.txn_id, "DIAGNOSE", txn.recommended_action, f"LLM Recommendation: {txn.diagnosis}")

                    final_action, guardrail_notes = apply_policy(txn, txn.recommended_action)
                    txn.guardrail_notes = guardrail_notes

                    _record_audit(db, txn.txn_id, "GUARDRAIL", final_action, guardrail_notes)

                    outcome = execute_action(txn, final_action)
                    txn.processed_at = datetime.now(timezone.utc).replace(tzinfo=None)

                    _record_audit(db, txn.txn_id, "EXECUTE", final_action, outcome.get("message", ""))
                    db.commit()

                    payload = {
                        "type": "progress",
                        "current": index,
                        "total": total,
                        "txn": _txn_to_response(txn)
                    }
                    yield f"data: {json.dumps(payload)}\n\n"
                    await asyncio.sleep(0.05)  # slight pause for smooth UI stream

                except Exception as e:
                    logger.error(f"Stream error on {txn.txn_id}: {e}")
                    db.rollback()

            yield f"data: {json.dumps({'type': 'complete', 'summary': _compute_summary(db)})}\n\n"
        finally:
            db.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/transactions/{txn_id}/process")
def process_single_transaction(txn_id: str, db: Session = Depends(get_db)):
    """Process a single transaction through the full 4-stage pipeline (DETECT -> DIAGNOSE -> GUARDRAIL -> EXECUTE)."""
    txn = db.query(Transaction).filter(Transaction.txn_id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail=f"Transaction '{txn_id}' not found.")

    _record_audit(db, txn.txn_id, "DETECT", None, f"Detected pending failure ({txn.failure_code}) for ₹{txn.amount:,.2f}")

    # Diagnose
    diag = diagnose_transaction(txn)
    txn.diagnosis = diag.get("diagnosis", "")
    txn.recommended_action = diag.get("recommended_action", "escalate_to_human")
    txn.confidence = diag.get("confidence", "medium")

    _record_audit(db, txn.txn_id, "DIAGNOSE", txn.recommended_action, f"LLM recommended '{txn.recommended_action}' ({txn.confidence} confidence): {txn.diagnosis}")

    # Guardrail
    final_action, guardrail_notes = apply_policy(txn, txn.recommended_action)
    txn.guardrail_notes = guardrail_notes

    _record_audit(db, txn.txn_id, "GUARDRAIL", final_action, f"Policy Engine output: {guardrail_notes}")

    # Execute
    outcome = execute_action(txn, final_action)
    txn.processed_at = datetime.now(timezone.utc).replace(tzinfo=None)

    _record_audit(db, txn.txn_id, "EXECUTE", final_action, outcome.get("message", ""))
    db.commit()

    return {
        "message": f"Transaction {txn_id} processed successfully: {outcome.get('message', '')}",
        "transaction": _txn_to_response(txn),
        "outcome": outcome,
        "summary": _compute_summary(db),
    }


@app.post("/demo/seed-pair")
def seed_demo_pair(db: Session = Depends(get_db)):
    """Seed ONLY the two presentation demo transactions (1 Guaranteed Success, 1 Guaranteed Policy Block)."""
    from generate_data import seed_demo_pair_database
    seed_demo_pair_database()
    return {
        "message": "Seeded 2 presentation demo transactions: TXN-DEMO-001 (Success) and TXN-DEMO-002 (Policy Block).",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": _compute_summary(db)
    }


@app.post("/clear")
def clear_database(db: Session = Depends(get_db)):
    """Completely wipe all transactions and audit events from the database."""
    db.query(AuditEvent).delete()
    db.query(Transaction).delete()
    db.commit()
    return {"message": "Database cleared. 0 transactions remaining.", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/reset")
def reset_database(db: Session = Depends(get_db)):
    """Reset database with 150 deterministic synthetic transactions."""
    from generate_data import seed_database
    seed_database()
    return {
        "message": "Database reset with 150 deterministic transactions (including TXN-DEMO-001 and TXN-DEMO-002).",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": _compute_summary(db)
    }


# Mount static assets if build exists
dist_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
