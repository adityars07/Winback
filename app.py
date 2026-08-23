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
from datetime import datetime
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Query
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


def _record_audit(db: Session, txn_id: str, stage: str, action: str | None, details: str):
    event = AuditEvent(
        txn_id=txn_id,
        stage=stage,
        action=action,
        details=details,
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()


def _compute_summary(db: Session) -> dict:
    all_txns = db.query(Transaction).all()
    total_at_risk = sum(t.amount for t in all_txns)
    total_recovered = sum(t.recovered_amount for t in all_txns)
    recovery_rate = (total_recovered / total_at_risk * 100) if total_at_risk > 0 else 0.0

    status_counts = {}
    for t in all_txns:
        status_counts[t.status] = status_counts.get(t.status, 0) + 1

    guardrail_blocks = sum(1 for t in all_txns if t.guardrail_notes and "⛔" in t.guardrail_notes)

    # Action counts
    action_counts = {}
    for t in all_txns:
        if t.final_action_taken:
            action_counts[t.final_action_taken] = action_counts.get(t.final_action_taken, 0) + 1

    # Recovery by type
    recovery_by_type = {}
    for t in all_txns:
        recovery_by_type.setdefault(t.type, {"total": 0.0, "recovered": 0.0, "count": 0})
        recovery_by_type[t.type]["total"] += t.amount
        recovery_by_type[t.type]["recovered"] += t.recovered_amount
        recovery_by_type[t.type]["count"] += 1

    return {
        "total_at_risk": round(total_at_risk, 2),
        "total_recovered": round(total_recovered, 2),
        "recovery_rate": round(recovery_rate, 2),
        "total_transactions": len(all_txns),
        "status_counts": status_counts,
        "action_counts": action_counts,
        "guardrail_blocks": guardrail_blocks,
        "recovery_by_type": recovery_by_type,
    }


# ── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"service": "Winback", "status": "healthy", "version": "2.0.0"}


from pydantic import BaseModel, Field

class CreateTransactionSchema(BaseModel):
    customer_id: str = Field(..., example="cust_1042")
    customer_name: str = Field(..., example="Rahul Sharma")
    customer_email: str = Field(..., example="rahul@example.com")
    type: str = Field(..., example="subscription_renewal") # subscription_renewal, checkout_abandoned, invoice_overdue
    amount: float = Field(..., example=1499.0)
    failure_code: str = Field(..., example="insufficient_funds") # insufficient_funds, card_expired, bank_timeout, mandate_declined, checkout_dropoff, invoice_overdue
    attempt_number: int = Field(1, example=1)
    customer_contact_count_48h: int = Field(0, example=0)
    mandate_window_end_days: float | None = Field(None, example=5.0)  # days from now


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
    now = datetime.utcnow()

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

    _record_audit(db, txn_id, "DETECT", None, f"Custom transaction created manually/via webhook: ₹{payload.amount:,.2f}")

    return {
        "message": "Transaction created successfully and marked as pending.",
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
            txn.processed_at = datetime.utcnow()
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
                    txn.processed_at = datetime.utcnow()

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


@app.post("/reset")
def reset_database(db: Session = Depends(get_db)):
    from generate_data import seed_database
    seed_database()
    return {"message": "Database reset with 150 synthetic transactions.", "timestamp": datetime.utcnow().isoformat()}


# Mount static assets if build exists
dist_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
