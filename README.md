# ⚡ Winback — AI Payment Recovery Agent (MVP)

> **Find revenue that's slipping away and win it back.**

Winback is a production-grade fintech AI agent that detects failed/at-risk payments, diagnoses root causes using LLMs, enforces deterministic guardrail policies, executes bounded recovery actions, and records immutable audit event trails — all presented in a real-time **React + TypeScript** dashboard.

Built for the **Razorpay Buildathon — AI Revenue Recovery Track**.

---

## 🎯 Problem Statement

Payment loss occurs across multiple touchpoints: subscription renewals fail, checkout sessions get abandoned, and B2B invoices fall overdue. Platforms often either react passively (losing revenue) or overly aggressively (violating NPCI mandate windows or customer outreach limits).

**Winback** delivers a closed-loop system: **Detect → Diagnose → Guardrail → Execute → Audit**.
- **AI (Groq / Llama 3.3 70B)** provides root cause intelligence and action recommendations.
- **Deterministic Policy Engine** enforces strict compliance rules (NPCI mandate retry windows, contact frequency caps, max retry limits).

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WINBACK MVP ARCHITECTURE                     │
├─────────┬──────────────┬──────────────┬───────────┬─────────────┤
│ DETECT  │  DIAGNOSE    │  GUARDRAIL   │  EXECUTE  │   AUDIT     │
│         │   (LLM)      │  (Policy)    │  (Sim)    │   (DB & UI) │
│ Pull    │  Groq API    │  Max Retries │  retry    │  SQLite +   │
│ pending │  Llama 3.3   │  Mandate     │  link     │  AuditEvents│
│ txns    │  70B +       │  Window      │  WhatsApp │  React +    │
│ by ₹    │  Fallback    │  Contact     │  escalate │  TypeScript │
│ amount  │  Heuristic   │  Limit       │  mark     │  Dashboard  │
└─────────┴──────────────┴──────────────┴───────────┴─────────────┘
```

---

## 🛡️ Policy Engine Guardrails (100% Deterministic & Unit Tested)

The policy engine is written in pure Python without LLM dependencies to guarantee compliance:

| # | Guardrail Rule | Trigger Condition | Enforcement Action |
|---|----------------|-------------------|--------------------|
| 1 | **Max Retry Limit** | `attempt_number > 3` | Override to `mark_unrecoverable` |
| 2 | **NPCI Mandate Retry Window** | `type == subscription_renewal` AND past `mandate_window_end` AND action is `retry_payment` | Override to `send_payment_link` |
| 3 | **Outreach Limit** | `customer_contact_count_48h >= 2` AND action is `send_reminder_whatsapp` or `send_payment_link` | Override to `escalate_to_human` |
| 4 | **Safe Pass-through** | None of the above triggered | Approve recommended action |

---

## 🚀 Key MVP Features

- **React 18 + TypeScript + Vite Dashboard**: Type-safe components, high-density audit log, interactive metrics, and Chart.js analytics.
- **Real-time SSE Batch Streaming**: Live progress visualization as transactions are diagnosed & executed (`/run-batch/stream`).
- **Audit Event Timeline Drawer**: Click any transaction to inspect granular audit logs (`DETECT`, `DIAGNOSE`, `GUARDRAIL`, `EXECUTE`) and visual decision diffs.
- **Resilient LLM Agent**: Groq API (`llama-3.3-70b-versatile`) with exponential backoff retries and an automatic fallback heuristic so live demos never fail.
- **CSV Audit Export**: One-click download of all transaction logs (`/export/csv`).
- **Automated Unit Test Suite**: `pytest` coverage for all guardrails and edge cases.

---

## 💻 Setup & Execution Guide

### 1. Install Backend & Frontend Dependencies

```bash
# Python dependencies
pip install -r requirements.txt

# Frontend dependencies & build
cd frontend
npm install
npm run build
cd ..
```

### 2. Set API Key (Optional)

```powershell
# Windows PowerShell
$env:GROQ_API_KEY="your_groq_api_key_here"

# Linux / macOS
export GROQ_API_KEY="your_groq_api_key_here"
```
*(Note: If `GROQ_API_KEY` is omitted, Winback seamlessly uses its rule-based diagnosis heuristic).*

### 3. Seed Synthetic Data (150 Transactions)

```bash
python generate_data.py
```

### 4. Run Unit Tests

```bash
python -m pytest tests/ -v
```

### 5. Launch Backend + Dashboard (Single Command)

```bash
uvicorn app:app --reload --port 8000
```

Open **`http://localhost:8000`** in your browser.

---

## 📁 Repository Structure

```
Winback/
├── app.py                  # FastAPI backend, SSE stream, CSV export, Static file server
├── models.py               # SQLAlchemy ORM (Transaction & AuditEvent tables)
├── generate_data.py        # Synthetic generator (150 realistic Indian transaction records)
├── detector.py             # Pending failure batch detector
├── diagnosis.py            # Groq LLM diagnosis agent + retry/fallback
├── policy.py               # Deterministic policy engine
├── executor.py             # Action executor (simulated recovery conversion)
├── tests/
│   └── test_policy.py      # Pytest unit test suite for policy guardrails
├── requirements.txt        # Backend dependencies (fastapi, uvicorn, sqlalchemy, groq, pytest)
├── frontend/               # React 18 + TypeScript + Vite Dashboard
│   ├── src/
│   │   ├── components/     # Header, KpiCards, PipelineFlow, AnalyticsCharts, AuditTrailTable, TransactionModal
│   │   ├── types.ts        # TypeScript data contracts
│   │   ├── styles.css      # Glassmorphism dark-mode styles
│   │   ├── App.tsx         # Main React state & SSE listener
│   │   └── main.tsx        # React entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

---

## 📝 License

Built for Razorpay Buildathon 2026. MIT License.
