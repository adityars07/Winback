# ⚡ Winback — Autonomous AI Revenue Recovery Agent

> **Find revenue that's slipping away and win it back.**  
> *Production-Grade Fintech AI Agent built for the **Razorpay Buildathon — AI Revenue Recovery Track**.*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036?style=flat-square)](https://groq.com)
[![Tests](https://img.shields.io/badge/Pytest-43%20Passed-00E599?style=flat-square)](https://pytest.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## 🎯 The Problem

Indian subscription, SaaS, and e-commerce platforms lose **15% to 20% of top-line revenue** to payment failures across three critical touchpoints:
1. **Subscription Renewals**: Auto-debit declines, expired cards, balance issues.
2. **Abandoned Checkouts**: Customer drop-offs and gateway timeouts.
3. **Overdue B2B Invoices**: Delayed purchase order verifications and missing payment links.

**The Dilemma:**
- **Passive Dunning:** Doing nothing causes immediate customer churn and revenue loss.
- **Aggressive Dunning:** Naive automated retries violate **NPCI / RBI mandate regulations** (triggering severe banking penalties) or spam customers (violating TRAI contact frequency caps).

---

## 💡 The Solution: Closed-Loop AI + Deterministic Governance

**Winback** couples **high-speed LLM perception (Groq / Llama 3.3 70B)** with a **100% deterministic, pure-Python Policy Engine** that acts as an unbreachable regulatory shield.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              WINBACK 5-STAGE PIPELINE                                  │
├──────────────┬──────────────┬──────────────────┬─────────────────┬─────────────────────┤
│   1. DETECT  │ 2. DIAGNOSE  │   3. GUARDRAIL   │   4. EXECUTE    │      5. AUDIT       │
│              │    (LLM)     │     (Policy)     │                 │   (Database & UI)   │
├──────────────┼──────────────┼──────────────────┼─────────────────┼─────────────────────┤
│ Ingest txns  │ Groq API     │ Pure Python rule │ Execute action  │ Immutable SQLite    │
│ sorted by ₹  │ Llama 3.3 70B│ engine enforces  │ (smart retry,   │ audit event table   │
│ amount & risk│ + Fallback   │ NPCI windows &   │ payment link,   │ + Real-time SSE     │
│ priority     │ Heuristics   │ outreach limits  │ WhatsApp, etc.) │ React Dashboard     │
└──────────────┴──────────────┴──────────────────┴─────────────────┴─────────────────────┘
```

---

## 🛡️ Deterministic Policy Guardrails (Zero Hallucinations)

The Policy Engine ([`policy.py`](file:///c:/Users/Aditya%20RS/OneDrive/Desktop/Winback/policy.py)) operates with **zero LLM dependencies** to guarantee 100% regulatory and mathematical compliance:

| # | Guardrail Rule | Trigger Condition | Enforcement Action | Rationale |
|---|----------------|-------------------|--------------------|-----------|
| **1** | **Max Retry Limit** | `attempt_number > 3` | Override to `mark_unrecoverable` | Prevents gateway spam penalties and customer account lockouts. |
| **2** | **NPCI Mandate Retry Window** | `type == subscription_renewal` AND past `mandate_window_end` AND action is `retry_payment` | Override to `send_payment_link` | Enforces RBI/NPCI e-mandate retry cutoff compliance. |
| **3** | **Contact Frequency Cap** | `customer_contact_count_48h >= 2` AND action in (`send_reminder_whatsapp`, `send_payment_link`) | Override to `escalate_to_human` | Prevents customer harassment and spam flags (TRAI compliance). |
| **4** | **Safe Pass-Through** | None of the above triggered | Approve recommended action (`✅`) | Safe for automated financial recovery. |

---

## 🌟 Key Features & Innovations

### 🎙️ 1. Hinglish Voice Recovery Agent
- Ingests natural spoken audio / voice notes in conversational **Hinglish** (*e.g., "Bhai mera payment fail ho gaya, kal salary aayegi, 28 ko retry karna"*).
- Extracts error codes, commitment dates (*kal, parso, 28 tarikh*), amounts, and customer intent.
- Evaluates through the Policy Engine and speaks back a natural, empathetic response in Hinglish via speech synthesis.

### 🤝 2. Promise-to-Pay & Broken Promise Lifecycle
- Records customer commitments (`status: promised`) and pauses all automated dunning notifications.
- The evaluation engine (`/promises/evaluate`) checks scheduled payments. If broken, it increments attempt counters, marks `is_broken_promise`, and re-routes through the Policy Engine with escalated priority.

### ⚖️ 3. Mathematical Conservation Law
- Guarantees financial ledger integrity:
  $$\text{Total at Risk} = \text{Recovered} + \text{Escalated to Human} + \text{Marked Unrecoverable} + \text{Promised}$$
- Eliminates untracked financial leakage and computes **Effective Recovery Rate** on actionable revenue.

### ⚡ 4. Real-Time SSE Batch Streaming
- Visualizes real-time progress as transactions pass through all 5 stages via Server-Sent Events (`/run-batch/stream`).

### 📂 5. Flexible Ingestion & AI Document Scanner
- **Fuzzy CSV Importer**: Resilient matching for any merchant CSV format.
- **AI Document Scanner**: Paste raw text or invoice notes to extract structured payment failure records.

---

## 🏛️ Architecture & Tech Stack

- **Backend:** FastAPI (Python 3.12), SQLAlchemy (SQLite ORM), Pydantic v2, Groq Python SDK, httpx connection pooling.
- **LLM Engine:** Groq API (`llama-3.3-70b-versatile` / `gpt-oss-20b`) with categorized caching & deterministic fallback.
- **Policy Engine:** Pure Python deterministic rule engine.
- **Frontend:** React 18, TypeScript, Vite, Glassmorphism Dark-Mode UI, Lucide Icons, Chart.js.
- **Testing:** Pytest (8 test suites, 43 automated unit & integration tests).

---

## 📁 Repository Structure

```
Winback/
├── app.py                     # FastAPI orchestrator, SSE stream, CSV export, static server
├── models.py                  # SQLAlchemy ORM models (Transaction, AuditEvent)
├── policy.py                  # Deterministic Policy Guardrail Engine (Rules 1-4)
├── diagnosis.py               # Groq LLM diagnosis agent + retry/fallback heuristics
├── executor.py                # Action executor with domain recovery semantics
├── detector.py                # Priority-based pending batch detector
├── voice_intake.py            # Hinglish Voice AI parser & spoken audio response generator
├── generate_data.py           # Deterministic 150-record synthetic generator + demo pair
├── generate_75_test_batch.py  # 75-record compliance-benchmarked dataset generator
├── synthetic_75_failed_transactions.csv # Benchmark CSV dataset
├── requirements.txt           # Python backend dependencies
├── tests/                     # 8 comprehensive pytest test suites (43 tests)
│   ├── test_policy.py                 # Guardrail rules verification
│   ├── test_deterministic_execution.py# Action execution consistency
│   ├── test_promise_to_pay.py         # Promise lifecycle & broken promise re-dunning
│   ├── test_voice_intake.py           # Voice parsing & Hinglish response validation
│   ├── test_api_endpoints.py          # REST endpoint validation
│   ├── test_batch_verification.py     # Batch processing checks
│   ├── test_demo_transactions.py      # Golden demo pair fixtures
│   └── test_metrics_math.py           # Conservation law & recovery rate math
└── frontend/                  # React 18 + TypeScript + Vite Dashboard
    ├── src/
    │   ├── App.tsx                    # Main state management & SSE listener
    │   ├── types.ts                   # TypeScript data contracts
    │   ├── styles.css                 # Glassmorphism dark-mode styles
    │   └── components/
    │       ├── Header.tsx             # Top navigation & CTA bar
    │       ├── Navbar.tsx             # Navigation menu
    │       ├── HeroSection.tsx        # Hero banner with value proposition
    │       ├── StatsBar.tsx           # Quick metric highlights
    │       ├── KpiCards.tsx           # Revenue & recovery KPI cards
    │       ├── PipelineFlow.tsx       # Visual 5-stage pipeline indicator
    │       ├── AnalyticsCharts.tsx    # Recovery breakdown charts (Chart.js)
    │       ├── LiveConsoleSection.tsx # Real-time batch console & live logs
    │       ├── AuditTrailTable.tsx    # Filterable & searchable audit table
    │       ├── TransactionModal.tsx   # Transaction details & audit drawer
    │       ├── VoiceIntakeModal.tsx   # Interactive Voice Agent simulator
    │       ├── UploadModal.tsx        # CSV and Document scanner modal
    │       ├── ComparisonSection.tsx  # Winback vs. Traditional Dunning
    │       ├── RecoveryLadderSection.tsx # Escalation ladder explanation
    │       └── BrandLogo.tsx          # Winback animated brand icon
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 Quickstart Guide

### 1. Clone & Install Dependencies

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Install Frontend dependencies & build bundle
cd frontend
npm install
npm run build
cd ..
```

### 2. Configure Environment (Optional)

Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
```
*(Note: If `GROQ_API_KEY` is omitted, Winback seamlessly uses its built-in rule-based diagnosis heuristic).*

### 3. Seed Synthetic Data (150 Deterministic Records)

```bash
python generate_data.py
```

### 4. Run Automated Test Suite

```bash
python -m pytest tests/ -v
```

### 5. Launch the Application

```bash
uvicorn app:app --reload --port 8000
```

Open **`http://localhost:8000`** in your browser.

---

## 🎬 Presentation Demo Guide

Winback includes two dedicated fixture records pre-configured for live presentations:

1. **`TXN-DEMO-001` (Aarav Sharma — ₹12,499.00)**:
   - **Scenario**: Subscription renewal failed due to transient bank timeout within active mandate window.
   - **Outcome**: LLM recommends `retry_payment` ➔ Policy Engine **Approves (`✅`)** ➔ Recovered via secondary route.
2. **`TXN-DEMO-002` (Priya Patel — ₹8,750.00)**:
   - **Scenario**: Subscription renewal failed due to insufficient funds, but mandate window expired 2 days ago.
   - **Outcome**: LLM recommends `retry_payment` ➔ Policy Engine **Overrides (`⛔ Rule 2`)** to `send_payment_link` to guarantee NPCI compliance.

Click **"Load 2 Demo Records"** or **"Run Recovery Batch"** in the Live Console to execute the demonstration live.

---

## 📝 License

Built for the **Razorpay Buildathon 2026**. Licensed under the [MIT License](LICENSE).
