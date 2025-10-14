import React, { useState, useEffect } from 'react';
import { InvestmentPerformance, Investment } from '../types/investment';
import { performanceAPI, pitchBookAPI, PitchBookIRRData, PitchBookQuantilesData, investmentAPI } from '../services/api';
import './PerformanceMetrics.css';

interface Props {
  investmentId: number;
  onUpdate?: () => void; // Called when performance should be recalculated
  onStatusClick?: () => void; // Called when status button is clicked
}

const PerformanceMetrics: React.FC<Props> = ({ investmentId, onUpdate, onStatusClick }) => {
  const [performance, setPerformance] = useState<InvestmentPerformance | null>(null);
  const [investment, setInvestment] = useState<Investment | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<PitchBookIRRData[]>([]);
  const [quantilesData, setQuantilesData] = useState<PitchBookQuantilesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both performance and investment details
      const [performanceData, investmentData] = await Promise.all([
        performanceAPI.getInvestmentPerformance(investmentId),
        investmentAPI.getInvestment(investmentId)
      ]);

      setPerformance(performanceData);
      setInvestment(investmentData);

      // Fetch benchmark data if we have asset class
      if (investmentData.asset_class) {
        try {
          const mappedAssetClass = mapAssetClassToPitchBook(investmentData.asset_class);
          console.log('Fetching benchmark data for:', {
            original: investmentData.asset_class,
            mapped: mappedAssetClass,
            vintage_year: investmentData.vintage_year
          });

          // Fetch both IRR and quantiles data in parallel
          const [benchmarkResponse, quantilesResponse] = await Promise.all([
            pitchBookAPI.getIRRData({
              asset_class: mappedAssetClass,
              vintage_year: investmentData.vintage_year
            }),
            pitchBookAPI.getQuantilesData({
              asset_class: mappedAssetClass,
              vintage_year: investmentData.vintage_year
            })
          ]);

          setBenchmarkData(benchmarkResponse);
          setQuantilesData(quantilesResponse);

          console.log('Received benchmark data:', benchmarkResponse);
          console.log('Received quantiles data:', quantilesResponse);
        } catch (benchErr) {
          console.warn('Failed to fetch benchmark data:', benchErr);
        }
      }
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

  const getBenchmarkComparison = (metricValue?: number, benchmarkValue?: number) => {
    if (metricValue == null || benchmarkValue == null) return null;
    const difference = metricValue - benchmarkValue;
    const percentDiff = (difference / benchmarkValue) * 100;
    return {
      difference,
      percentDiff,
      isOutperforming: difference > 0
    };
  };

  // Asset class mapping between internal enums and PitchBook codes
  const mapAssetClassToPitchBook = (assetClass: string): string => {
    const mapping: Record<string, string> = {
      'PRIVATE_EQUITY': 'private_equity',
      'PRIVATE_CREDIT': 'private_debt',
      'VENTURE_CAPITAL': 'venture_capital',
      'REAL_ESTATE': 'real_estate',
      'INFRASTRUCTURE': 'infrastructure',
      'NATURAL_RESOURCES': 'natural_resources',
      'HEDGE_FUNDS': 'hedge_funds'
    };

    // Handle both enum format (AssetClass.PRIVATE_CREDIT) and direct values
    const cleanAssetClass = assetClass.replace('AssetClass.', '');
    return mapping[cleanAssetClass] || assetClass.toLowerCase().replace(' ', '_');
  };

  // Display asset class names for UI
  const getDisplayAssetClass = (assetClass: string): string => {
    const displayMapping: Record<string, string> = {
      'PRIVATE_EQUITY': 'Private Equity',
      'PRIVATE_CREDIT': 'Private Debt',
      'VENTURE_CAPITAL': 'Venture Capital',
      'REAL_ESTATE': 'Real Estate',
      'INFRASTRUCTURE': 'Infrastructure',
      'NATURAL_RESOURCES': 'Natural Resources',
      'HEDGE_FUNDS': 'Hedge Funds'
    };

    // Handle both enum format (AssetClass.PRIVATE_CREDIT) and direct values
    const cleanAssetClass = assetClass.replace('AssetClass.', '');
    return displayMapping[cleanAssetClass] || assetClass.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getRelevantBenchmark = () => {
    if (!investment || !benchmarkData.length) {
      console.log('No relevant benchmark - missing investment or benchmark data:', {
        hasInvestment: !!investment,
        benchmarkDataLength: benchmarkData.length
      });
      return null;
    }

    // Find benchmark data for the investment's vintage year
    const vintageData = benchmarkData.find(b => b.vintage_year === investment.vintage_year);

    console.log('Benchmark matching result:', {
      investmentVintage: investment.vintage_year,
      investmentAssetClass: investment.asset_class,
      availableBenchmarks: benchmarkData.map(b => ({ vintage: b.vintage_year, assetClass: b.asset_class })),
      foundMatch: !!vintageData,
      matchedData: vintageData
    });

    return vintageData || null;
  };

  const getRelevantQuantiles = () => {
    if (!investment || !quantilesData.length) {
      return null;
    }
    // Find quantiles data for the investment's vintage year
    const vintageData = quantilesData.find(q => q.vintage_year === investment.vintage_year);
    return vintageData || null;
  };

  const QuartileRangeChart: React.FC<{
    title: string;
    bottomQuartile: number;
    median: number;
    topQuartile: number;
    bottomDecile?: number;
    topDecile?: number;
    currentValue: number;
    formatValue: (val: number) => string;
    unit?: string;
  }> = ({ title, bottomQuartile, median, topQuartile, bottomDecile, topDecile, currentValue, formatValue, unit = '' }) => {
    // Use deciles for scaling if available, otherwise fall back to quartiles
    const scaleMin = bottomDecile || bottomQuartile;
    const scaleMax = topDecile || topQuartile;
    const range = scaleMax - scaleMin;

    // Calculate positions (0-100%)
    const currentPosition = Math.max(0, Math.min(100, ((currentValue - scaleMin) / range) * 100));
    const medianPosition = ((median - scaleMin) / range) * 100;
    const bottomQuartilePosition = ((bottomQuartile - scaleMin) / range) * 100;
    const topQuartilePosition = ((topQuartile - scaleMin) / range) * 100;

    return (
      <div className="benchmark-item quartile-chart">
        <label>{title}</label>
        <div className="quartile-container">
          <div className="quartile-labels-top">
            <span className="quartile-label-left">{formatValue(bottomQuartile)}</span>
            <span className="quartile-label-right">{formatValue(topQuartile)}</span>
          </div>

          <div className="quartile-range-bar">
            <div className="gradient-bar">
              {/* Bottom Quartile Marker */}
              <div
                className="quartile-line bottom-quartile"
                style={{ left: `${bottomQuartilePosition}%` }}
                title={`Bottom Quartile: ${formatValue(bottomQuartile)}`}
              />

              {/* Median Line */}
              <div
                className="median-line"
                style={{ left: `${medianPosition}%` }}
                title={`Median: ${formatValue(median)}`}
              />

              {/* Top Quartile Marker */}
              <div
                className="quartile-line top-quartile"
                style={{ left: `${topQuartilePosition}%` }}
                title={`Top Quartile: ${formatValue(topQuartile)}`}
              />

              {/* Current Position Marker */}
              <div
                className="current-position"
                style={{ left: `${currentPosition}%` }}
                title={`Current: ${formatValue(currentValue)}`}
              />
            </div>
          </div>

          <div className="quartile-labels-bottom">
            <div className="scale-info">
              <small className="scale-label">
                Scale: {formatValue(scaleMin)} to {formatValue(scaleMax)}
                {(bottomDecile || topDecile) && ' (decile range)'}
              </small>
            </div>
          </div>

          <div className="current-value-display">
            <span className={`current-value ${currentValue > median ? 'above-median' : 'below-median'}`}>
              {formatValue(currentValue)} {unit}
            </span>
            <small className="performance-indicator">
              {currentValue > median ? '📈 Above Median' : '📉 Below Median'}
            </small>
          </div>
        </div>
      </div>
    );
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
          <button
            className="status-button"
            onClick={onStatusClick}
            title="Manage investment status"
          >
            <span className="status-label">Status:</span>
            <span className={`status-value status-${investment?.status?.toLowerCase() || 'active'}`}>
              {investment?.status || 'ACTIVE'}
            </span>
          </button>
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

      {/* Benchmark Comparison Section */}
      {investment && benchmarkData.length > 0 && (
        <div className="benchmark-section">
          <div className="benchmark-header">
            <h4>📊 PitchBook Benchmark Comparison</h4>
            <button
              className="toggle-benchmarks-btn"
              onClick={() => setShowBenchmarks(!showBenchmarks)}
            >
              {showBenchmarks ? '▼ Hide' : '▶ Show'} {getDisplayAssetClass(investment.asset_class)} Benchmarks
            </button>
          </div>

          {showBenchmarks && (
            <div className="benchmark-content">
              {(() => {
                const relevantBenchmark = getRelevantBenchmark();
                const currentMetrics = performance?.performance;

                if (!relevantBenchmark || !currentMetrics) {
                  return (
                    <div className="benchmark-unavailable">
                      <p>
                        No exact benchmark match for {getDisplayAssetClass(investment.asset_class)} vintage {investment.vintage_year}
                      </p>
                      {benchmarkData.length > 0 ? (
                        <small>
                          Available {getDisplayAssetClass(investment.asset_class)} vintages: {benchmarkData.map(b => b.vintage_year).sort().join(', ')}
                        </small>
                      ) : (
                        <small>
                          No benchmark data available for {getDisplayAssetClass(investment.asset_class)}
                        </small>
                      )}
                    </div>
                  );
                }

                const relevantQuantiles = getRelevantQuantiles();

                // Calculate RVPI from TVPI and DPI if available
                const calculateRVPI = (tvpi?: number, dpi?: number): number | null => {
                  if (tvpi != null && dpi != null) {
                    return tvpi - dpi;
                  }
                  return null;
                };

                return (
                  <>
                    <div className="benchmark-grid six-box-layout">
                    {/* IRR Quartile Visualization */}
                    <QuartileRangeChart
                      title="IRR Quartile Position"
                      bottomQuartile={relevantBenchmark.bottom_quartile || 0}
                      median={relevantBenchmark.median_irr || 0}
                      topQuartile={relevantBenchmark.top_quartile || 0}
                      currentValue={currentMetrics.irr || 0}
                      formatValue={formatPercentage}
                    />

                    {/* TVPI Quartile Visualization */}
                    {relevantQuantiles && (
                      <QuartileRangeChart
                        title="TVPI Quartile Position"
                        bottomQuartile={relevantQuantiles.tvpi_bottom_quartile || 0}
                        median={relevantQuantiles.tvpi_median || 0}
                        topQuartile={relevantQuantiles.tvpi_top_quartile || 0}
                        bottomDecile={relevantQuantiles.tvpi_bottom_decile}
                        topDecile={relevantQuantiles.tvpi_top_decile}
                        currentValue={currentMetrics.tvpi || 0}
                        formatValue={formatMultiple}
                      />
                    )}

                    {/* DPI Quartile Visualization */}
                    {relevantQuantiles && (
                      <QuartileRangeChart
                        title="DPI Quartile Position"
                        bottomQuartile={relevantQuantiles.dpi_bottom_quartile || 0}
                        median={relevantQuantiles.dpi_median || 0}
                        topQuartile={relevantQuantiles.dpi_top_quartile || 0}
                        bottomDecile={relevantQuantiles.dpi_bottom_decile}
                        topDecile={relevantQuantiles.dpi_top_decile}
                        currentValue={currentMetrics.dpi || 0}
                        formatValue={formatMultiple}
                      />
                    )}

                    {/* RVPI Calculated Quartile Visualization */}
                    {relevantQuantiles && (
                      <QuartileRangeChart
                        title="RVPI Quartile Position"
                        bottomQuartile={calculateRVPI(relevantQuantiles.tvpi_bottom_quartile, relevantQuantiles.dpi_top_quartile) || 0}
                        median={calculateRVPI(relevantQuantiles.tvpi_median, relevantQuantiles.dpi_median) || 0}
                        topQuartile={calculateRVPI(relevantQuantiles.tvpi_top_quartile, relevantQuantiles.dpi_bottom_quartile) || 0}
                        currentValue={currentMetrics.rvpi || 0}
                        formatValue={formatMultiple}
                      />
                    )}

                    {/* IRR vs Median Comparison */}
                    <div className="benchmark-item comparison-box">
                      <label>IRR vs. Median</label>
                      <div className="benchmark-comparison">
                        <span className={`metric-value ${getPerformanceColor(currentMetrics.irr)}`}>
                          {formatPercentage(currentMetrics.irr)}
                        </span>
                        <span className="vs-text">vs</span>
                        <span className="benchmark-value">
                          {formatPercentage(relevantBenchmark.median_irr)}
                        </span>
                        {getBenchmarkComparison(currentMetrics.irr, relevantBenchmark.median_irr) && (
                          <span className={`comparison-diff ${getBenchmarkComparison(currentMetrics.irr, relevantBenchmark.median_irr)!.isOutperforming ? 'positive' : 'negative'}`}>
                            ({getBenchmarkComparison(currentMetrics.irr, relevantBenchmark.median_irr)!.isOutperforming ? '+' : ''}{formatPercentage(getBenchmarkComparison(currentMetrics.irr, relevantBenchmark.median_irr)!.difference)})
                          </span>
                        )}
                      </div>
                      {relevantBenchmark.pooled_irr && (
                        <div className="additional-benchmark-info">
                          <small className="pooled-irr">Pooled IRR: {formatPercentage(relevantBenchmark.pooled_irr)}</small>
                          {relevantBenchmark.equal_weighted_pooled_irr && (
                            <small className="equal-weighted-irr">Equal-weighted: {formatPercentage(relevantBenchmark.equal_weighted_pooled_irr)}</small>
                          )}
                        </div>
                      )}
                      <small className="metric-description">Your IRR vs PitchBook median for {investment.vintage_year} vintage</small>
                    </div>

                    {/* Fund Universe Stats */}
                    <div className="benchmark-item stats-box">
                      <label>Fund Universe</label>
                      <div className="benchmark-stats">
                        <span className="stat-value">{relevantBenchmark.number_of_funds}</span>
                        <span className="stat-label">funds in benchmark</span>
                      </div>
                      {relevantQuantiles && (
                        <div className="additional-stats">
                          <span className="stat-secondary">{relevantQuantiles.number_of_funds} funds in multiples data</span>
                        </div>
                      )}
                      <small className="metric-description">Sample size for {investment.asset_class} {investment.vintage_year}</small>
                    </div>
                  </div>

                    {/* Compact Legend Below */}
                    <div className="benchmark-legend compact">
                      <div className="legend-grid-compact">
                        <div className="legend-item-compact">
                          <div className="legend-symbol-small">
                            <div className="legend-line solid"></div>
                          </div>
                          <span>Median</span>
                        </div>
                        <div className="legend-item-compact">
                          <div className="legend-symbol-small">
                            <div className="legend-line dashed bottom"></div>
                          </div>
                          <span>Bottom Quartile</span>
                        </div>
                        <div className="legend-item-compact">
                          <div className="legend-symbol-small">
                            <div className="legend-line dashed top"></div>
                          </div>
                          <span>Top Quartile</span>
                        </div>
                        <div className="legend-item-compact">
                          <div className="legend-symbol-small">
                            <div className="legend-triangle"></div>
                          </div>
                          <span>Your Fund</span>
                        </div>
                        <div className="legend-item-compact">
                          <div className="legend-symbol-small">
                            <div className="legend-gradient"></div>
                          </div>
                          <span>Performance Range</span>
                        </div>
                        <div className="legend-item-compact">
                          <div className="legend-text-small">Values</div>
                          <span>Quartile Numbers</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default PerformanceMetrics;