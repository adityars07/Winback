import React from 'react';
import { Search, Brain, Shield, Zap, FileText } from 'lucide-react';

export const PipelineFlow: React.FC = () => {
  return (
    <div className="pipeline-section">
      <div className="section-title">
        <span>🔁 Recovery Pipeline Workflow</span>
      </div>
      <div className="pipeline-steps">
        <div className="pipeline-step">
          <div className="step-icon detect">
            <Search size={18} />
          </div>
          <div>
            <div className="step-name">1. Detect</div>
            <div className="step-desc">Pull pending failures by ₹ amount</div>
          </div>
        </div>

        <div className="step-arrow">→</div>

        <div className="pipeline-step">
          <div className="step-icon diagnose">
            <Brain size={18} />
          </div>
          <div>
            <div className="step-name">2. Diagnose (LLM)</div>
            <div className="step-desc">Groq / Llama 3.3 70B Versatile</div>
          </div>
        </div>

        <div className="step-arrow">→</div>

        <div className="pipeline-step">
          <div className="step-icon policy">
            <Shield size={18} />
          </div>
          <div>
            <div className="step-name">3. Guardrail Engine</div>
            <div className="step-desc">Deterministic Policy Rules</div>
          </div>
        </div>

        <div className="step-arrow">→</div>

        <div className="pipeline-step">
          <div className="step-icon execute">
            <Zap size={18} />
          </div>
          <div>
            <div className="step-name">4. Execute</div>
            <div className="step-desc">Bounded simulated recovery</div>
          </div>
        </div>

        <div className="step-arrow">→</div>

        <div className="pipeline-step">
          <div className="step-icon audit">
            <FileText size={18} />
          </div>
          <div>
            <div className="step-name">5. Audit Trail</div>
            <div className="step-desc">Full immutable event logging</div>
          </div>
        </div>
      </div>
    </div>
  );
};
