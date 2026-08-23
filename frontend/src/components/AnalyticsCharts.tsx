import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { SummaryStats, Transaction } from '../types';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

interface AnalyticsChartsProps {
  summary: SummaryStats | null;
  transactions: Transaction[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  summary,
  transactions,
}) => {
  // Status Doughnut Data
  const counts = summary?.status_counts || {};
  const statusData = {
    labels: ['Recovered', 'Escalated', 'Unrecoverable', 'Pending'],
    datasets: [
      {
        data: [
          counts.recovered || 0,
          counts.escalated || 0,
          counts.unrecoverable || 0,
          counts.pending || 0,
        ],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(100, 116, 139, 0.5)',
        ],
        borderWidth: 0,
      },
    ],
  };

  // Failure Code Bar Data
  const failureMap: Record<string, number> = {};
  const recoveryMap: Record<string, number> = {};

  transactions.forEach((t) => {
    const code = t.failure_code || 'unknown';
    failureMap[code] = (failureMap[code] || 0) + 1;
    if (t.status === 'recovered') {
      recoveryMap[code] = (recoveryMap[code] || 0) + 1;
    }
  });

  const failureLabels = Object.keys(failureMap).sort();
  const failureData = {
    labels: failureLabels.map((l) => l.replace(/_/g, ' ')),
    datasets: [
      {
        label: 'Total Failures',
        data: failureLabels.map((l) => failureMap[l] || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.4)',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Recovered',
        data: failureLabels.map((l) => recoveryMap[l] || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgba(16, 185, 129, 0.9)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  // Recovery by Type Data
  const typeMap = summary?.recovery_by_type || {};
  const typeLabels = Object.keys(typeMap);
  const typeData = {
    labels: typeLabels.map((t) => t.replace(/_/g, ' ')),
    datasets: [
      {
        label: 'Total ₹ at Risk',
        data: typeLabels.map((t) => typeMap[t]?.total || 0),
        backgroundColor: 'rgba(249, 115, 22, 0.4)',
        borderColor: 'rgba(249, 115, 22, 0.8)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Recovered ₹',
        data: typeLabels.map((t) => typeMap[t]?.recovered || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgba(16, 185, 129, 0.9)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: "'Inter', sans-serif", size: 11 },
          usePointStyle: true,
        },
      },
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(42, 53, 72, 0.4)' } },
    },
  };

  return (
    <div className="charts-grid">
      <div className="chart-card">
        <h3>📊 Transaction Status Breakdown</h3>
        <div className="chart-wrapper">
          <Doughnut
            data={statusData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: '65%',
              plugins: {
                legend: {
                  position: 'right',
                  labels: { color: '#94a3b8', font: { size: 11 }, usePointStyle: true },
                },
              },
            }}
          />
        </div>
      </div>

      <div className="chart-card">
        <h3>📈 Recovery by Failure Code</h3>
        <div className="chart-wrapper">
          <Bar data={failureData} options={chartOptions} />
        </div>
      </div>

      <div className="chart-card">
        <h3>💳 Risk & Recovery by Category</h3>
        <div className="chart-wrapper">
          <Bar data={typeData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};
