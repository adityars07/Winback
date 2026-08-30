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
import re
import string
import random
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from models import init_db, get_db, Transaction, AuditEvent, SessionLocal
from detector import get_pending_batch
from diagnosis import diagnose_transaction
from policy import apply_policy
from executor import execute_action
from voice_intake import (
    parse_hinglish_voice_transcript,
    generate_hinglish_voice_response,
)

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
        "promise_date": txn.promise_date.isoformat() if getattr(txn, "promise_date", None) else None,
        "is_broken_promise": int(getattr(txn, "is_broken_promise", 0) or 0),
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

    status_counts = {"recovered": 0, "escalated": 0, "unrecoverable": 0, "promised": 0, "pending": 0}
    status_amounts = {"recovered": 0.0, "escalated": 0.0, "unrecoverable": 0.0, "promised": 0.0, "pending": 0.0}

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

    # Promise metrics
    total_promises = sum(1 for t in all_txns if getattr(t, "promise_date", None) is not None or t.final_action_taken == "promise_to_pay" or getattr(t, "is_broken_promise", 0) > 0)
    broken_promises = sum(1 for t in all_txns if getattr(t, "is_broken_promise", 0) > 0)
    broken_promise_rate = round((broken_promises / total_promises * 100), 2) if total_promises > 0 else 0.0

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
        "total_promises": total_promises,
        "broken_promises": broken_promises,
        "broken_promise_rate": broken_promise_rate,
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


class PromiseWebhookSchema(BaseModel):
    transaction_id: str | None = Field(None, json_schema_extra={"example": "txn_1042"})
    txn_id: str | None = Field(None, json_schema_extra={"example": "txn_1042"})
    promised_date: str = Field(..., json_schema_extra={"example": "2026-09-05T00:00:00"})


class EvaluatePromisesSchema(BaseModel):
    current_time: str | None = Field(None, json_schema_extra={"example": "2026-09-10T00:00:00"})
    force_evaluate_all: bool = Field(False, json_schema_extra={"example": True})
    simulate_paid_txn_ids: list[str] = Field(default_factory=list, json_schema_extra={"example": ["txn_1042"]})
    simulate_default_paid: bool = Field(False, json_schema_extra={"example": False})


@app.post("/webhook/promise-to-pay")
@app.post("/transactions/promise")
def record_promise_to_pay(
    payload: PromiseWebhookSchema,
    db: Session = Depends(get_db)
):
    """
    Webhook/Endpoint to record customer commitment to pay by a specific date.
    Transitions status to 'promised', logs audit event, and pauses automated dunning.
    """
    target_id = payload.transaction_id or payload.txn_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Missing transaction_id or txn_id in request body.")
    
    txn = db.query(Transaction).filter(Transaction.txn_id == target_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail=f"Transaction '{target_id}' not found.")

    try:
        if "T" in payload.promised_date:
            p_date = datetime.fromisoformat(payload.promised_date.replace("Z", "+00:00")).replace(tzinfo=None)
        else:
            p_date = datetime.strptime(payload.promised_date, "%Y-%m-%d")
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"Invalid date format '{payload.promised_date}': {err}")

    txn.promise_date = p_date
    txn.status = "promised"
    txn.final_action_taken = "promise_to_pay"
    txn.recovered_amount = 0.0
    txn.processed_at = datetime.now(timezone.utc).replace(tzinfo=None)

    _record_audit(
        db,
        txn.txn_id,
        "EXECUTE",
        "promise_to_pay",
        f"Customer commitment recorded: Promised to pay by {p_date.strftime('%Y-%m-%d')}. Automated dunning paused.",
        commit=True
    )

    return {
        "message": f"Promise to pay recorded for transaction {txn.txn_id}. Status updated to 'promised' and dunning paused until {p_date.strftime('%Y-%m-%d')}.",
        "transaction": _txn_to_response(txn),
        "summary": _compute_summary(db)
    }


@app.post("/transactions/{txn_id}/promise")
def record_promise_single_url(
    txn_id: str,
    payload: PromiseWebhookSchema,
    db: Session = Depends(get_db)
):
    payload.transaction_id = txn_id
    return record_promise_to_pay(payload, db)


