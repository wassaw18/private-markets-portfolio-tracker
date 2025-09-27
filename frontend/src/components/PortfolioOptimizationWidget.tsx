import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Investment, InvestmentStatus } from '../types/investment';
import './PortfolioOptimizationWidget.css';

interface PortfolioOptimizationWidgetProps {
  investments: Investment[];
  onOptimizationChange?: (optimization: OptimizationRecommendations) => void;
}

interface OptimizationSettings {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  liquidityRequirement: number; // Percentage of portfolio
  timeHorizon: number; // Years
  targetReturn: number; // Percentage
  rebalancingFrequency: 'quarterly' | 'semi-annual' | 'annual';
}

interface AssetAllocation {
  assetClass: string;
  current: number;
  recommended: number;
  difference: number;
  reasoning: string;
}

interface OptimizationRecommendations {
  expectedReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
  assetAllocations: AssetAllocation[];
  rebalancingActions: RebalancingAction[];
  strategicInsights: string[];
  riskWarnings: string[];
}

interface RebalancingAction {
  type: 'increase' | 'decrease' | 'add' | 'exit';
  assetClass: string;
  amount: number;
  priority: 'high' | 'medium' | 'low';
  timeline: string;
  reasoning: string;
}

const PortfolioOptimizationWidget: React.FC<PortfolioOptimizationWidgetProps> = ({
  investments,
  onOptimizationChange
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'allocation' | 'rebalancing' | 'settings'>('overview');
  const [optimizationSettings, setOptimizationSettings] = useState<OptimizationSettings>({
    riskTolerance: 'moderate',
    liquidityRequirement: 15,
    timeHorizon: 7,
    targetReturn: 12,
    rebalancingFrequency: 'semi-annual'
  });

  // Calculate portfolio optimization recommendations
  const optimizationRecommendations = useMemo((): OptimizationRecommendations => {
    const activeInvestments = investments.filter(inv => inv.status === InvestmentStatus.ACTIVE);

    if (activeInvestments.length === 0) {
      return {
        expectedReturn: 0,
        expectedRisk: 0,
        sharpeRatio: 0,
        assetAllocations: [],
        rebalancingActions: [],
        strategicInsights: [],
        riskWarnings: []
      };
    }

    // Helper function for current value
    const getCurrentValue = (investment: Investment): number => {
      if (investment.valuations && investment.valuations.length > 0) {
        const latestValuation = investment.valuations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return latestValuation.nav_value || 0;
      }
      return 0;
    };

    const totalValue = activeInvestments.reduce((sum, inv) => sum + getCurrentValue(inv), 0);

    // Current asset allocation
    const currentAllocation = activeInvestments.reduce((acc, inv) => {
      const assetClass = inv.asset_class || 'Other';
      acc[assetClass] = (acc[assetClass] || 0) + getCurrentValue(inv);
      return acc;
    }, {} as { [key: string]: number });

    // Optimal allocation based on risk tolerance
    const getOptimalAllocation = (): { [key: string]: number } => {
      switch (optimizationSettings.riskTolerance) {
        case 'conservative':
          return {
            'Private Equity': 35,
            'Real Estate': 25,
            'Private Credit': 20,
            'Infrastructure': 15,
            'Hedge Funds': 5
          };
        case 'moderate':
          return {
            'Private Equity': 45,
            'Real Estate': 20,
            'Private Credit': 15,
            'Infrastructure': 10,
            'Venture Capital': 10
          };
        case 'aggressive':
          return {
            'Private Equity': 50,
            'Venture Capital': 25,
            'Growth Equity': 15,
            'Real Estate': 10
          };
        default:
          return {};
      }
    };

    const optimalAllocation = getOptimalAllocation();

    // Calculate asset allocation recommendations
    const assetAllocations: AssetAllocation[] = Object.keys(optimalAllocation).map(assetClass => {
      const current = ((currentAllocation[assetClass] || 0) / totalValue) * 100;
      const recommended = optimalAllocation[assetClass];
      const difference = recommended - current;

      let reasoning = '';
      if (Math.abs(difference) < 2) {
        reasoning = 'Current allocation is well-balanced';
      } else if (difference > 0) {
        reasoning = `Underweight by ${difference.toFixed(1)}%. Consider increasing exposure`;
      } else {
        reasoning = `Overweight by ${Math.abs(difference).toFixed(1)}%. Consider reducing exposure`;
      }

      return {
        assetClass,
        current,
        recommended,
        difference,
        reasoning
      };
    });

    // Add current allocations not in optimal
    Object.keys(currentAllocation).forEach(assetClass => {
      if (!optimalAllocation[assetClass]) {
        const current = ((currentAllocation[assetClass] || 0) / totalValue) * 100;
        assetAllocations.push({
          assetClass,
          current,
          recommended: 0,
          difference: -current,
          reasoning: 'Not in optimal portfolio. Consider reducing or eliminating'
        });
      }
    });

    // Generate rebalancing actions
    const rebalancingActions: RebalancingAction[] = assetAllocations
      .filter(allocation => Math.abs(allocation.difference) > 2)
      .map(allocation => ({
        type: allocation.difference > 0 ? 'increase' : 'decrease',
        assetClass: allocation.assetClass,
        amount: totalValue * (Math.abs(allocation.difference) / 100),
        priority: Math.abs(allocation.difference) > 10 ? 'high' :
                 Math.abs(allocation.difference) > 5 ? 'medium' : 'low',
        timeline: Math.abs(allocation.difference) > 10 ? '3-6 months' : '6-12 months',
        reasoning: allocation.reasoning
      }));

    // Calculate expected portfolio metrics
    const expectedReturn = optimizationSettings.riskTolerance === 'conservative' ? 10 :
                          optimizationSettings.riskTolerance === 'moderate' ? 12 : 15;
    const expectedRisk = optimizationSettings.riskTolerance === 'conservative' ? 8 :
                        optimizationSettings.riskTolerance === 'moderate' ? 12 : 18;
    const sharpeRatio = (expectedReturn - 3) / expectedRisk; // Assuming 3% risk-free rate

    // Strategic insights
    const strategicInsights = [
      'Diversification across vintage years will reduce cyclical risk',
      'Geographic diversification should be considered for global exposure',
      'ESG factors are becoming increasingly important for long-term returns',
      'Co-investment opportunities can enhance returns while reducing fees'
    ];

    // Risk warnings
    const riskWarnings = [];
    if (assetAllocations.some(a => a.current > 50)) {
      riskWarnings.push('High concentration risk detected in single asset class');
    }
    if (optimizationSettings.liquidityRequirement < 10) {
      riskWarnings.push('Low liquidity buffer may limit flexibility during market stress');
    }
    if (optimizationSettings.timeHorizon < 5) {
      riskWarnings.push('Short time horizon may not allow for full private market cycles');
    }

    return {
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      assetAllocations,
      rebalancingActions,
      strategicInsights,
      riskWarnings
    };
  }, [investments, optimizationSettings]);

  const handleSettingsChange = useCallback((newSettings: Partial<OptimizationSettings>) => {
    const updatedSettings = { ...optimizationSettings, ...newSettings };
    setOptimizationSettings(updatedSettings);
  }, [optimizationSettings]);

  useEffect(() => {
    onOptimizationChange?.(optimizationRecommendations);
  }, [optimizationRecommendations, onOptimizationChange]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getEfficiencyScore = (): { score: number; rating: string; color: string } => {
    const score = optimizationRecommendations.sharpeRatio * 50; // Scale to 0-100
    if (score > 75) return { score, rating: 'EXCELLENT', color: '#27ae60' };
    if (score > 60) return { score, rating: 'GOOD', color: '#3498db' };
    if (score > 40) return { score, rating: 'FAIR', color: '#f39c12' };
    return { score, rating: 'NEEDS IMPROVEMENT', color: '#e74c3c' };
  };

  const efficiencyScore = getEfficiencyScore();

  return (
    <div className="portfolio-optimization-widget">
      <div className="widget-header">
        <h3>Portfolio Optimization</h3>
        <div className="optimization-controls">
          <div className="efficiency-indicator">
            <span className="efficiency-label">Portfolio Efficiency</span>
            <div className={`efficiency-score ${efficiencyScore.rating.toLowerCase().replace(' ', '-')}`}>
              {efficiencyScore.score.toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      <div className="optimization-tabs">
        {['overview', 'allocation', 'rebalancing', 'settings'].map((tab) => (
          <button
            key={tab}
            className={`optimization-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="optimization-content">
        {activeTab === 'overview' && (
          <div className="optimization-overview">
            <div className="metrics-summary-grid">
              <div className="metric-card">
                <div className="metric-icon">📈</div>
                <div className="metric-details">
                  <div className="metric-value">{optimizationRecommendations.expectedReturn.toFixed(1)}%</div>
                  <div className="metric-label">Expected Return</div>
                  <div className="metric-subtitle">Annual target</div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon">⚖️</div>
                <div className="metric-details">
                  <div className="metric-value">{optimizationRecommendations.expectedRisk.toFixed(1)}%</div>
                  <div className="metric-label">Expected Risk</div>
                  <div className="metric-subtitle">Standard deviation</div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon">🎯</div>
                <div className="metric-details">
                  <div className="metric-value">{optimizationRecommendations.sharpeRatio.toFixed(2)}</div>
                  <div className="metric-label">Sharpe Ratio</div>
                  <div className="metric-subtitle">Risk-adjusted return</div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon">🔄</div>
                <div className="metric-details">
                  <div className="metric-value">{optimizationRecommendations.rebalancingActions.length}</div>
                  <div className="metric-label">Rebalancing Actions</div>
                  <div className="metric-subtitle">Recommended changes</div>
                </div>
              </div>
            </div>

            <div className="insights-section">
              <div className="strategic-insights">
                <h4>Strategic Insights</h4>
                <div className="insights-list">
                  {optimizationRecommendations.strategicInsights.map((insight, index) => (
                    <div key={index} className="insight-item">
                      <span className="insight-icon">💡</span>
                      <span className="insight-text">{insight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {optimizationRecommendations.riskWarnings.length > 0 && (
                <div className="risk-warnings">
                  <h4>Risk Warnings</h4>
                  <div className="warnings-list">
                    {optimizationRecommendations.riskWarnings.map((warning, index) => (
                      <div key={index} className="warning-item">
                        <span className="warning-icon">⚠️</span>
                        <span className="warning-text">{warning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'allocation' && (
          <div className="allocation-optimization">
            <div className="allocation-comparison">
              <h4>Current vs Optimal Allocation</h4>
              <div className="allocation-chart">
                {optimizationRecommendations.assetAllocations.map((allocation, index) => (
                  <div key={index} className="allocation-row">
                    <div className="asset-class-name">{allocation.assetClass}</div>
                    <div className="allocation-bars">
                      <div className="allocation-bar current">
                        <div className="bar-label">Current</div>
                        <div className="bar-visual">
                          <div
                            className="bar-fill current"
                            style={{ width: `${Math.min(allocation.current, 100)}%` }}
                          ></div>
                          <span className="bar-value">{allocation.current.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="allocation-bar recommended">
                        <div className="bar-label">Optimal</div>
                        <div className="bar-visual">
                          <div
                            className="bar-fill recommended"
                            style={{ width: `${Math.min(allocation.recommended, 100)}%` }}
                          ></div>
                          <span className="bar-value">{allocation.recommended.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className={`allocation-difference ${allocation.difference > 0 ? 'underweight' : 'overweight'}`}>
                      {allocation.difference > 0 ? '+' : ''}{allocation.difference.toFixed(1)}%
                    </div>
                    <div className="allocation-reasoning">{allocation.reasoning}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rebalancing' && (
          <div className="rebalancing-plan">
            <div className="rebalancing-actions">
              <h4>Recommended Rebalancing Actions</h4>
              <div className="actions-list">
                {optimizationRecommendations.rebalancingActions.map((action, index) => (
                  <div key={index} className={`action-card priority-${action.priority}`}>
                    <div className="action-header">
                      <div className="action-type">
                        <span className={`type-icon ${action.type}`}>
                          {action.type === 'increase' ? '⬆️' :
                           action.type === 'decrease' ? '⬇️' :
                           action.type === 'add' ? '➕' : '❌'}
                        </span>
                        <span className="type-text">{action.type.toUpperCase()}</span>
                      </div>
                      <div className={`priority-badge ${action.priority}`}>
                        {action.priority.toUpperCase()}
                      </div>
                    </div>
                    <div className="action-details">
                      <h5>{action.assetClass}</h5>
                      <div className="action-amount">{formatCurrency(action.amount)}</div>
                      <div className="action-timeline">Timeline: {action.timeline}</div>
                      <div className="action-reasoning">{action.reasoning}</div>
                    </div>
                    <div className="action-controls">
                      <button className="action-button implement">Implement</button>
                      <button className="action-button schedule">Schedule</button>
                      <button className="action-button dismiss">Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>

              {optimizationRecommendations.rebalancingActions.length === 0 && (
                <div className="no-actions">
                  <span className="no-actions-icon">✅</span>
                  <span className="no-actions-text">Portfolio is well-balanced. No rebalancing actions needed.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="optimization-settings">
            <div className="settings-grid">
              <div className="setting-group">
                <label>Risk Tolerance</label>
                <select
                  value={optimizationSettings.riskTolerance}
                  onChange={(e) => handleSettingsChange({
                    riskTolerance: e.target.value as 'conservative' | 'moderate' | 'aggressive'
                  })}
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Liquidity Requirement (%)</label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={optimizationSettings.liquidityRequirement}
                  onChange={(e) => handleSettingsChange({
                    liquidityRequirement: parseInt(e.target.value)
                  })}
                />
                <span className="setting-value">{optimizationSettings.liquidityRequirement}%</span>
              </div>

              <div className="setting-group">
                <label>Time Horizon (years)</label>
                <input
                  type="range"
                  min="3"
                  max="15"
                  value={optimizationSettings.timeHorizon}
                  onChange={(e) => handleSettingsChange({
                    timeHorizon: parseInt(e.target.value)
                  })}
                />
                <span className="setting-value">{optimizationSettings.timeHorizon} years</span>
              </div>

              <div className="setting-group">
                <label>Target Return (%)</label>
                <input
                  type="range"
                  min="6"
                  max="20"
                  value={optimizationSettings.targetReturn}
                  onChange={(e) => handleSettingsChange({
                    targetReturn: parseInt(e.target.value)
                  })}
                />
                <span className="setting-value">{optimizationSettings.targetReturn}%</span>
              </div>

              <div className="setting-group">
                <label>Rebalancing Frequency</label>
                <select
                  value={optimizationSettings.rebalancingFrequency}
                  onChange={(e) => handleSettingsChange({
                    rebalancingFrequency: e.target.value as 'quarterly' | 'semi-annual' | 'annual'
                  })}
                >
                  <option value="quarterly">Quarterly</option>
                  <option value="semi-annual">Semi-Annual</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>

            <div className="advanced-settings">
              <h4>Advanced Settings</h4>
              <div className="advanced-options">
                <label className="checkbox-option">
                  <input type="checkbox" defaultChecked />
                  <span>Consider ESG factors in optimization</span>
                </label>
                <label className="checkbox-option">
                  <input type="checkbox" defaultChecked />
                  <span>Include co-investment opportunities</span>
                </label>
                <label className="checkbox-option">
                  <input type="checkbox" />
                  <span>Factor in tax implications</span>
                </label>
                <label className="checkbox-option">
                  <input type="checkbox" />
                  <span>Consider currency hedging for international investments</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioOptimizationWidget;