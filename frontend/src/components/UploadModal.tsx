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
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [autoProcess, setAutoProcess] = useState<boolean>(true);
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
    formData.append('replace_existing', replaceExisting ? 'true' : 'false');
    formData.append('auto_process', autoProcess ? 'true' : 'false');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('/upload/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_text: documentText,
          replace_existing: replaceExisting,
          auto_process: autoProcess,
        }),
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

            <div style={{ fontSize: '11px', color: '#A3B8B0', marginBottom: '16px', background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              ⚡ <strong>Universal Auto-Mapping:</strong> Supports standard CSV columns (<code>amount</code>, <code>customer_name</code>, <code>failure_code</code>, <code>mandate_window_end</code>, <code>type</code>, etc.). Missing fields are auto-filled.
            </div>

            {/* Ingestion Mode Configuration */}
            <div style={{
              background: 'rgba(0, 229, 153, 0.06)',
              border: '1px solid rgba(0, 229, 153, 0.2)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#00E599', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Ingestion Options
              </div>
              
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', color: '#E2E8F0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  style={{ accentColor: '#00E599', width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#FFFFFF' }}>Replace existing records (Clean Slate)</div>
                  <div style={{ fontSize: '11px', color: '#A3B8B0' }}>Wipes previous demo transactions so metrics & audit trail reflect only this dataset.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', color: '#E2E8F0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoProcess}
                  onChange={(e) => setAutoProcess(e.target.checked)}
                  style={{ accentColor: '#00E599', width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#FFFFFF' }}>Auto-execute AI Recovery Engine on upload</div>
                  <div style={{ fontSize: '11px', color: '#A3B8B0' }}>Runs LLM Diagnostician, Policy Guardrails, and Action Executor right after import.</div>
                </div>
              </label>
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
                  <span>{autoProcess ? 'Ingesting & Executing AI Engine...' : 'Ingesting & Parsing Batch...'}</span>
                </>
              ) : (
                <span>{autoProcess ? 'Upload & Execute Recovery Pipeline' : 'Upload & Ingest as Pending Queue'}</span>
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
                height: '130px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '12px',
                color: '#FFFFFF',
                fontFamily: 'monospace',
                fontSize: '12px',
                outline: 'none',
                marginBottom: '14px',
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

            {/* Ingestion Mode Configuration */}
            <div style={{
              background: 'rgba(0, 229, 153, 0.06)',
              border: '1px solid rgba(0, 229, 153, 0.2)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#00E599', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Ingestion Options
              </div>
              
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', color: '#E2E8F0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  style={{ accentColor: '#00E599', width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#FFFFFF' }}>Replace existing records (Clean Slate)</div>
                  <div style={{ fontSize: '11px', color: '#A3B8B0' }}>Wipes previous demo transactions.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', color: '#E2E8F0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoProcess}
                  onChange={(e) => setAutoProcess(e.target.checked)}
                  style={{ accentColor: '#00E599', width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#FFFFFF' }}>Auto-execute AI Recovery Engine immediately</div>
                  <div style={{ fontSize: '11px', color: '#A3B8B0' }}>Runs LLM Diagnostician & Action Executor instantly.</div>
                </div>
              </label>
            </div>

            <button
              type="submit"
              className="btn-console-action btn-console-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={!documentText.trim() || loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Scanning via Groq Llama 3.3 70B & Executing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>{autoProcess ? 'Scan, Extract & Recover with AI' : 'Extract & Ingest with AI'}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
