import React, { useState, useEffect } from 'react';
import { PortfolioPerformance } from '../types/investment';
import { performanceAPI } from '../services/api';
import './PortfolioSummary.css';

interface Props {
  onUpdate?: number; // Trigger for performance recalculation
}

const PortfolioSummary: React.FC<Props> = ({ onUpdate }) => {
  const [portfolio, setPortfolio] = useState<PortfolioPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolioPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await performanceAPI.getPortfolioPerformance();
      setPortfolio(data);
    } catch (err) {
      setError('Failed to calculate portfolio performance');
      console.error('Error fetching portfolio performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioPerformance();
  }, []);

  useEffect(() => {
    if (onUpdate) {
      fetchPortfolioPerformance();
    }
  }, [onUpdate]);

  const formatPercentage = (value?: number) => {
    if (value == null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatMultiple = (value?: number) => {
    if (value == null) return 'N/A';
    return `${value.toFixed(2)}x`;
  };

  const formatCurrency = (amount?: number) => {
    if (amount == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPerformanceColor = (value?: number) => {
    if (value == null) return 'neutral';
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  };

  const getMultipleColor = (value?: number) => {
    if (value == null) return 'neutral';
    if (value > 1) return 'positive';
    if (value < 1) return 'negative';
    return 'neutral';
  };

  if (loading) {
    return (
      <div className="portfolio-summary">
        <div className="summary-header">
          <h3>Portfolio Performance</h3>
        </div>
        <div className="loading">Calculating portfolio performance...</div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="portfolio-summary">
        <div className="summary-header">
          <h3>Portfolio Performance</h3>
        </div>
        <div className="error-message">{error || 'Unable to calculate portfolio performance'}</div>
      </div>
    );
  }

  const perf = portfolio.portfolio_performance;

  return (
    <div className="portfolio-summary">
      <div className="summary-header">
        <h3>Portfolio Performance</h3>
        <div className="portfolio-stats">
          <span className="stat-item">
            {portfolio.investment_count} Investment{portfolio.investment_count !== 1 ? 's' : ''}
          </span>
          <span className="stat-divider">•</span>
          <span className="stat-item">
            {portfolio.investments_with_nav} with Current NAV
          </span>
        </div>
      </div>

      {/* Prominent Total Portfolio Value Display */}
      <div className="portfolio-value-hero">
        <div className="hero-content">
          <h2 className="hero-label">Total Portfolio Value</h2>
          <div className="hero-value">
            {formatCurrency(perf.total_value)}
          </div>
          <div className="hero-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-label">Current NAV</span>
              <span className="breakdown-value">{formatCurrency(perf.current_nav)}</span>
            </div>
            <div className="breakdown-divider">+</div>
            <div className="breakdown-item">
              <span className="breakdown-label">Total Distributions</span>
              <span className="breakdown-value">{formatCurrency(perf.total_distributions)}</span>
            </div>
          </div>
          <div className="hero-performance">
            <div className="performance-badge">
              <span className={`badge-value ${getMultipleColor(perf.tvpi)}`}>
                {formatMultiple(perf.tvpi)} TVPI
              </span>
            </div>
            <div className="performance-badge">
              <span className={`badge-value ${getPerformanceColor(perf.irr)}`}>
                {formatPercentage(perf.irr)} IRR
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="summary-grid">
        {/* Key Performance Indicators */}
        <div className="summary-section">
          <h4>Key Metrics</h4>
          <div className="summary-metrics">
            <div className="metric-card primary">
              <label>Portfolio IRR</label>
              <span className={`value ${getPerformanceColor(perf.irr)}`}>
                {formatPercentage(perf.irr)}
              </span>
            </div>
            <div className="metric-card primary">
              <label>Total Multiple (TVPI)</label>
              <span className={`value ${getMultipleColor(perf.tvpi)}`}>
                {formatMultiple(perf.tvpi)}
              </span>
            </div>
          </div>
        </div>

        {/* Capital Deployment */}
        <div className="summary-section">
          <h4>Capital Deployment</h4>
          <div className="capital-breakdown">
            <div className="capital-item">
              <label>Total Committed</label>
              <span className="value">{formatCurrency(perf.total_contributions)}</span>
            </div>
            <div className="capital-item">
              <label>Current NAV</label>
              <span className="value">{formatCurrency(perf.current_nav)}</span>
            </div>
            <div className="capital-item">
              <label>Distributions</label>
              <span className="value">{formatCurrency(perf.total_distributions)}</span>
            </div>
            <div className="capital-item total-value">
              <label>Total Value</label>
              <span className="value">{formatCurrency(perf.total_value)}</span>
            </div>
          </div>
        </div>

        {/* Efficiency Ratios */}
        <div className="summary-section">
          <h4>Efficiency Ratios</h4>
          <div className="ratio-grid">
            <div className="ratio-item">
              <label>DPI</label>
              <span className={`value ${getPerformanceColor(perf.dpi)}`}>
                {formatMultiple(perf.dpi)}
              </span>
              <small>Distributed / Paid-In</small>
            </div>
            <div className="ratio-item">
              <label>RVPI</label>
              <span className={`value ${getMultipleColor(perf.rvpi)}`}>
                {formatMultiple(perf.rvpi)}
              </span>
              <small>Residual Value / Paid-In</small>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Insights */}
      <div className="portfolio-insights">
        <div className="insight-row">
          <div className="insight-item">
            <span className="insight-label">Portfolio Status:</span>
            <span className="insight-value">
              {perf.current_nav && perf.current_nav > 0 ? 
                (perf.total_distributions > 0 ? 'Active with Realizations' : 'Active') : 
                'Fully Realized'}
            </span>
          </div>
          <div className="insight-item">
            <span className="insight-label">Capital Returned:</span>
            <span className="insight-value">
              {perf.total_contributions > 0 ? 
                formatPercentage(perf.total_distributions / perf.total_contributions) : 'N/A'}
            </span>
          </div>
          <div className="insight-item">
            <span className="insight-label">Performance Grade:</span>
            <span className="insight-value">
              {perf.tvpi && perf.tvpi > 3 ? 'A+' :
               perf.tvpi && perf.tvpi > 2.5 ? 'A' :
               perf.tvpi && perf.tvpi > 2 ? 'B+' :
               perf.tvpi && perf.tvpi > 1.5 ? 'B' :
               perf.tvpi && perf.tvpi > 1 ? 'C' : 'D'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSummary;