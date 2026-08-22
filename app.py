"""
Winback — FastAPI Backend
Orchestrator endpoints for the payment recovery pipeline.
"""

import os
import traceback
from datetime import datetime
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from models import init_db, get_db, Transaction, SessionLocal
from detector import get_pending_batch
from diagnosis import diagnose_transaction
from policy import apply_policy
from executor import execute_action


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Winback — AI Payment Recovery Agent",
    description="Detects failed payments, diagnoses root causes via LLM, applies guardrail policies, and executes recovery actions.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
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
        "guardrail_notes": txn.guardrail_notes,
        "final_action_taken": txn.final_action_taken,
        "recovered_amount": txn.recovered_amount,
    }


def _compute_summary(db: Session) -> dict:
    all_txns = db.query(Transaction).all()
    total_at_risk = sum(t.amount for t in all_txns)
    total_recovered = sum(t.recovered_amount for t in all_txns)
    recovery_rate = (total_recovered / total_at_risk * 100) if total_at_risk > 0 else 0

    status_counts = {}
    for t in all_txns:
        status_counts[t.status] = status_counts.get(t.status, 0) + 1

    guardrail_blocks = sum(1 for t in all_txns if t.guardrail_notes and "⛔" in t.guardrail_notes)

    return {
        "total_at_risk": round(total_at_risk, 2),
        "total_recovered": round(total_recovered, 2),
        "recovery_rate": round(recovery_rate, 2),
        "total_transactions": len(all_txns),
        "status_counts": status_counts,
        "guardrail_blocks": guardrail_blocks,
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "Winback", "status": "running", "version": "1.0.0"}


@app.get("/transactions")
def list_transactions(db: Session = Depends(get_db)):
    """Return all transactions with their current state (audit log)."""
    txns = db.query(Transaction).order_by(Transaction.amount.desc()).all()
    return {
        "transactions": [_txn_to_response(t) for t in txns],
        "total": len(txns),
    }


@app.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    """Return summary stats without re-running the batch."""
    return _compute_summary(db)


@app.post("/run-batch")
def run_batch(db: Session = Depends(get_db)):
    """
    Orchestrator: pull pending → diagnose → apply policy → execute → update DB.
    """
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
            # Step 3: Diagnosis (LLM call)
            diagnosis_result = diagnose_transaction(txn)
            txn.diagnosis = diagnosis_result.get("diagnosis", "")
            txn.recommended_action = diagnosis_result.get("recommended_action", "escalate_to_human")

            # Step 4: Policy / Guardrail Engine
            final_action, guardrail_notes = apply_policy(txn, txn.recommended_action)
            txn.guardrail_notes = guardrail_notes

            # Step 5: Execute Action
            outcome = execute_action(txn, final_action)
            results.append(outcome)

            db.commit()

        except Exception as e:
            traceback.print_exc()
            errors.append({
                "txn_id": txn.txn_id,
                "error": str(e),
            })
            db.rollback()

    summary = _compute_summary(db)
    summary["batch_size"] = len(pending)
    summary["processed"] = len(results)
    summary["errors"] = errors
    summary["transactions"] = [_txn_to_response(t) for t in pending]

    return summary


@app.post("/reset")
def reset_database(db: Session = Depends(get_db)):
    """Re-seed the database with fresh synthetic data (for demo purposes)."""
    from generate_data import seed_database
    seed_database()
    return {"message": "Database reset with fresh synthetic data.", "timestamp": datetime.utcnow().isoformat()}
