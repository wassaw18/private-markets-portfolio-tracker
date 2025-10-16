import React, { useState } from 'react';
import './LPQuarterlyStatementModal.css';

export interface LPQuarterlyStatementConfig {
  lpId: string;
  lpName: string;
  quarter: string;
  year: string;
  includePortfolioDetails: boolean;
  includeTransactionHistory: boolean;
  includeProjections: boolean;
}

interface LPQuarterlyStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: LPQuarterlyStatementConfig) => void;
}

// Sample LP data - in production this would come from API
const sampleLPs = [
  { id: '1', name: 'Smith Family Office', commitment: 10000000 },
  { id: '2', name: 'Johnson Endowment', commitment: 25000000 },
  { id: '3', name: 'Davis Pension Fund', commitment: 15000000 },
  { id: '4', name: 'Anderson Fund of Funds', commitment: 8000000 },
  { id: '5', name: 'Miller Capital Partners', commitment: 6500000 }
];

const LPQuarterlyStatementModal: React.FC<LPQuarterlyStatementModalProps> = ({
  isOpen,
  onClose,
  onGenerate
}) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;

  const [selectedLP, setSelectedLP] = useState<string>('');
  const [quarter, setQuarter] = useState<string>(`Q${currentQuarter}`);
  const [year, setYear] = useState<string>(currentYear.toString());
  const [includePortfolioDetails, setIncludePortfolioDetails] = useState(true);
  const [includeTransactionHistory, setIncludeTransactionHistory] = useState(true);
  const [includeProjections, setIncludeProjections] = useState(true);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const selectedLPData = sampleLPs.find(lp => lp.id === selectedLP);
    if (!selectedLPData) {
      alert('Please select an LP');
      return;
    }

    const config: LPQuarterlyStatementConfig = {
      lpId: selectedLP,
      lpName: selectedLPData.name,
      quarter,
      year,
      includePortfolioDetails,
      includeTransactionHistory,
      includeProjections
    };

    onGenerate(config);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Generate year options (current year and 5 years back)
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content lp-quarterly-modal">
        <div className="modal-header">
          <h2>Generate LP Quarterly Statement</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <label className="form-label">Limited Partner *</label>
            <select
              className="form-select"
              value={selectedLP}
              onChange={(e) => setSelectedLP(e.target.value)}
            >
              <option value="">Select an LP...</option>
              {sampleLPs.map(lp => (
                <option key={lp.id} value={lp.id}>
                  {lp.name} (${(lp.commitment / 1000000).toFixed(1)}M commitment)
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-section">
              <label className="form-label">Quarter *</label>
              <select
                className="form-select"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
              >
                <option value="Q1">Q1 (Jan - Mar)</option>
                <option value="Q2">Q2 (Apr - Jun)</option>
                <option value="Q3">Q3 (Jul - Sep)</option>
                <option value="Q4">Q4 (Oct - Dec)</option>
              </select>
            </div>

            <div className="form-section">
              <label className="form-label">Year *</label>
              <select
                className="form-select"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label section-label">Report Sections</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includePortfolioDetails}
                  onChange={(e) => setIncludePortfolioDetails(e.target.checked)}
                />
                <span>Portfolio Holdings & Top Positions</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeTransactionHistory}
                  onChange={(e) => setIncludeTransactionHistory(e.target.checked)}
                />
                <span>Transaction History & Quarterly Activity</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeProjections}
                  onChange={(e) => setIncludeProjections(e.target.checked)}
                />
                <span>Projected Capital Calls (Next 12 Months)</span>
              </label>
            </div>
          </div>

          <div className="info-box">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
            <p>The statement will include capital account summary, performance metrics, and all standard LP reporting sections.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={!selectedLP}
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
            </svg>
            Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default LPQuarterlyStatementModal;
