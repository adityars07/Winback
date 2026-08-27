import React, { useState, useEffect } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Play,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  FileAudio,
  Calendar,
  Send,
} from 'lucide-react';
import { Transaction } from '../types';

interface VoiceIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSelectTxn?: (txn: Transaction) => void;
}

interface DemoSample {
  id: string;
  title: string;
  transcript: string;
  expected_error: string;
  expected_action: string;
}

const DEMO_SAMPLES: DemoSample[] = [
  {
    id: 'demo_voice_1',
    title: '🟢 Salary Delay (Promise to Pay)',
    transcript: 'Bhai mera payment fail ho gaya, account mein balance nahi tha. Kal meri salary aayegi, 28 tarikh ko phir se retry karna, pakka ho jayega.',
    expected_error: 'insufficient_funds',
    expected_action: 'promise_to_pay',
  },
  {
    id: 'demo_voice_2',
    title: '🔵 Card Expired (Send Payment Link)',
    transcript: 'Arre mera HDFC card expire ho gaya hai pichle hafte. Naya payment link WhatsApp pe bhej do, main naye card se abhi pay kar deta hoon.',
    expected_error: 'card_expired',
    expected_action: 'send_payment_link',
  },
  {
    id: 'demo_voice_3',
    title: '🟣 Bank Timeout (Alternate Route Retry)',
    transcript: 'Maine UPI PIN daala tha par SBI ka server timeout ho gaya. Paisa nahi kata mere bank se, ek baar standby route se auto-retry maar do.',
    expected_error: 'bank_timeout',
    expected_action: 'retry_payment',
  },
  {
    id: 'demo_voice_4',
    title: '🟠 Cart Drop-Off (WhatsApp Discount Nudge)',
    transcript: 'Checkout pe OTP late aaya toh maine window band kar di thi. Cart mein ₹3,450 ka saman hai, koi working coupon ya Razorpay link WhatsApp pe drop karo.',
    expected_error: 'checkout_dropoff',
    expected_action: 'send_reminder_whatsapp',
  },
  {
    id: 'demo_voice_5',
    title: '🔴 Corporate Invoice (Key Account Escalation)',
    transcript: 'Hamara ₹65,000 ka corporate annual invoice pending hai. Hamari finance team vendor onboarding verify kar rahi hai, accounts manager se baat karwao please.',
    expected_error: 'invoice_overdue',
    expected_action: 'escalate_to_human',
  },
];

