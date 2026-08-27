import React, { useState } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  RefreshCw,
  Play,
  FileAudio,
} from 'lucide-react';
import { Transaction } from '../types';

interface VoiceIntakeSectionProps {
  onOpenVoiceModal: () => void;
  onSuccess: () => void;
  onSelectTxn?: (txn: Transaction) => void;
}

const QUICK_VOICE_DEMOS = [
  {
    title: 'Salary Delay Promise',
    tag: 'promise_to_pay',
    color: '#38BDF8',
    text: 'Bhai mera payment fail ho gaya, kal salary aayegi, 28 tarikh ko retry karna.',
  },
  {
    title: 'Card Expired Link',
    tag: 'send_payment_link',
    color: '#00E599',
    text: 'Arre mera HDFC card expire ho gaya hai. Naya payment link WhatsApp pe bhej do.',
  },
  {
    title: 'UPI Bank Timeout',
    tag: 'retry_payment',
    color: '#A855F7',
    text: 'Maine UPI PIN daala tha par SBI server timeout ho gaya. Standby route se retry karo.',
  },
  {
    title: 'B2B Invoice Overdue',
    tag: 'escalate_to_human',
    color: '#F59E0B',
    text: 'Hamara ₹65,000 ka corporate invoice pending hai, accounts team se baat karwao.',
  },
];

export const VoiceIntakeSection: React.FC<VoiceIntakeSectionProps> = ({
  onOpenVoiceModal,
  onSuccess,
  onSelectTxn,
}) => {
  const [quickInput, setQuickInput] = useState<string>(QUICK_VOICE_DEMOS[0].text);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<any | null>(null);

  const handleQuickExecute = async (transcriptText: string) => {
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch('/voice-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          customer_name: 'Voice Demo Merchant',
          amount: 4999.0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastResult(data);
        onSuccess();
      }
    } catch (e) {
      console.error('Quick voice error:', e);
    } finally {
      setLoading(false);
    }
  };

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
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', marginBottom: '28px' }}>
            <div style={{ maxWidth: '680px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38BDF8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                <Mic size={13} />
                <span>New Feature • Hinglish Voice-Note Recovery</span>
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.6px', margin: '0 0 8px 0' }}>
                Voice Note In, Compliant Recovery Action Out
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-light-muted)', lineHeight: 1.5, margin: 0 }}>
                Customers in India communicate payment delays via WhatsApp audio notes in Hinglish. Winback's Groq AI translates conversational nuance into structured failure codes and promised payment dates, executing NPCI-compliant actions in under 200ms.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-pill-dark"
                onClick={onOpenVoiceModal}
                style={{ background: '#38BDF8', color: '#04120D', borderColor: '#38BDF8', fontWeight: 700 }}
              >
                <Mic size={14} />
                <span>Open Voice Studio & Mic</span>
              </button>
            </div>
          </div>

          {/* Quick Voice Demo Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {QUICK_VOICE_DEMOS.map((demo, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setQuickInput(demo.text);
                  handleQuickExecute(demo.text);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                className="voice-card-hover"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>{demo.title}</span>
                  <span style={{ fontSize: '9.5px', fontFamily: 'monospace', color: demo.color, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                    {demo.tag}
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#A3B8B0', fontStyle: 'italic', lineHeight: 1.4, marginBottom: '10px' }}>
                  "{demo.text}"
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#38BDF8', fontWeight: 600 }}>
                  <Play size={11} fill="#38BDF8" />
                  <span>Click to Test Live Flow</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live Quick Visualizer Output */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#38BDF8', fontSize: '13px' }}>
              <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
              <div>Groq AI Parsing Hinglish Transcript & Enforcing Guardrails...</div>
            </div>
          )}

          {lastResult && (
            <div style={{ background: 'rgba(0, 229, 153, 0.05)', border: '1px solid rgba(0, 229, 153, 0.3)', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle2 size={22} color="#00E599" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#00E599' }}>
                    Executed Action: {lastResult.pipeline_result?.final_action_taken} ({lastResult.pipeline_result?.status})
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#A3B8B0' }}>
                    {lastResult.extracted_data?.intent_summary}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`status-badge-obsidian ${lastResult.pipeline_result?.status}`}>
                  {lastResult.pipeline_result?.status}
                </span>
                <button
                  className="btn-pill-outline"
                  onClick={onOpenVoiceModal}
                  style={{ fontSize: '11px', padding: '6px 12px', borderColor: 'rgba(255,255,255,0.2)' }}
                >
                  View Full Detail Trace →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
