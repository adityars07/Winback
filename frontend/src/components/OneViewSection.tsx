import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap, Bot, RefreshCw } from 'lucide-react';

interface OneViewSectionProps {
  onOpenConsole: () => void;
}

export const OneViewSection: React.FC<OneViewSectionProps> = ({ onOpenConsole }) => {
  return (
    <section className="one-view-section" id="one-view">
      <div className="container">
        <div className="one-view-grid">
          {/* Left Column: Narrative & Technical Specs */}
          <div className="one-view-content">
            <h2>One view of every failed rupee, every gateway, every mandate.</h2>
            <p>
              Winback connects directly to Razorpay, Stripe, Cashfree, and bank webhooks — no manual spreadsheets, no messy dunning scripts. Transactions are normalized into a single real-time intelligence stream that acts before customers churn.
            </p>

            <div className="spec-list">
              <div className="spec-row">
                <span className="spec-label">Gateway connections</span>
                <span className="spec-value">Razorpay, Stripe, Cashfree, PayU</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Refresh cadence</span>
                <span className="spec-value">Real-time SSE + Webhooks</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">AI Diagnosis Model</span>
                <span className="spec-value">Groq Llama 3.3 70B Versatile</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Policy Guardrails</span>
                <span className="spec-value">100% Deterministic (Zero Hallucinations)</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Regulatory compliance</span>
                <span className="spec-value">NPCI Mandate Circular 2021/48</span>
              </div>
            </div>

            <button
              className="btn-pill-dark"
              onClick={onOpenConsole}
            >
              <span>See live stream in console</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Right Column: Dark Emerald Live Failures Feed */}
          <div className="live-stream-preview-card">
            <div className="stream-card-header">
              <span className="stream-card-title">Live Payment Ingestion & Audit Stream</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#00E599', fontFamily: 'monospace' }}>
                <span className="status-dot-pulse" />
                <span>LIVE FEED</span>
              </div>
            </div>

            {/* Event 1 */}
            <div className="stream-event-item">
              <div className="stream-event-top">
                <span className="stream-event-customer">Aarav Mehta · SaaS Pro Plan</span>
                <span className="stream-event-amt">₹14,999.00</span>
              </div>
              <div className="stream-event-diag">
                Groq AI: Card expired during monthly auto-debit. Generated personalized 1-click update link with 48h NPCI buffer.
              </div>
              <div className="stream-event-badges">
                <span className="alloc-badge rec">✓ RECOVERED IN 4 MIN</span>
                <span className="alloc-badge auto">WHATSAPP UPI SENT</span>
              </div>
            </div>

            {/* Event 2 */}
            <div className="stream-event-item">
              <div className="stream-event-top">
                <span className="stream-event-customer">Pooja Nair · D2C Cart Abandonment</span>
                <span className="stream-event-amt">₹3,450.00</span>
              </div>
              <div className="stream-event-diag">
                Groq AI: UPI checkout drop-off after bank timeout. Re-triggered dynamic Razorpay QR link with 5% completion discount.
              </div>
              <div className="stream-event-badges">
                <span className="alloc-badge rec">✓ AUTO-CONVERTED</span>
                <span className="alloc-badge auto">INSTANT RETRY</span>
              </div>
            </div>

            {/* Event 3 */}
            <div className="stream-event-item">
              <div className="stream-event-top">
                <span className="stream-event-customer">Vikram Enterprises · Annual License</span>
                <span className="stream-event-amt">₹84,000.00</span>
              </div>
              <div className="stream-event-diag">
                Groq AI: Attempt #4 detected. Policy Guardrail #1 enforced: Overrode retry to Human Account Exec Escalation.
              </div>
              <div className="stream-event-badges">
                <span className="alloc-badge block">⛔ GUARDRAIL ENFORCED</span>
                <span className="alloc-badge auto">ESCALATED TO CRM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
