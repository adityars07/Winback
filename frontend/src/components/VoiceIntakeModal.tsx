import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  PhoneCall,
  PhoneOff,
  Send,
  MessageSquare,
  Zap,
  Radio,
  User,
  Bot,
  Sliders,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  Check,
  Building,
  CreditCard,
  Calendar,
} from 'lucide-react';
import { Transaction } from '../types';

interface VoiceIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSelectTxn?: (txn: Transaction) => void;
  initialTxn?: Transaction | null;
}

interface MessageItem {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
  action?: string;
  guardrail?: string;
  error?: string;
  status?: string;
  amount?: number;
}

type VoicePersona = 'swara' | 'madhur' | 'neerja' | 'auto';

const VOICE_PERSONAS: Record<VoicePersona, { name: string; desc: string; pitch: number; rate: number; preferredNames: string[] }> = {
  swara: {
    name: '👩 Swara (Warm & Empathetic)',
    desc: 'Gentle, comforting female tone for friendly customer recovery',
    pitch: 1.06,
    rate: 0.94,
    preferredNames: ['Swara', 'Heera', 'Kalpana', 'Google हिन्दी', 'hi-IN', 'hi_IN', 'India'],
  },
  madhur: {
    name: '👨 Madhur (Senior Support Manager)',
    desc: 'Calm, authoritative, clear male support executive tone',
    pitch: 0.92,
    rate: 0.97,
    preferredNames: ['Madhur', 'Hemant', 'Prabhat', 'Rishi', 'Male', 'hi-IN', 'India'],
  },
  neerja: {
    name: '👩 Neerja (Crisp Indian English)',
    desc: 'Articulate, modern corporate tone for high-trust communication',
    pitch: 1.02,
    rate: 0.98,
    preferredNames: ['Neerja', 'Google English India', 'en-IN', 'en_IN', 'UK English Female', 'India'],
  },
  auto: {
    name: '⭐ Auto-Best Neural Engine',
    desc: 'Automatically picks the highest-grade Neural voice installed on your system',
    pitch: 1.0,
    rate: 0.96,
    preferredNames: ['Natural', 'Neural', 'Online', 'Google', 'Enhanced', 'hi-IN', 'en-IN', 'India'],
  },
};

