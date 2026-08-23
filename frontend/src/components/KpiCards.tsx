import React from 'react';
import { SummaryStats } from '../types';

interface KpiCardsProps {
  summary: SummaryStats | null;
}

const formatINR = (num: number | undefined): string => {
  if (num == null || isNaN(num)) return '0.00';
  const parts = Number(num).toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return `${intPart}.${decPart}`;
};

export const KpiCards: React.FC<KpiCardsProps> = ({ summary }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card at-risk">
        <div className="stat-label">Total ₹ at Risk</div>
        <div className="stat-value">
          ₹{summary ? formatINR(summary.total_at_risk) : '—'}
        </div>
        <div className="stat-subtitle">
          across {summary?.total_transactions ?? 0} transactions
        </div>
      </div>

      <div className="stat-card recovered">
        <div className="stat-label">Total ₹ Recovered</div>
        <div className="stat-value">
          ₹{summary ? formatINR(summary.total_recovered) : '—'}
        </div>
        <div className="stat-subtitle">
          {summary?.status_counts?.recovered ?? 0} transactions recovered
        </div>
      </div>

      <div className="stat-card rate">
        <div className="stat-label">Recovery Rate</div>
        <div className="stat-value">
          {summary ? `${summary.recovery_rate.toFixed(1)}%` : '—'}
        </div>
        <div className="stat-subtitle">of at-risk revenue won back</div>
      </div>

      <div className="stat-card guardrails">
        <div className="stat-label">Guardrails Fired</div>
        <div className="stat-value">
          {summary?.guardrail_blocks ?? 0}
        </div>
        <div className="stat-subtitle">overridden by policy engine</div>
      </div>
    </div>
  );
};
