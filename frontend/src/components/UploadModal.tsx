import React, { useState } from 'react';
import { X, Upload, FileText, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

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
    if (!file) {
      setMsg({ text: 'Please select a CSV file first.', type: 'error' });
      return;
    }
    setLoading(true);
    setMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const res = await fetch('/upload/csv', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'CSV upload failed');

      setMsg({ text: data.message, type: 'success' });
      setFile(null);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('CSV Upload Error:', err);
      setMsg({
        text: err.name === 'AbortError' ? 'Upload timed out. Please try again.' : (err.message || 'Failed to parse CSV.'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAiScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentText.trim()) {
      setMsg({ text: 'Please paste invoice or transaction text.', type: 'error' });
      return;
    }
    setLoading(true);
    setMsg(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('/upload/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_text: documentText }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'AI Document scan failed');

      setMsg({ text: data.message, type: 'success' });
      setDocumentText('');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('AI Scan Error:', err);
      setMsg({
        text: err.name === 'AbortError' ? 'Scan timed out. Please try again.' : (err.message || 'AI Ingestion failed.'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-box-luxury"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-luxury">
          <div>
            <div style={{ fontSize: '11px', color: '#00E599', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}>
              ● Data Ingestion Suite
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>
              Import Failed Payments
            </div>
          </div>
          <button className="close-btn-luxury" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
          <button
            className={`btn-console-action ${activeTab === 'csv' ? 'btn-console-primary' : ''}`}
            onClick={() => {
              setActiveTab('csv');
              setMsg(null);
            }}
          >
            <Upload size={13} />
            <span>Bulk CSV Ingestion</span>
          </button>
          <button
            className={`btn-console-action ${activeTab === 'ai' ? 'btn-console-primary' : ''}`}
            onClick={() => {
              setActiveTab('ai');
              setMsg(null);
            }}
          >
            <Sparkles size={13} />
            <span>AI Invoice / Receipt Scanner</span>
          </button>
        </div>

        {/* Status Notification Message */}
        {msg && (
          <div
            style={{
              fontSize: '12px',
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '18px',
              background: msg.type === 'success' ? 'rgba(0, 229, 153, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              color: msg.type === 'success' ? '#00E599' : '#FB7185',
              border: `1px solid ${msg.type === 'success' ? 'rgba(0, 229, 153, 0.35)' : 'rgba(244, 63, 94, 0.35)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Tab 1: CSV Upload */}
        {activeTab === 'csv' && (
          <form onSubmit={handleCsvSubmit}>
            <div
              style={{
                border: '2px dashed rgba(0, 229, 153, 0.35)',
                borderRadius: '14px',
                padding: '30px',
                textAlign: 'center',
                background: 'rgba(0, 0, 0, 0.25)',
                marginBottom: '18px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => document.getElementById('csvFileInput')?.click()}
            >
              <FileText size={38} color="#00E599" style={{ marginBottom: '10px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                {file ? file.name : 'Click to select or drop CSV file here'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#6B8077', marginTop: '4px' }}>
                Universal format: auto-detects Amount, Customer, Failure Code, etc.
              </div>
              <input
                id="csvFileInput"
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setMsg(null);
                }}
              />
            </div>

            <div style={{ fontSize: '11px', color: '#A3B8B0', marginBottom: '18px', background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              ⚡ <strong>Universal Auto-Mapping:</strong> Supports any gateway CSV columns (e.g. <code>amount</code>, <code>name</code>, <code>email</code>, <code>reason</code>, <code>type</code>). Missing fields are filled automatically.
            </div>

            <button
              type="submit"
              className="btn-console-action btn-console-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={!file || loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Ingesting & Parsing Batch...</span>
                </>
              ) : (
                <span>Upload & Ingest Transactions</span>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: AI Document Scanner */}
        {activeTab === 'ai' && (
          <form onSubmit={handleAiScanSubmit}>
            <div style={{ fontSize: '12px', color: '#A3B8B0', marginBottom: '8px' }}>
              Paste raw invoice text, receipt notes, or failure log notes:
            </div>
            <textarea
              style={{
                width: '100%',
                height: '140px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '12px',
                color: '#FFFFFF',
                fontFamily: 'monospace',
                fontSize: '12px',
                outline: 'none',
                marginBottom: '18px',
                resize: 'none',
              }}
              placeholder={`Example:
Invoice #8902 to Priya Sharma (priya@gmail.com) for amount ₹8,450.
Payment failed due to card_expired on 2026-08-20.`}
              value={documentText}
              onChange={(e) => {
                setDocumentText(e.target.value);
                setMsg(null);
              }}
            />

            <button
              type="submit"
              className="btn-console-action btn-console-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={!documentText.trim() || loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Scanning via Groq Llama 3.3 70B...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Extract & Ingest with AI</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
