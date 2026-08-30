import React from 'react';
import { Play, Download, Upload, Zap, ShieldCheck, Activity, Database, CheckCircle2, RefreshCw, Cpu, Trash2, Mic, Target } from 'lucide-react';
import { Transaction, SummaryStats } from '../types';
import { AnalyticsCharts } from './AnalyticsCharts';
import { AuditTrailTable } from './AuditTrailTable';
import { PipelineFlow } from './PipelineFlow';

interface LiveConsoleSectionProps {
  summary: SummaryStats | null;
  transactions: Transaction[];
  onRunBatch: () => void;
  onClear: () => void;
  onProcessSingleTxn: (txn_id: string) => void;
  onExport: () => void;
  onOpenUpload: () => void;
  onOpenVoiceModal: () => void;
  onSelectTxn: (txn: Transaction) => void;
  isProcessing: boolean;
  progress: { current: number; total: number } | null;
}

export const LiveConsoleSection: React.FC<LiveConsoleSectionProps> = ({
  summary,
  transactions,
  onRunBatch,
  onClear,
  onProcessSingleTxn,
  onExport,
  onOpenUpload,
  onOpenVoiceModal,
  onSelectTxn,
  isProcessing,
  progress,
}) => {
  const formatInr = (val: number | undefined) => {
    const num = val ?? 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalAtRisk = formatInr(summary?.total_at_risk);
  const recoverableRevenue = formatInr(summary?.recoverable_revenue);
  const totalRecovered = formatInr(summary?.total_recovered);
  const effectiveRate = summary ? `${summary.effective_recovery_rate.toFixed(1)}%` : '0.0%';
  const grossRate = summary ? `${summary.gross_recovery_rate.toFixed(1)}%` : '0.0%';
  const guardrailBlocks = summary ? summary.guardrail_blocks : 0;
  const guardrailAmount = formatInr(summary?.guardrail_blocked_amount);

  return (
    <section className="live-console-section" id="console">
      <div className="container-wide">
        {/* Luxury Obsidian Console Header Bar */}
        <div className="console-header-bar">
          <div className="console-title-area">
            <h2>
              <Activity size={24} color="#00E599" />
              <span>Live Recovery Engine Console</span>
              <span className="engine-status-tag">
                <Cpu size={12} />
                Production Groq AI + Policy Guardrails
              </span>
            </h2>
            <p className="console-subtitle">
              Real-time payment recovery pipeline, mathematical revenue conservation, NPCI regulatory guardrails & immutable audit log.
            </p>
          </div>

          <div className="console-actions-group">
            <button
              className="btn-console-action"
              onClick={onOpenVoiceModal}
              title="Voice Recovery Studio & Live Calling"
              style={{ color: '#38BDF8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
            >
              <Mic size={13} color="#38BDF8" />
              <span>Voice Intake AI</span>
            </button>

            <button
              className="btn-console-action"
              onClick={onOpenUpload}
              title="Import CSV Dataset or AI Scan Invoices"
            >
              <Upload size={13} />
              <span>Ingest Dataset (CSV/OCR)</span>
            </button>

            <button
              className="btn-console-action"
              onClick={onExport}
              title="Download Full Audit Trail CSV"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            <button
              className="btn-console-action"
              onClick={onClear}
              disabled={isProcessing}
              title="Reset all transactions"
              style={{ color: '#FB7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
            >
              <Trash2 size={13} />
              <span>Clear Database</span>
            </button>

            <button
              className="btn-console-action btn-console-primary"
              onClick={onRunBatch}
              disabled={isProcessing || transactions.filter((t) => t.status === 'pending').length === 0}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>
                    {progress
                      ? `Processing (${progress.current}/${progress.total})...`
                      : 'Executing Batch...'}
                  </span>
                </>
              ) : (
                <>
                  <Play size={14} />
                  <span>Execute Recovery Batch</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live SSE Progress Stream Box */}
        {isProcessing && progress && (
          <div className="progress-stream-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#E2E8F0', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="status-dot-pulse" />
                <span>Executing Deterministic Recovery Pipeline...</span>
              </span>
              <span style={{ fontFamily: 'monospace', color: '#00E599' }}>
                {progress.current} / {progress.total} transactions processed ({progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%)
              </span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{
                  width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
                }}
              />
            </div>
          </div>
        )}

        {/* Mathematically Defensible 5-Card KPI Grid */}
        <div className="dashboard-kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {/* Card 1: Revenue at Risk */}
          <div className="kpi-card-luxury at-risk">
            <div className="kpi-header">
              <span className="kpi-label">Revenue at Risk</span>
              <div className="kpi-icon-pod">
                <Database size={16} color="#FBBF24" />
              </div>
            </div>
            <div className="kpi-val">{totalAtRisk}</div>
            <div className="kpi-sub">
              <span>●</span> Gross failed volume ({summary?.total_transactions || 0} total)
            </div>
          </div>

          {/* Card 2: Recoverable Revenue */}
          <div className="kpi-card-luxury" style={{ borderBottom: '2px solid #38BDF8' }}>
            <div className="kpi-header">
              <span className="kpi-label">Recoverable Revenue</span>
              <div className="kpi-icon-pod">
                <Target size={16} color="#38BDF8" />
              </div>
            </div>
            <div className="kpi-val" style={{ color: '#38BDF8' }}>{recoverableRevenue}</div>
            <div className="kpi-sub">
              <span>●</span> Actionable pool (excl. hard limits)
            </div>
          </div>

          {/* Card 3: Revenue Recovered */}
          <div className="kpi-card-luxury recovered">
            <div className="kpi-header">
              <span className="kpi-label">Revenue Recovered</span>
              <div className="kpi-icon-pod">
                <CheckCircle2 size={16} color="#00E599" />
              </div>
            </div>
            <div className="kpi-val">{totalRecovered}</div>
            <div className="kpi-sub">
              <span>●</span> Won back via Smart Retry & UPI Links
            </div>
          </div>

          {/* Card 4: Recovery Rate */}
          <div className="kpi-card-luxury rate">
            <div className="kpi-header">
              <span className="kpi-label">Effective Recovery Rate</span>
              <div className="kpi-icon-pod">
                <Zap size={16} color="#38BDF8" />
              </div>
            </div>
            <div className="kpi-val">{effectiveRate}</div>
            <div className="kpi-sub">
              <span>●</span> Gross portfolio yield: {grossRate}
            </div>
          </div>

          {/* Card 5: Policy Blocks */}
          <div className="kpi-card-luxury guardrails">
            <div className="kpi-header">
              <span className="kpi-label">Policy Blocks</span>
              <div className="kpi-icon-pod">
                <ShieldCheck size={16} color="#FB7185" />
              </div>
            </div>
            <div className="kpi-val">{guardrailBlocks}</div>
            <div className="kpi-sub">
              <span>●</span> {guardrailAmount} protected from breaches ⛔
            </div>
          </div>
        </div>

        {/* Closed-Loop Pipeline Flow */}
        <div className="pipeline-luxury-section">
          <PipelineFlow />
        </div>

        {/* Analytics Charts */}
        <AnalyticsCharts summary={summary} transactions={transactions} />

        {/* High Density Searchable Audit Table */}
        <AuditTrailTable
          transactions={transactions}
          onSelectTxn={onSelectTxn}
          onOpenUpload={onOpenUpload}
          onProcessSingleTxn={onProcessSingleTxn}
          onRunBatch={onRunBatch}
        />
      </div>
    </section>
  );
};