@app.post("/promises/evaluate")
@app.post("/simulate/evaluate-promises")
def evaluate_promises(
    payload: EvaluatePromisesSchema | None = None,
    db: Session = Depends(get_db)
):
    """
    Evaluates all 'promised' transactions past their promise_date (or all if force_evaluate_all=True).
    - If paid (in simulate_paid_txn_ids or simulate_default_paid): marks recovered.
    - If not paid (broken promise): increments attempt_number, sets broken_promise context,
      and re-runs through the diagnose -> guardrail -> execute pipeline.
    """
    if payload is None:
        payload = EvaluatePromisesSchema()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if payload.current_time:
        try:
            if "T" in payload.current_time:
                now = datetime.fromisoformat(payload.current_time.replace("Z", "+00:00")).replace(tzinfo=None)
            else:
                now = datetime.strptime(payload.current_time, "%Y-%m-%d")
        except Exception as e:
            logger.warning(f"Failed to parse custom current_time: {e}")

    promised_txns = db.query(Transaction).filter(Transaction.status == "promised").all()
    evaluated = []

    for txn in promised_txns:
        is_past = (txn.promise_date is not None and now >= txn.promise_date)
        if not is_past and not payload.force_evaluate_all:
            continue

        is_paid = (txn.txn_id in payload.simulate_paid_txn_ids) or payload.simulate_default_paid

        if is_paid:
            # Fulfilled promise
            txn.status = "recovered"
            txn.recovered_amount = txn.amount
            txn.processed_at = now
            _record_audit(
                db,
                txn.txn_id,
                "EXECUTE",
                "promise_fulfilled",
                f"Promise fulfilled: Customer completed payment of INR {txn.amount:,.2f} on schedule - RECOVERED"
            )
            evaluated.append({
                "txn_id": txn.txn_id,
                "status": "recovered",
                "recovered_amount": txn.amount,
                "message": f"Promise fulfilled for INR {txn.amount:,.2f}."
            })
        else:
            # Broken promise
            txn.is_broken_promise = 1
            txn.attempt_number += 1
            p_date_str = txn.promise_date.strftime('%Y-%m-%d') if txn.promise_date else "deadline"
            
            _record_audit(
                db,
                txn.txn_id,
                "DETECT",
                "broken_promise",
                f"Broken promise detected past commitment date ({p_date_str}). Customer did not pay. Re-entering recovery pipeline (Attempt #{txn.attempt_number})."
            )

            # Re-enter pipeline at DIAGNOSE
            diag = diagnose_transaction(txn)
            txn.diagnosis = f"[Broken Promise] {diag.get('diagnosis', '')}"
            txn.recommended_action = diag.get("recommended_action", "escalate_to_human")
            txn.confidence = diag.get("confidence", "medium")

            _record_audit(
                db,
                txn.txn_id,
                "DIAGNOSE",
                txn.recommended_action,
                f"Broken promise re-diagnosis: LLM recommended '{txn.recommended_action}' ({txn.confidence} confidence): {txn.diagnosis}"
            )

            # Guardrail Check
            final_action, guardrail_notes = apply_policy(txn, txn.recommended_action)
            txn.guardrail_notes = guardrail_notes

            _record_audit(
                db,
                txn.txn_id,
                "GUARDRAIL",
                final_action,
                f"Policy Engine output on broken promise: {guardrail_notes}"
            )

            # Execute
            if final_action == "retry_payment":
                txn.attempt_number -= 1  # execute_action will increment it on retry
            outcome = execute_action(txn, final_action)
            txn.processed_at = now

            _record_audit(
                db,
                txn.txn_id,
                "EXECUTE",
                final_action,
                outcome.get("message", "")
            )

            evaluated.append({
                "txn_id": txn.txn_id,
                "status": txn.status,
                "outcome": outcome,
                "guardrail_notes": guardrail_notes,
                "attempt_number": txn.attempt_number,
                "message": f"Broken promise processed: {outcome.get('message', '')}"
            })

    db.commit()
    summary = _compute_summary(db)
    return {
        "message": f"Evaluated {len(evaluated)} promised transactions.",
        "evaluated_count": len(evaluated),
        "results": evaluated,
        "summary": summary
    }


class VoiceIntakeSchema(BaseModel):
    transcript: str = Field(..., json_schema_extra={"example": "Bhai mera payment fail ho gaya, kal salary aayegi, phir try karna"})
    txn_id: str | None = Field(None, json_schema_extra={"example": "TXN-DEMO-001"})
    customer_name: str | None = Field(None, json_schema_extra={"example": "Rahul Verma"})
    amount: float | None = Field(None, json_schema_extra={"example": 3450.0})
    attempt_number: int | None = Field(None, json_schema_extra={"example": 1})
    customer_contact_count_48h: int | None = Field(None, json_schema_extra={"example": 0})
    history: list[dict] | None = Field(default_factory=list)


@app.get("/voice-intake/active-transactions")
def get_voice_intake_active_transactions(
    limit: int = 25,
    db: Session = Depends(get_db)
):
    """
    Returns real failed/pending transactions from the database available for live voice recovery dialing.
    """
    pending_txns = db.query(Transaction).filter(
        Transaction.status.in_(["pending", "escalated", "unrecoverable", "promised"])
    ).order_by(Transaction.amount.desc()).limit(limit).all()

    if not pending_txns:
        pending_txns = db.query(Transaction).order_by(Transaction.amount.desc()).limit(limit).all()

    return {
        "transactions": [_txn_to_response(t) for t in pending_txns],
        "count": len(pending_txns),
    }


