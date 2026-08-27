import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, Zap, RefreshCw, Layers, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react';
import { SummaryStats } from '../types';

interface HeroSectionProps {
  summary: SummaryStats | null;
  onRunBatch: () => void;
  onScrollToSection: (id: string) => void;
  onOpenConsole: () => void;
  isProcessing: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  summary,
  onRunBatch,
  onScrollToSection,
  onOpenConsole,
  isProcessing,
}) => {
  const [activeDashTab, setActiveDashTab] = useState<'overview' | 'stream' | 'guardrails' | 'audit'>('overview');

  // Format currency helpers
  const formatInr = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const totalAtRisk = summary ? formatInr(summary.total_at_risk) : '₹48.2L';
  const totalRecovered = summary ? formatInr(summary.total_recovered) : '₹31.6L';
  const recoveryRate = summary ? `${summary.recovery_rate}%` : '65.5%';

  return (
    <section className="hero-section" id="hero">
      <div className="container">
        {/* Main Title (Mirrors Fathom headline) */}
        <h1 className="hero-title">
          Recover lost revenue more efficiently with Winback
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle">
          Winback connects to payment gateways, diagnoses failed transactions with Groq Llama 3.3 70B AI, enforces deterministic NPCI compliance guardrails, and wins back at-risk revenue — refreshed every second.
        </p>

        {/* Dual CTAs */}
        <div className="hero-cta-group">
          <button
            className="btn-pill-dark"
            onClick={() => {
              onOpenConsole();
              onRunBatch();
            }}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing Recovery Batch...' : 'Recover at-risk revenue'}
            <ArrowRight size={14} />
          </button>

          <button
            className="btn-pill-outline"
            onClick={() => onScrollToSection('comparison')}
          >
            Inspect Guardrail Engine
          </button>
        </div>

        {/* Trust Footnote */}
        <div className="hero-trust-line">
          Live in under 15 minutes · Zero risk to NPCI compliance · 100% Deterministic Policy Engine
        </div>

        {/* The Emerald Hero Dashboard Showcase Card */}
        <div className="hero-dashboard-wrapper">
          <div className="hero-dashboard-card">
            {/* Top Navigation Bar of the Mock */}
            <div className="dashboard-top-nav">
              <div className="dashboard-tabs">
                <button
                  className={`dash-tab-btn ${activeDashTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveDashTab('overview')}
                >
                  Overview
                </button>
                <button
                  className={`dash-tab-btn ${activeDashTab === 'stream' ? 'active' : ''}`}
                  onClick={() => setActiveDashTab('stream')}
                >
                  Live Stream
                </button>
                <button
                  className={`dash-tab-btn ${activeDashTab === 'guardrails' ? 'active' : ''}`}
                  onClick={() => setActiveDashTab('guardrails')}
                >
                  Guardrails
                </button>
                <button
                  className={`dash-tab-btn ${activeDashTab === 'audit' ? 'active' : ''}`}
                  onClick={() => setActiveDashTab('audit')}
                >
                  Audit Trail
                </button>
              </div>

              <div className="dash-sync-status">
                <span className="dash-sync-dot" />
                <span>All 47 gateways synced: 2s ago</span>
              </div>
            </div>

            {/* Dashboard Metric Ribbon */}
            <div className="dash-metrics-grid">
              <div className="dash-metric-item">
                <div className="dash-metric-label">Total At-Risk</div>
                <div className="dash-metric-value">{totalAtRisk}</div>
                <div className="dash-metric-sub">+14.2% pending batch</div>
              </div>

              <div className="dash-metric-item">
                <div className="dash-metric-label">Recovered Today</div>
                <div className="dash-metric-value">{totalRecovered}</div>
                <div className="dash-metric-sub">+₹640k auto-retries</div>
              </div>

              <div className="dash-metric-item">
                <div className="dash-metric-label">Recovery Rate</div>
                <div className="dash-metric-value">{recoveryRate}</div>
                <div className="dash-metric-sub">4.3x vs legacy dunning</div>
              </div>

              <div className="dash-metric-item">
                <div className="dash-metric-label">Runway Saved</div>
                <div className="dash-metric-value">₹1.84 Cr</div>
                <div className="dash-metric-sub sub-muted">Forecast: FY26</div>
              </div>
            </div>

            {/* 2-Column Main Showcase Grid */}
            <div className="dash-main-grid">
              {/* Left Column: Visual Recovery Curve */}
              <div className="dash-chart-card">
                <div className="dash-chart-header">
                  <span className="dash-chart-title">Revenue Recovery Trajectory — Trailing 30 Days</span>
                  <div className="dash-chart-legend">
                    <span><span className="legend-dot actual" /> Actual Recovery</span>
                    <span><span className="legend-dot forecast" /> Target Forecast</span>
                  </div>
                </div>

                <div className="svg-chart-container">
                  <svg viewBox="0 0 540 180" width="100%" height="100%" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00E599" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#00E599" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Background Grid Lines */}
                    <line x1="0" y1="40" x2="540" y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="90" x2="540" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <line x1="0" y1="140" x2="540" y2="140" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                    {/* Gradient Area Fill */}
                    <path
                      d="M 0 150 Q 70 140 130 110 T 260 85 T 380 50 L 380 180 L 0 180 Z"
                      fill="url(#emeraldGradient)"
                    />

                    {/* Main Actual Recovery Line */}
                    <path
                      d="M 0 150 Q 70 140 130 110 T 260 85 T 380 50"
                      fill="none"
                      stroke="#00E599"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* Forecast Dotted Line */}
                    <path
                      d="M 380 50 Q 450 35 540 20"
                      fill="none"
                      stroke="#EAB308"
                      strokeWidth="2.5"
                      strokeDasharray="5 5"
                    />

                    {/* Highlight Pulsing Pulse Node */}
                    <circle cx="380" cy="50" r="6" fill="#00E599" stroke="#FFFFFF" strokeWidth="2" />
                    <circle cx="380" cy="50" r="14" fill="rgba(0, 229, 153, 0.25)" className="animate-ping" />
                  </svg>
                </div>
              </div>

              {/* Right Column: Live Allocation & Policies */}
              <div className="dash-allocation-card">
                <div className="dash-allocation-header">
                  <span className="dash-allocation-title">Recovery Stream Queue</span>
                  <span style={{ fontSize: '11px', color: '#6B8077', fontFamily: 'monospace' }}>150 Queued</span>
                </div>

                <div className="dash-allocation-list">
                  <div className="dash-alloc-row">
                    <div className="alloc-row-left">
                      <div className="alloc-icon"><RefreshCw size={14} /></div>
                      <div>
                        <div className="alloc-title">Subscription Renewal · NPCI Auto-Retry</div>
                        <div className="alloc-sub">HDFC Bank · Insufficient Funds (Salary cycle synced)</div>
                      </div>
                    </div>
                    <div className="alloc-row-right">
                      <span className="alloc-amt">₹12.4L</span>
                      <span className="alloc-badge rec">92% REC</span>
                    </div>
                  </div>

                  <div className="dash-alloc-row">
                    <div className="alloc-row-left">
                      <div className="alloc-icon"><Zap size={14} /></div>
                      <div>
                        <div className="alloc-title">Checkout Dropoff · Smart WhatsApp Link</div>
                        <div className="alloc-sub">Razorpay UPI 1-Click Deep Link Generated</div>
                      </div>
                    </div>
                    <div className="alloc-row-right">
                      <span className="alloc-amt">₹9.8L</span>
                      <span className="alloc-badge rec">81% REC</span>
                    </div>
                  </div>

                  <div className="dash-alloc-row">
                    <div className="alloc-row-left">
                      <div className="alloc-icon"><AlertTriangle size={14} /></div>
                      <div>
                        <div className="alloc-title">B2B Overdue · Account Exec Escalation</div>
                        <div className="alloc-sub">Custom Enterprise terms + AI Audit Note</div>
                      </div>
                    </div>
                    <div className="alloc-row-right">
                      <span className="alloc-amt">₹4.7L</span>
                      <span className="alloc-badge auto">ESCALATED</span>
                    </div>
                  </div>

                  <div className="dash-alloc-row">
                    <div className="alloc-row-left">
                      <div className="alloc-icon"><ShieldCheck size={14} /></div>
                      <div>
                        <div className="alloc-title">UPI Intent · Instant Retry Window</div>
                        <div className="alloc-sub">Bank Timeout Resolved · Gateway Rerouted</div>
                      </div>
                    </div>
                    <div className="alloc-row-right">
                      <span className="alloc-amt">₹3.1L</span>
                      <span className="alloc-badge rec">RECOVERED</span>
                    </div>
                  </div>

                  <div className="dash-alloc-row">
                    <div className="alloc-row-left">
                      <div className="alloc-icon" style={{ color: '#F43F5E' }}><ShieldAlert size={14} /></div>
                      <div>
                        <div className="alloc-title">Max Retries Exceeded · Marked Unrecoverable</div>
                        <div className="alloc-sub">Attempt #4 Blocked by Deterministic Guardrail</div>
                      </div>
                    </div>
                    <div className="alloc-row-right">
                      <span className="alloc-amt">₹2.2L</span>
                      <span className="alloc-badge block">BLOCKED ⛔</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
