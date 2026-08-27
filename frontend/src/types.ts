export interface Transaction {
  txn_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  type: 'subscription_renewal' | 'checkout_abandoned' | 'invoice_overdue';
  amount: number;
  failure_code: string;
  attempt_number: number;
  last_attempt_ts: string;
  mandate_window_end: string | null;
  customer_contact_count_48h: number;
  status: 'pending' | 'recovered' | 'unrecoverable' | 'escalated' | 'promised';
  promise_date?: string | null;
  is_broken_promise?: number;
  diagnosis: string | null;
  recommended_action: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  guardrail_notes: string | null;
  final_action_taken: string | null;
  recovered_amount: number;
  processed_at: string | null;
}

export interface AuditEvent {
  id: number;
  txn_id: string;
  stage: 'DETECT' | 'DIAGNOSE' | 'GUARDRAIL' | 'EXECUTE';
  action: string | null;
  details: string;
  timestamp: string;
}

export interface RecoveryByType {
  total: number;
  recovered: number;
  count: number;
}

export interface SummaryStats {
  total_at_risk: number;
  recoverable_revenue: number;
  total_recovered: number;
  recovery_rate: number;
  effective_recovery_rate: number;
  gross_recovery_rate: number;
  total_transactions: number;
  total_promises?: number;
  broken_promises?: number;
  broken_promise_rate?: number;
  status_counts: Record<string, number>;
  status_amounts: Record<string, number>;
  action_counts: Record<string, number>;
  guardrail_blocks: number;
  guardrail_blocked_amount: number;
  recovery_by_type: Record<string, RecoveryByType>;
}
