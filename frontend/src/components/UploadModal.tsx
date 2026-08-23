import React, { useState } from 'react';
import { X, Upload, FileText, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'csv' | 'ai'>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [documentText, setDocumentText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/upload/csv', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'CSV upload failed');

      setMsg({ text: data.message, type: 'success' });
      setFile(null);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAiScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentText.trim()) return;
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch('/upload/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_text: documentText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'AI Document scan failed');

      setMsg({ text: data.message, type: 'success' });
      setDocumentText('');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-drawer"
        style={{ width: '560px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>
              Data Ingestion Suite
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>
              Import Failed Payments
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #2a3548', paddingBottom: '12px' }}>
          <button
            className={`btn ${activeTab === 'csv' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('csv')}
            style={{ fontSize: '12px', padding: '8px 14px' }}
          >
            <Upload size={14} /> Bulk CSV Import
          </button>
          <button
            className={`btn ${activeTab === 'ai' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('ai')}
            style={{ fontSize: '12px', padding: '8px 14px' }}
          >
            <Sparkles size={14} /> AI Document Scanner
          </button>
        </div>

        {msg && (
          <div
            style={{
              fontSize: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              background: msg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: msg.type === 'success' ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {msg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {msg.text}
          </div>
        )}

        {/* Tab 1: CSV Upload */}
        {activeTab === 'csv' && (
          <form onSubmit={handleCsvSubmit}>
            <div
              style={{
                border: '2px dashed #2a3548',
                borderRadius: '12px',
                padding: '32px',
                textAlign: 'center',
                background: 'rgba(26, 34, 51, 0.5)',
                marginBottom: '20px',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('csvFileInput')?.click()}
            >
              <FileText size={36} color="#3b82f6" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>
                {file ? file.name : 'Click to select CSV file'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Supports `.csv` files with payment failure logs
              </div>
              <input
                id="csvFileInput"
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '20px', background: '#131b2b', padding: '12px', borderRadius: '8px' }}>
              <strong>Expected CSV Headers:</strong> customer_id, customer_name, customer_email, type, amount, failure_code, attempt_number, customer_contact_count_48h
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!file || loading}>
              {loading ? 'Uploading & Parsing...' : 'Import CSV Records'}
            </button>
          </form>
        )}

        {/* Tab 2: AI Document Scanner */}
        {activeTab === 'ai' && (
          <form onSubmit={handleAiScanSubmit}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
              Paste raw invoice text, receipt notes, or failure log details below:
            </div>
            <textarea
              style={{
                width: '100%',
                height: '160px',
                background: '#131b2b',
                border: '1px solid #2a3548',
                borderRadius: '8px',
                padding: '12px',
                color: '#f1f5f9',
                fontFamily: 'monospace',
                fontSize: '12px',
                outline: 'none',
                marginBottom: '20px',
                resize: 'none',
              }}
              placeholder={`Example:
Invoice #8902 to Priya Sharma (priya@gmail.com) for amount ₹8,450.
Payment failed due to card_expired on 2026-08-20.`}
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
            />

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!documentText.trim() || loading}>
              <Sparkles size={15} />
              {loading ? 'Scanning via Groq LLM...' : 'Extract & Ingest with AI'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
