import React, { useState } from 'react';
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
} from 'lucide-react';
import { Transaction } from '../types';

interface VoiceIntakeSectionProps {
  onOpenVoiceModal: () => void;
  onSuccess: () => void;
  onSelectTxn?: (txn) => void;
}

const QUICK_VOICE_DEMOS = [
  {
    title: '🟢 Salary Delay (Promise to Pay)',
    tag: 'promise_to_pay',
    color: '#38BDF8',
    text: 'Bhai mera payment fail ho gaya, kal salary aayegi, 28 tarikh ko retry karna.',
    attempts: 1,
    contacts: 0,
  },
  {
    title: '🔵 Card Expired (Send Link)',
    tag: 'send_payment_link',
    color: '#00E599',
    text: 'Arre mera HDFC card expire ho gaya hai. Naya payment link WhatsApp pe bhej do.',
    attempts: 1,
    contacts: 0,
  },
  {
    title: '🟣 UPI Bank Timeout (Auto-Retry)',
    tag: 'retry_payment',
    color: '#A855F7',
    text: 'Maine UPI PIN daala tha par SBI server timeout ho gaya. Standby route se retry karo.',
    attempts: 1,
    contacts: 0,
  },
  {
    title: '⛔ Policy Block: Max Retries (Rule 1)',
    tag: 'mark_unrecoverable',
    color: '#FB7185',
    text: 'Bhai ek aur baar retry karke dekh lo please, shayad is baar pass ho jaye.',
    attempts: 4,
    contacts: 0,
  },
];

export const VoiceIntakeSection: React.FC<VoiceIntakeSectionProps> = ({
  onOpenVoiceModal,
  onSuccess,
  onSelectTxn,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const speakAudio = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(
      (v) => v.lang === 'hi-IN' || v.lang === 'en-IN' || v.name.includes('India') || v.name.includes('Hindi')
    );
    if (indianVoice) utterance.voice = indianVoice;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleQuickExecute = async (demo: typeof QUICK_VOICE_DEMOS[0]) => {
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch('/voice-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: demo.text,
          customer_name: 'Voice Demo Merchant',
          amount: 4999.0,
          attempt_number: demo.attempts,
          customer_contact_count_48h: demo.contacts,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastResult(data);
        onSuccess();
        if (data.voice_agent_reply) {
          setTimeout(() => speakAudio(data.voice_agent_reply), 300);
        }
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
                <span>Conversational AI • Hinglish Voice Recovery Agent</span>
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.6px', margin: '0 0 8px 0' }}>
                "Talk to Winback" — Voice Note In, Compliant Action Out
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-light-muted)', lineHeight: 1.5, margin: 0 }}>
                Customers in India communicate payment problems via voice notes in conversational Hinglish. Winback's Groq AI understands intent, enforces deterministic Policy Guardrails, executes approved actions, and speaks back in Hinglish.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-pill-dark"
                onClick={onOpenVoiceModal}
                style={{ background: '#38BDF8', color: '#04120D', borderColor: '#38BDF8', fontWeight: 700, padding: '10px 20px', fontSize: '13px' }}
              >
                <Mic size={15} />
                <span>Talk to Winback 🎙️</span>
              </button>
            </div>
          </div>

          {/* Quick Voice Demo Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {QUICK_VOICE_DEMOS.map((demo, idx) => (
              <div
                key={idx}
                onClick={() => handleQuickExecute(demo)}
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
                  <span>Click to Test Full Voice Loop</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live Quick Visualizer Output */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#38BDF8', fontSize: '13px' }}>
              <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
              <div>Groq AI Parsing Hinglish $\rightarrow$ Policy Engine Guardrail Check $\rightarrow$ Executor...</div>
            </div>
          )}

          {lastResult && (
            <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle2 size={22} color="#00E599" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
                      Approved Action: <span style={{ color: '#FBBF24', fontFamily: 'monospace' }}>{lastResult.pipeline_result?.final_action_taken}</span> ({lastResult.pipeline_result?.status})
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#34D399' }}>
                      {lastResult.pipeline_result?.guardrail_notes}
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
                    Open Voice Studio →
                  </button>
                </div>
              </div>

              {/* Spoken Voice Response Banner */}
              {lastResult.voice_agent_reply && (
                <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Volume2 size={16} color="#38BDF8" />
                    <span style={{ fontSize: '12px', color: '#E2E8F0', fontStyle: 'italic' }}>
                      "{lastResult.voice_agent_reply}"
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakAudio(lastResult.voice_agent_reply)}
                    style={{ background: '#38BDF8', color: '#04120D', border: 'none', borderRadius: '14px', padding: '4px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    {isPlaying ? 'Stop' : 'Replay 🔊'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
