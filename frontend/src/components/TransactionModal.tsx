import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, ArrowRight, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { Transaction, AuditEvent } from '../types';

interface TransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  transaction,
  onClose,
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!transaction) return;
    setLoading(true);
    fetch(`/audit-events?txn_id=${transaction.txn_id}`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
      })
      .catch((err) => console.error('Failed to load audit events:', err))
      .finally(() => setLoading(false));
  }, [transaction]);

  if (!transaction) return null;

  const isBlocked = transaction.guardrail_notes?.includes('⛔');
  const isOverridden = isBlocked && transaction.recommended_action !== transaction.final_action_taken;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-drawer-luxury" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-luxury">
          <div>
            <div style={{ fontSize: '11px', color: '#00E599', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}>
              ● Granular Audit Trace
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: '#FFFFFF', marginTop: '2px' }}>
              {transaction.txn_id}
            </div>
          </div>
          <button className="close-btn-luxury" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Customer & Payment Meta Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div className="detail-group-luxury">
            <div className="detail-label-luxury">Customer</div>
            <div className="detail-val-luxury">{transaction.customer_name}</div>
            <div style={{ fontSize: '11px', color: '#6B8077' }}>{transaction.customer_email}</div>
          </div>

          <div className="detail-group-luxury">
            <div className="detail-label-luxury">Amount at Risk</div>
            <div className="detail-val-luxury" style={{ color: '#00E599', fontFamily: 'monospace', fontSize: '17px' }}>
              ₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="detail-group-luxury">
            <div className="detail-label-luxury">Category / Type</div>
            <div className="detail-val-luxury">{transaction.type.replace(/_/g, ' ')}</div>
          </div>

          <div className="detail-group-luxury">
            <div className="detail-label-luxury">Failure Code</div>
            <div className="detail-val-luxury" style={{ color: '#FB7185', fontFamily: 'monospace' }}>
              {transaction.failure_code}
            </div>
          </div>

          <div className="detail-group-luxury">
            <div className="detail-label-luxury">Retry Count</div>
            <div className="detail-val-luxury">Attempt #{transaction.attempt_number}</div>
          </div>

          <div className="detail-group-luxury">
            <div className="detail-label-luxury">Outreach (48h Buffer)</div>
            <div className="detail-val-luxury">{transaction.customer_contact_count_48h} contacts</div>
          </div>
        </div>

        {/* Action Decision Diff */}
        <div className="decision-diff-box">
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#A3B8B0', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '12px' }}>
            Decision & Guardrail Diff
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#6B8077', textTransform: 'uppercase' }}>LLM Recommended</div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12.5px',
                  color: '#38BDF8',
                  marginTop: '2px',
                  textDecoration: isOverridden ? 'line-through' : 'none',
                }}
              >
                {transaction.recommended_action || 'N/A'}
              </div>
            </div>

            <ArrowRight size={16} color="#6B8077" />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#6B8077', textTransform: 'uppercase' }}>Final Action Executed</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12.5px', color: '#00E599', fontWeight: 700, marginTop: '2px' }}>
                {transaction.final_action_taken || 'N/A'}
              </div>
            </div>
          </div>

          {transaction.guardrail_notes && (
            <div
              style={{
                fontSize: '11.5px',
                padding: '9px 12px',
                borderRadius: '8px',
                background: isBlocked ? 'rgba(245, 158, 11, 0.14)' : 'rgba(0, 229, 153, 0.12)',
                color: isBlocked ? '#FBBF24' : '#00E599',
                border: `1px solid ${isBlocked ? 'rgba(245, 158, 11, 0.3)' : 'rgba(0, 229, 153, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isBlocked ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}
              <span>{transaction.guardrail_notes}</span>
            </div>
          )}
        </div>

        {/* Audit Event Timeline */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📋 Granular Event Trace ({events.length} events)</span>
          </div>

          {loading ? (
            <div style={{ fontSize: '12px', color: '#6B8077' }}>Loading timeline events...</div>
          ) : events.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#6B8077', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px' }}>
              No granular events recorded yet. Run a recovery batch to process this transaction.
            </div>
          ) : (
            <div className="timeline-luxury">
              {events.map((e) => (
                <div key={e.id} className="timeline-item-luxury">
                  <div className="timeline-stage-luxury">{e.stage}</div>
                  <div className="timeline-desc-luxury">{e.details}</div>
                  <div className="timeline-time-luxury">
                    <Clock size={10} style={{ display: 'inline', marginRight: '4px' }} />
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