export const VoiceIntakeModal: React.FC<VoiceIntakeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSelectTxn,
}) => {
  const [activeTab, setActiveTab] = useState<'demos' | 'mic' | 'custom'>('demos');
  const [transcript, setTranscript] = useState<string>(DEMO_SAMPLES[0].transcript);
  const [customerName, setCustomerName] = useState<string>('Aarav Sharma');
  const [amount, setAmount] = useState<string>('4999');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Web Speech API recognition instance
  const [recognition, setRecognition] = useState<any>(null);

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
          setRecognitionError(`Speech recognition: ${event.error}. You can type or select demo notes.`);
          setIsRecording(false);
        };

        recog.onend = () => {
          setIsRecording(false);
        };

        setRecognition(recog);
      }
    }
  }, []);

  if (!isOpen) return null;

  const toggleRecording = () => {
    if (!recognition) {
      setRecognitionError('Speech recognition is not supported in this browser. Please type or select a demo note.');
      return;
    }
    setRecognitionError(null);

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      setTranscript('');
      try {
        recognition.start();
        setIsRecording(true);
      } catch (err: any) {
        console.error(err);
        setRecognitionError('Microphone permission denied or busy.');
      }
    }
  };

  const handleSelectDemo = (sample: DemoSample) => {
    setTranscript(sample.transcript);
    setResult(null);
    setErrorMsg(null);
    if (sample.id === 'demo_voice_4') {
      setAmount('3450');
      setCustomerName('Ananya Iyer');
    } else if (sample.id === 'demo_voice_5') {
      setAmount('65000');
      setCustomerName('Vikram Enterprises');
    } else if (sample.id === 'demo_voice_2') {
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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Voice intake processing failed.');
      }

      setResult(data);
      onSuccess();
    } catch (err: any) {
      console.error('Voice intake error:', err);
      setErrorMsg(err.message || 'Failed to process voice note.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop-luxury">
      <div className="dialog-box-luxury" style={{ width: '740px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '20px' }}>🎙️</span>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                Hinglish Voice-Note Recovery Intake
              </h3>
              <span className="engine-status-tag" style={{ background: 'rgba(0, 229, 153, 0.15)', color: '#00E599' }}>
                Groq AI Bilingual
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-light-muted)', margin: 0 }}>
              Directly intake spoken audio transcripts in conversational Hinglish. Extracts root causes, captures payment promise dates, and executes NPCI-compliant recovery workflows.
            </p>
          </div>
          <button
            onClick={onClose}
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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
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
            <span>5 Live Demo Notes</span>
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
            <span>Speak into Mic</span>
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

        {/* Tab 1: 5 Demo Voice Notes */}
        {activeTab === 'demos' && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6B8077', fontWeight: 700, letterSpacing: '0.8px', marginBottom: '8px' }}>
              Select a Curated Presentation Scenario:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {DEMO_SAMPLES.map((sample) => {
                const isSelected = transcript === sample.transcript;
                return (
                  <div
                    key={sample.id}
                    onClick={() => handleSelectDemo(sample)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(0, 229, 153, 0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? '#00E599' : 'rgba(255,255,255,0.08)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#00E599' : '#FFFFFF' }}>
                        {sample.title}
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                        {sample.expected_action}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#A3B8B0', fontStyle: 'italic', lineHeight: 1.4 }}>
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
          <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={toggleRecording}
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: isRecording ? '#F43F5E' : '#00E599',
                  color: '#04120D',
                  border: isRecording ? '4px solid rgba(244, 63, 94, 0.4)' : '4px solid rgba(0, 229, 153, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isRecording ? '0 0 24px rgba(244, 63, 94, 0.6)' : '0 0 20px rgba(0, 229, 153, 0.4)',
                  transition: 'all 0.2s ease',
                }}
              >
                {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
              </button>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 700, color: isRecording ? '#FB7185' : '#FFFFFF', marginBottom: '4px' }}>
              {isRecording ? '🔴 Listening... Speak in Hindi or English' : 'Click microphone to record a live Hinglish voice note'}
            </div>
            <div style={{ fontSize: '11px', color: '#6B8077' }}>
              Example: "Bhai mera payment reject hua hai, somwar ko retry karna..."
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
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#A3B8B0', fontWeight: 700, letterSpacing: '0.6px' }}>
                Hinglish Voice Note Transcript (Voice-to-Text)
              </label>
              <span style={{ fontSize: '10px', color: '#6B8077' }}>Editable</span>
            </div>
            <textarea
              className="search-input-obsidian"
              rows={3}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Enter Hinglish voice note transcript, e.g. 'Card expire ho gaya hai shayad, naya bhejo link'..."
              style={{ width: '100%', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B8077', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                Customer Name
              </label>
              <input
                type="text"
                className="search-input-obsidian"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ width: '100%', borderRadius: '6px', padding: '8px 12px', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6B8077', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                Amount at Risk (₹ INR)
              </label>
              <input
                type="number"
                className="search-input-obsidian"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace' }}
              />
            </div>
          </div>

          {errorMsg && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.15)', color: '#FB7185', fontSize: '12px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Action Trigger Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: result ? '20px' : '0' }}>
            <button
              type="button"
              className="btn-pill-outline"
              onClick={onClose}
              style={{ color: '#94A3B8', borderColor: 'rgba(255,255,255,0.15)' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-pill-dark"
              disabled={isProcessing || !transcript.trim()}
              style={{ minWidth: '170px', justifyContent: 'center' }}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Processing Voice AI...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Execute Voice Intake</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Result Live Decision Visualizer */}
        {result && (
          <div
            style={{
              marginTop: '20px',
              padding: '18px',
              borderRadius: '12px',
              background: 'rgba(0, 229, 153, 0.04)',
              border: '1px solid rgba(0, 229, 153, 0.3)',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#00E599" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#00E599' }}>
                  Voice Note Processed & Compliant Action Executed
                </span>
              </div>
              <span className={`status-badge-obsidian ${result.pipeline_result?.status}`}>
                {result.pipeline_result?.status}
              </span>
            </div>

            {/* Extracted Entity Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9.5px', color: '#6B8077', textTransform: 'uppercase' }}>Extracted Failure</div>
                <div style={{ fontSize: '11.5px', color: '#FB7185', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                  {result.extracted_data?.error_code}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9.5px', color: '#6B8077', textTransform: 'uppercase' }}>Promise Date</div>
                <div style={{ fontSize: '11.5px', color: '#38BDF8', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                  {result.extracted_data?.promised_date ? `📅 ${result.extracted_data?.promised_date}` : 'None'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9.5px', color: '#6B8077', textTransform: 'uppercase' }}>Confidence</div>
                <div style={{ fontSize: '11.5px', color: '#00E599', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>
                  {result.extracted_data?.confidence_level || 'HIGH'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9.5px', color: '#6B8077', textTransform: 'uppercase' }}>Executed Action</div>
                <div style={{ fontSize: '11.5px', color: '#FBBF24', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                  {result.pipeline_result?.final_action_taken}
                </div>
              </div>
            </div>

            {/* Translation & Guardrail Output */}
            <div style={{ fontSize: '11.5px', color: '#A3B8B0', marginBottom: '8px', lineHeight: 1.4 }}>
              <strong>Intent Translation:</strong> {result.extracted_data?.intent_summary}
            </div>

            <div
              style={{
                fontSize: '11.5px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34D399',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '14px',
              }}
            >
              <ShieldCheck size={14} />
              <span>{result.pipeline_result?.guardrail_notes}</span>
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
                  style={{ fontSize: '11px', padding: '6px 12px', borderColor: '#38BDF8', color: '#38BDF8' }}
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
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                Intake Another Voice Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
