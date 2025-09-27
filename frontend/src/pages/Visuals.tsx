import React, { useState, useEffect } from 'react';
import { DashboardSummaryStats, Investment, PerformanceMetrics } from '../types/investment';
import { dashboardAPI, investmentAPI, performanceAPI } from '../services/api';
import CommitmentVsCalledChart from '../components/CommitmentVsCalledChart';
import AssetAllocationChart from '../components/AssetAllocationChart';
import VintageAllocationChart from '../components/VintageAllocationChart';
import OwnershipVisualizationChart from '../components/OwnershipVisualizationChart';
import PortfolioTimelineChart from '../components/PortfolioTimelineChart';
import JCurveChart from '../components/JCurveChart';
import PortfolioForecastPanel from '../components/PortfolioForecastPanel';
import PerformanceBenchmarkingWidget from '../components/PerformanceBenchmarkingWidget';
// import RiskAnalysisWidget from '../components/RiskAnalysisWidget';
// import PortfolioOptimizationWidget from '../components/PortfolioOptimizationWidget';
// import CashFlowForecastWidget from '../components/CashFlowForecastWidget';
// import ComprehensiveReportingWidget from '../components/ComprehensiveReportingWidget';
import './Visuals.css';

const Visuals: React.FC = () => {
  const [summaryStats, setSummaryStats] = useState<DashboardSummaryStats | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [performanceData, setPerformanceData] = useState<Map<number, PerformanceMetrics>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'performance' | 'risk' | 'allocation' | 'trends'>('performance');
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['sp500', 'cambridge_pe']);

  const fetchComprehensiveData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [stats, investmentData] = await Promise.all([
        dashboardAPI.getSummaryStats(),
        investmentAPI.getInvestments(0, 1000)
      ]);

      setSummaryStats(stats);
      setInvestments(investmentData);

      // Fetch performance data for all investments
      const performanceMap = new Map<number, PerformanceMetrics>();
      const performancePromises = investmentData.map(async (investment) => {
        try {
          const result = await performanceAPI.getInvestmentPerformance(investment.id);
          return { id: investment.id, performance: result.performance };
        } catch (error) {
          console.warn(`Failed to fetch performance for investment ${investment.id}:`, error);
          return { id: investment.id, performance: null };
        }
      });

      const performanceResults = await Promise.all(performancePromises);
      performanceResults.forEach(result => {
        if (result.performance) {
          performanceMap.set(result.id, result.performance);
        }
      });

      setPerformanceData(performanceMap);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error fetching comprehensive data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComprehensiveData();
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

  // Advanced Analytics Calculations
  const advancedAnalytics = React.useMemo(() => {
    if (!investments.length || !performanceData.size) return null;

    // Performance Analytics
    let totalTVPI = 0;
    let totalIRR = 0;
    let performanceCount = 0;
    let totalCurrentNAV = 0;
    let totalDistributions = 0;
    let totalContributions = 0;

    const performanceByAssetClass = new Map<string, { tvpi: number[], irr: number[], count: number }>();
    const performanceByVintage = new Map<number, { tvpi: number[], irr: number[], count: number }>();

    performanceData.forEach((performance, investmentId) => {
      const investment = investments.find(inv => inv.id === investmentId);
      if (!investment) return;

      if (performance.tvpi) {
        totalTVPI += performance.tvpi;
        performanceCount++;

        // By Asset Class
        const assetClass = investment.asset_class;
        if (!performanceByAssetClass.has(assetClass)) {
          performanceByAssetClass.set(assetClass, { tvpi: [], irr: [], count: 0 });
        }
        performanceByAssetClass.get(assetClass)!.tvpi.push(performance.tvpi);
        performanceByAssetClass.get(assetClass)!.count++;

        // By Vintage
        if (investment.vintage_year) {
          if (!performanceByVintage.has(investment.vintage_year)) {
            performanceByVintage.set(investment.vintage_year, { tvpi: [], irr: [], count: 0 });
          }
          performanceByVintage.get(investment.vintage_year)!.tvpi.push(performance.tvpi);
          performanceByVintage.get(investment.vintage_year)!.count++;
        }
      }

      if (performance.irr) {
        totalIRR += performance.irr;
        performanceByAssetClass.get(investment.asset_class)?.irr.push(performance.irr);
        if (investment.vintage_year) {
          performanceByVintage.get(investment.vintage_year)?.irr.push(performance.irr);
        }
      }

      totalCurrentNAV += performance.current_nav || 0;
      totalDistributions += performance.total_distributions || 0;
      totalContributions += performance.total_contributions || 0;
    });

    // Risk Analytics
    const assetClassConcentration = new Map<string, number>();
    const totalCommitment = investments.reduce((sum, inv) => sum + (inv.commitment_amount || 0), 0);

    investments.forEach(inv => {
      const assetClass = inv.asset_class;
      const commitment = inv.commitment_amount || 0;
      assetClassConcentration.set(assetClass, (assetClassConcentration.get(assetClass) || 0) + commitment);
    });

    // Calculate concentration risk (Herfindahl index)
    let herfindahlIndex = 0;
    assetClassConcentration.forEach(commitment => {
      const marketShare = commitment / totalCommitment;
      herfindahlIndex += marketShare * marketShare;
    });

    // Vintage concentration
    const vintageConcentration = new Map<number, number>();
    investments.forEach(inv => {
      if (inv.vintage_year) {
        const commitment = inv.commitment_amount || 0;
        vintageConcentration.set(inv.vintage_year, (vintageConcentration.get(inv.vintage_year) || 0) + commitment);
      }
    });

    return {
      // Performance Metrics
      averageTVPI: performanceCount > 0 ? totalTVPI / performanceCount : 0,
      averageIRR: performanceCount > 0 ? totalIRR / performanceCount : 0,
      totalValue: totalCurrentNAV + totalDistributions,
      realizationRate: totalContributions > 0 ? totalDistributions / totalContributions : 0,
      performanceByAssetClass: Array.from(performanceByAssetClass.entries()).map(([assetClass, data]) => ({
        assetClass,
        averageTVPI: data.tvpi.reduce((sum, val) => sum + val, 0) / data.count,
        averageIRR: data.irr.reduce((sum, val) => sum + val, 0) / data.irr.length,
        count: data.count
      })),
      performanceByVintage: Array.from(performanceByVintage.entries()).sort((a, b) => a[0] - b[0]).map(([vintage, data]) => ({
        vintage,
        averageTVPI: data.tvpi.reduce((sum, val) => sum + val, 0) / data.count,
        averageIRR: data.irr.reduce((sum, val) => sum + val, 0) / data.irr.length,
        count: data.count
      })),

      // Risk Metrics
      concentrationRisk: herfindahlIndex,
      riskRating: herfindahlIndex > 0.25 ? 'High' : herfindahlIndex > 0.15 ? 'Medium' : 'Low',
      assetClassConcentration: Array.from(assetClassConcentration.entries()).sort((a, b) => b[1] - a[1]),
      vintageSpread: vintageConcentration.size,
      oldestVintage: Math.min(...Array.from(vintageConcentration.keys())),
      newestVintage: Math.max(...Array.from(vintageConcentration.keys())),

      // Allocation Metrics
      topAssetClass: Array.from(assetClassConcentration.entries()).sort((a, b) => b[1] - a[1])[0],
      deploymentRate: totalCommitment > 0 ? (totalContributions / totalCommitment) : 0,
      diversificationScore: assetClassConcentration.size * vintageConcentration.size,

      // Trend Metrics
      recentVintages: Array.from(vintageConcentration.entries())
        .filter(([vintage, _]) => vintage >= new Date().getFullYear() - 3)
        .reduce((sum, [_, commitment]) => sum + commitment, 0),
      earlyStageExposure: investments.filter(inv => inv.vintage_year && inv.vintage_year >= new Date().getFullYear() - 2).length
    };
  }, [investments, performanceData]);

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

      {/* Primary Analysis Grid - 2x1 Layout */}
      <div className="primary-charts-grid">
        {/* Asset Class Breakdown - Compact Table View */}
        <div className="chart-section compact-table">
          <div className="chart-container">
            <AssetAllocationChart />
          </div>
        </div>

        {/* Commitment vs Called - Pie Chart */}
        <div className="chart-section pie-chart">
          <div className="chart-container">
            <CommitmentVsCalledChart />
          </div>
        </div>
      </div>

      {/* Full Width Vintage Chart */}
      <div className="full-width-chart">
        <div className="chart-section">
          <div className="chart-container">
            <VintageAllocationChart />
          </div>
        </div>
      </div>

      {/* Additional Charts Grid */}
      <div className="charts-grid">

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

      {/* Advanced Analytics Section */}
      {advancedAnalytics && (
        <div className="advanced-analytics-section">
          <div className="analytics-header">
            <h3>Advanced Portfolio Analytics</h3>
            <div className="analytics-tabs">
              <button
                className={`tab-button ${activeAnalyticsTab === 'performance' ? 'active' : ''}`}
                onClick={() => setActiveAnalyticsTab('performance')}
              >
                📊 Performance
              </button>
              <button
                className={`tab-button ${activeAnalyticsTab === 'risk' ? 'active' : ''}`}
                onClick={() => setActiveAnalyticsTab('risk')}
              >
                ⚠️ Risk
              </button>
              <button
                className={`tab-button ${activeAnalyticsTab === 'allocation' ? 'active' : ''}`}
                onClick={() => setActiveAnalyticsTab('allocation')}
              >
                🎯 Allocation
              </button>
              <button
                className={`tab-button ${activeAnalyticsTab === 'trends' ? 'active' : ''}`}
                onClick={() => setActiveAnalyticsTab('trends')}
              >
                📈 Trends
              </button>
            </div>
          </div>

          <div className="analytics-content">
            {/* Performance Tab */}
            {activeAnalyticsTab === 'performance' && (
              <div className="analytics-tab-content">
                <div className="performance-overview">
                  <div className="performance-metrics-grid">
                    <div className="performance-metric">
                      <div className="metric-icon">💎</div>
                      <div className="metric-details">
                        <div className="metric-value">{advancedAnalytics.averageTVPI.toFixed(2)}x</div>
                        <div className="metric-label">Average TVPI</div>
                        <div className="metric-description">Portfolio multiple on invested capital</div>
                      </div>
                    </div>
                    <div className="performance-metric">
                      <div className="metric-icon">📈</div>
                      <div className="metric-details">
                        <div className="metric-value">{(advancedAnalytics.averageIRR * 100).toFixed(1)}%</div>
                        <div className="metric-label">Average IRR</div>
                        <div className="metric-description">Annualized return rate</div>
                      </div>
                    </div>
                    <div className="performance-metric">
                      <div className="metric-icon">💰</div>
                      <div className="metric-details">
                        <div className="metric-value">{formatCurrencyCompact(advancedAnalytics.totalValue)}</div>
                        <div className="metric-label">Total Value</div>
                        <div className="metric-description">NAV + Distributions</div>
                      </div>
                    </div>
                    <div className="performance-metric">
                      <div className="metric-icon">🔄</div>
                      <div className="metric-details">
                        <div className="metric-value">{(advancedAnalytics.realizationRate * 100).toFixed(1)}%</div>
                        <div className="metric-label">Realization Rate</div>
                        <div className="metric-description">Capital returned to investors</div>
                      </div>
                    </div>
                  </div>

                  <div className="performance-breakdown">
                    <div className="breakdown-section">
                      <h4>Performance by Asset Class</h4>
                      <div className="performance-table">
                        {advancedAnalytics.performanceByAssetClass.map(item => (
                          <div key={item.assetClass} className="performance-row">
                            <div className="asset-class-name">{item.assetClass.replace(/_/g, ' ')}</div>
                            <div className="performance-stats">
                              <span>TVPI: {item.averageTVPI.toFixed(2)}x</span>
                              <span>IRR: {(item.averageIRR * 100).toFixed(1)}%</span>
                              <span>Count: {item.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="breakdown-section">
                      <h4>Performance by Vintage Year</h4>
                      <div className="vintage-performance-chart">
                        {advancedAnalytics.performanceByVintage.map(item => (
                          <div key={item.vintage} className="vintage-performance-bar">
                            <div className="vintage-year">{item.vintage}</div>
                            <div className="performance-bar">
                              <div
                                className="bar-fill"
                                style={{ width: `${Math.min(item.averageTVPI * 50, 100)}%` }}
                              ></div>
                            </div>
                            <div className="performance-values">
                              <span>{item.averageTVPI.toFixed(2)}x</span>
                              <span>{(item.averageIRR * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Benchmarking Widget */}
                <PerformanceBenchmarkingWidget
                  investments={investments}
                  selectedBenchmarks={selectedBenchmarks}
                  onBenchmarkChange={setSelectedBenchmarks}
                />
              </div>
            )}

            {/* Risk Tab */}
            {activeAnalyticsTab === 'risk' && (
              <div className="analytics-tab-content">
                <div className="risk-overview">
                  <div className="risk-metrics-grid">
                    <div className="risk-metric">
                      <div className="metric-icon">⚖️</div>
                      <div className="metric-details">
                        <div className="metric-value">{(advancedAnalytics.concentrationRisk * 100).toFixed(1)}%</div>
                        <div className="metric-label">Concentration Risk</div>
                        <div className={`risk-rating ${advancedAnalytics.riskRating.toLowerCase()}`}>
                          {advancedAnalytics.riskRating} Risk
                        </div>
                      </div>
                    </div>
                    <div className="risk-metric">
                      <div className="metric-icon">🎯</div>
                      <div className="metric-details">
                        <div className="metric-value">{advancedAnalytics.diversificationScore}</div>
                        <div className="metric-label">Diversification Score</div>
                        <div className="metric-description">Asset classes × Vintages</div>
                      </div>
                    </div>
                    <div className="risk-metric">
                      <div className="metric-icon">📊</div>
                      <div className="metric-details">
                        <div className="metric-value">{advancedAnalytics.vintageSpread}</div>
                        <div className="metric-label">Vintage Spread</div>
                        <div className="metric-description">{advancedAnalytics.oldestVintage}-{advancedAnalytics.newestVintage}</div>
                      </div>
                    </div>
                    <div className="risk-metric">
                      <div className="metric-icon">🏢</div>
                      <div className="metric-details">
                        <div className="metric-value">{advancedAnalytics.topAssetClass?.[0]?.replace(/_/g, ' ') || 'N/A'}</div>
                        <div className="metric-label">Largest Exposure</div>
                        <div className="metric-description">
                          {advancedAnalytics.topAssetClass ? formatCurrencyCompact(advancedAnalytics.topAssetClass[1]) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="risk-analysis">
                    <div className="risk-section">
                      <h4>Asset Class Concentration</h4>
                      <div className="concentration-bars">
                        {advancedAnalytics.assetClassConcentration.map(([assetClass, commitment]) => {
                          const percentage = (commitment / summaryStats!.total_commitment) * 100;
                          return (
                            <div key={assetClass} className="concentration-bar">
                              <div className="concentration-label">
                                <span>{assetClass.replace(/_/g, ' ')}</span>
                                <span>{percentage.toFixed(1)}%</span>
                              </div>
                              <div className="concentration-visual">
                                <div
                                  className="bar-fill"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Risk Analysis Widget - Temporarily disabled for compilation */}
                  {/* <RiskAnalysisWidget
                    investments={investments}
                    onRiskSettingsChange={(settings) => console.log('Risk settings changed:', settings)}
                  /> */}
                </div>
              </div>
            )}

            {/* Allocation Tab */}
            {activeAnalyticsTab === 'allocation' && (
              <div className="analytics-tab-content">
                <div className="allocation-overview">
                  <div className="allocation-metrics-grid">
                    <div className="allocation-metric">
                      <div className="metric-icon">🚀</div>
                      <div className="metric-details">
                        <div className="metric-value">{(advancedAnalytics.deploymentRate * 100).toFixed(1)}%</div>
                        <div className="metric-label">Capital Deployed</div>
                        <div className="metric-description">Of total commitments</div>
                      </div>
                    </div>
                    <div className="allocation-metric">
                      <div className="metric-icon">🏆</div>
                      <div className="metric-details">
                        <div className="metric-value">{summaryStats.asset_classes}</div>
                        <div className="metric-label">Asset Classes</div>
                        <div className="metric-description">Portfolio breadth</div>
                      </div>
                    </div>
                    <div className="allocation-metric">
                      <div className="metric-icon">⏰</div>
                      <div className="metric-details">
                        <div className="metric-value">{formatCurrencyCompact(advancedAnalytics.recentVintages)}</div>
                        <div className="metric-label">Recent Vintages</div>
                        <div className="metric-description">Last 3 years</div>
                      </div>
                    </div>
                    <div className="allocation-metric">
                      <div className="metric-icon">🌱</div>
                      <div className="metric-details">
                        <div className="metric-value">{advancedAnalytics.earlyStageExposure}</div>
                        <div className="metric-label">Early Stage</div>
                        <div className="metric-description">Recent investments</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trends Tab */}
            {activeAnalyticsTab === 'trends' && (
              <div className="analytics-tab-content">
                <div className="trends-overview">
                  <div className="trend-cards">
                    <div className="trend-card">
                      <h4>Investment Pacing</h4>
                      <div className="trend-visual">
                        <div className="pacing-indicator">
                          <span className="pacing-rate">{(advancedAnalytics.deploymentRate * 100).toFixed(1)}%</span>
                          <span className="pacing-label">Deployed</span>
                        </div>
                        <div className="pacing-breakdown">
                          <div>Recent Activity: {formatCurrencyCompact(advancedAnalytics.recentVintages)}</div>
                          <div>Early Stage: {advancedAnalytics.earlyStageExposure} investments</div>
                        </div>
                      </div>
                    </div>

                    <div className="trend-card">
                      <h4>Vintage Diversification</h4>
                      <div className="trend-visual">
                        <div className="vintage-timeline">
                          <span>{advancedAnalytics.oldestVintage}</span>
                          <div className="timeline-bar"></div>
                          <span>{advancedAnalytics.newestVintage}</span>
                        </div>
                        <div className="vintage-stats">
                          <div>Span: {advancedAnalytics.newestVintage - advancedAnalytics.oldestVintage} years</div>
                          <div>Vintages: {advancedAnalytics.vintageSpread}</div>
                        </div>
                      </div>
                    </div>

                    <div className="trend-card">
                      <h4>Performance Trends</h4>
                      <div className="trend-visual">
                        <div className="performance-trends">
                          <div className="trend-stat">
                            <span>Average TVPI</span>
                            <span className="trend-value">{advancedAnalytics.averageTVPI.toFixed(2)}x</span>
                          </div>
                          <div className="trend-stat">
                            <span>Average IRR</span>
                            <span className="trend-value">{(advancedAnalytics.averageIRR * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Portfolio Cash Flow Forecast */}
      <PortfolioForecastPanel />

      {/* Advanced Portfolio Management Widgets - Temporarily disabled for compilation */}
      {/* <div className="advanced-widgets-section">
        <PortfolioOptimizationWidget
          investments={investments}
          onOptimizationChange={(optimization) => console.log('Optimization updated:', optimization)}
        />

        <CashFlowForecastWidget
          investments={investments}
          onForecastChange={(forecast) => console.log('Forecast updated:', forecast)}
        />

        <ComprehensiveReportingWidget
          investments={investments}
          onReportGenerated={(report) => console.log('Report generated:', report)}
        />
      </div> */}
    </div>
  );
};

export default Visuals;