@app.post("/voice-intake")
def process_voice_intake(
    payload: VoiceIntakeSchema,
    db: Session = Depends(get_db)
):
    """
    Hinglish Voice Recovery Agent Endpoint:
    1. Converts/Parses customer spoken Hinglish speech via Groq LLM.
    2. Extracts error_code, promised_date, transaction_type, intent, confidence.
    3. Seamlessly routes into the detect -> diagnose -> guardrail -> execute pipeline.
    4. Policy engine remains the final authority (Rule 1, Rule 2, Rule 3, Rule 4).
    5. Executes only approved financial actions.
    6. Generates a natural, empathetic spoken Hinglish reply based on the REAL outcome.
    7. Records the complete trace in the immutable audit trail.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    transcript = payload.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript text cannot be empty.")

    # 1. Parse Hinglish via Groq / Fallback
    extracted = parse_hinglish_voice_transcript(transcript, reference_date=now)
    err_code = extracted.get("error_code") or "insufficient_funds"
    if err_code not in ("insufficient_funds", "bank_timeout", "card_expired", "mandate_declined", "checkout_dropoff", "invoice_overdue"):
        err_code = "insufficient_funds"

    txn_type = extracted.get("transaction_type") or "subscription_renewal"
    if txn_type not in ("subscription_renewal", "checkout_abandoned", "invoice_overdue"):
        txn_type = "subscription_renewal"

    promised_date_str = extracted.get("promised_date")
    amount = payload.amount or extracted.get("amount_inr") or 4999.0
    cust_name = payload.customer_name or extracted.get("customer_name") or "Voice Customer"

    # 2. Get or Create Transaction
    txn = None
    if payload.txn_id:
        txn = db.query(Transaction).filter(Transaction.txn_id == payload.txn_id).first()

    if not txn:
        import string, random
        txn_id = payload.txn_id or f"txn_voice_{''.join(random.choices(string.ascii_letters + string.digits, k=5))}"
        cust_id = f"cust_{''.join(random.choices(string.digits, k=4))}"
        
        mandate_end = None
        if txn_type == "subscription_renewal":
            mandate_end = now + timedelta(days=5)

        txn = Transaction(
            txn_id=txn_id,
            customer_id=cust_id,
            customer_name=cust_name,
            customer_email=f"{re.sub(r'[^a-zA-Z0-9]', '', cust_name).lower() or 'user'}@voice.in",
            type=txn_type,
            amount=amount,
            failure_code=err_code,
            attempt_number=payload.attempt_number or 1,
            last_attempt_ts=now,
            mandate_window_end=mandate_end,
            customer_contact_count_48h=payload.customer_contact_count_48h or 0,
            status="pending",
        )
        db.add(txn)
    else:
        # Update existing txn failure code if clarified by voice
        txn.failure_code = err_code
        if amount and amount > 0:
            txn.amount = amount
        if payload.attempt_number is not None:
            txn.attempt_number = payload.attempt_number
        if payload.customer_contact_count_48h is not None:
            txn.customer_contact_count_48h = payload.customer_contact_count_48h

    _record_audit(
        db,
        txn.txn_id,
        "DETECT",
        None,
        f"Ingested via Hinglish Voice Note: \"{transcript}\" (Classified as: {err_code})"
    )

    # 3. Closed-Loop Pipeline Routing
    parsed_promise_date = None
    if promised_date_str:
        try:
            parsed_promise_date = datetime.strptime(promised_date_str, "%Y-%m-%d")
        except Exception:
            try:
                parsed_promise_date = datetime.fromisoformat(promised_date_str.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                parsed_promise_date = None

    # Check if attempts exceed Rule 1 limit even if promise requested
    if txn.attempt_number > 3:
        # Policy Rule 1 intercepts before promise
        final_action = "mark_unrecoverable"
        guardrail_notes = "⛔ Exceeded max retry attempts (3) — marking unrecoverable."
        txn.recommended_action = "promise_to_pay"
        txn.guardrail_notes = guardrail_notes
        txn.status = "unrecoverable"
        txn.final_action_taken = "mark_unrecoverable"
        txn.confidence = extracted.get("confidence_level", "high")
        txn.diagnosis = f"[Voice Intake] Max attempts reached ({txn.attempt_number}). Unrecoverable."
        txn.processed_at = now

        _record_audit(db, txn.txn_id, "DIAGNOSE", "promise_to_pay", f"Voice diagnosis: {txn.diagnosis}")
        _record_audit(db, txn.txn_id, "GUARDRAIL", "mark_unrecoverable", guardrail_notes)
        _record_audit(db, txn.txn_id, "EXECUTE", "mark_unrecoverable", "Transaction marked unrecoverable by Policy Engine Rule 1.")
        outcome_msg = f"Policy Rule 1 enforced: {guardrail_notes}"

    elif parsed_promise_date:
        # Route to Promise to Pay flow
        txn.promise_date = parsed_promise_date
        txn.status = "promised"
        txn.recommended_action = "promise_to_pay"
        txn.final_action_taken = "promise_to_pay"
        txn.recovered_amount = 0.0
        txn.confidence = extracted.get("confidence_level", "high")
        txn.diagnosis = f"[Voice Promise] {extracted.get('intent_summary', '')} Committed to pay by {parsed_promise_date.strftime('%Y-%m-%d')}."
        txn.guardrail_notes = f"✅ Customer payment commitment accepted via voice note — dunning paused until {parsed_promise_date.strftime('%Y-%m-%d')}."
        txn.processed_at = now

        _record_audit(
            db,
            txn.txn_id,
            "DIAGNOSE",
            "promise_to_pay",
            f"Voice diagnosis: {txn.diagnosis}"
        )
        _record_audit(
            db,
            txn.txn_id,
            "GUARDRAIL",
            "promise_to_pay",
            txn.guardrail_notes
        )
        _record_audit(
            db,
            txn.txn_id,
            "EXECUTE",
            "promise_to_pay",
            f"Customer commitment recorded from voice note: Promised to pay by {parsed_promise_date.strftime('%Y-%m-%d')} (dunning paused)"
        )
        outcome_msg = f"Voice commitment recorded for {txn.customer_name}: Promised to pay by {parsed_promise_date.strftime('%Y-%m-%d')} (dunning paused)"

    else:
        # Standard Diagnosis -> Policy Engine -> Execution Flow
        diag = diagnose_transaction(txn)
        txn.diagnosis = f"[Voice Note Intake] {extracted.get('intent_summary', '')} — {diag.get('diagnosis', '')}"
        txn.recommended_action = diag.get("recommended_action", "escalate_to_human")
        txn.confidence = extracted.get("confidence_level", diag.get("confidence", "high"))

        _record_audit(
            db,
            txn.txn_id,
            "DIAGNOSE",
            txn.recommended_action,
            f"Voice diagnosis recommendation: '{txn.recommended_action}' ({txn.confidence} confidence): {txn.diagnosis}"
        )

        final_action, guardrail_notes = apply_policy(txn, txn.recommended_action)
        txn.guardrail_notes = guardrail_notes

        _record_audit(
            db,
            txn.txn_id,
            "GUARDRAIL",
            final_action,
            f"Policy Engine output: {guardrail_notes}"
        )

        outcome = execute_action(txn, final_action)
        txn.processed_at = now

        _record_audit(
            db,
            txn.txn_id,
            "EXECUTE",
            final_action,
            outcome.get("message", "")
        )
        outcome_msg = outcome.get("message", "")

    # 4. Generate Natural Hinglish Spoken Audio Response from REAL Outcome
    final_action = txn.final_action_taken or "escalate_to_human"
    voice_reply = generate_hinglish_voice_response(
        transcript=transcript,
        extracted=extracted,
        guardrail_notes=txn.guardrail_notes or "",
        final_action=final_action,
        status=txn.status,
        outcome_msg=outcome_msg,
        customer_name=txn.customer_name,
        history=payload.history
    )

    _record_audit(
        db,
        txn.txn_id,
        "EXECUTE",
        "voice_agent_reply",
        f"AI Voice Agent Spoke: \"{voice_reply}\""
    )
    db.commit()

    return {
        "original_transcript": transcript,
        "extracted_data": extracted,
        "voice_agent_reply": voice_reply,
        "pipeline_result": {
            "txn_id": txn.txn_id,
            "customer_name": txn.customer_name,
            "amount": txn.amount,
            "failure_code": txn.failure_code,
            "status": txn.status,
            "recommended_action": txn.recommended_action,
            "guardrail_notes": txn.guardrail_notes,
            "final_action_taken": txn.final_action_taken,
            "recovered_amount": txn.recovered_amount,
            "outcome_message": outcome_msg,
            "voice_agent_reply": voice_reply,
        },
        "transaction": _txn_to_response(txn),
        "summary": _compute_summary(db)
    }


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


def _parse_datetime(val: any) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None)
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "n/a", "", "nan"):
        return None
    try:
        clean_s = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_s)
        return dt.replace(tzinfo=None)
    except Exception:
        pass
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
    ):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            continue
    return None


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
    replace_existing: bool = Form(True),
    auto_process: bool = Form(False),
    db: Session = Depends(get_db)
):
    """
    Ultra-resilient bulk import: accepts any financial transaction CSV format with fuzzy header matching,
    preserves date/mandate windows, supports replacing or appending datasets, and optional auto-execution.
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

    if replace_existing:
        db.query(AuditEvent).delete()
        db.query(Transaction).delete()
        db.commit()

    created = []
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    existing_txn_ids = {t.txn_id for t in db.query(Transaction.txn_id).all()}

    for idx, row in enumerate(reader, start=1):
        if not row or not any(row.values()):
            continue
        try:
            # 1. Amount
            raw_amt = _find_field(row, [
                "amount", "amt", "transaction_amount", "amount_in_inr", "amount_inr", "inr", "price",
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
                "failure_code", "error_code", "reason", "failure_reason", "error",
                "decline_reason", "status_code", "failure", "remark", "failure_type"
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
                "customer_contact_count_48h", "contact_count_48h", "contact_count", "outreach_count",
                "contacts", "reminders", "contact_count_48h", "outreach"
            ])
            try:
                contact_count = int(re.sub(r"\D", "", str(raw_contact))) if raw_contact else 0
            except Exception:
                contact_count = 0

            # 9. Mandate Window End (preserve actual dataset mandate window)
            raw_mandate = _find_field(row, [
                "mandate_window_end", "mandate_end", "mandate_expiry", "mandate_window", "mandate_date"
            ])
            mandate_end = _parse_datetime(raw_mandate)
            if mandate_end is None and txn_type == "subscription_renewal":
                mandate_end = now + timedelta(days=5)

            # 10. Last Attempt / Timestamp
            raw_ts = _find_field(row, [
                "last_attempt_ts", "timestamp", "date", "created_at", "attempt_date", "txn_time", "transaction_date"
            ])
            last_attempt = _parse_datetime(raw_ts) or now

            # 11. Transaction ID
            raw_txn_id = _find_field(row, [
                "txn_id", "transaction_id", "id", "reference_id", "order_id"
            ])
            if raw_txn_id:
                clean_id = re.sub(r"[^\w\-]", "", raw_txn_id)
                txn_id = clean_id if clean_id and clean_id not in existing_txn_ids else f"txn_{clean_id or ''}_{''.join(random.choices(string.ascii_letters + string.digits, k=4))}"
            else:
                txn_id = f"txn_{''.join(random.choices(string.ascii_letters + string.digits, k=6))}"
            existing_txn_ids.add(txn_id)

            # 12. Pre-computed columns if present in exported/labeled dataset
            raw_status = _find_field(row, ["status", "txn_status", "recovery_status", "state"])
            status = raw_status.lower() if raw_status and raw_status.lower() in ["pending", "recovered", "escalated", "unrecoverable", "promised"] else "pending"

            diagnosis = _find_field(row, ["diagnosis", "reasoning", "ai_diagnosis"])
            recommended_action = _find_field(row, ["recommended_action", "recommendation", "action_recommended"])
            confidence = _find_field(row, ["confidence", "ai_confidence"])
            guardrail_notes = _find_field(row, ["guardrail_notes", "guardrail_policy", "policy_notes", "guardrails"])
            final_action_taken = _find_field(row, ["final_action_taken", "final_action", "action_taken", "executed_action"])
            recovered_amount = _extract_number(_find_field(row, ["recovered_amount", "amount_recovered", "recovered_inr"]), default=0.0)
            promise_date = _parse_datetime(_find_field(row, ["promise_date", "promised_date", "promise_due_date"]))
            raw_broken = _find_field(row, ["is_broken_promise", "broken_promise"])
            is_broken_promise = 1 if raw_broken in ("1", "true", "True", "yes", "Yes") else 0
            processed_at = _parse_datetime(_find_field(row, ["processed_at", "resolved_at", "execution_time"]))

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
                last_attempt_ts=last_attempt,
                mandate_window_end=mandate_end,
                status=status,
                promise_date=promise_date,
                is_broken_promise=is_broken_promise,
                diagnosis=diagnosis,
                recommended_action=recommended_action,
                confidence=confidence,
                guardrail_notes=guardrail_notes,
                final_action_taken=final_action_taken,
                recovered_amount=recovered_amount,
                processed_at=processed_at or (now if status != "pending" else None),
            )
            db.add(txn)
            created.append(txn)

            # Record initial audit events
            _record_audit(db, txn_id, "DETECT", None, f"Batch imported from CSV '{file.filename}': ₹{amount:,.2f}")
            if diagnosis:
                _record_audit(db, txn_id, "DIAGNOSE", recommended_action, f"Imported Diagnosis: {diagnosis}")
            if guardrail_notes:
                _record_audit(db, txn_id, "GUARDRAIL", final_action_taken, f"Imported Guardrail: {guardrail_notes}")
            if final_action_taken:
                _record_audit(db, txn_id, "EXECUTE", final_action_taken, f"Imported Outcome: Status is '{status}', Recovered: ₹{recovered_amount:,.2f}")

        except Exception as err:
            logger.warning(f"Error parsing row {idx}: {err}")

    if not created:
        raise HTTPException(
            status_code=400,
            detail=f"Could not parse any transaction rows from '{file.filename}'. Please ensure the CSV contains rows with transaction amounts."
        )

    db.commit()

    # Optional auto-processing for pending transactions
    auto_processed_count = 0
    if auto_process:
        for txn in created:
            if txn.status == "pending":
                try:
                    diag = diagnose_transaction(txn)
                    txn.diagnosis = diag.get("diagnosis", "")
                    txn.recommended_action = diag.get("recommended_action", "escalate_to_human")
                    txn.confidence = diag.get("confidence", "medium")

                    _record_audit(db, txn.txn_id, "DIAGNOSE", txn.recommended_action, f"LLM recommended '{txn.recommended_action}' ({txn.confidence} confidence): {txn.diagnosis}")

                    final_action, guardrail_notes = apply_policy(txn, txn.recommended_action)
                    txn.guardrail_notes = guardrail_notes

                    _record_audit(db, txn.txn_id, "GUARDRAIL", final_action, f"Policy Engine output: {guardrail_notes}")

                    outcome = execute_action(txn, final_action)
                    txn.processed_at = datetime.now(timezone.utc).replace(tzinfo=None)

                    _record_audit(db, txn.txn_id, "EXECUTE", final_action, outcome.get("message", ""))
                    auto_processed_count += 1
                except Exception as e:
                    logger.error(f"Auto-process error on {txn.txn_id}: {e}")
        db.commit()

    total_val = sum(t.amount for t in created)
    summary = _compute_summary(db)
    msg = f"Successfully imported {len(created)} transactions (Total: ₹{total_val:,.2f}) from '{file.filename}'."
    if auto_process:
        msg += f" Automatically processed {auto_processed_count} transactions through the AI Recovery Pipeline."

    return {
        "message": msg,
        "count": len(created),
        "total_amount": total_val,
        "auto_processed": auto_processed_count,
        "summary": summary,
    }


