import React, { useState, useEffect, useCallback } from 'react';
import { Investment, InvestmentStatus } from '../types/investment';
import { investmentAPI } from '../services/api';
import PortfolioSummary from '../components/PortfolioSummary';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import '../styles/luxury-design-system.css';
import './Dashboard.css';

interface AssetClassBreakdown {
  asset_class: string;
  count: number;
  total_commitment: number;
  current_nav: number;
  percentage: number;
}

interface EntityBreakdown {
  entity_name: string;
  count: number;
  total_value: number;
  percentage: number;
}

const Dashboard: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioUpdateTrigger, setPortfolioUpdateTrigger] = useState(0);

  // Helper function to get current NAV from valuations
  const getCurrentNav = useCallback((investment: Investment): number => {
    if (!investment.valuations || investment.valuations.length === 0) {
      return 0;
    }
    // Get the latest valuation by date
    const sortedValuations = [...investment.valuations].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sortedValuations[0]?.nav_value || 0;
  }, []);

  const fetchInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await investmentAPI.getInvestments(0, 1000);
      setInvestments(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch portfolio data. Please check if the backend is running.');
      console.error('Error fetching investments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  // Calculate asset class breakdown
  const assetClassBreakdown: AssetClassBreakdown[] = React.useMemo(() => {
    if (!investments.length) return [];

    const breakdown = new Map<string, {
      count: number;
      total_commitment: number;
      current_nav: number;
    }>();

    let totalNavValue = 0;

    investments.forEach(inv => {
      const assetClass = inv.asset_class || 'Unknown';
      const commitment = inv.commitment_amount || 0;
      const nav = getCurrentNav(inv);

      totalNavValue += nav;

      if (!breakdown.has(assetClass)) {
        breakdown.set(assetClass, {
          count: 0,
          total_commitment: 0,
          current_nav: 0
        });
      }

      const current = breakdown.get(assetClass)!;
      current.count += 1;
      current.total_commitment += commitment;
      current.current_nav += nav;
    });

    return Array.from(breakdown.entries()).map(([asset_class, data]) => ({
      asset_class,
      count: data.count,
      total_commitment: data.total_commitment,
      current_nav: data.current_nav,
      percentage: totalNavValue > 0 ? (data.current_nav / totalNavValue) * 100 : 0
    })).sort((a, b) => b.current_nav - a.current_nav);
  }, [investments, getCurrentNav]);

  // Calculate entity breakdown
  const entityBreakdown: EntityBreakdown[] = React.useMemo(() => {
    if (!investments.length) return [];

    const breakdown = new Map<string, {
      count: number;
      total_value: number;
    }>();

    let totalValue = 0;

    investments.forEach(inv => {
      const entityName = inv.entity?.name || 'Unknown Entity';
      const value = getCurrentNav(inv);

      totalValue += value;

      if (!breakdown.has(entityName)) {
        breakdown.set(entityName, {
          count: 0,
          total_value: 0
        });
      }

      const current = breakdown.get(entityName)!;
      current.count += 1;
      current.total_value += value;
    });

    return Array.from(breakdown.entries()).map(([entity_name, data]) => ({
      entity_name,
      count: data.count,
      total_value: data.total_value,
      percentage: totalValue > 0 ? (data.total_value / totalValue) * 100 : 0
    })).sort((a, b) => b.total_value - a.total_value);
  }, [investments, getCurrentNav]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="luxury-card">
          <div className="luxury-table-loading">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="luxury-card page-header">
        <h1 className="luxury-heading-1">Portfolio Dashboard</h1>
        <p className="luxury-body-large">Executive overview of your private markets portfolio</p>
      </div>

      {error && (
        <div className="luxury-card" style={{borderColor: 'var(--luxury-error)', backgroundColor: 'rgba(231, 76, 60, 0.05)'}}>
          <p className="luxury-body" style={{color: 'var(--luxury-error)', margin: 0}}>{error}</p>
        </div>
      )}

      {/* Portfolio Performance Summary */}
      <div style={{marginBottom: '32px'}}>
        <SectionErrorBoundary sectionName="Portfolio Performance">
          <PortfolioSummary onUpdate={portfolioUpdateTrigger} />
        </SectionErrorBoundary>
      </div>

      {/* Asset Class Breakdown */}
      <div className="luxury-card" style={{marginBottom: '32px'}}>
        <h3 className="luxury-heading-3" style={{marginBottom: '24px'}}>Asset Class Allocation</h3>
        <div className="breakdown-grid">
          {assetClassBreakdown.map((item, index) => (
            <div key={index} className="breakdown-card">
              <div className="breakdown-header">
                <h4 className="breakdown-title">{item.asset_class.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                <span className="breakdown-percentage">{formatPercentage(item.percentage)}</span>
              </div>
              <div className="breakdown-metrics">
                <div className="breakdown-metric">
                  <label>Holdings</label>
                  <span>{item.count}</span>
                </div>
                <div className="breakdown-metric">
                  <label>Commitment</label>
                  <span>{formatCurrency(item.total_commitment)}</span>
                </div>
                <div className="breakdown-metric primary">
                  <label>Current Value</label>
                  <span>{formatCurrency(item.current_nav)}</span>
                </div>
              </div>
              <div className="breakdown-bar">
                <div
                  className="breakdown-fill"
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Entity Breakdown */}
      <div className="luxury-card">
        <h3 className="luxury-heading-3" style={{marginBottom: '24px'}}>Holdings by Entity</h3>
        <div className="entity-breakdown-list">
          {entityBreakdown.slice(0, 8).map((item, index) => (
            <div key={index} className="entity-breakdown-item">
              <div className="entity-info">
                <div className="entity-name">{item.entity_name}</div>
                <div className="entity-stats">
                  <span className="entity-count">{item.count} holdings</span>
                  <span className="entity-percentage">{formatPercentage(item.percentage)}</span>
                </div>
              </div>
              <div className="entity-value">
                {formatCurrency(item.total_value)}
              </div>
              <div className="entity-bar">
                <div
                  className="entity-fill"
                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </>
  );
};

export default Dashboard;