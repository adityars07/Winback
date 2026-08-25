import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { StatsBar } from './components/StatsBar';
import { OneViewSection } from './components/OneViewSection';
import { ComparisonSection } from './components/ComparisonSection';
import { RecoveryLadderSection } from './components/RecoveryLadderSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { LiveConsoleSection } from './components/LiveConsoleSection';
import { FooterSection } from './components/FooterSection';
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
  const [activeView, setActiveView] = useState<'landing' | 'console'>('landing');

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
          // Update transaction in real-time
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
    if (!window.confirm('Reset all demo transactions back to fresh pending state?')) return;
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

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="page-wrapper">
      {/* Editorial Navbar */}
      <Navbar
        onRunBatch={handleRunBatchStream}
        onOpenUpload={() => setIsUploadOpen(true)}
        onScrollToSection={scrollToSection}
        isProcessing={isProcessing}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Hero Section */}
      <HeroSection
        summary={summary}
        onRunBatch={handleRunBatchStream}
        onScrollToSection={scrollToSection}
        onOpenConsole={() => {
          setActiveView('console');
          scrollToSection('console');
        }}
        isProcessing={isProcessing}
      />

      {/* Stats Ribbon */}
      <StatsBar />

      {/* One View Section */}
      <OneViewSection
        onOpenConsole={() => {
          setActiveView('console');
          scrollToSection('console');
        }}
      />

      {/* Comparison Section: Legacy Dunning vs Winback */}
      <ComparisonSection />

      {/* Recovery Ladder Section + Interactive ROI Calculator */}
      <RecoveryLadderSection
        onOpenConsole={() => {
          setActiveView('console');
          scrollToSection('console');
        }}
      />

      {/* Customer Stories & Testimonials */}
      <TestimonialsSection />

      {/* Live Recovery Console & Sandbox */}
      <LiveConsoleSection
        summary={summary}
        transactions={transactions}
        onRunBatch={handleRunBatchStream}
        onReset={handleReset}
        onExport={handleExport}
        onOpenUpload={() => setIsUploadOpen(true)}
        onSelectTxn={(txn) => setSelectedTxn(txn)}
        isProcessing={isProcessing}
        progress={progress}
      />

      {/* Regulatory Footer */}
      <FooterSection />

      {/* Modals & Drawers */}
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
