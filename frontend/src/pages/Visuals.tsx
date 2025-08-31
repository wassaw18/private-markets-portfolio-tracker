import React, { useState, useEffect } from 'react';
import { DashboardSummaryStats } from '../types/investment';
import { dashboardAPI } from '../services/api';
import CommitmentVsCalledChart from '../components/CommitmentVsCalledChart';
import AssetAllocationChart from '../components/AssetAllocationChart';
import VintageAllocationChart from '../components/VintageAllocationChart';
import OwnershipVisualizationChart from '../components/OwnershipVisualizationChart';
import PortfolioTimelineChart from '../components/PortfolioTimelineChart';
import JCurveChart from '../components/JCurveChart';
import PortfolioForecastPanel from '../components/PortfolioForecastPanel';
import './Visuals.css';

const Visuals: React.FC = () => {
  const [summaryStats, setSummaryStats] = useState<DashboardSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummaryStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const stats = await dashboardAPI.getSummaryStats();
      setSummaryStats(stats);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error fetching summary stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyCompact = (amount: number) => {
    if (amount >= 1e9) {
      return `$${(amount / 1e9).toFixed(1)}B`;
    } else if (amount >= 1e6) {
      return `$${(amount / 1e6).toFixed(1)}M`;
    } else if (amount >= 1e3) {
      return `$${(amount / 1e3).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  if (loading) {
    return (
      <div className="visuals-container">
        <div className="visuals-header">
          <h2>Portfolio Visuals & Analytics</h2>
        </div>
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !summaryStats) {
    return (
      <div className="visuals-container">
        <div className="visuals-header">
          <h2>Portfolio Visuals & Analytics</h2>
        </div>
        <div className="error-message">{error || 'Unable to load dashboard data'}</div>
      </div>
    );
  }

  return (
    <div className="visuals-container">
      <div className="visuals-header">
        <h2>Portfolio Visuals & Analytics</h2>
        <div className="header-subtitle">
          Institutional-grade portfolio analysis and data visualization
        </div>
      </div>

      {/* Summary Statistics Bar */}
      <div className="summary-stats-bar">
        <div className="stat-card">
          <label>Total Investments</label>
          <span className="value">{summaryStats.total_investments}</span>
        </div>
        <div className="stat-card">
          <label>Total Commitment</label>
          <span className="value">{formatCurrencyCompact(summaryStats.total_commitment)}</span>
        </div>
        <div className="stat-card">
          <label>Total Called</label>
          <span className="value">{formatCurrencyCompact(summaryStats.total_called)}</span>
        </div>
        <div className="stat-card">
          <label>Current NAV</label>
          <span className="value">{formatCurrencyCompact(summaryStats.total_nav)}</span>
        </div>
        <div className="stat-card">
          <label>Distributions</label>
          <span className="value">{formatCurrencyCompact(summaryStats.total_distributions)}</span>
        </div>
        <div className="stat-card">
          <label>Asset Classes</label>
          <span className="value">{summaryStats.asset_classes}</span>
        </div>
        <div className="stat-card">
          <label>Vintage Years</label>
          <span className="value">{summaryStats.vintage_years}</span>
        </div>
        <div className="stat-card">
          <label>Active Investments</label>
          <span className="value">{summaryStats.active_investments}</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Capital Deployment Charts */}
        <div className="chart-section">
          <div className="chart-container">
            <CommitmentVsCalledChart />
          </div>
        </div>

        <div className="chart-section">
          <div className="chart-container">
            <AssetAllocationChart />
          </div>
        </div>

        <div className="chart-section">
          <div className="chart-container">
            <VintageAllocationChart />
          </div>
        </div>

        {/* Ownership Distribution Chart */}
        <div className="chart-section full-width">
          <div className="chart-container">
            <OwnershipVisualizationChart />
          </div>
        </div>

        {/* Time Series Charts - Full Width */}
        <div className="chart-section full-width">
          <div className="chart-container">
            <PortfolioTimelineChart />
          </div>
        </div>

        <div className="chart-section full-width">
          <div className="chart-container">
            <JCurveChart />
          </div>
        </div>
      </div>

      {/* Analytics Insights */}
      <div className="analytics-insights">
        <div className="insights-header">
          <h3>Portfolio Analytics Insights</h3>
        </div>
        <div className="insights-grid">
          <div className="insight-card">
            <label>Capital Deployment</label>
            <span className="insight-value">
              {summaryStats.total_commitment > 0 ? 
                `${((summaryStats.total_called / summaryStats.total_commitment) * 100).toFixed(1)}% Called` : 'N/A'}
            </span>
            <small>of total commitments deployed</small>
          </div>
          <div className="insight-card">
            <label>Portfolio Diversification</label>
            <span className="insight-value">
              {summaryStats.asset_classes} Asset Classes
            </span>
            <small>across {summaryStats.vintage_years} vintage years</small>
          </div>
          <div className="insight-card">
            <label>Realization Status</label>
            <span className="insight-value">
              {summaryStats.total_distributions > 0 ? 'Active Returns' : 'Pre-Distribution'}
            </span>
            <small>{formatCurrencyCompact(summaryStats.total_distributions)} distributed</small>
          </div>
          <div className="insight-card">
            <label>Portfolio Activity</label>
            <span className="insight-value">
              {summaryStats.active_investments} Active
            </span>
            <small>of {summaryStats.total_investments} total investments</small>
          </div>
        </div>
      </div>

      {/* Portfolio Cash Flow Forecast */}
      <PortfolioForecastPanel />
    </div>
  );
};

export default Visuals;