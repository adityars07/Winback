import React, { useEffect, useState } from 'react';
import { X, Shield, ArrowRight, CheckCircle, Clock } from 'lucide-react';
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
      <div className="modal-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>
              Transaction Audit Trace
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: '#f1f5f9' }}>
              {transaction.txn_id}
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Customer & Payment Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="detail-group">
            <div className="detail-label">Customer</div>
            <div className="detail-val">{transaction.customer_name}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{transaction.customer_email}</div>
          </div>

          <div className="detail-group">
            <div className="detail-label">Amount at Risk</div>
            <div className="detail-val" style={{ color: '#3b82f6', fontFamily: 'monospace', fontSize: '16px' }}>
              ₹{transaction.amount.toLocaleString()}
            </div>
          </div>

          <div className="detail-group">
            <div className="detail-label">Category / Type</div>
            <div className="detail-val">{transaction.type}</div>
          </div>

          <div className="detail-group">
            <div className="detail-label">Failure Code</div>
            <div className="detail-val" style={{ color: '#ef4444' }}>{transaction.failure_code}</div>
          </div>

          <div className="detail-group">
            <div className="detail-label">Retry Attempts</div>
            <div className="detail-val">Attempt #{transaction.attempt_number}</div>
          </div>

          <div className="detail-group">
            <div className="detail-label">Outreach 48h</div>
            <div className="detail-val">{transaction.customer_contact_count_48h} contacts</div>
          </div>
        </div>

        {/* Action Decision Diff */}
        <div
          style={{
            background: 'rgba(26, 34, 51, 0.8)',
            border: '1px solid #2a3548',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '12px' }}>
            DECISION & GUARDRAIL DIFF
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>LLM RECOMMENDED</div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#3b82f6',
                  textDecoration: isOverridden ? 'line-through' : 'none',
                }}
              >
                {transaction.recommended_action || 'N/A'}
              </div>
            </div>

            <ArrowRight size={16} color="#64748b" />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>FINAL EXECUTED</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#10b981', fontWeight: 700 }}>
                {transaction.final_action_taken || 'N/A'}
              </div>
            </div>
          </div>

          {transaction.guardrail_notes && (
            <div
              style={{
                fontSize: '11px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: isBlocked ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                color: isBlocked ? '#f59e0b' : '#10b981',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isBlocked ? <Shield size={14} /> : <CheckCircle size={14} />}
              {transaction.guardrail_notes}
            </div>
          )}
        </div>

        {/* Audit Event Timeline */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '12px' }}>
            📋 Audit Event Timeline
          </div>

          {loading ? (
            <div style={{ fontSize: '12px', color: '#64748b' }}>Loading timeline events...</div>
          ) : events.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              No granular events recorded yet. Run a batch to process this transaction.
            </div>
          ) : (
            <div className="timeline">
              {events.map((e) => (
                <div key={e.id} className="timeline-item">
                  <div className="timeline-stage">{e.stage}</div>
                  <div className="timeline-desc">{e.details}</div>
                  <div className="timeline-time">
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
