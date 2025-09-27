import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Investment, InvestmentStatus } from '../types/investment';
import './RiskAnalysisWidget.css';

interface RiskAnalysisWidgetProps {
  investments: Investment[];
  onRiskSettingsChange?: (settings: RiskSettings) => void;
}

interface RiskSettings {
  riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive';
  maxConcentration: number;
  rebalanceThreshold: number;
}

interface RiskAnalysis {
  concentrationRisk: number;
  sectorConcentration: { [sector: string]: number };
  geographicConcentration: { [region: string]: number };
  vintageConcentration: { [vintage: string]: number };
  singleInvestmentRisk: number;
  portfolioVaR: number;
  expectedShortfall: number;
  diversificationRatio: number;
}

interface StressTestResult {
  scenario: string;
  impactPercentage: number;
  estimatedLoss: number;
  description: string;
  severity: 'Low' | 'Medium' | 'High';
}

const RiskAnalysisWidget: React.FC<RiskAnalysisWidgetProps> = ({
  investments,
  onRiskSettingsChange
}) => {
  const [viewMode, setViewMode] = useState<'overview' | 'concentration' | 'stress-test'>('overview');
  const [riskSettings, setRiskSettings] = useState<RiskSettings>({
    riskTolerance: 'Moderate',
    maxConcentration: 25,
    rebalanceThreshold: 5
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

  const generateAnalysis = useCallback((): RiskAnalysis => {
    const activeInvestments = investments.filter(
      inv => inv.status === InvestmentStatus.ACTIVE
    );

    if (activeInvestments.length === 0) {
      return {
        concentrationRisk: 0,
        sectorConcentration: {},
        geographicConcentration: {},
        vintageConcentration: {},
        singleInvestmentRisk: 0,
        portfolioVaR: 0,
        expectedShortfall: 0,
        diversificationRatio: 0
      };
    }

    const totalValue = activeInvestments.reduce((sum, inv) => sum + getCurrentValue(inv), 0);

    // Sector concentration
    const sectorConcentration = activeInvestments.reduce((acc, inv) => {
      const sector = inv.asset_class || 'Unknown';
      acc[sector] = (acc[sector] || 0) + getCurrentValue(inv);
      return acc;
    }, {} as { [sector: string]: number });

    Object.keys(sectorConcentration).forEach(sector => {
      sectorConcentration[sector] = (sectorConcentration[sector] / totalValue) * 100;
    });

    // Geographic concentration (using fund domicile or entity geography as proxy)
    const geographicConcentration = activeInvestments.reduce((acc, inv) => {
      const region = inv.fund_domicile ||
                    (inv.entity?.name?.includes('Europe') ? 'Europe' :
                     inv.entity?.name?.includes('Asia') ? 'Asia' :
                     inv.entity?.name?.includes('Americas') ? 'Americas' : 'North America');
      acc[region] = (acc[region] || 0) + getCurrentValue(inv);
      return acc;
    }, {} as { [region: string]: number });

    Object.keys(geographicConcentration).forEach(region => {
      geographicConcentration[region] = (geographicConcentration[region] / totalValue) * 100;
    });

    // Vintage year concentration
    const vintageConcentration = activeInvestments.reduce((acc, inv) => {
      const vintage = inv.vintage_year ? inv.vintage_year.toString() : 'Unknown';
      acc[vintage] = (acc[vintage] || 0) + getCurrentValue(inv);
      return acc;
    }, {} as { [vintage: string]: number });

    Object.keys(vintageConcentration).forEach(vintage => {
      vintageConcentration[vintage] = (vintageConcentration[vintage] / totalValue) * 100;
    });

    // Concentration risk (Herfindahl index)
    const sectorWeights = Object.values(sectorConcentration).map((val: number) => val / 100);
    const concentrationRisk = sectorWeights.reduce((sum, weight) => sum + weight * weight, 0) * 100;

    // Single investment risk (largest position as % of portfolio)
    const singleInvestmentRisk = Math.max(...activeInvestments.map(inv =>
      (getCurrentValue(inv) / totalValue) * 100
    ));

    // Simplified VaR calculation (5% VaR over 1 year)
    const portfolioVaR = totalValue * 0.15; // Simplified 15% downside assumption

    // Expected shortfall (average loss beyond VaR)
    const expectedShortfall = portfolioVaR * 1.3;

    // Diversification ratio (simplified)
    const diversificationRatio = activeInvestments.length / Math.sqrt(activeInvestments.length);

    return {
      concentrationRisk,
      sectorConcentration,
      geographicConcentration,
      vintageConcentration,
      singleInvestmentRisk,
      portfolioVaR,
      expectedShortfall,
      diversificationRatio
    };
  }, [investments]);

  const riskAnalysis = useMemo(() => generateAnalysis(), [generateAnalysis]);

  // Generate stress test results
  const stressTestResults = useMemo((): StressTestResult[] => {
    const totalValue = investments.reduce((sum, inv) => sum + getCurrentValue(inv), 0);

    return [
      {
        scenario: 'Market Downturn (2008-style)',
        impactPercentage: -35,
        estimatedLoss: totalValue * 0.35,
        description: 'Severe equity market decline similar to 2008 financial crisis',
        severity: 'High' as const
      },
      {
        scenario: 'Interest Rate Shock',
        impactPercentage: -15,
        estimatedLoss: totalValue * 0.15,
        description: 'Rapid increase in interest rates affecting valuations',
        severity: 'Medium' as const
      },
      {
        scenario: 'Liquidity Crisis',
        impactPercentage: -25,
        estimatedLoss: totalValue * 0.25,
        description: 'Reduced access to capital markets and forced selling',
        severity: 'High' as const
      },
      {
        scenario: 'Sector-Specific Shock',
        impactPercentage: -20,
        estimatedLoss: totalValue * 0.20,
        description: 'Industry-specific disruption affecting key holdings',
        severity: 'Medium' as const
      },
      {
        scenario: 'Currency Devaluation',
        impactPercentage: -10,
        estimatedLoss: totalValue * 0.10,
        description: 'Foreign exchange impact on international investments',
        severity: 'Low' as const
      }
    ];
  }, [investments]);

  const handleRiskSettingsChange = useCallback((newSettings: Partial<RiskSettings>) => {
    const updatedSettings = { ...riskSettings, ...newSettings };
    setRiskSettings(updatedSettings);
    onRiskSettingsChange?.(updatedSettings);
  }, [riskSettings, onRiskSettingsChange]);

  useEffect(() => {
    onRiskSettingsChange?.(riskSettings);
  }, [riskSettings, onRiskSettingsChange]);

  const getRiskLevel = (value: number, thresholds: { low: number; medium: number }): string => {
    if (value <= thresholds.low) return 'Low';
    if (value <= thresholds.medium) return 'Medium';
    return 'High';
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const renderOverview = () => (
    <div className="risk-overview">
      <div className="risk-metrics-grid">
        <div className="metric-card">
          <h4>Concentration Risk</h4>
          <div className={`metric-value ${getRiskLevel(riskAnalysis.concentrationRisk, { low: 15, medium: 25 }).toLowerCase()}`}>
            {formatPercentage(riskAnalysis.concentrationRisk)}
          </div>
          <p>Herfindahl index of asset concentration</p>
        </div>

        <div className="metric-card">
          <h4>Single Investment Risk</h4>
          <div className={`metric-value ${getRiskLevel(riskAnalysis.singleInvestmentRisk, { low: 10, medium: 20 }).toLowerCase()}`}>
            {formatPercentage(riskAnalysis.singleInvestmentRisk)}
          </div>
          <p>Largest single position</p>
        </div>

        <div className="metric-card">
          <h4>Portfolio VaR (1Y, 95%)</h4>
          <div className="metric-value">
            {formatCurrency(riskAnalysis.portfolioVaR)}
          </div>
          <p>Value at Risk over 1 year</p>
        </div>

        <div className="metric-card">
          <h4>Diversification Ratio</h4>
          <div className={`metric-value ${getRiskLevel(5 - riskAnalysis.diversificationRatio, { low: 1, medium: 2 }).toLowerCase()}`}>
            {riskAnalysis.diversificationRatio.toFixed(2)}
          </div>
          <p>Portfolio diversification effectiveness</p>
        </div>
      </div>

      <div className="risk-settings">
        <h3>Risk Management Settings</h3>
        <div className="settings-grid">
          <div className="setting-item">
            <label>Risk Tolerance</label>
            <select
              value={riskSettings.riskTolerance}
              onChange={(e) => handleRiskSettingsChange({ riskTolerance: e.target.value as any })}
            >
              <option value="Conservative">Conservative</option>
              <option value="Moderate">Moderate</option>
              <option value="Aggressive">Aggressive</option>
            </select>
          </div>

          <div className="setting-item">
            <label>Max Concentration (%)</label>
            <input
              type="number"
              value={riskSettings.maxConcentration}
              onChange={(e) => handleRiskSettingsChange({ maxConcentration: Number(e.target.value) })}
              min="5"
              max="50"
            />
          </div>

          <div className="setting-item">
            <label>Rebalance Threshold (%)</label>
            <input
              type="number"
              value={riskSettings.rebalanceThreshold}
              onChange={(e) => handleRiskSettingsChange({ rebalanceThreshold: Number(e.target.value) })}
              min="1"
              max="20"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderConcentration = () => (
    <div className="concentration-analysis">
      <div className="concentration-charts">
        <div className="chart-section">
          <h4>Sector Concentration</h4>
          <div className="concentration-bars">
            {Object.entries(riskAnalysis.sectorConcentration).map(([sector, percentage]) => (
              <div key={sector} className="concentration-bar">
                <div className="bar-label">{sector}</div>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: percentage > riskSettings.maxConcentration ? '#dc3545' : '#28a745'
                    }}
                  />
                  <span className="bar-value">{formatPercentage(percentage)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-section">
          <h4>Geographic Concentration</h4>
          <div className="concentration-bars">
            {Object.entries(riskAnalysis.geographicConcentration).map(([region, percentage]) => (
              <div key={region} className="concentration-bar">
                <div className="bar-label">{region}</div>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: percentage > riskSettings.maxConcentration ? '#dc3545' : '#007bff'
                    }}
                  />
                  <span className="bar-value">{formatPercentage(percentage)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-section">
          <h4>Vintage Year Concentration</h4>
          <div className="concentration-bars">
            {Object.entries(riskAnalysis.vintageConcentration).map(([vintage, percentage]) => (
              <div key={vintage} className="concentration-bar">
                <div className="bar-label">{vintage}</div>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: percentage > riskSettings.maxConcentration ? '#dc3545' : '#ffc107'
                    }}
                  />
                  <span className="bar-value">{formatPercentage(percentage)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStressTest = () => (
    <div className="stress-test-analysis">
      <h3>Stress Test Scenarios</h3>
      <div className="stress-test-results">
        {stressTestResults.map((result, index) => (
          <div key={index} className={`stress-test-card ${result.severity.toLowerCase()}`}>
            <div className="scenario-header">
              <h4>{result.scenario}</h4>
              <div className={`severity-badge ${result.severity.toLowerCase()}`}>
                {result.severity}
              </div>
            </div>
            <div className="scenario-metrics">
              <div className="metric">
                <span className="metric-label">Impact:</span>
                <span className="metric-value">{formatPercentage(Math.abs(result.impactPercentage))}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Estimated Loss:</span>
                <span className="metric-value">{formatCurrency(result.estimatedLoss)}</span>
              </div>
            </div>
            <p className="scenario-description">{result.description}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="risk-analysis-widget">
      <div className="widget-header">
        <h2>Risk Analysis</h2>
        <div className="view-mode-selector">
          <button
            className={viewMode === 'overview' ? 'active' : ''}
            onClick={() => setViewMode('overview')}
          >
            Overview
          </button>
          <button
            className={viewMode === 'concentration' ? 'active' : ''}
            onClick={() => setViewMode('concentration')}
          >
            Concentration
          </button>
          <button
            className={viewMode === 'stress-test' ? 'active' : ''}
            onClick={() => setViewMode('stress-test')}
          >
            Stress Tests
          </button>
        </div>
      </div>

      <div className="widget-content">
        {viewMode === 'overview' && renderOverview()}
        {viewMode === 'concentration' && renderConcentration()}
        {viewMode === 'stress-test' && renderStressTest()}
      </div>
    </div>
  );
};

export default RiskAnalysisWidget;