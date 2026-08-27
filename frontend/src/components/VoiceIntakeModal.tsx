import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  FileAudio,
  Calendar,
  Send,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { Transaction } from '../types';

interface VoiceIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSelectTxn?: (txn: Transaction) => void;
}

interface DemoScenario {
  id: string;
  title: string;
  scenario: string;
  transcript: string;
  expected_error: string;
  expected_action: string;
  test_type: 'success' | 'policy_blocked';
  attempt_number?: number;
  contact_count_48h?: number;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'demo_voice_1',
    title: '🟢 Salary Delay (Promise to Pay)',
    scenario: 'Customer commits to pay on salary date. System pauses dunning until promise date.',
    transcript: 'Bhai mera payment fail ho gaya, account mein balance nahi tha. Kal meri salary aayegi, 28 tarikh ko phir se retry karna, pakka ho jayega.',
    expected_error: 'insufficient_funds',
    expected_action: 'promise_to_pay',
    test_type: 'success',
    attempt_number: 1,
    contact_count_48h: 0,
  },
  {
    id: 'demo_voice_2',
    title: '🔵 Card Expired (Send Payment Link)',
    scenario: 'Debit card expired. System generates and dispatches 1-click payment link via WhatsApp.',
    transcript: 'Arre mera HDFC card expire ho gaya hai pichle hafte. Naya payment link WhatsApp pe bhej do, main naye card se abhi pay kar deta hoon.',
    expected_error: 'card_expired',
    expected_action: 'send_payment_link',
    test_type: 'success',
    attempt_number: 1,
    contact_count_48h: 0,
  },
  {
    id: 'demo_voice_3',
    title: '🟣 Bank Timeout (Auto-Retry Route)',
    scenario: 'UPI gateway server timed out. System auto-retries via standby route.',
    transcript: 'Maine UPI PIN daala tha par SBI ka server timeout ho gaya. Paisa nahi kata mere bank se, ek baar standby route se auto-retry maar do.',
    expected_error: 'bank_timeout',
    expected_action: 'retry_payment',
    test_type: 'success',
    attempt_number: 1,
    contact_count_48h: 0,
  },
  {
    id: 'demo_voice_4',
    title: '⛔ Policy Block: Max Retries (Rule 1)',
    scenario: 'Customer asks for retry, but attempt count is already 4. Policy Engine blocks retry and marks unrecoverable.',
    transcript: 'Bhai ek aur baar retry karke dekh lo please, shayad is baar payment pass ho jaye.',
    expected_error: 'insufficient_funds',
    expected_action: 'mark_unrecoverable',
    test_type: 'policy_blocked',
    attempt_number: 4,
    contact_count_48h: 0,
  },
  {
    id: 'demo_voice_5',
    title: '⛔ Policy Block: Contact Cap (Rule 3)',
    scenario: 'Customer asks for link, but contact limit (2 in 48h) reached. Policy Engine blocks outreach and escalates to human.',
    transcript: 'Mera card expire hai, ek aur baar WhatsApp pe link drop kardo.',
    expected_error: 'card_expired',
    expected_action: 'escalate_to_human',
    test_type: 'policy_blocked',
    attempt_number: 1,
    contact_count_48h: 2,
  },
  {
    id: 'demo_voice_6',
    title: '🟠 Cart Drop-Off (WhatsApp Nudge)',
    scenario: 'Checkout abandoned. System sends WhatsApp discount intent recovery nudge.',
    transcript: 'Checkout pe OTP late aaya toh maine window band kar di thi. Cart mein ₹3,450 ka saman hai, koi working coupon ya Razorpay link WhatsApp pe drop karo.',
    expected_error: 'checkout_dropoff',
    expected_action: 'send_reminder_whatsapp',
    test_type: 'success',
    attempt_number: 1,
    contact_count_48h: 0,
  },
  {
    id: 'demo_voice_7',
    title: '🔴 Corporate Invoice (Human Escalation)',
    scenario: 'High-value B2B invoice ₹65,000. System escalates to dedicated human account manager.',
    transcript: 'Hamara ₹65,000 ka corporate annual invoice pending hai. Hamari finance team vendor onboarding verify kar rahi hai, accounts manager se baat karwao please.',
    expected_error: 'invoice_overdue',
    expected_action: 'escalate_to_human',
    test_type: 'success',
    attempt_number: 1,
    contact_count_48h: 0,
  },
];

