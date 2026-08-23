import React from 'react';
import { Play, RotateCcw, Download, Zap } from 'lucide-react';

interface HeaderProps {
  onRunBatch: () => void;
  onReset: () => void;
  onExport: () => void;
  isProcessing: boolean;
  progress: { current: number; total: number } | null;
}

export const Header: React.FC<HeaderProps> = ({
  onRunBatch,
  onReset,
  onExport,
  isProcessing,
  progress,
}) => {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-icon">
          <Zap size={24} color="#ffffff" />
        </div>
        <div>
          <h1>
            <span>Win</span>back
          </h1>
          <div className="header-subtitle">
            Autonomous AI Payment Recovery & Policy Enforcement Agent
          </div>
        </div>
      </div>

      <div className="header-actions">
        <button
          className="btn btn-secondary"
          onClick={onExport}
          title="Download Audit Log as CSV"
        >
          <Download size={15} /> Export CSV
        </button>

        <button
          className="btn btn-secondary"
          onClick={onReset}
          disabled={isProcessing}
          title="Re-seed synthetic data"
        >
          <RotateCcw size={15} /> Reset Data
        </button>

        <button
          className="btn btn-primary"
          onClick={onRunBatch}
          disabled={isProcessing}
        >
          <Play size={15} />
          {isProcessing
            ? progress
              ? `Processing (${progress.current}/${progress.total})...`
              : 'Processing...'
            : 'Run Recovery Batch'}
        </button>
      </div>
    </header>
  );
};
