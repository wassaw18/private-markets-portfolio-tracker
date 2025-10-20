import React, { useState, useEffect, useCallback } from 'react';
import { Investment } from '../types/investment';
import { investmentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import '../styles/luxury-design-system.css';
import './LPPortalDashboard.css';

interface CapitalAccountSummary {
  total_commitment: number;
  total_called: number;
  total_distributed: number;
  current_nav: number;
  unfunded_commitment: number;
}

interface PerformanceMetrics {
  irr: number;
  tvpi: number;
  dpi: number;
  rvpi: number;
}

interface CashFlowActivity {
  date: string;
  type: 'capital_call' | 'distribution';
  amount: number;
  fund_name: string;
}

const LPPortalDashboard: React.FC = () => {
  const { authState } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get current NAV from valuations
  const getCurrentNav = useCallback((investment: Investment): number => {
    if (!investment.valuations || investment.valuations.length === 0) {
      return 0;
    }
    const sortedValuations = [...investment.valuations].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sortedValuations[0]?.nav_value || 0;
  }, []);

  // Helper function to calculate total distributions from cashflows
  const getTotalDistributions = useCallback((investment: Investment): number => {
    if (!investment.cashflows || investment.cashflows.length === 0) {
      return 0;
    }
    return investment.cashflows
      .filter(cf =>
        cf.type === 'Distribution' ||
        cf.type === 'Yield' ||
        cf.type === 'Return of Principal'
      )
      .reduce((sum, cf) => sum + cf.amount, 0);
  }, []);

  const fetchInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await investmentAPI.getInvestments(0, 1000);
      // TODO: Filter by LP's entity when backend supports it
      setInvestments(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch your investment data. Please try again.');
      console.error('Error fetching investments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  // Calculate capital account summary
  const capitalAccountSummary: CapitalAccountSummary = React.useMemo(() => {
    if (!investments.length) {
      return {
        total_commitment: 0,
        total_called: 0,
        total_distributed: 0,
        current_nav: 0,
        unfunded_commitment: 0
      };
    }

    let total_commitment = 0;
    let total_called = 0;
    let total_distributed = 0;
    let current_nav = 0;

    investments.forEach(inv => {
      total_commitment += inv.commitment_amount || 0;
      total_called += inv.called_amount || 0;
      total_distributed += getTotalDistributions(inv);
      current_nav += getCurrentNav(inv);
    });

    return {
      total_commitment,
      total_called,
      total_distributed,
      current_nav,
      unfunded_commitment: total_commitment - total_called
    };
  }, [investments, getCurrentNav, getTotalDistributions]);

  // Calculate performance metrics
  const performanceMetrics: PerformanceMetrics = React.useMemo(() => {
    const { total_called, total_distributed, current_nav } = capitalAccountSummary;

    const tvpi = total_called > 0 ? (total_distributed + current_nav) / total_called : 0;
    const dpi = total_called > 0 ? total_distributed / total_called : 0;
    const rvpi = total_called > 0 ? current_nav / total_called : 0;

    // Simplified IRR calculation (would need actual cash flow dates for real IRR)
    const irr = 0; // Placeholder - requires complex calculation with dates

    return { irr, tvpi, dpi, rvpi };
  }, [capitalAccountSummary]);

  // Get recent cash flow activity (mock for now - would come from backend)
  const recentActivity: CashFlowActivity[] = React.useMemo(() => {
    // TODO: Fetch real cash flow data from backend
    return [];
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatMultiple = (value: number) => {
    return `${value.toFixed(2)}x`;
  };

  if (loading) {
    return (
      <div className="lp-portal-container">
        <div className="luxury-card">
          <div className="luxury-table-loading">Loading your portfolio...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-portal-container">
      <div className="luxury-card page-header">
        <div className="header-content">
          <div>
            <h1 className="luxury-heading-1">LP Portal</h1>
            <p className="luxury-body-large">Welcome, {authState.user?.username}</p>
          </div>
          <div className="header-badge">
            <span className="badge-icon">👥</span>
            <span className="badge-text">Limited Partner</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="luxury-card error-card">
          <p className="luxury-body" style={{color: 'var(--luxury-error)', margin: 0}}>{error}</p>
        </div>
      )}

      {/* Capital Account Summary */}
      <SectionErrorBoundary sectionName="Capital Account Summary">
        <div className="luxury-card summary-card">
          <h2 className="luxury-heading-2 section-title">Capital Account Summary</h2>
          <div className="capital-metrics-grid">
            <div className="capital-metric-card primary">
              <div className="metric-icon">💰</div>
              <div className="metric-content">
                <label className="metric-label">Total Commitment</label>
                <span className="metric-value">{formatCurrency(capitalAccountSummary.total_commitment)}</span>
              </div>
            </div>
            <div className="capital-metric-card">
              <div className="metric-icon">📥</div>
              <div className="metric-content">
                <label className="metric-label">Called Capital</label>
                <span className="metric-value">{formatCurrency(capitalAccountSummary.total_called)}</span>
              </div>
            </div>
            <div className="capital-metric-card">
              <div className="metric-icon">📤</div>
              <div className="metric-content">
                <label className="metric-label">Distributions</label>
                <span className="metric-value positive">{formatCurrency(capitalAccountSummary.total_distributed)}</span>
              </div>
            </div>
            <div className="capital-metric-card highlight">
              <div className="metric-icon">📊</div>
              <div className="metric-content">
                <label className="metric-label">Current NAV</label>
                <span className="metric-value">{formatCurrency(capitalAccountSummary.current_nav)}</span>
              </div>
            </div>
            <div className="capital-metric-card">
              <div className="metric-icon">⏳</div>
              <div className="metric-content">
                <label className="metric-label">Unfunded Commitment</label>
                <span className="metric-value">{formatCurrency(capitalAccountSummary.unfunded_commitment)}</span>
              </div>
            </div>
          </div>
        </div>
      </SectionErrorBoundary>

      {/* Performance Metrics */}
      <SectionErrorBoundary sectionName="Performance Metrics">
        <div className="luxury-card performance-card">
          <h2 className="luxury-heading-2 section-title">Performance Metrics</h2>
          <div className="performance-metrics-grid">
            <div className="performance-metric">
              <label className="performance-label">TVPI (Total Value)</label>
              <span className="performance-value">{formatMultiple(performanceMetrics.tvpi)}</span>
              <p className="performance-description">Total value to paid-in capital</p>
            </div>
            <div className="performance-metric">
              <label className="performance-label">DPI (Realized)</label>
              <span className="performance-value">{formatMultiple(performanceMetrics.dpi)}</span>
              <p className="performance-description">Distributions to paid-in capital</p>
            </div>
            <div className="performance-metric">
              <label className="performance-label">RVPI (Unrealized)</label>
              <span className="performance-value">{formatMultiple(performanceMetrics.rvpi)}</span>
              <p className="performance-description">Residual value to paid-in capital</p>
            </div>
            {performanceMetrics.irr > 0 && (
              <div className="performance-metric">
                <label className="performance-label">Net IRR</label>
                <span className="performance-value">{formatPercentage(performanceMetrics.irr)}</span>
                <p className="performance-description">Internal rate of return</p>
              </div>
            )}
          </div>
        </div>
      </SectionErrorBoundary>

      {/* Investment Holdings */}
      <SectionErrorBoundary sectionName="Investment Holdings">
        <div className="luxury-card holdings-card">
          <h2 className="luxury-heading-2 section-title">Your Fund Investments</h2>
          {investments.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📂</span>
              <p className="empty-message">No investments found</p>
            </div>
          ) : (
            <div className="holdings-list">
              {investments.map((investment) => (
                <div key={investment.id} className="holding-item">
                  <div className="holding-header">
                    <div className="holding-name-section">
                      <h3 className="holding-name">{investment.name}</h3>
                      <span className="holding-asset-class">
                        {investment.asset_class?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <div className="holding-status">
                      <span className={`status-badge ${investment.status?.toLowerCase()}`}>
                        {investment.status}
                      </span>
                    </div>
                  </div>
                  <div className="holding-metrics">
                    <div className="holding-metric">
                      <label>Commitment</label>
                      <span>{formatCurrency(investment.commitment_amount || 0)}</span>
                    </div>
                    <div className="holding-metric">
                      <label>Called</label>
                      <span>{formatCurrency(investment.called_amount || 0)}</span>
                    </div>
                    <div className="holding-metric">
                      <label>Distributions</label>
                      <span className="positive">{formatCurrency(getTotalDistributions(investment))}</span>
                    </div>
                    <div className="holding-metric primary">
                      <label>Current NAV</label>
                      <span>{formatCurrency(getCurrentNav(investment))}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionErrorBoundary>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <SectionErrorBoundary sectionName="Recent Activity">
          <div className="luxury-card activity-card">
            <h2 className="luxury-heading-2 section-title">Recent Activity</h2>
            <div className="activity-list">
              {recentActivity.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'capital_call' ? '📥' : '📤'}
                  </div>
                  <div className="activity-content">
                    <div className="activity-header">
                      <span className="activity-type">
                        {activity.type === 'capital_call' ? 'Capital Call' : 'Distribution'}
                      </span>
                      <span className="activity-date">{new Date(activity.date).toLocaleDateString()}</span>
                    </div>
                    <div className="activity-details">
                      <span className="activity-fund">{activity.fund_name}</span>
                      <span className={`activity-amount ${activity.type === 'distribution' ? 'positive' : ''}`}>
                        {activity.type === 'capital_call' ? '-' : '+'}{formatCurrency(activity.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* Information Banner */}
      <div className="luxury-card info-banner">
        <div className="info-content">
          <span className="info-icon">ℹ️</span>
          <div className="info-text">
            <h3 className="info-title">About Your Portal</h3>
            <p className="info-description">
              This portal provides real-time access to your fund investments, capital account activity, and performance metrics.
              For quarterly statements and detailed reports, please visit the Documents section.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LPPortalDashboard;
