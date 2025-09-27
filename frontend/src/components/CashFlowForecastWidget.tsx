import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Investment, InvestmentStatus } from '../types/investment';
import './CashFlowForecastWidget.css';

interface CashFlowForecastWidgetProps {
  investments: Investment[];
  onForecastSettingsChange?: (settings: ForecastSettings) => void;
}

interface ForecastSettings {
  timeHorizon: number; // years
  scenario: 'Base' | 'Optimistic' | 'Pessimistic';
  includeNewCommitments: boolean;
  newCommitmentsAmount: number;
}

interface CashFlowProjection {
  date: string;
  capitalCalls: number;
  distributions: number;
  netCashFlow: number;
  cumulativeNetCashFlow: number;
}

interface AssetClassForecast {
  assetClass: string;
  projections: CashFlowProjection[];
  totalCommitments: number;
  unfundedCommitments: number;
}

const CashFlowForecastWidget: React.FC<CashFlowForecastWidgetProps> = ({
  investments,
  onForecastSettingsChange
}) => {
  const [viewMode, setViewMode] = useState<'overview' | 'by-asset-class' | 'stress-test'>('overview');
  const [forecastSettings, setForecastSettings] = useState<ForecastSettings>({
    timeHorizon: 5,
    scenario: 'Base',
    includeNewCommitments: false,
    newCommitmentsAmount: 0
  });

  // Helper functions for calculated fields
  const getCurrentValue = (investment: Investment): number => {
    if (investment.valuations && investment.valuations.length > 0) {
      const latestValuation = investment.valuations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return latestValuation.nav_value || 0;
    }
    return 0;
  };

  const getCommitment = (investment: Investment): number => {
    return investment.commitment_amount || 0;
  };

  const getContributions = (investment: Investment): number => {
    return investment.called_amount || 0;
  };

  const getDistributions = (investment: Investment): number => {
    if (investment.cashflows && investment.cashflows.length > 0) {
      return investment.cashflows
        .filter(cf => cf.type === 'Distribution' || cf.type === 'Yield' || cf.type === 'Return of Principal')
        .reduce((sum, cf) => sum + cf.amount, 0);
    }
    return 0;
  };

  const generateForecast = useCallback((): {
    monthlyProjections: CashFlowProjection[];
    assetClassForecasts: AssetClassForecast[];
    totalUnfundedCommitments: number;
  } => {
    const activeInvestments = investments.filter(
      inv => inv.status === InvestmentStatus.ACTIVE
    );

    if (activeInvestments.length === 0) {
      return {
        monthlyProjections: [],
        assetClassForecasts: [],
        totalUnfundedCommitments: 0
      };
    }

    // Generate monthly projections
    const months = forecastSettings.timeHorizon * 12;
    const startDate = new Date();

    // Calculate unfunded commitments
    const totalUnfundedCommitments = activeInvestments.reduce((sum, inv) => {
      const commitment = getCommitment(inv);
      const contributions = getContributions(inv);
      return sum + Math.max(0, commitment - contributions);
    }, 0);

    // Simplified projection logic - in a real implementation this would be much more sophisticated
    const monthlyProjections: CashFlowProjection[] = [];
    let cumulativeNetCashFlow = 0;

    for (let i = 0; i < months; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);

      // Simplified calculation - would use proper J-curve modeling in production
      const capitalCalls = totalUnfundedCommitments * 0.02; // 2% per month
      const distributions = activeInvestments.reduce((sum, inv) => sum + getCurrentValue(inv), 0) * 0.005; // 0.5% per month
      const netCashFlow = distributions - capitalCalls;
      cumulativeNetCashFlow += netCashFlow;

      monthlyProjections.push({
        date: date.toISOString().split('T')[0],
        capitalCalls,
        distributions,
        netCashFlow,
        cumulativeNetCashFlow
      });
    }

    // Generate projections by asset class
    const assetClassForecasts: AssetClassForecast[] = [];
    const assetClasses = Array.from(new Set(activeInvestments.map(inv => inv.asset_class || 'Other')));

    assetClasses.forEach(assetClass => {
      const classInvestments = activeInvestments.filter(inv => (inv.asset_class || 'Other') === assetClass);
      const projections: CashFlowProjection[] = [];

      let cumulativeNetCashFlow = 0;
      const totalCommitments = classInvestments.reduce((sum, inv) => sum + getCommitment(inv), 0);
      const unfundedCommitments = classInvestments.reduce((sum, inv) => {
        return sum + Math.max(0, getCommitment(inv) - getContributions(inv));
      }, 0);

      for (let i = 0; i < months; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);

        // Simplified calculations by asset class
        const capitalCalls = unfundedCommitments * 0.02;
        const distributions = classInvestments.reduce((sum, inv) => sum + getCurrentValue(inv), 0) * 0.005;
        const netCashFlow = distributions - capitalCalls;
        cumulativeNetCashFlow += netCashFlow;

        projections.push({
          date: date.toISOString().split('T')[0],
          capitalCalls,
          distributions,
          netCashFlow,
          cumulativeNetCashFlow
        });
      }

      assetClassForecasts.push({
        assetClass,
        projections,
        totalCommitments,
        unfundedCommitments
      });
    });

    return {
      monthlyProjections,
      assetClassForecasts,
      totalUnfundedCommitments
    };
  }, [investments, forecastSettings]);

  const forecast = useMemo(() => generateForecast(), [generateForecast]);

  const handleSettingsChange = useCallback((newSettings: Partial<ForecastSettings>) => {
    const updatedSettings = { ...forecastSettings, ...newSettings };
    setForecastSettings(updatedSettings);
    onForecastSettingsChange?.(updatedSettings);
  }, [forecastSettings, onForecastSettingsChange]);

  useEffect(() => {
    onForecastSettingsChange?.(forecastSettings);
  }, [forecastSettings, onForecastSettingsChange]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderOverview = () => (
    <div className="cash-flow-overview">
      <div className="forecast-summary">
        <div className="summary-card">
          <h4>Total Unfunded Commitments</h4>
          <div className="metric-value">{formatCurrency(forecast.totalUnfundedCommitments)}</div>
        </div>

        <div className="summary-card">
          <h4>Projected Net Cash Flow (5Y)</h4>
          <div className="metric-value">
            {formatCurrency(forecast.monthlyProjections.reduce((sum, p) => sum + p.netCashFlow, 0))}
          </div>
        </div>

        <div className="summary-card">
          <h4>Peak Funding Need</h4>
          <div className="metric-value">
            {formatCurrency(Math.min(...forecast.monthlyProjections.map(p => p.cumulativeNetCashFlow)))}
          </div>
        </div>
      </div>

      <div className="forecast-chart">
        <h3>Cash Flow Projection</h3>
        <div className="chart-placeholder">
          {/* In a real implementation, this would be a sophisticated chart */}
          <p>Cash flow chart would be displayed here with:</p>
          <ul>
            <li>Monthly capital calls and distributions</li>
            <li>Cumulative net cash flow</li>
            <li>Liquidity analysis</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderByAssetClass = () => (
    <div className="cash-flow-by-asset-class">
      <h3>Projections by Asset Class</h3>
      <div className="asset-class-grid">
        {forecast.assetClassForecasts.map((forecast, index) => (
          <div key={index} className="asset-class-card">
            <h4>{forecast.assetClass}</h4>
            <div className="asset-class-metrics">
              <div className="metric">
                <span>Total Commitments:</span>
                <span>{formatCurrency(forecast.totalCommitments)}</span>
              </div>
              <div className="metric">
                <span>Unfunded:</span>
                <span>{formatCurrency(forecast.unfundedCommitments)}</span>
              </div>
              <div className="metric">
                <span>5Y Net Cash Flow:</span>
                <span>{formatCurrency(forecast.projections.reduce((sum, p) => sum + p.netCashFlow, 0))}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStressTest = () => (
    <div className="stress-test-scenarios">
      <h3>Stress Test Scenarios</h3>
      <div className="scenario-grid">
        <div className="scenario-card">
          <h4>Economic Downturn</h4>
          <p>Capital call acceleration with reduced distributions</p>
          <div className="scenario-impact">Impact: -30% on cash flows</div>
        </div>

        <div className="scenario-card">
          <h4>Liquidity Crisis</h4>
          <p>Delayed distributions with continued capital calls</p>
          <div className="scenario-impact">Impact: -50% on distributions</div>
        </div>

        <div className="scenario-card">
          <h4>Market Rally</h4>
          <p>Accelerated distributions with reduced new calls</p>
          <div className="scenario-impact">Impact: +25% on cash flows</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="cash-flow-forecast-widget">
      <div className="widget-header">
        <h2>Cash Flow Forecast</h2>
        <div className="view-mode-selector">
          <button
            className={viewMode === 'overview' ? 'active' : ''}
            onClick={() => setViewMode('overview')}
          >
            Overview
          </button>
          <button
            className={viewMode === 'by-asset-class' ? 'active' : ''}
            onClick={() => setViewMode('by-asset-class')}
          >
            By Asset Class
          </button>
          <button
            className={viewMode === 'stress-test' ? 'active' : ''}
            onClick={() => setViewMode('stress-test')}
          >
            Stress Tests
          </button>
        </div>
      </div>

      <div className="forecast-settings">
        <div className="settings-row">
          <div className="setting-item">
            <label>Time Horizon (Years)</label>
            <select
              value={forecastSettings.timeHorizon}
              onChange={(e) => handleSettingsChange({ timeHorizon: Number(e.target.value) })}
            >
              <option value={3}>3 Years</option>
              <option value={5}>5 Years</option>
              <option value={7}>7 Years</option>
              <option value={10}>10 Years</option>
            </select>
          </div>

          <div className="setting-item">
            <label>Scenario</label>
            <select
              value={forecastSettings.scenario}
              onChange={(e) => handleSettingsChange({ scenario: e.target.value as any })}
            >
              <option value="Base">Base Case</option>
              <option value="Optimistic">Optimistic</option>
              <option value="Pessimistic">Pessimistic</option>
            </select>
          </div>

          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={forecastSettings.includeNewCommitments}
                onChange={(e) => handleSettingsChange({ includeNewCommitments: e.target.checked })}
              />
              Include New Commitments
            </label>
          </div>
        </div>
      </div>

      <div className="widget-content">
        {viewMode === 'overview' && renderOverview()}
        {viewMode === 'by-asset-class' && renderByAssetClass()}
        {viewMode === 'stress-test' && renderStressTest()}
      </div>
    </div>
  );
};

export default CashFlowForecastWidget;