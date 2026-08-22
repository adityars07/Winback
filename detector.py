"""
Winback — Detector
Pulls pending transactions sorted by amount (highest revenue at risk first).
"""

from sqlalchemy.orm import Session
from models import Transaction


def get_pending_batch(db: Session) -> list[Transaction]:
    """Fetch all pending transactions, ordered by amount descending (highest risk first)."""
    return (
        db.query(Transaction)
        .filter(Transaction.status == "pending")
        .order_by(Transaction.amount.desc())
        .all()
    )
