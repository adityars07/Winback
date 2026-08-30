import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, CheckCircle, ListFilter, ShieldAlert, Upload, Database, Play } from 'lucide-react';
import { Transaction } from '../types';

interface AuditTrailTableProps {
  transactions: Transaction[];
  onSelectTxn: (txn: Transaction) => void;
  onOpenUpload?: () => void;
  onProcessSingleTxn?: (txn_id: string) => void;
  onRunBatch?: () => void;
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
  onOpenUpload,
  onProcessSingleTxn,
  onRunBatch,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [guardrailFilter, setGuardrailFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [sortKey, setSortKey] = useState<keyof Transaction>('amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const pendingCount = transactions.filter((t) => t.status === 'pending').length;

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
          {pendingCount > 0 && (
            <span className="table-count-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              {pendingCount} pending
            </span>
          )}
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
            <option value="promised">Promised</option>
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
            <option value="all">All Policy Decisions</option>
            <option value="blocked">Guardrail Intercepted (⛔)</option>
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

      {/* Pending Execution Alert Banner */}
      {pendingCount > 0 && (
        <div style={{
          margin: '12px 20px 4px 20px',
          padding: '10px 16px',
          borderRadius: '8px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
            <span style={{ fontSize: '12.5px', color: '#FDE68A', fontWeight: 600 }}>
              {pendingCount} payment failure records awaiting AI diagnosis & recovery execution
            </span>
          </div>
          {onRunBatch && (
            <button
              onClick={onRunBatch}
              style={{
                background: '#F59E0B',
                color: '#04140F',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Play size={12} fill="#04140F" />
              <span>Execute All Pending Now</span>
            </button>
          )}
        </div>
      )}

      {/* Main Table */}
      <div className="table-responsive-luxury">
        <table className="data-table-luxury">
          <thead>
            <tr>
              <th onClick={() => handleSort('txn_id')} style={{ cursor: 'pointer' }}>
                TXN ID {sortKey === 'txn_id' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('customer_name')} style={{ cursor: 'pointer' }}>
                Customer {sortKey === 'customer_name' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>
                Amount {sortKey === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th>Failure Code</th>
              <th>Diagnosis & Recommendation</th>
              <th>Policy Guardrail</th>
              <th>Final Action</th>
              <th>Status</th>
              <th>Audit Trail</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '64px 20px' }}>
                  <div style={{ maxWidth: '460px', margin: '0 auto' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 229, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 auto 16px auto', color: '#00E599' }}>
                      <Database size={24} style={{ margin: '0 auto' }} />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
                      No Transactions in Database
                    </div>
                    <p style={{ fontSize: '13px', color: '#A3B8B0', lineHeight: 1.5, marginBottom: '20px' }}>
                      Please ingest your payment failure CSV dataset or scan invoice documents to start automated recovery.
                    </p>
                    {onOpenUpload && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                        <button className="btn-console-action btn-console-primary" onClick={onOpenUpload}>
                          <Upload size={13} />
                          <span>Ingest Dataset (CSV / Invoices)</span>
                        </button>
                      </div>
                    )}
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
                const rowClass = `status-${t.status}`;

                return (
                  <tr
                    key={t.txn_id}
                    className={rowClass}
                    onClick={() => onSelectTxn(t)}
                    title="Click to inspect full audit event timeline & decision trace"
                  >
                    <td>
                      <span className="mono-hash">{t.txn_id}</span>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: '#FFFFFF' }}>
                        {t.customer_name || 'Customer'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6B8077' }}>
                        {t.customer_email || t.customer_id}
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
                      <button
                        className="btn-view-audit"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTxn(t);
                        }}
                      >
                        Inspect Trail →
                      </button>
                    </td>

                    <td>
                      {t.status === 'pending' && onProcessSingleTxn ? (
                        <button
                          className="btn-run-single"
                          onClick={(e) => {
                            e.stopPropagation();
                            onProcessSingleTxn(t.txn_id);
                          }}
                          title="Execute single recovery pipeline for this transaction"
                        >
                          <Play size={10} fill="#00E599" />
                          <span>Run</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#6B8077' }}>Done</span>
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
      {sorted.length > pageSize && (
        <div className="table-pagination-luxury">
          <span className="pagination-info">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, sorted.length)} of {sorted.length} records
          </span>
          <div className="pagination-buttons">
            <button
              className="btn-page-nav"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span className="page-indicator">
              {page} / {totalPages}
            </span>
            <button
              className="btn-page-nav"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
