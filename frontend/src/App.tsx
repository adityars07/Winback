import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { KpiCards } from './components/KpiCards';
import { PipelineFlow } from './components/PipelineFlow';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { AuditTrailTable } from './components/AuditTrailTable';
import { TransactionModal } from './components/TransactionModal';
import { UploadModal } from './components/UploadModal';
import { Transaction, SummaryStats } from './types';
import './styles.css';

export const App: React.FC = () => {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [sumRes, txnRes] = await Promise.all([
        fetch('/summary'),
        fetch('/transactions'),
      ]);
      if (sumRes.ok && txnRes.ok) {
        const sumData = await sumRes.json();
        const txnData = await txnRes.json();
        setSummary(sumData);
        setTransactions(txnData.transactions || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunBatchStream = () => {
    setIsProcessing(true);
    setProgress({ current: 0, total: 0 });

    const eventSource = new EventSource('/run-batch/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'start') {
          setProgress({ current: 0, total: data.total });
        } else if (data.type === 'progress') {
          setProgress({ current: data.current, total: data.total });
          // Update the transaction in local state in real-time
          setTransactions((prev) => {
            const index = prev.findIndex((t) => t.txn_id === data.txn.txn_id);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = data.txn;
              return updated;
            }
            return [data.txn, ...prev];
          });
        } else if (data.type === 'complete') {
          setSummary(data.summary);
          setIsProcessing(false);
          setProgress(null);
          eventSource.close();
          loadData();
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setIsProcessing(false);
      setProgress(null);
      eventSource.close();
      loadData();
    };
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all transactions back to fresh pending state?')) return;
    try {
      const res = await fetch('/reset', { method: 'POST' });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  const handleExport = () => {
    window.open('/export/csv', '_blank');
  };

  return (
    <div className="app-container">
      <Header
        onRunBatch={handleRunBatchStream}
        onReset={handleReset}
        onExport={handleExport}
        onOpenUpload={() => setIsUploadOpen(true)}
        isProcessing={isProcessing}
        progress={progress}
      />

      {isProcessing && progress && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
            <span>Processing Recovery Batch...</span>
            <span>{progress.current} / {progress.total} transactions diagnosed & executed</span>
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

      <KpiCards summary={summary} />

      <PipelineFlow />

      <AnalyticsCharts summary={summary} transactions={transactions} />

      <AuditTrailTable
        transactions={transactions}
        onSelectTxn={(txn) => setSelectedTxn(txn)}
      />

      <TransactionModal
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
