import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Shield, CheckCircle, ListFilter, ShieldAlert, Sparkles, Upload, Database, Play } from 'lucide-react';
import { Transaction } from '../types';

interface AuditTrailTableProps {
  transactions: Transaction[];
  onSelectTxn: (txn: Transaction) => void;
  onSeedDemo?: () => void;
  onOpenUpload?: () => void;
  onProcessSingleTxn?: (txn_id: string) => void;
}

const formatINR = (num: number): string => {
  const parts = Number(num).toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return `${intPart}.${decPart}`;
};

export const AuditTrailTable: React.FC<AuditTrailTableProps> = ({
  transactions,
  onSelectTxn,
  onSeedDemo,
  onOpenUpload,
  onProcessSingleTxn,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [guardrailFilter, setGuardrailFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [sortKey, setSortKey] = useState<keyof Transaction>('amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const handleSort = (key: keyof Transaction) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (
        guardrailFilter === 'blocked' &&
        (!t.guardrail_notes || !t.guardrail_notes.includes('⛔'))
      )
        return false;
      if (
        guardrailFilter === 'approved' &&
        (!t.guardrail_notes || !t.guardrail_notes.includes('✅'))
      )
        return false;
      if (
        guardrailFilter === 'demo' &&
        !t.txn_id.startsWith('TXN-DEMO')
      )
        return false;
      if (search) {
        const q = search.toLowerCase();
        const matchId = t.txn_id.toLowerCase().includes(q);
        const matchCust = t.customer_id.toLowerCase().includes(q);
        const matchName = t.customer_name?.toLowerCase().includes(q) ?? false;
        const matchEmail = t.customer_email?.toLowerCase().includes(q) ?? false;
        if (!matchId && !matchCust && !matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, guardrailFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Pin demo transactions to the very top if no custom sort direction
      if (sortKey === 'amount' && sortDir === 'desc') {
        if (a.txn_id === 'TXN-DEMO-001') return -1;
        if (b.txn_id === 'TXN-DEMO-001') return 1;
        if (a.txn_id === 'TXN-DEMO-002') return -1;
        if (b.txn_id === 'TXN-DEMO-002') return 1;
      }
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="audit-table-card-luxury">
      {/* Top Filter Bar */}
      <div className="table-top-bar-luxury">
        <div className="table-top-title-luxury">
          <ListFilter size={18} color="#00E599" />
          <span>Audit Trail & Execution Log</span>
          <span className="table-count-pill">{filtered.length} records</span>
        </div>

        <div className="table-controls-luxury">
          <select
            className="filter-select-obsidian"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="recovered">Recovered</option>
            <option value="escalated">Escalated</option>
            <option value="unrecoverable">Unrecoverable</option>
          </select>

          <select
            className="filter-select-obsidian"
            value={guardrailFilter}
            onChange={(e) => {
              setGuardrailFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Policies</option>
            <option value="demo">⭐ Presentation Demos (1 & 2)</option>
            <option value="blocked">Guardrail Blocked (Overridden ⛔)</option>
            <option value="approved">Approved Pass-Through (✅)</option>
          </select>

          <input
            type="text"
            className="search-input-obsidian"
            placeholder="Search txn, customer, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="table-scroll-luxury">
        <table className="obsidian-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('txn_id')}>Txn ID ↕</th>
              <th onClick={() => handleSort('customer_name')}>Customer ↕</th>
              <th onClick={() => handleSort('amount')}>Amount ↕</th>
              <th onClick={() => handleSort('failure_code')}>Failure Code ↕</th>
              <th>Diagnosis & Recommendation</th>
              <th>Guardrail Policy Enforcement</th>
              <th onClick={() => handleSort('final_action_taken')}>Final Action ↕</th>
              <th onClick={() => handleSort('status')}>Status ↕</th>
              <th onClick={() => handleSort('recovered_amount')}>Recovered ↕</th>
              <th>Live Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ maxWidth: '440px', margin: '0 auto' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 229, 153, 0.1)', color: '#00E599', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                      <Database size={24} />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
                      No Transactions in Queue (Database Clear)
                    </div>
                    <p style={{ fontSize: '13px', color: '#A3B8B0', lineHeight: 1.5, marginBottom: '20px' }}>
                      The database is currently empty. You can ingest your own CSV failure logs or load the deterministic demo dataset.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                      {onOpenUpload && (
                        <button className="btn-console-action" onClick={onOpenUpload}>
                          <Upload size={13} />
                          <span>Ingest Invoices</span>
                        </button>
                      )}
                      {onSeedDemo && (
                        <button className="btn-console-action btn-console-primary" onClick={onSeedDemo}>
                          <Sparkles size={13} />
                          <span>Load 150 Demo Records</span>
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#6B8077' }}>
                  No matching transaction records found for current filters.
                </td>
              </tr>
            ) : (
              paginated.map((t) => {
                const isBlocked = t.guardrail_notes && t.guardrail_notes.includes('⛔');
                const isOverridden = isBlocked && t.recommended_action !== t.final_action_taken;
                const isDemo1 = t.txn_id === 'TXN-DEMO-001';
                const isDemo2 = t.txn_id === 'TXN-DEMO-002';
                const rowClass = `status-${t.status} ${isDemo1 || isDemo2 ? 'demo-highlight-row' : ''}`;

                return (
                  <tr
                    key={t.txn_id}
                    className={rowClass}
                    onClick={() => onSelectTxn(t)}
                    title="Click to inspect full audit event timeline & decision trace"
                    style={{
                      borderLeft: isDemo1
                        ? '3px solid #00E599'
                        : isDemo2
                        ? '3px solid #FB7185'
                        : undefined,
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="mono-hash">{t.txn_id}</span>
                        {isDemo1 && (
                          <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 229, 153, 0.2)', color: '#00E599', display: 'inline-block', width: 'fit-content' }}>
                            ⭐ DEMO 1 (SUCCESS)
                          </span>
                        )}
                        {isDemo2 && (
                          <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.2)', color: '#FB7185', display: 'inline-block', width: 'fit-content' }}>
                            🛡️ DEMO 2 (POLICY BLOCK)
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: '#FFFFFF' }}>
                        {t.customer_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6B8077' }}>
                        {t.customer_email}
                      </div>
                    </td>

                    <td>
                      <span className="mono-amount">₹{formatINR(t.amount)}</span>
                    </td>

                    <td>
                      <span className="tag-failure">{t.failure_code}</span>
                    </td>

                    <td>
                      <div style={{ fontSize: '11.5px', color: '#A3B8B0', maxWidth: '240px' }}>
                        {t.diagnosis || 'Pending diagnosis'}
                      </div>
                      {t.recommended_action && (
                        <div style={{ marginTop: '5px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span className={`tag-action ${isOverridden ? 'tag-action-strikethrough' : ''}`}>
                            {t.recommended_action}
                          </span>
                        </div>
                      )}
                    </td>

                    <td>
                      {t.guardrail_notes ? (
                        <span className={`tag-guardrail ${isBlocked ? '' : 'approved'}`}>
                          {isBlocked ? <ShieldAlert size={12} /> : <CheckCircle size={12} />}
                          {t.guardrail_notes.replace(/[⛔✅]/g, '').trim()}
                        </span>
                      ) : (
                        <span style={{ color: '#6B8077' }}>—</span>
                      )}
                    </td>

                    <td>
                      {t.final_action_taken ? (
                        <span className="tag-action">{t.final_action_taken}</span>
                      ) : (
                        <span style={{ color: '#6B8077' }}>—</span>
                      )}
                    </td>

                    <td>
                      <span className={`status-badge-obsidian ${t.status}`}>
                        {t.status}
                      </span>
                    </td>

                    <td>
                      <span className={`mono-amount ${t.recovered_amount > 0 ? 'recovered-glow' : ''}`}>
                        {t.recovered_amount > 0 ? `₹${formatINR(t.recovered_amount)}` : '—'}
                      </span>
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>
                      {t.status === 'pending' && onProcessSingleTxn ? (
                        <button
                          className="btn-console-action"
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            background: isDemo1
                              ? 'rgba(0, 229, 153, 0.15)'
                              : isDemo2
                              ? 'rgba(251, 113, 133, 0.15)'
                              : 'rgba(255, 255, 255, 0.05)',
                            borderColor: isDemo1
                              ? '#00E599'
                              : isDemo2
                              ? '#FB7185'
                              : 'rgba(255, 255, 255, 0.15)',
                            color: isDemo1 ? '#00E599' : isDemo2 ? '#FB7185' : '#E2E8F0',
                          }}
                          onClick={() => onProcessSingleTxn(t.txn_id)}
                          title={`Process ${t.txn_id} individually`}
                        >
                          <Play size={11} />
                          <span>Run</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#6B8077' }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {transactions.length > 0 && (
        <div className="pagination-luxury">
          <div>
            Showing Page {page} of {totalPages} ({sorted.length} total transactions)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="page-btn-luxury"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              className="page-btn-luxury"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
