import React, { useState, useEffect } from 'react';
import { PortfolioPerformance } from '../types/investment';
import { performanceAPI } from '../services/api';
import '../styles/dashboard-shared.css';

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

      {/* Prominent Total Portfolio Value Display */}
      <div className="portfolio-value-hero">
        <div className="hero-content">
          <h2 className="hero-label">Total Portfolio Value</h2>
          <div className="hero-value">
            {formatCurrency(perf.current_nav)}
          </div>
        </div>
      </div>

      <div className="summary-grid">
        {/* Performance Metrics */}
        <div className="summary-section">
          <h4>Performance Metrics</h4>
          <div className="summary-metrics">
            <div className="dashboard-metric-card">
              <label>IRR</label>
              <span className={`value ${getPerformanceColor(perf.irr)}`}>
                {formatPercentage(perf.irr)}
              </span>
            </div>
            <div className="dashboard-metric-card">
              <label>TVPI</label>
              <span className={`value ${getMultipleColor(perf.tvpi)}`}>
                {formatMultiple(perf.tvpi)}
              </span>
            </div>
            <div className="dashboard-metric-card">
              <label>DPI</label>
              <span className={`value ${getPerformanceColor(perf.dpi)}`}>
                {formatMultiple(perf.dpi)}
              </span>
            </div>
            <div className="dashboard-metric-card">
              <label>RVPI</label>
              <span className={`value ${getMultipleColor(perf.rvpi)}`}>
                {formatMultiple(perf.rvpi)}
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
              <span className="value">{formatCurrency(portfolio.total_commitment)}</span>
            </div>
            <div className="capital-item">
              <label>Total Called</label>
              <span className="value">{formatCurrency(portfolio.total_called)}</span>
            </div>
            <div className="capital-item">
              <label>Lifetime Distributions</label>
              <span className="value">{formatCurrency(perf.total_distributions)}</span>
            </div>
            <div className="capital-item total-value">
              <label>Total Portfolio NAV</label>
              <span className="value">{formatCurrency(perf.current_nav)}</span>
            </div>
          </div>
        </div>

        {/* Portfolio Overview */}
        <div className="summary-section">
          <h4>Portfolio Overview</h4>
          <div className="summary-metrics">
            <div className="dashboard-metric-card">
              <label>Active Investments</label>
              <span className="value">
                {portfolio.active_investment_count}
              </span>
            </div>
            <div className="dashboard-metric-card">
              <label>With Recent NAV</label>
              <span className="value">
                {portfolio.investments_with_nav}
              </span>
            </div>
            <div className="dashboard-metric-card">
              <label>Entities</label>
              <span className="value">
                {portfolio.entity_count}
              </span>
            </div>
            <div className="dashboard-metric-card">
              <label>Realized Investments</label>
              <span className="value">
                {portfolio.realized_investment_count}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PortfolioSummary;