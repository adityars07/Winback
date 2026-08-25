import React from 'react';

export const StatsBar: React.FC = () => {
  return (
    <section className="stats-ribbon-section">
      <div className="container">
        <div className="stats-ribbon-grid">
          {/* Dark Contrast Block */}
          <div className="ribbon-cell dark-feature">
            <div className="ribbon-feature-text">
              Revenue & Finance teams at <span className="brand-accent">140+ high-growth brands</span> run recovery on Winback.
            </div>
          </div>

          {/* Metric 1 */}
          <div className="ribbon-cell">
            <div className="ribbon-stat-val">₹18.4 Cr</div>
            <div className="ribbon-stat-label">Lost Revenue Recovered (Across 15,400+ transactions)</div>
          </div>

          {/* Metric 2 */}
          <div className="ribbon-cell">
            <div className="ribbon-stat-val">68.4%</div>
            <div className="ribbon-stat-label">Avg. Autonomous Recovery Rate (Vs 18% dumb dunning)</div>
          </div>

          {/* Metric 3 */}
          <div className="ribbon-cell">
            <div className="ribbon-stat-val">100%</div>
            <div className="ribbon-stat-label">Deterministic NPCI & RBI Compliance Guarantee</div>
          </div>
        </div>
      </div>
    </section>
  );
};