export const VoiceIntakeModal: React.FC<VoiceIntakeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSelectTxn,
}) => {
  const [activeTab, setActiveTab] = useState<'demos' | 'mic' | 'custom'>('demos');
  const [transcript, setTranscript] = useState<string>(DEMO_SCENARIOS[0].transcript);
  const [customerName, setCustomerName] = useState<string>('Aarav Sharma');
  const [amount, setAmount] = useState<string>('4999');
  const [attemptNumber, setAttemptNumber] = useState<number>(1);
  const [contactCount, setContactCount] = useState<number>(0);
  const [selectedDemoId, setSelectedDemoId] = useState<string>(DEMO_SCENARIOS[0].id);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Web Speech API instances
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = false;
        recog.lang = 'hi-IN'; // Hinglish / Hindi-English support

        recog.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          setTranscript(text);
          setIsRecording(false);
        };

        recog.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setRecognitionError(`Microphone notice: ${event.error}. You can also type or use sample transcripts.`);
          setIsRecording(false);
        };

        recog.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recog;
      }
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text-to-Speech (TTS) handler for AI spoken response
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    if (isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick Indian English or Hindi voice if available
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(
      (v) => v.lang === 'hi-IN' || v.lang === 'en-IN' || v.name.includes('India') || v.name.includes('Hindi')
    );
    if (indianVoice) {
      utterance.voice = indianVoice;
    }

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  if (!isOpen) return null;

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setRecognitionError('Speech recognition is not supported in this browser. Please type or select a demo note.');
      return;
    }
    setRecognitionError(null);

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err: any) {
        console.error(err);
        setRecognitionError('Microphone permission denied or busy.');
      }
    }
  };

  const handleSelectDemo = (sample: DemoScenario) => {
    setSelectedDemoId(sample.id);
    setTranscript(sample.transcript);
    setAttemptNumber(sample.attempt_number || 1);
    setContactCount(sample.contact_count_48h || 0);
    setResult(null);
    setErrorMsg(null);

    if (sample.id === 'demo_voice_6') {
      setAmount('3450');
      setCustomerName('Ananya Iyer');
    } else if (sample.id === 'demo_voice_7') {
      setAmount('65000');
      setCustomerName('Vikram Enterprises');
    } else if (sample.id === 'demo_voice_2' || sample.id === 'demo_voice_5') {
      setAmount('2499');
      setCustomerName('Priya Patel');
    } else if (sample.id === 'demo_voice_3') {
      setAmount('1299');
      setCustomerName('Rohan Mehta');
    } else {
      setAmount('4999');
      setCustomerName('Aarav Sharma');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!transcript.trim()) {
      setErrorMsg('Please enter or record a Hinglish voice note transcript.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const parsedAmount = parseFloat(amount);
      const res = await fetch('/voice-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript.trim(),
          customer_name: customerName.trim() || 'Voice Customer',
          amount: isNaN(parsedAmount) ? 4999.0 : parsedAmount,
          attempt_number: attemptNumber,
          customer_contact_count_48h: contactCount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Voice recovery intake failed.');
      }

      setResult(data);
      onSuccess();

      // Automatically speak the AI response
      if (data.voice_agent_reply) {
        setTimeout(() => {
          speakText(data.voice_agent_reply);
        }, 300);
      }
    } catch (err: any) {
      console.error('Voice intake error:', err);
      setErrorMsg(err.message || 'Failed to process voice note.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-box-luxury voice-dialog-luxury"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '840px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '22px' }}>🎙️</span>
              <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Hinglish Voice Recovery Agent
              </h3>
              <span className="engine-status-tag" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>
                Talk to Winback
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-light-muted)', margin: 0 }}>
              Speak naturally in Hinglish. Groq AI extracts the failure code & promise date, passes it into the deterministic Policy Engine, executes the approved action, and speaks back in Hinglish.
            </p>
          </div>
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              onClose();
            }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: '#94A3B8',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
          <button
            type="button"
            className={`btn-pill-outline ${activeTab === 'demos' ? 'active' : ''}`}
            onClick={() => { setActiveTab('demos'); }}
            style={{
              background: activeTab === 'demos' ? 'rgba(0, 229, 153, 0.15)' : 'transparent',
              borderColor: activeTab === 'demos' ? '#00E599' : 'rgba(255,255,255,0.15)',
              color: activeTab === 'demos' ? '#00E599' : '#94A3B8',
            }}
          >
            <Sparkles size={13} />
            <span>7 Demo Scenarios (Success & Guardrail Blocks)</span>
          </button>

          <button
            type="button"
            className={`btn-pill-outline ${activeTab === 'mic' ? 'active' : ''}`}
            onClick={() => { setActiveTab('mic'); }}
            style={{
              background: activeTab === 'mic' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              borderColor: activeTab === 'mic' ? '#38BDF8' : 'rgba(255,255,255,0.15)',
              color: activeTab === 'mic' ? '#38BDF8' : '#94A3B8',
            }}
          >
            <Mic size={13} />
            <span>Speak Live (Microphone)</span>
          </button>

          <button
            type="button"
            className={`btn-pill-outline ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => { setActiveTab('custom'); }}
            style={{
              background: activeTab === 'custom' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              borderColor: activeTab === 'custom' ? '#F59E0B' : 'rgba(255,255,255,0.15)',
              color: activeTab === 'custom' ? '#FBBF24' : '#94A3B8',
            }}
          >
            <Send size={13} />
            <span>Custom Script</span>
          </button>
        </div>

        {/* Tab 1: 7 Demo Scenarios */}
        {activeTab === 'demos' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6B8077', fontWeight: 700, letterSpacing: '0.8px', marginBottom: '8px' }}>
              Choose a Test Scenario (Evaluates Golden Paths & NPCI Guardrail Intercepts):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '7px', maxHeight: '230px', overflowY: 'auto', paddingRight: '4px' }}>
              {DEMO_SCENARIOS.map((sample) => {
                const isSelected = selectedDemoId === sample.id;
                const isBlocked = sample.test_type === 'policy_blocked';
                return (
                  <div
                    key={sample.id}
                    onClick={() => handleSelectDemo(sample)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(0, 229, 153, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? (isBlocked ? '#FB7185' : '#00E599') : 'rgba(255,255,255,0.08)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? (isBlocked ? '#FB7185' : '#00E599') : '#FFFFFF' }}>
                          {sample.title}
                        </span>
                        {isBlocked && (
                          <span style={{ fontSize: '9px', background: 'rgba(244, 63, 94, 0.2)', color: '#FB7185', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            GUARDRAIL OVERRIDE
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                        {sample.expected_action}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#A3B8B0', fontStyle: 'italic', lineHeight: 1.35 }}>
                      "{sample.transcript}"
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Microphone Live Recording */}
        {activeTab === 'mic' && (
          <div style={{ textAlign: 'center', padding: '20px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={toggleRecording}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: isRecording ? '#F43F5E' : '#38BDF8',
                  color: '#04120D',
                  border: isRecording ? '4px solid rgba(244, 63, 94, 0.4)' : '4px solid rgba(56, 189, 248, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isRecording ? '0 0 24px rgba(244, 63, 94, 0.6)' : '0 0 20px rgba(56, 189, 248, 0.4)',
                  transition: 'all 0.2s ease',
                }}
              >
                {isRecording ? <MicOff size={26} /> : <Mic size={26} />}
              </button>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 700, color: isRecording ? '#FB7185' : '#FFFFFF', marginBottom: '3px' }}>
              {isRecording ? '🔴 Listening... Speak in Hindi or English (Hinglish)' : 'Click microphone to record your voice live'}
            </div>
            <div style={{ fontSize: '11px', color: '#6B8077' }}>
              Say: "Mera card expire ho gaya hai, WhatsApp pe naya link bhej do..."
            </div>

            {recognitionError && (
              <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#FBBF24', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 12px', borderRadius: '6px', display: 'inline-block' }}>
                ⚠️ {recognitionError}
              </div>
            )}
          </div>
        )}

        {/* Transcript Text Input & Meta Overrides */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#A3B8B0', fontWeight: 700, letterSpacing: '0.6px' }}>
                Spoken Hinglish Transcript (Speech-to-Text Input)
              </label>
              <span style={{ fontSize: '10px', color: '#6B8077' }}>Editable Fallback</span>
            </div>
            <textarea
              className="search-input-obsidian"
              rows={2}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Enter Hinglish voice note transcript, e.g. 'Card expire ho gaya hai shayad, naya bhejo link'..."
              style={{ width: '100%', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B8077', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                Customer Name
              </label>
              <input
                type="text"
                className="search-input-obsidian"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ width: '100%', borderRadius: '6px', padding: '7px 10px', fontSize: '11.5px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B8077', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                Amount (₹ INR)
              </label>
              <input
                type="number"
                className="search-input-obsidian"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%', borderRadius: '6px', padding: '7px 10px', fontSize: '11.5px', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B8077', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                Attempt Count
              </label>
              <input
                type="number"
                min={1}
                max={6}
                className="search-input-obsidian"
                value={attemptNumber}
                onChange={(e) => setAttemptNumber(parseInt(e.target.value) || 1)}
                style={{ width: '100%', borderRadius: '6px', padding: '7px 10px', fontSize: '11.5px', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B8077', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                Outreach (48h)
              </label>
              <input
                type="number"
                min={0}
                max={5}
                className="search-input-obsidian"
                value={contactCount}
                onChange={(e) => setContactCount(parseInt(e.target.value) || 0)}
                style={{ width: '100%', borderRadius: '6px', padding: '7px 10px', fontSize: '11.5px', fontFamily: 'monospace' }}
              />
            </div>
          </div>

          {errorMsg && (
            <div style={{ marginBottom: '12px', padding: '9px 12px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.15)', color: '#FB7185', fontSize: '11.5px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Action Trigger Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: result ? '18px' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6B8077' }}>
              <Zap size={13} color="#FBBF24" />
              <span>Deterministic Policy Engine holds final authority • LLM does not execute financial transactions</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-pill-outline"
                onClick={onClose}
                style={{ color: '#94A3B8', borderColor: 'rgba(255,255,255,0.15)', fontSize: '11px' }}
              >
                Close
              </button>

              <button
                type="submit"
                className="btn-pill-dark"
                disabled={isProcessing || !transcript.trim()}
                style={{ minWidth: '180px', justifyContent: 'center', background: '#38BDF8', color: '#04120D', borderColor: '#38BDF8', fontWeight: 700 }}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Processing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Talk to Winback</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* ── Result Visualizer & Spoken Audio Output Card ── */}
        {result && (
          <div
            style={{
              marginTop: '18px',
              padding: '16px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.06) 0%, rgba(4, 18, 13, 0.8) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            {/* Top Status Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#00E599" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#00E599' }}>
                  Voice Interaction Processed & Executed
                </span>
                <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#A3B8B0' }}>
                  ⚡ Simulated Sandbox Execution
                </span>
              </div>
              <span className={`status-badge-obsidian ${result.pipeline_result?.status}`}>
                {result.pipeline_result?.status}
              </span>
            </div>

            {/* AI Spoken Audio Response Box */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Volume2 size={20} color="#38BDF8" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: '#38BDF8', fontWeight: 700, letterSpacing: '0.6px', marginBottom: '2px' }}>
                    AI Voice Recovery Agent Spoke Back (Hinglish Audio):
                  </div>
                  <div style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: 600, fontStyle: 'italic', lineHeight: 1.4 }}>
                    "{result.voice_agent_reply || result.pipeline_result?.voice_agent_reply}"
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => speakText(result.voice_agent_reply || result.pipeline_result?.voice_agent_reply)}
                style={{
                  background: isPlayingAudio ? '#F43F5E' : '#38BDF8',
                  color: '#04120D',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexShrink: 0,
                }}
              >
                {isPlayingAudio ? <VolumeX size={13} /> : <Play size={13} fill="#04120D" />}
                <span>{isPlayingAudio ? 'Stop' : 'Replay Audio'}</span>
              </button>
            </div>

            {/* Extracted Entity Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '7px 9px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9px', color: '#6B8077', textTransform: 'uppercase' }}>Extracted Failure</div>
                <div style={{ fontSize: '11px', color: '#FB7185', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                  {result.extracted_data?.error_code}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '7px 9px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9px', color: '#6B8077', textTransform: 'uppercase' }}>Promise Date</div>
                <div style={{ fontSize: '11px', color: '#38BDF8', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                  {result.extracted_data?.promised_date ? `📅 ${result.extracted_data?.promised_date}` : 'None'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '7px 9px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9px', color: '#6B8077', textTransform: 'uppercase' }}>Recommended</div>
                <div style={{ fontSize: '11px', color: '#60A5FA', fontFamily: 'monospace', fontWeight: 600, marginTop: '2px' }}>
                  {result.pipeline_result?.recommended_action}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '7px 9px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9px', color: '#6B8077', textTransform: 'uppercase' }}>Final Action</div>
                <div style={{ fontSize: '11px', color: '#FBBF24', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                  {result.pipeline_result?.final_action_taken}
                </div>
              </div>
            </div>

            {/* Policy Guardrail Decision Card */}
            <div
              style={{
                fontSize: '11px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: result.pipeline_result?.guardrail_notes?.includes('⛔')
                  ? 'rgba(244, 63, 94, 0.12)'
                  : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${
                  result.pipeline_result?.guardrail_notes?.includes('⛔')
                    ? 'rgba(244, 63, 94, 0.3)'
                    : 'rgba(16, 185, 129, 0.25)'
                }`,
                color: result.pipeline_result?.guardrail_notes?.includes('⛔') ? '#FB7185' : '#34D399',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '12px',
              }}
            >
              {result.pipeline_result?.guardrail_notes?.includes('⛔') ? (
                <ShieldAlert size={14} />
              ) : (
                <ShieldCheck size={14} />
              )}
              <span>
                <strong>Policy Engine Decision:</strong> {result.pipeline_result?.guardrail_notes}
              </span>
            </div>

            {/* Inspect Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {onSelectTxn && result.transaction && (
                <button
                  type="button"
                  className="btn-pill-outline"
                  onClick={() => {
                    onSelectTxn(result.transaction);
                    onClose();
                  }}
                  style={{ fontSize: '11px', padding: '5px 12px', borderColor: '#38BDF8', color: '#38BDF8' }}
                >
                  Inspect In Audit Drawer →
                </button>
              )}
              <button
                type="button"
                className="btn-pill-dark"
                onClick={() => {
                  setResult(null);
                  setTranscript('');
                }}
                style={{ fontSize: '11px', padding: '5px 12px' }}
              >
                Talk Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
