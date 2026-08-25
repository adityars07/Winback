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
import { PieChart, BarChart3, Layers } from 'lucide-react';

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
          '#00E599',
          '#F59E0B',
          '#F43F5E',
          '#475569',
        ],
        hoverBackgroundColor: [
          '#34D399',
          '#FBBF24',
          '#FB7185',
          '#64748B',
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
        backgroundColor: 'rgba(56, 189, 248, 0.35)',
        borderColor: '#38BDF8',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Recovered',
        data: failureLabels.map((l) => recoveryMap[l] || 0),
        backgroundColor: 'rgba(0, 229, 153, 0.65)',
        borderColor: '#00E599',
        borderWidth: 1,
        borderRadius: 6,
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
        backgroundColor: 'rgba(245, 158, 11, 0.35)',
        borderColor: '#F59E0B',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Recovered ₹',
        data: typeLabels.map((t) => typeMap[t]?.recovered || 0),
        backgroundColor: 'rgba(0, 229, 153, 0.65)',
        borderColor: '#00E599',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#A3B8B0',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
          usePointStyle: true,
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: '#04140F',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        borderWidth: 1,
        titleColor: '#FFFFFF',
        bodyColor: '#A3B8B0',
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        ticks: { color: '#6B8077', font: { size: 10 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: '#6B8077', font: { size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
      },
    },
  };

  return (
    <div className="charts-grid-luxury">
      <div className="chart-card-luxury">
        <h3>
          <PieChart size={14} color="#00E599" />
          <span>Status Distribution</span>
        </h3>
        <div className="chart-wrapper-luxury">
          <Doughnut
            data={statusData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: '70%',
              plugins: {
                legend: {
                  position: 'right',
                  labels: {
                    color: '#A3B8B0',
                    font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                    usePointStyle: true,
                    boxWidth: 8,
                  },
                },
                tooltip: {
                  backgroundColor: '#04140F',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  borderWidth: 1,
                  padding: 10,
                  cornerRadius: 8,
                },
              },
            }}
          />
        </div>
      </div>

      <div className="chart-card-luxury">
        <h3>
          <BarChart3 size={14} color="#38BDF8" />
          <span>Recovery by Failure Code</span>
        </h3>
        <div className="chart-wrapper-luxury">
          <Bar data={failureData} options={chartOptions} />
        </div>
      </div>

      <div className="chart-card-luxury">
        <h3>
          <Layers size={14} color="#FBBF24" />
          <span>Risk & Recovery by Category</span>
        </h3>
        <div className="chart-wrapper-luxury">
          <Bar data={typeData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};