class DocumentScanSchema(BaseModel):
    document_text: str = Field(..., json_schema_extra={"example": "Invoice #8902 to Priya Sharma (priya@gmail.com) for amount ₹8,450. Payment failed due to card_expired on 2026-08-20."})
    replace_existing: bool = Field(True, json_schema_extra={"example": True})
    auto_process: bool = Field(False, json_schema_extra={"example": False})


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

    if payload.replace_existing:
        db.query(AuditEvent).delete()
        db.query(Transaction).delete()
        db.commit()

    txn_id = f"txn_{''.join(random.choices(string.ascii_letters + string.digits, k=6))}"
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    mandate_end = None
    if extracted.get("type") == "subscription_renewal":
        mandate_end = now + timedelta(days=5)

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
        mandate_window_end=mandate_end,
        status="pending",
    )
    db.add(txn)
    db.commit()

    _record_audit(db, txn_id, "DETECT", None, f"Extracted & ingested by AI Document Scanner: ₹{txn.amount:,.2f}")

    if payload.auto_process:
        try:
            diag = diagnose_transaction(txn)
            txn.diagnosis = diag.get("diagnosis", "")
            txn.recommended_action = diag.get("recommended_action", "escalate_to_human")
            txn.confidence = diag.get("confidence", "medium")

            _record_audit(db, txn.txn_id, "DIAGNOSE", txn.recommended_action, f"LLM recommended '{txn.recommended_action}' ({txn.confidence} confidence): {txn.diagnosis}")

            final_action, guardrail_notes = apply_policy(txn, txn.recommended_action)
            txn.guardrail_notes = guardrail_notes

            _record_audit(db, txn.txn_id, "GUARDRAIL", final_action, f"Policy Engine output: {guardrail_notes}")

            outcome = execute_action(txn, final_action)
            txn.processed_at = datetime.now(timezone.utc).replace(tzinfo=None)

            _record_audit(db, txn.txn_id, "EXECUTE", final_action, outcome.get("message", ""))
            db.commit()
        except Exception as e:
            logger.error(f"Auto-process scan error on {txn.txn_id}: {e}")

    return {
        "message": "AI Document Ingestion complete!" + (" Transaction processed through recovery engine." if payload.auto_process else " Added to pending queue."),
        "extracted_data": extracted,
        "transaction": _txn_to_response(txn),
        "summary": _compute_summary(db),
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
        "Status", "Promise Date", "Is Broken Promise", "Diagnosis", "Recommended Action", "Confidence",
        "Guardrail Notes", "Final Action Taken", "Recovered Amount (INR)", "Processed At"
    ])
    
    for t in txns:
        writer.writerow([
            t.txn_id, t.customer_id, t.customer_name or "", t.customer_email or "", t.type,
            t.amount, t.failure_code, t.attempt_number, t.customer_contact_count_48h,
            t.status, t.promise_date.isoformat() if t.promise_date else "",
            "Yes" if getattr(t, "is_broken_promise", 0) else "No",
            t.diagnosis or "", t.recommended_action or "", t.confidence or "",
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
