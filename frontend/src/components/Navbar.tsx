import React from 'react';
import { ArrowRight, Play, ShieldCheck, Zap, Upload, RefreshCw, Mic } from 'lucide-react';

import { BrandLogo } from './BrandLogo';

interface NavbarProps {
  onRunBatch: () => void;
  onOpenUpload: () => void;
  onOpenVoiceModal: () => void;
  isProcessing: boolean;
  onScrollToSection: (sectionId: string) => void;
  activeView: 'landing' | 'console';
  setActiveView: (view: 'landing' | 'console') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRunBatch,
  onOpenUpload,
  onOpenVoiceModal,
  isProcessing,
  onScrollToSection,
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
              style={{ textDecoration: 'none' }}
              onClick={(e) => {
                e.preventDefault();
                setActiveView('landing');
                onScrollToSection('hero');
              }}
            >
              <BrandLogo variant="light" size="md" />
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
              title="Hinglish Voice Recovery Agent (Talk to Winback)"
              style={{
                borderColor: 'rgba(56, 189, 248, 0.45)',
                background: 'rgba(56, 189, 248, 0.08)',
                color: '#0284C7',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Mic size={14} color="#0284C7" />
              <span>Talk to Winback</span>
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