export const VoiceIntakeModal: React.FC<VoiceIntakeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSelectTxn,
  initialTxn,
}) => {
  const [activeMode, setActiveMode] = useState<'outbound' | 'inbound' | 'manual'>('outbound');
  
  // Real Database Transactions for Outbound Dialer
  const [activeDbTxns, setActiveDbTxns] = useState<Transaction[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(initialTxn || null);
  const [txnSearchQuery, setTxnSearchQuery] = useState<string>('');
  const [loadingTxns, setLoadingTxns] = useState<boolean>(false);

  // Live 2-Way Call State
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [callState, setCallState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [liveSpeechPreview, setLiveSpeechPreview] = useState<string>('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number>(0);
  const [lastProcessedTxn, setLastProcessedTxn] = useState<Transaction | null>(null);

  // Dynamic Caller Information
  const [customerName, setCustomerName] = useState<string>(initialTxn?.customer_name || 'Customer');
  const [amount, setAmount] = useState<string>(initialTxn?.amount?.toString() || '4999');
  const [attemptNumber, setAttemptNumber] = useState<number>(initialTxn?.attempt_number || 1);
  const [contactCount, setContactCount] = useState<number>(initialTxn?.customer_contact_count_48h || 0);

  // Human Voice Settings
  const [voicePersona, setVoicePersona] = useState<VoicePersona>('swara');
  const [voiceSpeed, setVoiceSpeed] = useState<number>(0.95);
  const [voicePitch, setVoicePitch] = useState<number>(1.05);
  const [showVoiceSettings, setShowVoiceSettings] = useState<boolean>(false);

  // Manual / Custom Text Input
  const [customInputText, setCustomInputText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const isCallActiveRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const callTimerRef = useRef<any>(null);

  isCallActiveRef.current = isCallActive;
  isMutedRef.current = isMuted;

  // Load Real Transactions from Database for Outbound Calling
  const fetchRealTransactions = useCallback(async () => {
    setLoadingTxns(true);
    try {
      const res = await fetch('/voice-intake/active-transactions');
      if (res.ok) {
        const data = await res.json();
        setActiveDbTxns(data.transactions || []);
        if (!selectedTxn && data.transactions?.length > 0) {
          const first = data.transactions[0];
          setSelectedTxn(first);
          setCustomerName(first.customer_name || 'Customer');
          setAmount(first.amount?.toString() || '4999');
          setAttemptNumber(first.attempt_number || 1);
          setContactCount(first.customer_contact_count_48h || 0);
        }
      }
    } catch (e) {
      console.warn('Could not load real transactions for dialer:', e);
    } finally {
      setLoadingTxns(false);
    }
  }, [selectedTxn]);

  useEffect(() => {
    if (isOpen) {
      fetchRealTransactions();
    }
  }, [isOpen, fetchRealTransactions]);

  // Update caller context when a transaction is picked from DB
  const handleSelectDbTxn = (t: Transaction) => {
    setSelectedTxn(t);
    setCustomerName(t.customer_name || 'Customer');
    setAmount(t.amount?.toString() || '4999');
    setAttemptNumber(t.attempt_number || 1);
    setContactCount(t.customer_contact_count_48h || 0);
    setLastProcessedTxn(t);
  };

  // Call duration timer
  useEffect(() => {
    if (isCallActive) {
      setCallDurationSeconds(0);
      callTimerRef.current = setInterval(() => {
        setCallDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [isCallActive]);

  // Auto-scroll chat feed
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveSpeechPreview]);

  // Subtle acoustic chime
  const playListeningChime = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  }, []);

  // Find Neural Voice Helper
  const findBestVoice = useCallback((personaKey: VoicePersona): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const persona = VOICE_PERSONAS[personaKey] || VOICE_PERSONAS.swara;
    for (const pref of persona.preferredNames) {
      const found = voices.find((v) =>
        v.name.toLowerCase().includes(pref.toLowerCase()) ||
        v.lang.toLowerCase().includes(pref.toLowerCase())
      );
      if (found) return found;
    }

    const indianVoice = voices.find(
      (v) =>
        v.lang === 'hi-IN' ||
        v.lang === 'hi_IN' ||
        v.lang === 'en-IN' ||
        v.name.includes('India') ||
        v.name.includes('Hindi')
    );
    if (indianVoice) return indianVoice;

    return voices[0] || null;
  }, []);

  // Natural Speech Synthesis Helper
  const speakText = useCallback(
    (text: string, onEndCallback?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (onEndCallback) onEndCallback();
        return;
      }

      window.speechSynthesis.cancel();
      setCallState('speaking');

      const cleanText = text
        .replace(/[*_~`#\[\]]/g, '')
        .replace(/₹\s*/g, 'rupaye ')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const personaConfig = VOICE_PERSONAS[voicePersona] || VOICE_PERSONAS.swara;
      
      utterance.rate = voiceSpeed || personaConfig.rate;
      utterance.pitch = voicePitch || personaConfig.pitch;

      const chosenVoice = findBestVoice(voicePersona);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      utterance.onend = () => {
        setCallState('idle');
        if (onEndCallback) onEndCallback();
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        setCallState('idle');
        if (onEndCallback) onEndCallback();
      };

      window.speechSynthesis.speak(utterance);
    },
    [voicePersona, voiceSpeed, voicePitch, findBestVoice]
  );

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.lang = 'hi-IN';

        recog.onstart = () => {
          if (isCallActiveRef.current && !isMutedRef.current) {
            setCallState('listening');
          }
        };

        recog.onresult = (event: any) => {
          let interimText = '';
          let finalText = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalText += event.results[i][0].transcript;
            } else {
              interimText += event.results[i][0].transcript;
            }
          }

          if (interimText) {
            setLiveSpeechPreview(interimText);
          }

          if (finalText.trim()) {
            setLiveSpeechPreview('');
            handleSendUserTurn(finalText.trim());
          }
        };

        recog.onerror = (event: any) => {
          if (event.error === 'no-speech' && isCallActiveRef.current && !isMutedRef.current) {
            setTimeout(() => {
              if (isCallActiveRef.current && !isMutedRef.current) {
                try { recog.start(); } catch (e) {}
              }
            }, 300);
          } else {
            setLiveSpeechPreview('');
          }
        };

        recog.onend = () => {
          if (isCallActiveRef.current && !isMutedRef.current && callState === 'listening') {
            setTimeout(() => {
              if (isCallActiveRef.current && !isMutedRef.current) {
                try { recog.start(); } catch (e) {}
              }
            }, 400);
          }
        };

        recognitionRef.current = recog;
      }
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Helper to trigger microphone listening
  const startListening = useCallback(() => {
    if (recognitionRef.current && isCallActiveRef.current && !isMutedRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      setTimeout(() => {
        try {
          recognitionRef.current.start();
          setCallState('listening');
          playListeningChime();
        } catch (e) {
          console.warn('Recognition start skipped:', e);
        }
      }, 250);
    }
  }, [playListeningChime]);

  // Start Real Voice Call Session
  const handleStartCall = () => {
    setIsCallActive(true);
    isCallActiveRef.current = true;
    setErrorMsg(null);

    let greetingText = '';
    if (activeMode === 'outbound' && selectedTxn) {
      const failureReasonStr = selectedTxn.failure_code.replace('_', ' ');
      greetingText = `Namaste ${customerName} ji! Main Winback recovery support se bol raha hoon. Aapka ₹${amount} ka payment ${failureReasonStr} ki wajah se complete nahi ho paya tha. Main isme aapki kya madad kar sakta hoon?`;
    } else {
      greetingText = `Namaste ${customerName} ji! Winback AI payment recovery desk mein aapka swagat hai. Main aapki kya madad kar sakta hoon?`;
    }

    const greetingMsg: MessageItem = {
      id: `msg_${Date.now()}`,
      role: 'agent',
      text: greetingText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([greetingMsg]);

    speakText(greetingText, () => {
      if (isCallActiveRef.current && !isMutedRef.current) {
        startListening();
      }
    });
  };

  // End Call Session
  const handleEndCall = () => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setCallState('idle');
    setLiveSpeechPreview('');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;

    if (next) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setCallState('idle');
    } else {
      if (isCallActive) {
        startListening();
      }
    }
  };

  // Process Real Turn via POST /voice-intake
  const handleSendUserTurn = async (userText: string) => {
    if (!userText.trim()) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    setCallState('processing');
    setErrorMsg(null);

    const userMsg: MessageItem = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);

    try {
      const parsedAmount = parseFloat(amount) || 4999.0;
      const targetTxnId = selectedTxn?.txn_id || lastProcessedTxn?.txn_id;

      const res = await fetch('/voice-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: userText,
          customer_name: customerName.trim() || 'Customer',
          amount: parsedAmount,
          attempt_number: attemptNumber,
          customer_contact_count_48h: contactCount,
          txn_id: targetTxnId,
          history: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch (parseErr) {
        throw new Error(resText || `Server returned error (${res.status})`);
      }

      if (!res.ok) throw new Error(data.detail || data.message || 'Voice recovery turn failed.');

      const agentReplyText = data.voice_agent_reply || 'Theek hai, humne aapka payment status update kar diya hai.';
      const pipeline = data.pipeline_result || {};

      const agentMsg: MessageItem = {
        id: `agt_${Date.now()}`,
        role: 'agent',
        text: agentReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: pipeline.final_action_taken,
        guardrail: pipeline.guardrail_notes,
        error: data.extracted_data?.error_code,
        status: pipeline.status,
        amount: pipeline.amount,
      };

      setMessages((prev) => [...prev, agentMsg]);
      if (data.transaction) {
        setLastProcessedTxn(data.transaction);
        setSelectedTxn(data.transaction);
      }
      onSuccess();

      // Speak response out loud & AUTOMATICALLY RE-OPEN MIC for Two-Way conversation!
      speakText(agentReplyText, () => {
        if (isCallActiveRef.current && !isMutedRef.current) {
          setTimeout(() => {
            if (isCallActiveRef.current && !isMutedRef.current) {
              startListening();
            }
          }, 350);
        }
      });
    } catch (err: any) {
      console.error('Two-way voice turn error:', err);
      setErrorMsg(err.message || 'Could not process voice turn.');
      setCallState('idle');
      if (isCallActiveRef.current && !isMutedRef.current) {
        setTimeout(startListening, 1000);
      }
    }
  };

  // Format call duration MM:SS
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredTxns = activeDbTxns.filter((t) => {
    if (!txnSearchQuery.trim()) return true;
    const q = txnSearchQuery.toLowerCase();
    return (
      t.txn_id.toLowerCase().includes(q) ||
      (t.customer_name && t.customer_name.toLowerCase().includes(q)) ||
      t.failure_code.toLowerCase().includes(q) ||
      t.amount.toString().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-box-luxury voice-dialog-luxury"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '900px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Modal Top Bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '22px' }}>🎙️</span>
              <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Live Two-Way Voice Recovery Agent
              </h3>
              <span className="engine-status-tag" style={{ background: isCallActive ? 'rgba(0, 229, 153, 0.18)' : 'rgba(56, 189, 248, 0.15)', color: isCallActive ? '#00E599' : '#38BDF8' }}>
                <Radio size={12} className={isCallActive ? 'animate-pulse' : ''} />
                {isCallActive ? `Live Call (${formatDuration(callDurationSeconds)})` : 'Production Voice Agent'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-light-muted)', margin: 0 }}>
              Dynamic AI voice agent connected directly to real database transactions. Negotiates payment commitments, handles objections, enforces deterministic NPCI guardrails, and speaks in natural Hinglish.
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className="btn-pill-outline"
              style={{
                fontSize: '11px',
                padding: '5px 10px',
                borderColor: showVoiceSettings ? '#38BDF8' : 'rgba(255,255,255,0.15)',
                color: showVoiceSettings ? '#38BDF8' : '#A3B8B0',
              }}
            >
              <Sliders size={12} />
              <span>Voice Persona ⚙️</span>
            </button>
            
            <button
              onClick={() => {
                handleEndCall();
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
        </div>

        {/* Expandable Voice Persona & Tone Panel */}
        {showVoiceSettings && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(4, 20, 15, 0.95) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#38BDF8' }}>
                <Sparkles size={14} />
                <span>Voice Persona & Neural Tone Tuning</span>
              </div>
              <button
                type="button"
                onClick={() => speakText('Namaste! Main Winback AI recovery assistant hoon. Main aapki payment recovery mein poori madad kar sakta hoon.')}
                style={{
                  background: '#38BDF8',
                  color: '#04120D',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '3px 10px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Volume2 size={12} />
                <span>Test Voice Sample 🔊</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              {(Object.keys(VOICE_PERSONAS) as VoicePersona[]).map((key) => {
                const p = VOICE_PERSONAS[key];
                const isSelected = voicePersona === key;
                return (
                  <div
                    key={key}
                    onClick={() => {
                      setVoicePersona(key);
                      setVoicePitch(p.pitch);
                      setVoiceSpeed(p.rate);
                    }}
                    style={{
                      background: isSelected ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? '#38BDF8' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '8px',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: isSelected ? '#38BDF8' : '#FFFFFF', marginBottom: '2px' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#A3B8B0', lineHeight: 1.3 }}>
                      {p.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode Selector Tabs (Real Modes: Outbound Dialer, Inbound Hotline, Manual) */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
          <button
            type="button"
            className={`btn-pill-outline ${activeMode === 'outbound' ? 'active' : ''}`}
            onClick={() => setActiveMode('outbound')}
            style={{
              background: activeMode === 'outbound' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              borderColor: activeMode === 'outbound' ? '#38BDF8' : 'rgba(255,255,255,0.15)',
              color: activeMode === 'outbound' ? '#38BDF8' : '#94A3B8',
              fontWeight: 700,
            }}
          >
            <PhoneOutgoing size={13} />
            <span>Outbound Recovery Call (Select from DB)</span>
          </button>

          <button
            type="button"
            className={`btn-pill-outline ${activeMode === 'inbound' ? 'active' : ''}`}
            onClick={() => {
              setActiveMode('inbound');
              setSelectedTxn(null);
            }}
            style={{
              background: activeMode === 'inbound' ? 'rgba(0, 229, 153, 0.15)' : 'transparent',
              borderColor: activeMode === 'inbound' ? '#00E599' : 'rgba(255,255,255,0.15)',
              color: activeMode === 'inbound' ? '#00E599' : '#94A3B8',
              fontWeight: 700,
            }}
          >
            <PhoneIncoming size={13} />
            <span>Inbound Customer Hotline</span>
          </button>

          <button
            type="button"
            className={`btn-pill-outline ${activeMode === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveMode('manual')}
            style={{
              background: activeMode === 'manual' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              borderColor: activeMode === 'manual' ? '#F59E0B' : 'rgba(255,255,255,0.15)',
              color: activeMode === 'manual' ? '#FBBF24' : '#94A3B8',
            }}
          >
            <Send size={13} />
            <span>Custom Script & Note Ingestion</span>
          </button>
        </div>

        {/* ── REAL DATABASE TRANSACTION PICKER FOR OUTBOUND CALLS ── */}
        {activeMode === 'outbound' && !isCallActive && (
          <div style={{ marginBottom: '14px', background: 'rgba(0, 0, 0, 0.3)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#38BDF8', fontWeight: 700, letterSpacing: '0.6px' }}>
                Select Real Failed Transaction to Call from Database:
              </div>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={12} color="#6B8077" style={{ position: 'absolute', left: '8px', top: '8px' }} />
                <input
                  type="text"
                  placeholder="Search customer, ID, amount..."
                  value={txnSearchQuery}
                  onChange={(e) => setTxnSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    padding: '4px 8px 4px 26px',
                    color: '#FFFFFF',
                    fontSize: '11px',
                  }}
                />
              </div>
            </div>

            {/* List of Real DB Transactions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
              {loadingTxns ? (
                <div style={{ color: '#6B8077', fontSize: '11px', padding: '10px' }}>Loading database transactions...</div>
              ) : filteredTxns.length === 0 ? (
                <div style={{ color: '#6B8077', fontSize: '11px', padding: '10px' }}>No transactions found in database.</div>
              ) : (
                filteredTxns.map((t) => {
                  const isSelected = selectedTxn?.txn_id === t.txn_id;
                  return (
                    <div
                      key={t.txn_id}
                      onClick={() => handleSelectDbTxn(t)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? '#38BDF8' : 'rgba(255,255,255,0.08)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: isSelected ? '#38BDF8' : '#FFFFFF' }}>
                          {t.customer_name || 'Customer'}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#00E599', fontFamily: 'monospace' }}>
                          ₹{t.amount?.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9.5px', color: '#A3B8B0' }}>
                        <span className="mono-hash">{t.txn_id}</span>
                        <span style={{ color: '#FBBF24' }}>{t.failure_code} (Att #{t.attempt_number})</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Customer Context Card (Live Context for Current Call) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px', background: 'rgba(0, 0, 0, 0.3)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B8077', display: 'block', fontWeight: 700 }}>
              Customer Name
            </label>
            <input
              type="text"
              className="search-input-obsidian"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ width: '100%', borderRadius: '4px', padding: '4px 8px', fontSize: '11px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B8077', display: 'block', fontWeight: 700 }}>
              Amount at Risk (₹)
            </label>
            <input
              type="number"
              className="search-input-obsidian"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: '100%', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B8077', display: 'block', fontWeight: 700 }}>
              Attempt # (Rule 1 Cap: 3)
            </label>
            <input
              type="number"
              min={1}
              max={6}
              className="search-input-obsidian"
              value={attemptNumber}
              onChange={(e) => setAttemptNumber(parseInt(e.target.value) || 1)}
              style={{ width: '100%', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B8077', display: 'block', fontWeight: 700 }}>
              Outreach Count 48h (Rule 3 Cap: 2)
            </label>
            <input
              type="number"
              min={0}
              max={5}
              className="search-input-obsidian"
              value={contactCount}
              onChange={(e) => setContactCount(parseInt(e.target.value) || 0)}
              style={{ width: '100%', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* ── TWO-WAY CONVERSATIONAL VOICE CALL ARENA ── */}
        {(activeMode === 'outbound' || activeMode === 'inbound') && (
          <div>
            {/* Central Animated Orb & Call Controller */}
            <div className="voice-call-orb-container">
              {isCallActive ? (
                <>
                  <div
                    className={`voice-call-orb ${
                      callState === 'listening'
                        ? 'orb-listening'
                        : callState === 'speaking'
                        ? 'orb-speaking'
                        : callState === 'processing'
                        ? 'orb-processing'
                        : 'orb-idle'
                    }`}
                  >
                    {callState === 'listening' ? (
                      <Mic size={34} color="#04140F" />
                    ) : callState === 'speaking' ? (
                      <Volume2 size={34} color="#04140F" />
                    ) : callState === 'processing' ? (
                      <RefreshCw size={30} color="#04140F" className="animate-spin" />
                    ) : (
                      <MicOff size={30} color="#04140F" />
                    )}
                  </div>

                  {/* Sound Wave Indicator */}
                  {callState === 'listening' || callState === 'speaking' ? (
                    <div className="voice-wave-container">
                      <div className="voice-wave-bar" style={{ background: callState === 'speaking' ? '#00E599' : '#38BDF8' }} />
                      <div className="voice-wave-bar" style={{ background: callState === 'speaking' ? '#00E599' : '#38BDF8' }} />
                      <div className="voice-wave-bar" style={{ background: callState === 'speaking' ? '#00E599' : '#38BDF8' }} />
                      <div className="voice-wave-bar" style={{ background: callState === 'speaking' ? '#00E599' : '#38BDF8' }} />
                      <div className="voice-wave-bar" style={{ background: callState === 'speaking' ? '#00E599' : '#38BDF8' }} />
                    </div>
                  ) : (
                    <div style={{ height: '24px', marginTop: '10px' }} />
                  )}

                  {/* Call State Text */}
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: callState === 'listening' ? '#38BDF8' : callState === 'speaking' ? '#00E599' : '#FBBF24', marginTop: '4px' }}>
                    {callState === 'listening'
                      ? '🎙️ Listening... Speak naturally in Hindi or English (Hinglish)'
                      : callState === 'speaking'
                      ? `🔊 AI Speaking (${VOICE_PERSONAS[voicePersona]?.name.split(' ')[1] || 'Agent'})...`
                      : callState === 'processing'
                      ? '🧠 Groq AI Interpreting Intent & Checking Policy Rules...'
                      : isMuted
                      ? '🔇 Microphone Muted'
                      : '📞 Call Active'}
                  </div>

                  {liveSpeechPreview && (
                    <div style={{ fontSize: '12px', color: '#38BDF8', fontStyle: 'italic', marginTop: '4px', background: 'rgba(56, 189, 248, 0.1)', padding: '3px 10px', borderRadius: '12px' }}>
                      "{liveSpeechPreview}..."
                    </div>
                  )}

                  {/* Active Call Action Bar */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className="btn-pill-outline"
                      style={{
                        background: isMuted ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                        color: isMuted ? '#FB7185' : '#FFFFFF',
                        borderColor: isMuted ? '#FB7185' : 'rgba(255,255,255,0.2)',
                        padding: '6px 14px',
                        fontSize: '11.5px',
                      }}
                    >
                      {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                      <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                    </button>

                    {callState === 'speaking' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') window.speechSynthesis.cancel();
                          setCallState('idle');
                          startListening();
                        }}
                        className="btn-pill-outline"
                        style={{ color: '#FBBF24', borderColor: '#FBBF24', padding: '6px 14px', fontSize: '11.5px' }}
                      >
                        <Pause size={13} />
                        <span>Interrupt AI</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleEndCall}
                      className="btn-pill-dark"
                      style={{ background: '#F43F5E', color: '#FFFFFF', borderColor: '#F43F5E', fontWeight: 700, padding: '6px 16px', fontSize: '11.5px' }}
                    >
                      <PhoneOff size={13} />
                      <span>End Call</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="voice-call-orb orb-idle" style={{ cursor: 'pointer' }} onClick={handleStartCall}>
                    <PhoneCall size={34} color="#38BDF8" />
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', marginTop: '12px' }}>
                    {activeMode === 'outbound'
                      ? `Dial Customer: ${customerName} (₹${amount})`
                      : `Start Inbound Voice Recovery Session`}
                  </div>
                  <p style={{ fontSize: '12px', color: '#A3B8B0', textAlign: 'center', maxWidth: '460px', margin: '4px 0 16px 0' }}>
                    {activeMode === 'outbound'
                      ? `Connect an interactive two-way recovery call for ${selectedTxn?.txn_id || 'active transaction'}. The AI agent will explain the failure reason and negotiate payment.`
                      : `Receive live inbound voice customer call. The AI agent will identify their payment issue and resolve it dynamically.`}
                  </p>
                  <button
                    type="button"
                    onClick={handleStartCall}
                    className="btn-pill-dark"
                    style={{ background: '#38BDF8', color: '#04120D', borderColor: '#38BDF8', fontWeight: 800, padding: '10px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <PhoneCall size={16} />
                    <span>{activeMode === 'outbound' ? '📞 Call Customer Now' : '🎧 Answer Inbound Call'}</span>
                  </button>
                </>
              )}
            </div>

            {/* Two-Way Conversation Transcript Feed */}
            <div className="voice-transcript-feed">
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#6B8077', fontSize: '12px' }}>
                  Ready to connect. Click "Call Customer Now" to begin dynamic two-way conversation.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'voice-msg-user' : 'voice-msg-agent'}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: m.role === 'user' ? '#38BDF8' : '#00E599', textTransform: 'uppercase' }}>
                        {m.role === 'user' ? <User size={11} /> : <Bot size={11} />}
                        <span>{m.role === 'user' ? customerName : 'Winback Voice AI'}</span>
                      </div>
                      <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                        {m.timestamp}
                      </span>
                    </div>

                    <div style={{ lineHeight: 1.45, fontSize: '12.5px' }}>
                      "{m.text}"
                    </div>

                    {/* Agent Outcome Badge */}
                    {m.role === 'agent' && m.action && (
                      <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: m.guardrail?.includes('⛔') ? 'rgba(244, 63, 94, 0.2)' : 'rgba(0, 229, 153, 0.2)', color: m.guardrail?.includes('⛔') ? '#FB7185' : '#00E599', fontWeight: 700 }}>
                            {m.action}
                          </span>
                          {m.status && (
                            <span style={{ fontSize: '9px', color: '#A3B8B0' }}>
                              Status: <strong style={{ color: '#FFFFFF' }}>{m.status}</strong>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => speakText(m.text)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#38BDF8',
                            fontSize: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Volume2 size={11} />
                          <span>Replay</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* In-Call Text Input for noisy environments */}
            {isCallActive && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customInputText.trim()) {
                    handleSendUserTurn(customInputText.trim());
                    setCustomInputText('');
                  }
                }}
                style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}
              >
                <input
                  type="text"
                  className="search-input-obsidian"
                  placeholder="Or type what the customer is saying in Hinglish..."
                  value={customInputText}
                  onChange={(e) => setCustomInputText(e.target.value)}
                  style={{ flex: 1, borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}
                />
                <button
                  type="submit"
                  className="btn-pill-dark"
                  disabled={!customInputText.trim() || callState === 'processing'}
                  style={{ padding: '8px 16px', background: '#38BDF8', color: '#04120D', fontWeight: 700 }}
                >
                  <Send size={13} />
                  <span>Send</span>
                </button>
              </form>
            )}

            {/* Active Transaction Report & Audit Link */}
            {lastProcessedTxn && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(0, 229, 153, 0.06)', border: '1px solid rgba(0, 229, 153, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#00E599" />
                  <span style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 600 }}>
                    Active Transaction: <span className="mono-hash">{lastProcessedTxn.txn_id}</span> ({lastProcessedTxn.status})
                  </span>
                </div>
                {onSelectTxn && (
                  <button
                    type="button"
                    className="btn-pill-outline"
                    onClick={() => {
                      onSelectTxn(lastProcessedTxn);
                      handleEndCall();
                      onClose();
                    }}
                    style={{ fontSize: '11px', padding: '4px 10px', borderColor: '#00E599', color: '#00E599' }}
                  >
                    Inspect in Audit Drawer →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: CUSTOM SCRIPT / VOICE NOTE INGESTION ── */}
        {activeMode === 'manual' && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#A3B8B0', fontWeight: 700, letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                Enter Unstructured Customer Speech Transcript / Voice Note:
              </label>
              <textarea
                className="search-input-obsidian"
                rows={4}
                value={customInputText}
                onChange={(e) => setCustomInputText(e.target.value)}
                placeholder="Type or paste any customer voice note in Hinglish, Hindi, or English (e.g. 'Mera card expire ho gaya hai, WhatsApp link bhej do' or 'Kal salary aayegi 28 ko retry karo')..."
                style={{ width: '100%', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn-pill-dark"
                disabled={!customInputText.trim()}
                onClick={() => {
                  setActiveMode('outbound');
                  setIsCallActive(true);
                  isCallActiveRef.current = true;
                  handleSendUserTurn(customInputText.trim());
                  setCustomInputText('');
                }}
                style={{ background: '#38BDF8', color: '#04120D', fontWeight: 700, padding: '8px 18px' }}
              >
                <PhoneCall size={14} />
                <span>Process with Dynamic Voice Engine</span>
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(244, 63, 94, 0.15)', color: '#FB7185', fontSize: '11.5px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
            ⚠️ {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
