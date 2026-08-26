"""
Winback — API End-to-End Integration Tests
Tests all HTTP endpoints, demo seeds, single-transaction processing, and batch runs.
"""

import pytest
from fastapi.testclient import TestClient
from app import app
from generate_data import seed_database

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_demo_pair_workflow():
    # 1. Seed demo pair
    seed_res = client.post("/demo/seed-pair")
    assert seed_res.status_code == 200
    assert "TXN-DEMO-001" in seed_res.json()["message"]

    # 2. Check summary before processing
    sum_res = client.get("/summary")
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert sum_data["total_transactions"] == 2
    assert sum_data["total_at_risk"] == 21249.0  # 12499 + 8750
    assert sum_data["total_recovered"] == 0.0
    assert sum_data["status_counts"]["pending"] == 2

    # 3. Process Demo 1 (Success path)
    d1_res = client.post("/transactions/TXN-DEMO-001/process")
    assert d1_res.status_code == 200
    d1_data = d1_res.json()
    assert d1_data["transaction"]["status"] == "recovered"
    assert d1_data["transaction"]["recovered_amount"] == 12499.0
    assert d1_data["outcome"]["success"] is True

    # 4. Process Demo 2 (Guardrail block path)
    d2_res = client.post("/transactions/TXN-DEMO-002/process")
    assert d2_res.status_code == 200
    d2_data = d2_res.json()
    assert "⛔" in d2_data["transaction"]["guardrail_notes"]
    assert d2_data["transaction"]["final_action_taken"] == "send_payment_link"
    assert d2_data["transaction"]["status"] == "recovered"
    assert d2_data["transaction"]["recovered_amount"] == 8750.0

    # 5. Check post-demo summary metrics
    final_sum = client.get("/summary").json()
    assert final_sum["total_recovered"] == 21249.0
    assert final_sum["status_counts"]["pending"] == 0
    assert final_sum["guardrail_blocks"] == 1
    assert final_sum["guardrail_blocked_amount"] == 8750.0
    assert final_sum["effective_recovery_rate"] == 100.0


def test_full_150_reset_and_batch_api():
    # 1. Reset 150 records
    reset_res = client.post("/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["summary"]["total_transactions"] == 150

    # 2. Run batch via API
    batch_res = client.post("/run-batch")
    assert batch_res.status_code == 200
    batch_data = batch_res.json()
    assert batch_data["processed"] == 150
    assert batch_data["status_counts"]["pending"] == 0
    assert batch_data["total_recovered"] > 0
    assert batch_data["recoverable_revenue"] > 0
    assert batch_data["effective_recovery_rate"] > 0
    assert batch_data["guardrail_blocks"] > 0


def test_clear_database_api():
    clear_res = client.post("/clear")
    assert clear_res.status_code == 200
    sum_data = client.get("/summary").json()
    assert sum_data["total_transactions"] == 0
    assert sum_data["total_at_risk"] == 0.0
