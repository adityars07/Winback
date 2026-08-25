import React, { useState } from 'react';
import { Calculator, ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface RecoveryLadderSectionProps {
  onOpenConsole: () => void;
}

export const RecoveryLadderSection: React.FC<RecoveryLadderSectionProps> = ({ onOpenConsole }) => {
  const [monthlyGmv, setMonthlyGmv] = useState<number>(5000000); // 50 Lakhs INR
  const [failureRate, setFailureRate] = useState<number>(8.5); // 8.5%

  // Winback average recovery efficiency = ~68%
  const failedGmvMonthly = (monthlyGmv * failureRate) / 100;
  const monthlyRecovered = failedGmvMonthly * 0.684;
  const annualRecovered = monthlyRecovered * 12;
  const hoursSaved = Math.round((failedGmvMonthly / 25000) * 2.5);

  const formatRupees = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakhs`;
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  return (
    <section className="recovery-ladder-section" id="ladder">
      <div className="container">
        <div className="ladder-grid">
          {/* Left Column: Ladder Flow Breakdown */}
          <div className="ladder-intro">
            <h2>Put lost revenue on a ladder, automatically.</h2>
            <p>
              Set agency rules — minimum mandate retry buffers, customer contact frequency caps, and maximum retry limits. Winback automatically sweeps every failed payment through a bounded, multi-tier recovery ladder.
            </p>

            <div className="ladder-steps-list">
              <div className="ladder-step-card">
                <div className="step-num-badge">01</div>
                <div>
                  <div className="step-content-title">Instant Gateway Smart Retry (0–2h)</div>
                  <div className="step-content-desc">
                    AI detects temporary bank server timeouts and reroutes transactions to high-uptime standby routes.
                  </div>
                </div>
              </div>

              <div className="ladder-step-card">
                <div className="step-num-badge">02</div>
                <div>
                  <div className="step-content-title">NPCI Mandate Compliant Buffer (24–48h)</div>
                  <div className="step-content-desc">
                    Deterministic guardrails calculate the valid mandate retry window, preventing card blacklisting.
                  </div>
                </div>
              </div>

              <div className="ladder-step-card">
                <div className="step-num-badge">03</div>
                <div>
                  <div className="step-content-title">Dynamic WhatsApp 1-Click UPI Payment Link</div>
                  <div className="step-content-desc">
                    Sends contextual payment links with personalized messaging and UPI intent for zero friction.
                  </div>
                </div>
              </div>

              <div className="ladder-step-card">
                <div className="step-num-badge">04</div>
                <div>
                  <div className="step-content-title">High-Value Account Executive Escalation</div>
                  <div className="step-content-desc">
                    High-ticket B2B overdue invoices are packaged with complete audit notes and routed to human reps.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive ROI Calculator */}
          <div className="roi-calculator-card" id="calculator">
            <div className="roi-card-header">
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>
                  Revenue Recovery Calculator
                </h3>
                <p style={{ fontSize: '12px', color: '#6B8077', marginTop: '2px' }}>
                  Estimate how much at-risk revenue Winback will win back for your business.
                </p>
              </div>
              <span className="roi-badge">68.4% Avg Yield</span>
            </div>

            {/* Slider 1: Monthly GMV */}
            <div className="roi-slider-group">
              <div className="slider-label-row">
                <span>Monthly Transaction Volume (GMV)</span>
                <span className="slider-val-highlight">{formatRupees(monthlyGmv)} / mo</span>
              </div>
              <input
                type="range"
                min={500000}
                max={50000000}
                step={250000}
                value={monthlyGmv}
                onChange={(e) => setMonthlyGmv(Number(e.target.value))}
                className="custom-slider"
              />
            </div>

            {/* Slider 2: Failed Payment Rate */}
            <div className="roi-slider-group">
              <div className="slider-label-row">
                <span>Estimated Payment Failure / Churn Rate</span>
                <span className="slider-val-highlight">{failureRate.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min={2.0}
                max={20.0}
                step={0.5}
                value={failureRate}
                onChange={(e) => setFailureRate(Number(e.target.value))}
                className="custom-slider"
              />
            </div>

            {/* Live Calculation Results */}
            <div className="roi-results-box">
              <div className="roi-result-metric">
                <div className="res-label">Monthly Recovered</div>
                <div className="res-val">{formatRupees(monthlyRecovered)}</div>
              </div>
              <div className="roi-result-metric">
                <div className="res-label">Annual ARR Saved</div>
                <div className="res-val">{formatRupees(annualRecovered)}</div>
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                className="btn-pill-dark"
                style={{ width: '100%', justifyContent: 'center', background: '#00E599', color: '#061A14', fontWeight: 700 }}
                onClick={onOpenConsole}
              >
                <span>Recover this revenue now in console</span>
                <ArrowRight size={14} />
              </button>
              <div style={{ fontSize: '11px', color: '#6B8077', marginTop: '10px' }}>
                ⚡ Saves approx. {hoursSaved} hours of manual finance team outreach per month.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
