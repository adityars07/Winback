import React from 'react';
import { Play, RotateCcw, Download, Zap, Upload, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onRunBatch: () => void;
  onReset: () => void;
  onExport: () => void;
  onOpenUpload: () => void;
  isProcessing: boolean;
  progress: { current: number; total: number } | null;
}

export const Header: React.FC<HeaderProps> = ({
  onRunBatch,
  onReset,
  onExport,
  onOpenUpload,
  isProcessing,
  progress,
}) => {
  return (
    <>
      <div className="top-glow-bar" />
      <header className="header">
        <div className="header-left">
          <div className="logo-icon">
            <Zap size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span className="rzp-badge">
                <ShieldCheck size={12} /> Razorpay / Buildathon Track 03
              </span>
            </div>
            <h1>
              <span>Win</span><span className="brand-highlight">back</span>
            </h1>
            <div className="header-subtitle">
              Autonomous AI Revenue Recovery Agent & Policy Enforcement Engine
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={onOpenUpload}
            title="Import CSV or Scan Invoices with AI"
          >
            <Upload size={14} /> Ingest Data
          </button>

          <button
            className="btn btn-secondary"
            onClick={onExport}
            title="Download Audit Log as CSV"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            className="btn btn-secondary"
            onClick={onReset}
            disabled={isProcessing}
            title="Re-seed synthetic data"
          >
            <RotateCcw size={14} /> Reset Data
          </button>

          <button
            className="btn btn-primary"
            onClick={onRunBatch}
            disabled={isProcessing}
          >
            <Play size={14} />
            {isProcessing
              ? progress
                ? `Executing Batch (${progress.current}/${progress.total})...`
                : 'Executing...'
              : 'Run Recovery Batch'}
          </button>
        </div>
      </header>
    </>
  );
};
