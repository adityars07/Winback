import React from 'react';
import { Search, Brain, Shield, Zap, FileText, ChevronRight } from 'lucide-react';

export const PipelineFlow: React.FC = () => {
  return (
    <div className="pipeline-luxury-strip">
      <div className="p-step">
        <div className="p-icon detect">
          <Search size={16} />
        </div>
        <div>
          <div className="p-title">1. Detect Failure</div>
          <div className="p-sub">Filter pending by ₹ amount</div>
        </div>
      </div>

      <div className="p-arrow">
        <ChevronRight size={18} />
      </div>

      <div className="p-step">
        <div className="p-icon diagnose">
          <Brain size={16} />
        </div>
        <div>
          <div className="p-title">2. Diagnose (Groq AI)</div>
          <div className="p-sub">Llama 3.3 70B Versatile</div>
        </div>
      </div>

      <div className="p-arrow">
        <ChevronRight size={18} />
      </div>

      <div className="p-step">
        <div className="p-icon guardrail">
          <Shield size={16} />
        </div>
        <div>
          <div className="p-title">3. Policy Guardrail</div>
          <div className="p-sub">Deterministic Rules (NPCI)</div>
        </div>
      </div>

      <div className="p-arrow">
        <ChevronRight size={18} />
      </div>

      <div className="p-step">
        <div className="p-icon execute">
          <Zap size={16} />
        </div>
        <div>
          <div className="p-title">4. Execute Action</div>
          <div className="p-sub">Retry / WhatsApp / Escalate</div>
        </div>
      </div>

      <div className="p-arrow">
        <ChevronRight size={18} />
      </div>

      <div className="p-step">
        <div className="p-icon audit">
          <FileText size={16} />
        </div>
        <div>
          <div className="p-title">5. Immutable Audit</div>
          <div className="p-sub">Granular Event Trace</div>
        </div>
      </div>
    </div>
  );
};
