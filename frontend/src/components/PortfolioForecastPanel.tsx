import React, { useState, useEffect } from 'react';
import { pacingModelAPI } from '../services/api';
import './PortfolioForecastPanel.css';

interface PortfolioCashFlowForecast {
  forecast_date: string;
  scenario: 'Bull' | 'Base' | 'Bear';
  annual_forecasts: Array<{
    year: number;
    calls: number;
    distributions: number;
    net: number;
  }>;
  peak_capital_need_year: number;
  peak_capital_amount: number;
  break_even_year: number;
  total_capital_required: number;
  total_expected_distributions: number;
  portfolio_expected_irr: number;
  portfolio_expected_moic: number;
  liquidity_gap_periods: Array<{year: number; gap_amount: number}>;
  distribution_peak_periods: Array<{year: number; distribution_amount: number}>;
}

const PortfolioForecastPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<'Bull' | 'Base' | 'Bear'>('Base');
  const [forecast, setForecast] = useState<PortfolioCashFlowForecast | null>(null);

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await pacingModelAPI.getPortfolioForecast(scenario);
      setForecast(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('No investments with forecasting enabled found. Enable forecasting on individual investments first.');
      } else {
        setError('Failed to load portfolio forecast');
      }
      console.error('Error fetching portfolio forecast:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      fetchForecast();
    }
  }, [isExpanded, scenario]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatMultiple = (value: number) => `${value.toFixed(1)}x`;

  const getScenarioColor = (scenario: string) => {
    switch (scenario) {
      case 'Bull': return 'linear-gradient(135deg, var(--luxury-success) 0%, var(--luxury-emerald) 100%)';
      case 'Bear': return 'linear-gradient(135deg, var(--luxury-error) 0%, var(--luxury-ruby) 100%)';
      default: return 'linear-gradient(135deg, var(--luxury-accent-blue) 0%, var(--luxury-dark-blue) 100%)';
    }
  };

  return (
    <div className="portfolio-forecast-panel">
      <div className="panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>Portfolio Cash Flow Forecast</h3>
        <div className="header-controls">
          {isExpanded && (
            <div className="scenario-selector" onClick={(e) => e.stopPropagation()}>
              <label>Scenario:</label>
              <select 
                value={scenario} 
                onChange={(e) => setScenario(e.target.value as any)}
                className="scenario-select"
              >
                <option value="Bull">Bull Case</option>
                <option value="Base">Base Case</option>
                <option value="Bear">Bear Case</option>
              </select>
            </div>
          )}
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </div>
      </div>

      {isExpanded && (
        <div className="panel-content">
          {loading && <div className="loading-state">Loading portfolio forecast...</div>}
          
          {error && <div className="error-message">{error}</div>}

          {forecast && (
            <>
              {/* Summary Cards */}
              <div className="forecast-summary">
                <div className="summary-card scenario-badge" style={{ background: getScenarioColor(scenario) }}>
                  <h4>{scenario} Case Scenario</h4>
                  <p>Portfolio-level cash flow projections</p>
                </div>
                
                <div className="summary-grid">
                  <div className="summary-metric">
                    <span className="metric-label">Expected IRR</span>
                    <span className="metric-value">{formatPercentage(forecast.portfolio_expected_irr)}</span>
                  </div>
                  
                  <div className="summary-metric">
                    <span className="metric-label">Expected MOIC</span>
                    <span className="metric-value">{formatMultiple(forecast.portfolio_expected_moic)}</span>
                  </div>
                  
                  <div className="summary-metric">
                    <span className="metric-label">Total Capital Required</span>
                    <span className="metric-value">{formatCurrency(forecast.total_capital_required)}</span>
                  </div>
                  
                  <div className="summary-metric">
                    <span className="metric-label">Expected Distributions</span>
                    <span className="metric-value">{formatCurrency(forecast.total_expected_distributions)}</span>
                  </div>
                </div>
              </div>

              {/* Key Insights */}
              <div className="key-insights">
                <h4>Key Insights</h4>
                <div className="insights-grid">
                  <div className="insight-card">
                    <div className="insight-icon">📈</div>
                    <div className="insight-content">
                      <h5>Peak Capital Need</h5>
                      <p><strong>{forecast.peak_capital_need_year}</strong> - {formatCurrency(forecast.peak_capital_amount)}</p>
                    </div>
                  </div>
                  
                  <div className="insight-card">
                    <div className="insight-icon">⚖️</div>
                    <div className="insight-content">
                      <h5>Break-Even Year</h5>
                      <p>Cumulative cash flow turns positive in <strong>{forecast.break_even_year}</strong></p>
                    </div>
                  </div>
                  
                  {forecast.liquidity_gap_periods.length > 0 && (
                    <div className="insight-card warning">
                      <div className="insight-icon">⚠️</div>
                      <div className="insight-content">
                        <h5>Liquidity Gaps</h5>
                        <p>{forecast.liquidity_gap_periods.length} periods require significant capital</p>
                      </div>
                    </div>
                  )}
                  
                  {forecast.distribution_peak_periods.length > 0 && (
                    <div className="insight-card positive">
                      <div className="insight-icon">💰</div>
                      <div className="insight-content">
                        <h5>Distribution Peaks</h5>
                        <p>{forecast.distribution_peak_periods.length} high distribution periods expected</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Annual Forecast Table */}
              <div className="annual-forecast-table">
                <h4>Annual Cash Flow Projections</h4>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>Capital Calls</th>
                        <th>Distributions</th>
                        <th>Net Cash Flow</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.annual_forecasts.map((year) => (
                        <tr key={year.year}>
                          <td><strong>{year.year}</strong></td>
                          <td className="negative">{formatCurrency(-year.calls)}</td>
                          <td className="positive">{formatCurrency(year.distributions)}</td>
                          <td className={year.net >= 0 ? 'positive' : 'negative'}>
                            {formatCurrency(year.net)}
                          </td>
                          <td>
                            {year.net >= 0 ? (
                              <span className="status-positive">Cash Positive</span>
                            ) : (
                              <span className="status-negative">Capital Need</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Liquidity Analysis */}
              {(forecast.liquidity_gap_periods.length > 0 || forecast.distribution_peak_periods.length > 0) && (
                <div className="liquidity-analysis">
                  <h4>Liquidity Analysis</h4>
                  
                  {forecast.liquidity_gap_periods.length > 0 && (
                    <div className="analysis-section">
                      <h5>High Capital Need Periods</h5>
                      <div className="period-cards">
                        {forecast.liquidity_gap_periods.map((gap, index) => (
                          <div key={index} className="period-card warning">
                            <span className="period-year">{gap.year}</span>
                            <span className="period-amount">{formatCurrency(gap.gap_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {forecast.distribution_peak_periods.length > 0 && (
                    <div className="analysis-section">
                      <h5>High Distribution Periods</h5>
                      <div className="period-cards">
                        {forecast.distribution_peak_periods.map((peak, index) => (
                          <div key={index} className="period-card positive">
                            <span className="period-year">{peak.year}</span>
                            <span className="period-amount">{formatCurrency(peak.distribution_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="forecast-disclaimer">
                <small>
                  <strong>Disclaimer:</strong> These forecasts are based on pacing models and target returns. 
                  Actual results may vary significantly. Use for strategic planning purposes only.
                </small>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PortfolioForecastPanel;