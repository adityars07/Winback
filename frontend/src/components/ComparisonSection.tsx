import React from 'react';
import { CalendarClock, ShieldAlert, Sparkles, AlertOctagon, CheckCircle2, TrendingDown } from 'lucide-react';

export const ComparisonSection: React.FC = () => {
  return (
    <section className="comparison-section" id="comparison">
      <div className="container">
        <div className="section-header-center">
          <h2>Spreadsheet dunning is costing you real money</h2>
          <p>
            The average high-growth merchant loses 8–15% of MRR to preventable payment failures — and spends weeks trying to fix it with dumb cron jobs and manual spreadsheets.
          </p>
        </div>

        <div className="dark-cards-grid">
          {/* Card 1 */}
          <div className="dark-feature-card">
            <div>
              <div className="feature-visual-box">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#F43F5E', fontFamily: 'monospace' }}>
                    0.01%
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B8077', marginTop: '4px' }}>
                    Recovery rate with static scheduled cron
                  </div>
                </div>
              </div>

              <h3 className="card-title">Blind retries go stale by D.O.M.</h3>
              <p className="card-description">
                The card failed right when someone needed it. Blind cron jobs hammer the card repeatedly before salary day, triggering permanent issuer declines and customer churn.
              </p>
            </div>

            <div className="card-solution-tag">
              <CheckCircle2 size={13} color="#00E599" />
              <span>Winback: AI-timed retries</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="dark-feature-card">
            <div>
              <div className="feature-visual-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F43F5E' }}>
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>NPCI Compliance Breach</div>
                    <div style={{ fontSize: '10px', color: '#F43F5E', fontFamily: 'monospace' }}>RETRY WINDOW EXPIRED</div>
                  </div>
                </div>
              </div>

              <h3 className="card-title">Unregulated outreach breaches NPCI</h3>
              <p className="card-description">
                Unchecked automated dunning violates RBI e-mandate 48h windows and customer spam limits. Winback enforces deterministic guardrails with mathematical unit test guarantees.
              </p>
            </div>

            <div className="card-solution-tag">
              <CheckCircle2 size={13} color="#00E599" />
              <span>Winback: Hard policy guardrails</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="dark-feature-card">
            <div>
              <div className="feature-visual-box">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#00E599', fontFamily: 'monospace' }}>
                    +4.8x ROI
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B8077', marginTop: '4px' }}>
                    Instant 1-click WhatsApp UPI recovery
                  </div>
                </div>
              </div>

              <h3 className="card-title">Revenue lost in checkout drop-offs</h3>
              <p className="card-description">
                When customers abandon carts or invoice payment links fail, generic emails sit unopened. Winback sends personalized WhatsApp deep links with 1-click UPI payment intents.
              </p>
            </div>

            <div className="card-solution-tag">
              <CheckCircle2 size={13} color="#00E599" />
              <span>Winback: WhatsApp 1-click UPI</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
