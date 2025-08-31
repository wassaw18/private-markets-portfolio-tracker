import React, { useState, useEffect } from 'react';
import { PerformanceMetrics as PerfMetrics, InvestmentPerformance } from '../types/investment';
import { performanceAPI } from '../services/api';
import './PerformanceMetrics.css';

interface Props {
  investmentId: number;
  onUpdate?: () => void; // Called when performance should be recalculated
}

const PerformanceMetrics: React.FC<Props> = ({ investmentId, onUpdate }) => {
  const [performance, setPerformance] = useState<InvestmentPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await performanceAPI.getInvestmentPerformance(investmentId);
      setPerformance(data);
    } catch (err) {
      setError('Failed to calculate performance metrics');
      console.error('Error fetching performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [investmentId]);

  useEffect(() => {
    if (onUpdate) {
      fetchPerformance();
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
      <div className="performance-metrics">
        <div className="section-header">
          <h3>Performance Metrics</h3>
        </div>
        <div className="loading">Calculating performance...</div>
      </div>
    );
  }

  if (error || !performance) {
    return (
      <div className="performance-metrics">
        <div className="section-header">
          <h3>Performance Metrics</h3>
        </div>
        <div className="error-message">{error || 'Unable to calculate performance'}</div>
      </div>
    );
  }

  const metrics = performance.performance;

  return (
    <div className="performance-metrics">
      <div className="section-header">
        <h3>Performance Metrics</h3>
        <div className="metrics-subtitle">
          Professional private markets performance analysis
        </div>
      </div>

      <div className="metrics-grid">
        {/* Core Performance Metrics */}
        <div className="metric-group">
          <h4>Returns</h4>
          <div className="metric-item">
            <label>IRR (Internal Rate of Return)</label>
            <span className={`metric-value ${getPerformanceColor(metrics.irr)}`}>
              {formatPercentage(metrics.irr)}
            </span>
            <small className="metric-description">Time-weighted annualized return</small>
          </div>
          <div className="metric-item">
            <label>TVPI (Total Value / Paid-In)</label>
            <span className={`metric-value ${getMultipleColor(metrics.tvpi)}`}>
              {formatMultiple(metrics.tvpi)}
            </span>
            <small className="metric-description">Total return multiple (MOIC)</small>
          </div>
        </div>

        {/* Capital Efficiency Metrics */}
        <div className="metric-group">
          <h4>Capital Efficiency</h4>
          <div className="metric-item">
            <label>DPI (Distributed / Paid-In)</label>
            <span className={`metric-value ${getPerformanceColor(metrics.dpi)}`}>
              {formatMultiple(metrics.dpi)}
            </span>
            <small className="metric-description">Cash-on-cash return realized</small>
          </div>
          <div className="metric-item">
            <label>RVPI (Residual Value / Paid-In)</label>
            <span className={`metric-value ${getMultipleColor(metrics.rvpi)}`}>
              {formatMultiple(metrics.rvpi)}
            </span>
            <small className="metric-description">Remaining value multiple</small>
          </div>
        </div>

        {/* Capital Summary */}
        <div className="metric-group">
          <h4>Capital Summary</h4>
          <div className="metric-item">
            <label>Total Contributions</label>
            <span className="metric-value capital">
              {formatCurrency(metrics.total_contributions)}
            </span>
            <small className="metric-description">Total capital called</small>
          </div>
          <div className="metric-item">
            <label>Total Distributions</label>
            <span className="metric-value capital">
              {formatCurrency(metrics.total_distributions)}
            </span>
            <small className="metric-description">Total distributions received</small>
          </div>
          <div className="metric-item">
            <label>Current NAV</label>
            <span className="metric-value capital">
              {formatCurrency(metrics.current_nav)}
            </span>
            <small className="metric-description">Current net asset value</small>
          </div>
          <div className="metric-item">
            <label>Total Value</label>
            <span className="metric-value capital total">
              {formatCurrency(metrics.total_value)}
            </span>
            <small className="metric-description">NAV + Distributions</small>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="performance-insights">
        <h4>Performance Insights</h4>
        <div className="insights-grid">
          <div className="insight-item">
            <span className="insight-label">Investment Status:</span>
            <span className="insight-value">
              {metrics.current_nav && metrics.current_nav > 0 ? 'Active' : 
               metrics.total_distributions > 0 ? 'Realized' : 'Pending'}
            </span>
          </div>
          <div className="insight-item">
            <span className="insight-label">Cash Returned:</span>
            <span className="insight-value">
              {metrics.total_contributions > 0 ? 
                formatPercentage(metrics.total_distributions / metrics.total_contributions) : 'N/A'}
            </span>
          </div>
          <div className="insight-item">
            <span className="insight-label">Capital Efficiency:</span>
            <span className="insight-value">
              {metrics.tvpi && metrics.tvpi > 2 ? 'Excellent' :
               metrics.tvpi && metrics.tvpi > 1.5 ? 'Good' :
               metrics.tvpi && metrics.tvpi > 1 ? 'Positive' : 'Below Target'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;