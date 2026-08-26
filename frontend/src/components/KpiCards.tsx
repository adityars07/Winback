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
    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {/* 1. Total At-Risk */}
      <div className="stat-card at-risk">
        <div className="stat-label">Revenue at Risk</div>
        <div className="stat-value">
          ₹{summary ? formatINR(summary.total_at_risk) : '0.00'}
        </div>
        <div className="stat-subtitle">
          across {summary?.total_transactions ?? 0} failed transactions
        </div>
      </div>

      {/* 2. Recoverable Revenue */}
      <div className="stat-card recoverable" style={{ borderLeft: '3px solid #38BDF8' }}>
        <div className="stat-label">Recoverable Revenue</div>
        <div className="stat-value" style={{ color: '#38BDF8' }}>
          ₹{summary ? formatINR(summary.recoverable_revenue) : '0.00'}
        </div>
        <div className="stat-subtitle">
          legally & technically actionable pool
        </div>
      </div>

      {/* 3. Revenue Recovered */}
      <div className="stat-card recovered">
        <div className="stat-label">Revenue Recovered</div>
        <div className="stat-value">
          ₹{summary ? formatINR(summary.total_recovered) : '0.00'}
        </div>
        <div className="stat-subtitle">
          {summary?.status_counts?.recovered ?? 0} transactions won back
        </div>
      </div>

      {/* 4. Recovery Rate */}
      <div className="stat-card rate">
        <div className="stat-label">Effective Recovery Rate</div>
        <div className="stat-value">
          {summary ? `${summary.effective_recovery_rate.toFixed(1)}%` : '0.0%'}
        </div>
        <div className="stat-subtitle">
          {summary ? `Gross rate: ${summary.gross_recovery_rate.toFixed(1)}% of total risk` : 'of recoverable won back'}
        </div>
      </div>

      {/* 5. Policy Blocks */}
      <div className="stat-card guardrails">
        <div className="stat-label">Policy Blocks</div>
        <div className="stat-value">
          {summary?.guardrail_blocks ?? 0}
        </div>
        <div className="stat-subtitle">
          ₹{summary ? formatINR(summary.guardrail_blocked_amount) : '0.00'} breaches prevented ⛔
        </div>
      </div>
    </div>
  );
};
