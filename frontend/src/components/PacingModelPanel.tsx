import React, { useState, useEffect } from 'react';
import { Investment, PacingPattern, AssetClass } from '../types/investment';
import { investmentAPI } from '../services/api';
import './PacingModelPanel.css';

interface PacingModelInputs {
  pacing_pattern?: PacingPattern;
  target_irr: number;
  target_moic: number;
  fund_life: number;
  investment_period: number;
  bow_factor: number;
  call_schedule: 'Front Loaded' | 'Steady' | 'Back Loaded';
  distribution_timing: 'Early' | 'Backend' | 'Steady';
  forecast_enabled: boolean;
}

// Pattern descriptions and default parameters
const PATTERN_DESCRIPTIONS: Record<PacingPattern, {
  title: string;
  description: string;
  bestFor: string;
  defaultMOIC: number;
}> = {
  [PacingPattern.IMMEDIATE_STEADY_YIELD]: {
    title: "Immediate Steady Yield",
    description: "100% capital call upfront, steady quarterly yield payments, principal at maturity",
    bestFor: "Private debt, loans, bonds with regular interest",
    defaultMOIC: 1.3
  },
  [PacingPattern.IMMEDIATE_BULLET]: {
    title: "Immediate Bullet",
    description: "100% capital call upfront, single bullet payment at maturity",
    bestFor: "Zero-coupon bonds, short-term notes",
    defaultMOIC: 1.2
  },
  [PacingPattern.TRADITIONAL_PE]: {
    title: "Traditional PE",
    description: "4-year capital deployment, backend-loaded distributions",
    bestFor: "Private equity buyout funds",
    defaultMOIC: 2.0
  },
  [PacingPattern.VENTURE_CAPITAL]: {
    title: "Venture Capital",
    description: "Fast deployment, long tail distributions with binary outcomes",
    bestFor: "VC funds, early-stage investing",
    defaultMOIC: 2.5
  },
  [PacingPattern.REAL_ESTATE_CORE]: {
    title: "Real Estate Core",
    description: "Moderate deployment, steady income plus appreciation",
    bestFor: "Core real estate, stabilized properties",
    defaultMOIC: 1.8
  },
  [PacingPattern.REAL_ESTATE_OPPORTUNISTIC]: {
    title: "Real Estate Opportunistic",
    description: "Fast deployment, lumpy exits, value-add strategies",
    bestFor: "Opportunistic real estate, development",
    defaultMOIC: 2.2
  },
  [PacingPattern.CREDIT_FUND]: {
    title: "Credit Fund",
    description: "Steady deployment and repayments, regular interest payments",
    bestFor: "Direct lending, mezzanine debt",
    defaultMOIC: 1.5
  },
  [PacingPattern.CUSTOM]: {
    title: "Custom",
    description: "User-defined cash flow pattern",
    bestFor: "Unique structures or manual forecasting",
    defaultMOIC: 2.0
  }
};

// Asset class default patterns
const ASSET_CLASS_DEFAULT_PATTERNS: Record<AssetClass, PacingPattern> = {
  [AssetClass.PRIVATE_CREDIT]: PacingPattern.IMMEDIATE_STEADY_YIELD,
  [AssetClass.PRIVATE_EQUITY]: PacingPattern.TRADITIONAL_PE,
  [AssetClass.REAL_ESTATE]: PacingPattern.REAL_ESTATE_CORE,
  [AssetClass.VENTURE_CAPITAL]: PacingPattern.VENTURE_CAPITAL,
  [AssetClass.REAL_ASSETS]: PacingPattern.REAL_ESTATE_CORE,
  [AssetClass.PUBLIC_EQUITY]: PacingPattern.CUSTOM,
  [AssetClass.PUBLIC_FIXED_INCOME]: PacingPattern.CUSTOM,
  [AssetClass.CASH_AND_EQUIVALENTS]: PacingPattern.CUSTOM
};

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
  
  // Determine the default pattern based on asset class if none is set
  const getDefaultPattern = (): PacingPattern => {
    if (investment.pacing_pattern) {
      return investment.pacing_pattern;
    }
    return ASSET_CLASS_DEFAULT_PATTERNS[investment.asset_class] || PacingPattern.TRADITIONAL_PE;
  };

  const [inputs, setInputs] = useState<PacingModelInputs>({
    pacing_pattern: investment.pacing_pattern,
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
      pacing_pattern: investment.pacing_pattern,
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
      pacing_pattern: investment.pacing_pattern,
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

          {/* Pattern Selector Section */}
          <div className="pattern-selector-section">
            <h4>Cash Flow Pattern</h4>
            <div className="pattern-info">
              {inputs.pacing_pattern ? (
                <>
                  <div className="current-pattern">
                    <span className="pattern-label">Current Pattern:</span>
                    <span className="pattern-name">{inputs.pacing_pattern}</span>
                    {!investment.pacing_pattern && (
                      <span className="default-badge">Default</span>
                    )}
                  </div>
                  <div className="pattern-description">
                    <p><strong>Description:</strong> {PATTERN_DESCRIPTIONS[inputs.pacing_pattern].description}</p>
                    <p><strong>Best for:</strong> {PATTERN_DESCRIPTIONS[inputs.pacing_pattern].bestFor}</p>
                    <p><strong>Target MOIC:</strong> {PATTERN_DESCRIPTIONS[inputs.pacing_pattern].defaultMOIC}x</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="current-pattern">
                    <span className="pattern-label">Current Pattern:</span>
                    <span className="pattern-name">{getDefaultPattern()}</span>
                    <span className="default-badge">Default (based on {investment.asset_class})</span>
                  </div>
                  <div className="pattern-description">
                    <p><strong>Description:</strong> {PATTERN_DESCRIPTIONS[getDefaultPattern()].description}</p>
                    <p><strong>Best for:</strong> {PATTERN_DESCRIPTIONS[getDefaultPattern()].bestFor}</p>
                    <p><strong>Target MOIC:</strong> {PATTERN_DESCRIPTIONS[getDefaultPattern()].defaultMOIC}x</p>
                  </div>
                </>
              )}
            </div>

            {isEditing && (
              <div className="pattern-selector">
                <label>Change Pattern:</label>
                <select
                  value={inputs.pacing_pattern || getDefaultPattern()}
                  onChange={(e) => handleInputChange('pacing_pattern', e.target.value as PacingPattern)}
                  className="pattern-select"
                >
                  <option value={PacingPattern.IMMEDIATE_STEADY_YIELD}>Immediate Steady Yield</option>
                  <option value={PacingPattern.IMMEDIATE_BULLET}>Immediate Bullet</option>
                  <option value={PacingPattern.TRADITIONAL_PE}>Traditional PE</option>
                  <option value={PacingPattern.VENTURE_CAPITAL}>Venture Capital</option>
                  <option value={PacingPattern.REAL_ESTATE_CORE}>Real Estate Core</option>
                  <option value={PacingPattern.REAL_ESTATE_OPPORTUNISTIC}>Real Estate Opportunistic</option>
                  <option value={PacingPattern.CREDIT_FUND}>Credit Fund</option>
                  <option value={PacingPattern.CUSTOM}>Custom</option>
                </select>
              </div>
            )}
          </div>

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
                    <option value="Front Loaded">Fast (Front-loaded deployment)</option>
                    <option value="Steady">Even (Steady deployment)</option>
                    <option value="Back Loaded">Slow (Back-loaded deployment)</option>
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
                    <option value="Early">Fast (Early distributions)</option>
                    <option value="Steady">Even (Mid-period distributions)</option>
                    <option value="Backend">Slow (Back-end distributions)</option>
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