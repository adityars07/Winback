import React, { useState, useEffect } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Activity,
  RefreshCw,
  Play,
  VolumeX,
  PhoneOutgoing,
  PhoneCall,
  User,
  AlertTriangle,
  Building,
} from 'lucide-react';
import { Transaction } from '../types';

interface VoiceIntakeSectionProps {
  onOpenVoiceModal: () => void;
  onSuccess: () => void;
  onSelectTxn?: (txn: Transaction) => void;
}

export const VoiceIntakeSection: React.FC<VoiceIntakeSectionProps> = ({
  onOpenVoiceModal,
  onSuccess,
  onSelectTxn,
}) => {
  const [realTxns, setRealTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchActiveTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/voice-intake/active-transactions?limit=4');
      if (res.ok) {
        const data = await res.json();
        setRealTxns(data.transactions || []);
      }
    } catch (e) {
      console.warn('Could not load active transactions for voice section:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTransactions();
  }, []);

  return (
    <section className="voice-intake-showcase-section" id="voice-intake" style={{ padding: '60px 0', background: '#020C08' }}>
      <div className="container-wide">
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(4, 18, 13, 0.95) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '16px',
            padding: '36px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(56, 189, 248, 0.1)',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', marginBottom: '28px' }}>
            <div style={{ maxWidth: '680px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38BDF8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                <Mic size={13} />
                <span>Production AI • Live Voice Recovery Agent</span>
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.6px', margin: '0 0 8px 0' }}>
                Conversational Voice Recovery — Live Database Calling
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-light-muted)', lineHeight: 1.5, margin: 0 }}>
                Directly dial customers with failed payments from your active database. The Groq AI agent understands natural Hinglish, negotiates promise-to-pay dates, sends 1-click WhatsApp links, executes backup gateway retries, and records full audit logs.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-pill-dark"
                onClick={onOpenVoiceModal}
                style={{ background: '#38BDF8', color: '#04120D', borderColor: '#38BDF8', fontWeight: 800, padding: '12px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <PhoneCall size={16} />
                <span>Open Voice Recovery Studio 🎙️</span>
              </button>
            </div>
          </div>

          {/* Real Transactions Ready for Voice Outreach */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Active Failed Transactions Ready for Voice Recovery:
              </span>
              <button
                onClick={fetchActiveTransactions}
                style={{ background: 'transparent', border: 'none', color: '#38BDF8', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                <span>Refresh List</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px' }}>
              {realTxns.map((txn) => {
                const isRecovered = txn.status === 'recovered';
                const isPromised = txn.status === 'promised';
                const isUnrecoverable = txn.status === 'unrecoverable';

                return (
                  <div
                    key={txn.txn_id}
                    onClick={onOpenVoiceModal}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    className="voice-card-hover"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
                        {txn.customer_name || 'Customer'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#00E599', fontFamily: 'monospace' }}>
                        ₹{txn.amount?.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#A3B8B0', marginBottom: '12px' }}>
                      <span className="mono-hash">{txn.txn_id}</span>
                      <span style={{ color: '#FBBF24', fontSize: '10.5px' }}>
                        {txn.failure_code} (Att #{txn.attempt_number})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      <span className={`status-badge-obsidian ${txn.status}`}>
                        {txn.status}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#38BDF8', fontWeight: 700 }}>
                        <PhoneOutgoing size={12} />
                        <span>Dial Customer →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
