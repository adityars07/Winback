import React from 'react';
import { ArrowRight, Play, ShieldCheck, Zap, Upload, RefreshCw, Mic } from 'lucide-react';

interface NavbarProps {
  onRunBatch: () => void;
  onOpenUpload: () => void;
  onOpenVoiceModal: () => void;
  onScrollToSection: (id: string) => void;
  isProcessing: boolean;
  activeView: 'landing' | 'console';
  setActiveView: (view: 'landing' | 'console') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRunBatch,
  onOpenUpload,
  onOpenVoiceModal,
  onScrollToSection,
  isProcessing,
  activeView,
  setActiveView,
}) => {
  return (
    <div className="navbar-wrapper">
      <div className="container">
        <nav className="navbar">
          <div className="nav-left">
            <a
              href="#hero"
              className="brand-logo"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('landing');
                onScrollToSection('hero');
              }}
            >
              <span>win</span>
              <span className="highlight">back</span>
              <span className="brand-badge">RECOVERY</span>
            </a>

            <ul className="nav-links">
              <li>
                <a
                  href="#hero"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('landing');
                    onScrollToSection('hero');
                  }}
                >
                  Product
                </a>
              </li>
              <li>
                <a
                  href="#one-view"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('landing');
                    onScrollToSection('one-view');
                  }}
                >
                  Intelligence
                </a>
              </li>
              <li>
                <a
                  href="#voice-intake"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('landing');
                    onScrollToSection('voice-intake');
                  }}
                  style={{ color: '#38BDF8', fontWeight: 600 }}
                >
                  Voice AI 🎙️
                </a>
              </li>
              <li>
                <a
                  href="#comparison"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('landing');
                    onScrollToSection('comparison');
                  }}
                >
                  Guardrails
                </a>
              </li>
              <li>
                <a
                  href="#ladder"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('landing');
                    onScrollToSection('ladder');
                  }}
                >
                  Recovery Ladder
                </a>
              </li>
              <li>
                <a
                  href="#console"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('console');
                    onScrollToSection('console');
                  }}
                  style={{
                    color: activeView === 'console' ? '#08221A' : undefined,
                    fontWeight: activeView === 'console' ? 700 : undefined,
                  }}
                >
                  Live Console
                </a>
              </li>
            </ul>
          </div>

          <div className="nav-right">
            <div className="nav-status-pill">
              <span className="status-dot-pulse" />
              <span>NPCI Guardrails Active</span>
            </div>

            <button
              className="btn-pill-outline"
              onClick={onOpenVoiceModal}
              title="Hinglish Voice-Note Recovery Studio"
              style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38BDF8' }}
            >
              <Mic size={13} color="#38BDF8" />
              <span>Voice AI</span>
            </button>

            <button
              className="btn-pill-outline"
              onClick={onOpenUpload}
              title="Import CSV or AI Scan Invoices"
            >
              <Upload size={13} />
              <span>Ingest</span>
            </button>

            <button
              className="btn-pill-dark"
              onClick={() => {
                setActiveView('console');
                onRunBatch();
                onScrollToSection('console');
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Run Recovery Agent</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};
