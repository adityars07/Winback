import React from 'react';
import { Zap, ShieldCheck } from 'lucide-react';

export const FooterSection: React.FC = () => {
  return (
    <footer className="footer-section">
      <div className="container">
        <div className="footer-top">
          {/* Brand Info */}
          <div className="footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#00E599', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#061A14' }}>
                <Zap size={16} />
              </div>
              <h3 style={{ margin: 0, fontSize: '20px' }}>winback</h3>
            </div>
            <p>
              Autonomous AI Payment Recovery Agent & Deterministic Guardrail Policy Engine. Built for the Razorpay Buildathon 2026.
            </p>
          </div>

          {/* Col 1 */}
          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#hero">Overview</a></li>
              <li><a href="#one-view">Stream Ingestion</a></li>
              <li><a href="#comparison">Legacy vs Winback</a></li>
              <li><a href="#ladder">Recovery Ladder</a></li>
            </ul>
          </div>

          {/* Col 2 */}
          <div className="footer-col">
            <h4>Guardrails</h4>
            <ul>
              <li><a href="#comparison">NPCI Mandate 48h</a></li>
              <li><a href="#comparison">Max Retry Cap</a></li>
              <li><a href="#comparison">Frequency Limiting</a></li>
              <li><a href="#comparison">Human Escalation</a></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="footer-col">
            <h4>Security & Policy</h4>
            <ul>
              <li><a href="#ladder">RBI Compliance</a></li>
              <li><a href="#ladder">Groq Llama 3.3 70B</a></li>
              <li><a href="#ladder">Immutable Audit Logs</a></li>
              <li><a href="#calculator">ROI Calculator</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="footer-bottom">
          <div>
            © 2026 Winback Technologies. Built for Razorpay Buildathon AI Revenue Recovery Track.
          </div>

          <div className="compliance-pills">
            <span className="compliance-pill">NPCI Circular 2021/48</span>
            <span className="compliance-pill">RBI e-Mandate Guardrails</span>
            <span className="compliance-pill">Groq Llama 3.3 70B</span>
            <span className="compliance-pill">100% Deterministic</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
