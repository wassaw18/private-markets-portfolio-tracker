import React, { useState, useEffect } from 'react';
import { Investment } from '../types/investment';
import { investmentAPI } from '../services/api';
import './PacingModelPanel.css';

interface PacingModelInputs {
  target_irr: number;
  target_moic: number;
  fund_life: number;
  investment_period: number;
  bow_factor: number;
  call_schedule: 'Front Loaded' | 'Steady' | 'Back Loaded';
  distribution_timing: 'Early' | 'Backend' | 'Steady';
  forecast_enabled: boolean;
}

interface PacingModelPanelProps {
  investment: Investment;
  onUpdate: () => void;
}

const PacingModelPanel: React.FC<PacingModelPanelProps> = ({ investment, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  
  const [inputs, setInputs] = useState<PacingModelInputs>({
    target_irr: investment.target_irr || 0.15,
    target_moic: investment.target_moic || 2.5,
    fund_life: investment.fund_life || 10,
    investment_period: investment.investment_period || 4,
    bow_factor: investment.bow_factor || 0.3,
    call_schedule: investment.call_schedule || 'Steady',
    distribution_timing: investment.distribution_timing || 'Backend',
    forecast_enabled: investment.forecast_enabled !== false
  });

  useEffect(() => {
    setInputs({
      target_irr: investment.target_irr || 0.15,
      target_moic: investment.target_moic || 2.5,
      fund_life: investment.fund_life || 10,
      investment_period: investment.investment_period || 4,
      bow_factor: investment.bow_factor || 0.3,
      call_schedule: investment.call_schedule || 'Steady',
      distribution_timing: investment.distribution_timing || 'Backend',
      forecast_enabled: investment.forecast_enabled !== false
    });
  }, [investment]);

  const handleInputChange = (field: keyof PacingModelInputs, value: any) => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await investmentAPI.updatePacingInputs(investment.id, inputs);
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      setError('Failed to update pacing model parameters');
      console.error('Error updating pacing inputs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateForecast = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      await investmentAPI.generateForecast(investment.id);
      onUpdate();
    } catch (err) {
      setError('Failed to generate forecast');
      console.error('Error generating forecast:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCancel = () => {
    setInputs({
      target_irr: investment.target_irr || 0.15,
      target_moic: investment.target_moic || 2.5,
      fund_life: investment.fund_life || 10,
      investment_period: investment.investment_period || 4,
      bow_factor: investment.bow_factor || 0.3,
      call_schedule: investment.call_schedule || 'Steady',
      distribution_timing: investment.distribution_timing || 'Backend',
      forecast_enabled: investment.forecast_enabled !== false
    });
    setIsEditing(false);
    setError(null);
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatMultiple = (value: number) => `${value.toFixed(1)}x`;

  return (
    <div className="pacing-model-panel">
      <div className="panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>Cash Flow Pacing Model</h3>
        <div className="header-controls">
          {inputs.forecast_enabled && (
            <button
              className="generate-forecast-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateForecast();
              }}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Forecast'}
            </button>
          )}
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </div>
      </div>

      {isExpanded && (
        <div className="panel-content">
          <div className="forecast-status">
            <div className="status-item">
              <span className="label">Forecasting:</span>
              <span className={`status ${inputs.forecast_enabled ? 'enabled' : 'disabled'}`}>
                {inputs.forecast_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {investment.last_forecast_date && (
              <div className="status-item">
                <span className="label">Last Updated:</span>
                <span className="date">
                  {new Date(investment.last_forecast_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="parameters-grid">
            <div className="parameter-section">
              <h4>Performance Targets</h4>
              <div className="parameter-row">
                <label>Target IRR</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={inputs.target_irr}
                    onChange={(e) => handleInputChange('target_irr', parseFloat(e.target.value) || 0)}
                    min="0"
                    max="1"
                    step="0.01"
                    className="parameter-input"
                  />
                ) : (
                  <span className="parameter-value">{formatPercentage(inputs.target_irr)}</span>
                )}
              </div>
              <div className="parameter-row">
                <label>Target MOIC</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={inputs.target_moic}
                    onChange={(e) => handleInputChange('target_moic', parseFloat(e.target.value) || 0)}
                    min="1"
                    max="10"
                    step="0.1"
                    className="parameter-input"
                  />
                ) : (
                  <span className="parameter-value">{formatMultiple(inputs.target_moic)}</span>
                )}
              </div>
            </div>

            <div className="parameter-section">
              <h4>Fund Structure</h4>
              <div className="parameter-row">
                <label>Fund Life (Years)</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={inputs.fund_life}
                    onChange={(e) => handleInputChange('fund_life', parseInt(e.target.value) || 0)}
                    min="5"
                    max="15"
                    className="parameter-input"
                  />
                ) : (
                  <span className="parameter-value">{inputs.fund_life} years</span>
                )}
              </div>
              <div className="parameter-row">
                <label>Investment Period (Years)</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={inputs.investment_period}
                    onChange={(e) => handleInputChange('investment_period', parseInt(e.target.value) || 0)}
                    min="1"
                    max="8"
                    className="parameter-input"
                  />
                ) : (
                  <span className="parameter-value">{inputs.investment_period} years</span>
                )}
              </div>
            </div>

            <div className="parameter-section">
              <h4>Cash Flow Patterns</h4>
              <div className="parameter-row">
                <label>Call Schedule</label>
                {isEditing ? (
                  <select
                    value={inputs.call_schedule}
                    onChange={(e) => handleInputChange('call_schedule', e.target.value as any)}
                    className="parameter-select"
                  >
                    <option value="Front Loaded">Front Loaded (40%-35%-20%-5%)</option>
                    <option value="Steady">Steady (25%-30%-30%-15%)</option>
                    <option value="Back Loaded">Back Loaded (15%-25%-35%-25%)</option>
                  </select>
                ) : (
                  <span className="parameter-value">{inputs.call_schedule}</span>
                )}
              </div>
              <div className="parameter-row">
                <label>Distribution Timing</label>
                {isEditing ? (
                  <select
                    value={inputs.distribution_timing}
                    onChange={(e) => handleInputChange('distribution_timing', e.target.value as any)}
                    className="parameter-select"
                  >
                    <option value="Early">Early (Starts year 3)</option>
                    <option value="Steady">Steady (After investment period)</option>
                    <option value="Backend">Backend (Year after investment period)</option>
                  </select>
                ) : (
                  <span className="parameter-value">{inputs.distribution_timing}</span>
                )}
              </div>
            </div>

            <div className="parameter-section">
              <h4>J-Curve Modeling</h4>
              <div className="parameter-row">
                <label>Bow Factor</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={inputs.bow_factor}
                    onChange={(e) => handleInputChange('bow_factor', parseFloat(e.target.value) || 0)}
                    min="0.1"
                    max="0.5"
                    step="0.05"
                    className="parameter-input"
                  />
                ) : (
                  <span className="parameter-value">{inputs.bow_factor} ({getBowDescription(inputs.bow_factor)})</span>
                )}
              </div>
              <div className="parameter-row">
                <label>Forecast Enabled</label>
                {isEditing ? (
                  <input
                    type="checkbox"
                    checked={inputs.forecast_enabled}
                    onChange={(e) => handleInputChange('forecast_enabled', e.target.checked)}
                    className="parameter-checkbox"
                  />
                ) : (
                  <span className={`parameter-value ${inputs.forecast_enabled ? 'enabled' : 'disabled'}`}>
                    {inputs.forecast_enabled ? 'Yes' : 'No'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="panel-actions">
            {isEditing ? (
              <>
                <button
                  className="save-btn"
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Parameters'}
                </button>
                <button
                  className="cancel-btn"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="edit-btn"
                onClick={() => setIsEditing(true)}
              >
                Edit Parameters
              </button>
            )}
          </div>

          <div className="model-info">
            <h5>Pacing Model Information</h5>
            <ul>
              <li><strong>J-Curve Modeling:</strong> Captures initial negative performance followed by recovery</li>
              <li><strong>Call Schedules:</strong> Different capital deployment patterns based on fund strategy</li>
              <li><strong>Distribution Timing:</strong> When investments start returning capital to investors</li>
              <li><strong>Scenario Analysis:</strong> Bull, Base, and Bear case projections</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

const getBowDescription = (value: number): string => {
  if (value <= 0.15) return 'Shallow J-curve';
  if (value <= 0.25) return 'Moderate J-curve';
  if (value <= 0.35) return 'Deep J-curve';
  return 'Very deep J-curve';
};

export default PacingModelPanel;