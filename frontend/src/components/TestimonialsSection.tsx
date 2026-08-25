import React from 'react';
import { Quote } from 'lucide-react';

export const TestimonialsSection: React.FC = () => {
  return (
    <section className="testimonials-section" id="testimonials">
      <div className="container">
        <div className="section-header-center">
          <h2>Finance & Revenue teams that stopped guessing</h2>
          <p>
            From high-growth SaaS to premier D2C brands processing millions in monthly transaction volume.
          </p>
        </div>

        <div className="testimonials-grid">
          {/* Card 1 */}
          <div className="testimonial-card">
            <div>
              <Quote className="quote-icon" />
              <p className="testimonial-quote">
                "₹51L was sitting in accounts with failed renewals. <span className="highlight-green">Winback had 74% recovered within a week</span>, and our NPCI mandate compliance buffer has never been breached once."
              </p>
            </div>

            <div className="testimonial-author">
              <div className="author-avatar">AV</div>
              <div>
                <div className="author-name">Aakash Verma</div>
                <div className="author-role">VP Finance, CloudScale SaaS</div>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="testimonial-card">
            <div>
              <Quote className="quote-icon" />
              <p className="testimonial-quote">
                "Month-end B2B dunning went from <span className="highlight-green">four days of manual emails to forty minutes on autopilot</span>. The board deck revenue recovery chart is literally a screenshot of Winback now."
              </p>
            </div>

            <div className="testimonial-author">
              <div className="author-avatar">NK</div>
              <div>
                <div className="author-name">Neha Kulkarni</div>
                <div className="author-role">Head of RevOps, Omnichannel Retail</div>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="testimonial-card">
            <div>
              <Quote className="quote-icon" />
              <p className="testimonial-quote">
                "Six payment gateways, three currencies, one engine we trust. When our Series B diligence asked for cash history and audit trail, <span className="highlight-green">it took one expert export</span>."
              </p>
            </div>

            <div className="testimonial-author">
              <div className="author-avatar">RM</div>
              <div>
                <div className="author-name">Rohan Malhotra</div>
                <div className="author-role">Co-Founder & CEO, FinPulse</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
