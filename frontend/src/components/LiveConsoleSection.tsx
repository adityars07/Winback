import React from 'react';
import { Play, RotateCcw, Download, Upload, Zap, ShieldCheck, Activity, Database, CheckCircle2, RefreshCw, Cpu, Trash2, Sparkles } from 'lucide-react';
import { Transaction, SummaryStats } from '../types';
import { AnalyticsCharts } from './AnalyticsCharts';
import { AuditTrailTable } from './AuditTrailTable';
import { PipelineFlow } from './PipelineFlow';

interface LiveConsoleSectionProps {
  summary: SummaryStats | null;
  transactions: Transaction[];
  onRunBatch: () => void;
  onClear: () => void;
  onSeedDemo: () => void;
  onExport: () => void;
  onOpenUpload: () => void;
  onSelectTxn: (txn: Transaction) => void;
  isProcessing: boolean;
  progress: { current: number; total: number } | null;
}

export const LiveConsoleSection: React.FC<LiveConsoleSectionProps> = ({
  summary,
  transactions,
  onRunBatch,
  onClear,
  onSeedDemo,
  onExport,
  onOpenUpload,
  onSelectTxn,
  isProcessing,
  progress,
}) => {
  const formatInr = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalAtRisk = summary ? formatInr(summary.total_at_risk) : '₹0.00';
  const totalRecovered = summary ? formatInr(summary.total_recovered) : '₹0.00';
  const recoveryRate = summary ? `${summary.recovery_rate}%` : '0.0%';
  const guardrailBlocks = summary ? summary.guardrail_blocks : 0;

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
                Groq Llama 3.3 70B Active
              </span>
            </h2>
            <p className="console-subtitle">
              Real-time SSE event pipeline, closed-loop AI root-cause diagnosis, deterministic guardrails & immutable audit trail.
            </p>
          </div>

          <div className="console-actions-group">
            <button
              className="btn-console-action"
              onClick={onOpenUpload}
              title="Import CSV or AI Scan Invoices"
            >
              <Upload size={13} />
              <span>Ingest Invoices</span>
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
              title="Completely wipe all transactions to 0"
              style={{ color: '#FB7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
            >
              <Trash2 size={13} />
              <span>Clear All</span>
            </button>

            <button
              className="btn-console-action"
              onClick={onSeedDemo}
              disabled={isProcessing}
              title="Load 150 synthetic transactions for testing"
            >
              <Sparkles size={13} color="#00E599" />
              <span>Load 150 Demo Records</span>
            </button>

            <button
              className="btn-console-action btn-console-primary"
              onClick={onRunBatch}
              disabled={isProcessing || transactions.length === 0}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>
                    {progress
                      ? `Diagnosing (${progress.current}/${progress.total})...`
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
                <span>Streaming Live AI Diagnosis & Policy Enforcement...</span>
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

        {/* Luxury Glowing Obsidian KPI Row */}
        <div className="dashboard-kpi-row">
          <div className="kpi-card-luxury at-risk">
            <div className="kpi-header">
              <span className="kpi-label">Total At-Risk Revenue</span>
              <div className="kpi-icon-pod">
                <Database size={16} color="#FBBF24" />
              </div>
            </div>
            <div className="kpi-val">{totalAtRisk}</div>
            <div className="kpi-sub">
              <span>●</span> Pending failure queue ({summary?.total_transactions || 0} records)
            </div>
          </div>

          <div className="kpi-card-luxury recovered">
            <div className="kpi-header">
              <span className="kpi-label">Recovered Revenue</span>
              <div className="kpi-icon-pod">
                <CheckCircle2 size={16} color="#00E599" />
              </div>
            </div>
            <div className="kpi-val">{totalRecovered}</div>
            <div className="kpi-sub">
              <span>●</span> Won back via AI retries & WhatsApp UPI
            </div>
          </div>

          <div className="kpi-card-luxury rate">
            <div className="kpi-header">
              <span className="kpi-label">Recovery Conversion Rate</span>
              <div className="kpi-icon-pod">
                <Zap size={16} color="#38BDF8" />
              </div>
            </div>
            <div className="kpi-val">{recoveryRate}</div>
            <div className="kpi-sub">
              <span>●</span> Benchmark: 18% standard dunning
            </div>
          </div>

          <div className="kpi-card-luxury guardrails">
            <div className="kpi-header">
              <span className="kpi-label">Guardrail Policy Blocks</span>
              <div className="kpi-icon-pod">
                <ShieldCheck size={16} color="#FB7185" />
              </div>
            </div>
            <div className="kpi-val">{guardrailBlocks}</div>
            <div className="kpi-sub">
              <span>●</span> NPCI/RBI regulatory breaches prevented ⛔
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
          onSeedDemo={onSeedDemo}
          onOpenUpload={onOpenUpload}
        />
      </div>
    </section>
  );
};
