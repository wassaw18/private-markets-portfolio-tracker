import React, { useState, useEffect } from 'react';
import { fundManagerAPI } from '../services/api';
import '../styles/dashboard-shared.css';
import './FundDashboard.css';

interface FundOverview {
  total_aum: number;
  total_commitments: number;
  total_called: number;
  total_distributed: number;
  unfunded_obligations: number;
  deployment_rate: number;
  investment_count: number;
  tvpi: number;
  dpi: number;
  rvpi: number;
}

interface VintagePerformance {
  vintage_year: number;
  count: number;
  total_commitment: number;
  total_nav: number;
  tvpi: number;
  dpi: number;
  rvpi: number;
}

interface TopGP {
  manager: string;
  count: number;
  total_commitment: number;
  total_nav: number;
  concentration: number;
}

interface CapitalCall {
  investment_name: string;
  amount: number;
  date: string;
  manager: string;
}

interface FundData {
  overview: FundOverview;
  vintage_performance: VintagePerformance[];
  top_gps: TopGP[];
  recent_activity: {
    capital_calls: CapitalCall[];
    total_recent_calls: number;
  };
}

const FundDashboard: React.FC = () => {
  const [data, setData] = useState<FundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFundData();
  }, []);

  const loadFundData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fundManagerAPI.getFundOverview();
      setData(result);
    } catch (err: any) {
      console.error('Error loading fund data:', err);
      setError(err.response?.data?.detail || 'Failed to load fund data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  const formatMultiple = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0.00x';
    return `${value.toFixed(2)}x`;
  };

  if (loading) {
    return (
      <div className="fund-dashboard">
        <div className="loading-state">Loading fund data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fund-dashboard">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadFundData} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overview, vintage_performance, top_gps, recent_activity } = data;

  return (
    <div className="fund-dashboard">
      <div className="dashboard-header">
        <h1>Fund Manager Dashboard</h1>
        <p className="dashboard-subtitle">Portfolio-wide metrics and analytics</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <div className="dashboard-metric-card">
          <div className="metric-label">Total AUM</div>
          <div className="metric-value">{formatCurrency(overview.total_aum)}</div>
          <div className="metric-subtitle">{overview.investment_count} investments</div>
        </div>

        <div className="dashboard-metric-card">
          <div className="metric-label">Total Commitments</div>
          <div className="metric-value">{formatCurrency(overview.total_commitments)}</div>
          <div className="metric-subtitle">Across all funds</div>
        </div>

        <div className="dashboard-metric-card">
          <div className="metric-label">Unfunded Obligations</div>
          <div className="metric-value">{formatCurrency(overview.unfunded_obligations)}</div>
          <div className="metric-subtitle">{formatPercent(overview.deployment_rate)} deployed</div>
        </div>

        <div className="dashboard-metric-card">
          <div className="metric-label">TVPI</div>
          <div className="metric-value">{formatMultiple(overview.tvpi)}</div>
          <div className="metric-detail">
            DPI: {formatMultiple(overview.dpi)} | RVPI: {formatMultiple(overview.rvpi)}
          </div>
        </div>
      </div>

      {/* Deployment Progress */}
      <div className="dashboard-section">
        <h2>Deployment Progress</h2>
        <div className="deployment-card">
          <div className="deployment-bar-container">
            <div
              className="deployment-bar-filled"
              style={{ width: `${overview.deployment_rate}%` }}
            />
          </div>
          <div className="deployment-stats">
            <div className="deployment-stat">
              <span className="stat-label">Called</span>
              <span className="stat-value">{formatCurrency(overview.total_called)}</span>
            </div>
            <div className="deployment-stat">
              <span className="stat-label">Distributed</span>
              <span className="stat-value">{formatCurrency(overview.total_distributed)}</span>
            </div>
            <div className="deployment-stat">
              <span className="stat-label">Deployment Rate</span>
              <span className="stat-value">{formatPercent(overview.deployment_rate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dashboard-columns">
        {/* Vintage Year Performance */}
        <div className="dashboard-section">
          <h2>Vintage Year Performance</h2>
          <div className="table-container">
            <table className="vintage-table">
              <thead>
                <tr>
                  <th>Vintage</th>
                  <th>Count</th>
                  <th>Commitment</th>
                  <th>NAV</th>
                  <th>TVPI</th>
                  <th>DPI</th>
                </tr>
              </thead>
              <tbody>
                {vintage_performance.map((vintage) => (
                  <tr key={vintage.vintage_year}>
                    <td className="vintage-year">{vintage.vintage_year}</td>
                    <td>{vintage.count}</td>
                    <td>{formatCurrency(vintage.total_commitment)}</td>
                    <td>{formatCurrency(vintage.total_nav)}</td>
                    <td className="performance-metric">{formatMultiple(vintage.tvpi)}</td>
                    <td className="performance-metric">{formatMultiple(vintage.dpi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* GP Concentration */}
        <div className="dashboard-section">
          <h2>GP Concentration</h2>
          <div className="table-container">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Funds</th>
                  <th>Commitment</th>
                  <th>% of Portfolio</th>
                </tr>
              </thead>
              <tbody>
                {top_gps.map((gp, index) => (
                  <tr key={index}>
                    <td className="gp-name">{gp.manager}</td>
                    <td>{gp.count}</td>
                    <td>{formatCurrency(gp.total_commitment)}</td>
                    <td className="concentration">
                      <div className="concentration-bar-container">
                        <div
                          className="concentration-bar"
                          style={{ width: `${gp.concentration}%` }}
                        />
                        <span className="concentration-text">{formatPercent(gp.concentration)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dashboard-section">
        <h2>Recent Activity</h2>
        <div className="activity-summary">
          <p>
            <strong>{formatCurrency(recent_activity.total_recent_calls)}</strong> in capital calls
            over the last 30 days ({recent_activity.capital_calls.length} calls)
          </p>
        </div>
        {recent_activity.capital_calls.length > 0 && (
          <div className="table-container">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Investment</th>
                  <th>Manager</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent_activity.capital_calls.map((call, index) => (
                  <tr key={index}>
                    <td>{new Date(call.date).toLocaleDateString()}</td>
                    <td>{call.investment_name}</td>
                    <td>{call.manager}</td>
                    <td className="amount-call">{formatCurrency(Math.abs(call.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FundDashboard;
