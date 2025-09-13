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
        <div className="header-left">
          <h3>Performance Metrics</h3>
          <div className="metrics-subtitle">
            Professional private markets performance analysis
          </div>
        </div>
        <div className="header-right">
          <div className="investment-status">
            <span className="status-label">Status:</span>
            <span className={`status-value ${metrics.current_nav && metrics.current_nav > 0 ? 'active' : 
                             metrics.total_distributions > 0 ? 'realized' : 'pending'}`}>
              {metrics.current_nav && metrics.current_nav > 0 ? 'Active' : 
               metrics.total_distributions > 0 ? 'Realized' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        {/* Return Metrics */}
        <div className="metric-group">
          <h4>Return Metrics</h4>
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
          <div className="metric-item">
            <label>RVPI (Residual Value / Paid-In)</label>
            <span className={`metric-value ${getMultipleColor(metrics.rvpi)}`}>
              {formatMultiple(metrics.rvpi)}
            </span>
            <small className="metric-description">Remaining value multiple</small>
          </div>
          <div className="metric-item">
            <label>DPI (Distributed / Paid-In)</label>
            <span className={`metric-value ${getPerformanceColor(metrics.dpi)}`}>
              {formatMultiple(metrics.dpi)}
            </span>
            <small className="metric-description">Cash-on-cash return realized</small>
          </div>
        </div>

        {/* Yield Metrics */}
        <div className="metric-group">
          <h4>Yield Metrics</h4>
          <div className="metric-item">
            <label>Trailing Yield (12-Month)</label>
            <span className={`metric-value ${getPerformanceColor(metrics.trailing_yield)}`}>
              {formatPercentage(metrics.trailing_yield)}
            </span>
            <small className="metric-description">
              {metrics.trailing_yield ? 'Actual yield over past 12 months' : 'No yield distributions'}
            </small>
          </div>
          
          <div className="metric-item">
            <label>Trailing Yield ($)</label>
            <span className="metric-value capital">
              {metrics.trailing_yield_amount 
                ? formatCurrency(metrics.trailing_yield_amount)
                : 'N/A'
              }
            </span>
            <small className="metric-description">Sum of all yields in past 12 months</small>
          </div>
          
          <div className="metric-item">
            <label>Forward Yield</label>
            <span className={`metric-value ${getPerformanceColor(metrics.forward_yield)}`} 
                  title={metrics.yield_frequency ? `Based on ${metrics.yield_frequency.toLowerCase()} distributions` : undefined}>
              {formatPercentage(metrics.forward_yield)}
            </span>
            <small className="metric-description">
              {metrics.yield_frequency 
                ? `Projected (${metrics.yield_frequency.toLowerCase()} frequency)` 
                : 'Cannot determine frequency'}
            </small>
          </div>
          
          <div className="metric-item">
            <label>Forward Yield ($)</label>
            <span className="metric-value capital">
              {metrics.latest_yield_amount && metrics.forward_yield && (metrics.current_nav || metrics.total_contributions)
                ? `${formatCurrency(metrics.latest_yield_amount)} (${formatCurrency(metrics.forward_yield * (metrics.current_nav || Math.abs(metrics.total_contributions)))} annualized)`
                : metrics.latest_yield_amount
                ? formatCurrency(metrics.latest_yield_amount)
                : 'N/A'
              }
            </span>
            <small className="metric-description">Latest single yield payment (annualized projection)</small>
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

    </div>
  );
};

export default PerformanceMetrics;