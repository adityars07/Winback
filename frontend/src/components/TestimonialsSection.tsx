import React from 'react';
import { ShieldCheck, Lock, FileCheck2, Cpu, Scale, CheckCircle2 } from 'lucide-react';

export const TestimonialsSection: React.FC = () => {
  return (
    <section className="testimonials-section" id="compliance" style={{ padding: '60px 0', background: '#020C08' }}>
      <div className="container">
        <div className="section-header-center" style={{ marginBottom: '36px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(0, 229, 153, 0.12)', border: '1px solid rgba(0, 229, 153, 0.3)', color: '#00E599', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
            <ShieldCheck size={13} />
            <span>Enterprise Security & Regulatory Compliance</span>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px', margin: '0 0 8px 0' }}>
            Built for Regulated Indian Banking & FinTech Infrastructure
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-light-muted)', maxWidth: '640px', margin: '0 auto', lineHeight: 1.5 }}>
            Every recovery recommendation passes through a pure deterministic policy safety engine before financial execution.
          </p>
        </div>

        <div className="testimonials-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Card 1 */}
          <div className="testimonial-card" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(0, 229, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00E599' }}>
                <Scale size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>NPCI Circular Compliance</h4>
                <span style={{ fontSize: '11px', color: '#00E599' }}>Mandate Timing Enforcement</span>
              </div>
            </div>
            <p style={{ fontSize: '12.5px', color: '#A3B8B0', lineHeight: 1.5, margin: 0 }}>
              Enforces strict 24-hour pre-debit notifications and strict mandate validity windows. Automatically halts auto-retries and routes to 1-click payment links if the mandate window has expired.
            </p>
          </div>

          {/* Card 2 */}
          <div className="testimonial-card" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38BDF8' }}>
                <FileCheck2 size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>Immutable Audit Ledger</h4>
                <span style={{ fontSize: '11px', color: '#38BDF8' }}>100% Traceable Decision State</span>
              </div>
            </div>
            <p style={{ fontSize: '12.5px', color: '#A3B8B0', lineHeight: 1.5, margin: 0 }}>
              Every AI diagnosis, policy check, voice transcript turn, and execution outcome is permanently logged into append-only SQLite/PostgreSQL audit tables for compliance readiness.
            </p>
          </div>

          {/* Card 3 */}
          <div className="testimonial-card" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FBBF24' }}>
                <Lock size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>Anti-Fatigue Outreach Cap</h4>
                <span style={{ fontSize: '11px', color: '#FBBF24' }}>48-Hour Frequency Limiter</span>
              </div>
            </div>
            <p style={{ fontSize: '12.5px', color: '#A3B8B0', lineHeight: 1.5, margin: 0 }}>
              Protects customer relationships with a hard cap of maximum 2 contact touches per 48 hours across WhatsApp, SMS, and Email. Subsequent attempts are safely routed to human operations.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
