"""
Winback — Database models (SQLAlchemy ORM)
"""

from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Enum as SAEnum
from sqlalchemy.orm import declarative_base, sessionmaker
import enum

DATABASE_URL = "sqlite:///winback.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class TransactionType(str, enum.Enum):
    subscription_renewal = "subscription_renewal"
    checkout_abandoned = "checkout_abandoned"
    invoice_overdue = "invoice_overdue"


class FailureCode(str, enum.Enum):
    insufficient_funds = "insufficient_funds"
    card_expired = "card_expired"
    bank_timeout = "bank_timeout"
    mandate_declined = "mandate_declined"
    checkout_dropoff = "checkout_dropoff"
    invoice_overdue = "invoice_overdue"


class TransactionStatus(str, enum.Enum):
    pending = "pending"
    recovered = "recovered"
    unrecoverable = "unrecoverable"
    escalated = "escalated"


class Transaction(Base):
    __tablename__ = "transactions"

    txn_id = Column(String, primary_key=True, unique=True)
    customer_id = Column(String, nullable=False)
    type = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    failure_code = Column(String, nullable=False)
    attempt_number = Column(Integer, default=1)
    last_attempt_ts = Column(DateTime, nullable=False)
    mandate_window_end = Column(DateTime, nullable=True)
    customer_contact_count_48h = Column(Integer, default=0)
    status = Column(String, default="pending")
    diagnosis = Column(String, nullable=True)
    recommended_action = Column(String, nullable=True)
    guardrail_notes = Column(String, nullable=True)
    final_action_taken = Column(String, nullable=True)
    recovered_amount = Column(Float, default=0.0)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
