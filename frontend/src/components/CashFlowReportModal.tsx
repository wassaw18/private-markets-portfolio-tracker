import React, { useState } from 'react';
import './CashFlowReportModal.css';

interface CashFlowReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: CashFlowReportConfig) => void;
}

export interface CashFlowReportConfig {
  timePeriod: 'ytd' | 'last_quarter' | 'last_year' | 'last_3_years' | 'inception' | 'custom';
  startDate?: string;
  endDate?: string;
  cashFlowTypes: string[];
  groupBy: 'none' | 'investment' | 'entity' | 'asset_class' | 'month' | 'quarter';
}

const CASH_FLOW_TYPES = [
  { value: 'CAPITAL_CALL', label: 'Capital Calls' },
  { value: 'DISTRIBUTION', label: 'Distributions' },
  { value: 'RETURN_OF_CAPITAL', label: 'Return of Capital' },
  { value: 'INCOME', label: 'Income' },
  { value: 'RECALLABLE_RETURN', label: 'Recallable Returns' },
  { value: 'FEE', label: 'Fees' },
  { value: 'OTHER', label: 'Other' }
];

const CashFlowReportModal: React.FC<CashFlowReportModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [timePeriod, setTimePeriod] = useState<CashFlowReportConfig['timePeriod']>('ytd');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['CAPITAL_CALL', 'DISTRIBUTION']);
  const [groupBy, setGroupBy] = useState<CashFlowReportConfig['groupBy']>('none');

  if (!isOpen) return null;

  const handleToggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSelectAllTypes = () => {
    if (selectedTypes.length === CASH_FLOW_TYPES.length) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(CASH_FLOW_TYPES.map(t => t.value));
    }
  };

  const handleGenerate = () => {
    const config: CashFlowReportConfig = {
      timePeriod,
      cashFlowTypes: selectedTypes.length > 0 ? selectedTypes : CASH_FLOW_TYPES.map(t => t.value),
      groupBy,
      ...(timePeriod === 'custom' && { startDate, endDate })
    };
    onGenerate(config);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content cash-flow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Cash Flow Activity Report</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Time Period Section */}
          <div className="config-section">
            <h4>Time Period</h4>
            <div className="button-group">
              <button
                className={`option-button ${timePeriod === 'ytd' ? 'active' : ''}`}
                onClick={() => setTimePeriod('ytd')}
              >
                Year to Date
              </button>
              <button
                className={`option-button ${timePeriod === 'last_quarter' ? 'active' : ''}`}
                onClick={() => setTimePeriod('last_quarter')}
              >
                Last Quarter
              </button>
              <button
                className={`option-button ${timePeriod === 'last_year' ? 'active' : ''}`}
                onClick={() => setTimePeriod('last_year')}
              >
                Last Year
              </button>
              <button
                className={`option-button ${timePeriod === 'last_3_years' ? 'active' : ''}`}
                onClick={() => setTimePeriod('last_3_years')}
              >
                Last 3 Years
              </button>
              <button
                className={`option-button ${timePeriod === 'inception' ? 'active' : ''}`}
                onClick={() => setTimePeriod('inception')}
              >
                Since Inception
              </button>
              <button
                className={`option-button ${timePeriod === 'custom' ? 'active' : ''}`}
                onClick={() => setTimePeriod('custom')}
              >
                Custom Range
              </button>
            </div>

            {timePeriod === 'custom' && (
              <div className="date-range-inputs">
                <div className="input-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cash Flow Types Section */}
          <div className="config-section">
            <div className="section-header">
              <h4>Cash Flow Types</h4>
              <button className="link-button" onClick={handleSelectAllTypes}>
                {selectedTypes.length === CASH_FLOW_TYPES.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="checkbox-grid">
              {CASH_FLOW_TYPES.map(type => (
                <label key={type.value} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type.value)}
                    onChange={() => handleToggleType(type.value)}
                  />
                  <span>{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Grouping Section */}
          <div className="config-section">
            <h4>Group By</h4>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="groupBy"
                  checked={groupBy === 'none'}
                  onChange={() => setGroupBy('none')}
                />
                <span>None (Chronological)</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="groupBy"
                  checked={groupBy === 'investment'}
                  onChange={() => setGroupBy('investment')}
                />
                <span>By Investment</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="groupBy"
                  checked={groupBy === 'entity'}
                  onChange={() => setGroupBy('entity')}
                />
                <span>By Entity</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="groupBy"
                  checked={groupBy === 'asset_class'}
                  onChange={() => setGroupBy('asset_class')}
                />
                <span>By Asset Class</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="groupBy"
                  checked={groupBy === 'month'}
                  onChange={() => setGroupBy('month')}
                />
                <span>By Month</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="groupBy"
                  checked={groupBy === 'quarter'}
                  onChange={() => setGroupBy('quarter')}
                />
                <span>By Quarter</span>
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="generate-button"
            onClick={handleGenerate}
            disabled={selectedTypes.length === 0 || (timePeriod === 'custom' && (!startDate || !endDate))}
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashFlowReportModal;
