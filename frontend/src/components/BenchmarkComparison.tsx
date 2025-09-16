import React, { useState, useEffect } from 'react';
import { benchmarkAPI, InvestmentBenchmarkComparison, marketBenchmarkAPI, MarketBenchmark, BenchmarkReturn } from '../services/api';
import './BenchmarkComparison.css';

interface BenchmarkComparisonProps {
  investmentId: number;
}

const BenchmarkComparison: React.FC<BenchmarkComparisonProps> = ({ investmentId }) => {
  const [benchmarkData, setBenchmarkData] = useState<InvestmentBenchmarkComparison | null>(null);
  const [marketBenchmarks, setMarketBenchmarks] = useState<MarketBenchmark[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<MarketBenchmark | null>(null);
  const [benchmarkReturns, setBenchmarkReturns] = useState<BenchmarkReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBenchmarkData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch both vintage year quartile data and monthly benchmark data
        const [quartileData, monthlyBenchmarks] = await Promise.all([
          benchmarkAPI.getInvestmentBenchmark(investmentId).catch(() => null),
          marketBenchmarkAPI.getMarketBenchmarks().catch(() => [])
        ]);
        
        setBenchmarkData(quartileData);
        setMarketBenchmarks(monthlyBenchmarks);
        
        // Default to S&P 500 Total Return if available
        const sp500 = monthlyBenchmarks.find(b => b.ticker === 'SPY-TR');
        if (sp500) {
          setSelectedBenchmark(sp500);
          // Fetch returns for S&P 500
          const returns = await marketBenchmarkAPI.getBenchmarkReturns(sp500.id);
          setBenchmarkReturns(returns.sort((a, b) => new Date(b.period_date).getTime() - new Date(a.period_date).getTime()));
        }
      } catch (err) {
        console.error('Error fetching benchmark data:', err);
        setError('Failed to load benchmark comparison');
      } finally {
        setLoading(false);
      }
    };

    if (investmentId) {
      fetchBenchmarkData();
    }
  }, [investmentId]);

  const handleBenchmarkChange = async (benchmarkId: number) => {
    const benchmark = marketBenchmarks.find(b => b.id === benchmarkId);
    if (benchmark) {
      setSelectedBenchmark(benchmark);
      try {
        const returns = await marketBenchmarkAPI.getBenchmarkReturns(benchmarkId);
        setBenchmarkReturns(returns.sort((a, b) => new Date(b.period_date).getTime() - new Date(a.period_date).getTime()));
      } catch (err) {
        console.error('Error fetching benchmark returns:', err);
      }
    }
  };

  const getQuartileLabel = (rank: number): string => {
    switch (rank) {
      case 1: return 'Top Quartile';
      case 2: return 'Above Median';
      case 3: return 'Below Median';
      case 4: return 'Bottom Quartile';
      default: return 'N/A';
    }
  };

  const getQuartileClass = (rank: number): string => {
    switch (rank) {
      case 1: return 'quartile-1'; // Green
      case 2: return 'quartile-2'; // Light green
      case 3: return 'quartile-3'; // Yellow
      case 4: return 'quartile-4'; // Red
      default: return 'quartile-na';
    }
  };

  const formatPercentage = (value: number | undefined): string => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatMultiple = (value: number | undefined): string => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)}x`;
  };

  const formatDifference = (value: number, isPercentage: boolean): string => {
    const sign = value >= 0 ? '+' : '';
    if (isPercentage) {
      return `${sign}${value.toFixed(1)}pp`; // percentage points
    } else {
      return `${sign}${value.toFixed(2)}x`;
    }
  };

  const formatDate = (dateString: string): string => {
    // Parse as local date to avoid timezone shift
    const [year, month] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
  };

  if (loading) {
    return (
      <div className="benchmark-comparison">
        <div className="benchmark-header">
          <h3>📊 Benchmark Analysis</h3>
        </div>
        <div className="loading-state">Loading benchmark comparison...</div>
      </div>
    );
  }

  if (error || !benchmarkData) {
    return (
      <div className="benchmark-comparison">
        <div className="benchmark-header">
          <h3>📊 Benchmark Analysis</h3>
        </div>
        <div className="error-state">{error || 'No benchmark data available'}</div>
      </div>
    );
  }

  const hasIrrData = benchmarkData.irr_benchmark && benchmarkData.investment_irr !== null;
  const hasTvpiData = benchmarkData.tvpi_benchmark && benchmarkData.investment_tvpi !== null;

  return (
    <div className="benchmark-comparison">
      <div className="benchmark-header">
        <h3>📊 Benchmark Analysis</h3>
        <div className="benchmark-subtitle">
          Performance vs {benchmarkData.asset_class} peers ({benchmarkData.vintage_year} vintage)
        </div>
      </div>

      {/* Overall Performance Summary */}
      <div className="performance-summary">
        <div className="summary-badge">
          {benchmarkData.overall_performance_summary}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="metrics-grid">
        {/* IRR Comparison */}
        {hasIrrData && (
          <div className="metric-card irr-metric">
            <div className="metric-header">
              <h4>Internal Rate of Return (IRR)</h4>
              <div className={`quartile-badge ${getQuartileClass(benchmarkData.irr_quartile_rank!)}`}>
                {getQuartileLabel(benchmarkData.irr_quartile_rank!)}
              </div>
            </div>
            
            <div className="metric-comparison">
              <div className="performance-value">
                <span className="label">Investment IRR:</span>
                <span className="value primary">{formatPercentage(benchmarkData.investment_irr!)}</span>
              </div>
              
              <div className="benchmark-stats">
                <div className="benchmark-row">
                  <span>vs Median:</span>
                  <span className={`diff ${benchmarkData.irr_vs_median! >= 0 ? 'positive' : 'negative'}`}>
                    {formatDifference(benchmarkData.irr_vs_median!, true)}
                  </span>
                </div>
                <div className="benchmark-row">
                  <span>Percentile:</span>
                  <span className="percentile">~{benchmarkData.irr_percentile!.toFixed(0)}th</span>
                </div>
              </div>
            </div>

            <div className="quartile-breakdown">
              <div className="quartile-bar">
                <div className="quartile-segment q1">
                  <span>Q1: {formatPercentage(benchmarkData.irr_benchmark!.q1_performance)}</span>
                </div>
                <div className="quartile-segment median">
                  <span>Median: {formatPercentage(benchmarkData.irr_benchmark!.median_performance)}</span>
                </div>
                <div className="quartile-segment q3">
                  <span>Q3: {formatPercentage(benchmarkData.irr_benchmark!.q3_performance)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TVPI Comparison */}
        {hasTvpiData && (
          <div className="metric-card tvpi-metric">
            <div className="metric-header">
              <h4>Total Value to Paid-In (TVPI)</h4>
              <div className={`quartile-badge ${getQuartileClass(benchmarkData.tvpi_quartile_rank!)}`}>
                {getQuartileLabel(benchmarkData.tvpi_quartile_rank!)}
              </div>
            </div>
            
            <div className="metric-comparison">
              <div className="performance-value">
                <span className="label">Investment TVPI:</span>
                <span className="value primary">{formatMultiple(benchmarkData.investment_tvpi!)}</span>
              </div>
              
              <div className="benchmark-stats">
                <div className="benchmark-row">
                  <span>vs Median:</span>
                  <span className={`diff ${benchmarkData.tvpi_vs_median! >= 0 ? 'positive' : 'negative'}`}>
                    {formatDifference(benchmarkData.tvpi_vs_median!, false)}
                  </span>
                </div>
                <div className="benchmark-row">
                  <span>Percentile:</span>
                  <span className="percentile">~{benchmarkData.tvpi_percentile!.toFixed(0)}th</span>
                </div>
              </div>
            </div>

            <div className="quartile-breakdown">
              <div className="quartile-bar">
                <div className="quartile-segment q1">
                  <span>Q1: {formatMultiple(benchmarkData.tvpi_benchmark!.q1_performance)}</span>
                </div>
                <div className="quartile-segment median">
                  <span>Median: {formatMultiple(benchmarkData.tvpi_benchmark!.median_performance)}</span>
                </div>
                <div className="quartile-segment q3">
                  <span>Q3: {formatMultiple(benchmarkData.tvpi_benchmark!.q3_performance)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Attribution */}
      <div className="benchmark-attribution">
        <h5>Data Sources & Methodology</h5>
        <div className="attribution-content">
          {hasIrrData && (
            <div className="source-item">
              <strong>IRR Data:</strong> {benchmarkData.irr_benchmark!.data_source}
              {benchmarkData.irr_benchmark!.sample_size && (
                <span> (n={benchmarkData.irr_benchmark!.sample_size} funds)</span>
              )}
              <br />
              <small>{benchmarkData.irr_benchmark!.methodology_notes}</small>
            </div>
          )}
          {hasTvpiData && benchmarkData.tvpi_benchmark!.data_source !== benchmarkData.irr_benchmark?.data_source && (
            <div className="source-item">
              <strong>TVPI Data:</strong> {benchmarkData.tvpi_benchmark!.data_source}
              {benchmarkData.tvpi_benchmark!.sample_size && (
                <span> (n={benchmarkData.tvpi_benchmark!.sample_size} funds)</span>
              )}
              <br />
              <small>{benchmarkData.tvpi_benchmark!.methodology_notes}</small>
            </div>
          )}
        </div>
        <div className="data-disclaimer">
          <small>
            Benchmark data from public industry reports. Performance comparisons are indicative and should be 
            considered alongside fund-specific factors. Past performance does not guarantee future results.
          </small>
        </div>
      </div>

      {/* Monthly Benchmark Returns Section */}
      {marketBenchmarks.length > 0 && (
        <div className="monthly-benchmark-section">
          <div className="section-header">
            <h4>📈 Public Markets Benchmark</h4>
            <div className="benchmark-selector">
              <select 
                value={selectedBenchmark?.id || ''}
                onChange={(e) => handleBenchmarkChange(parseInt(e.target.value))}
                className="benchmark-select"
              >
                {marketBenchmarks.map(benchmark => (
                  <option key={benchmark.id} value={benchmark.id}>
                    {benchmark.name} ({benchmark.ticker})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedBenchmark && (
            <div className="benchmark-info">
              <div className="benchmark-description">
                <p>{selectedBenchmark.description}</p>
                <span className="data-source">Source: {selectedBenchmark.data_source}</span>
              </div>

              {benchmarkReturns.length > 0 && (
                <div className="returns-preview">
                  <h5>Recent Monthly Returns</h5>
                  <div className="returns-table-small">
                    <table>
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Total Return</th>
                          <th>Price Return</th>
                          <th>Div Yield</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarkReturns.slice(0, 6).map((returnData) => (
                          <tr key={returnData.id}>
                            <td>{formatDate(returnData.period_date)}</td>
                            <td className="number positive">{formatPercentage(returnData.total_return)}</td>
                            <td className="number">{formatPercentage(returnData.price_return)}</td>
                            <td className="number">{formatPercentage(returnData.dividend_yield)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {benchmarkReturns.length > 6 && (
                      <div className="table-footer">
                        Showing most recent 6 of {benchmarkReturns.length} monthly returns
                      </div>
                    )}
                  </div>
                </div>
              )}

              {benchmarkReturns.length === 0 && (
                <div className="no-returns-data">
                  <p>No monthly returns data available for {selectedBenchmark.name}</p>
                  <small>Monthly returns are used for PME (Public Markets Equivalent) analysis</small>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No Data Message */}
      {!hasIrrData && !hasTvpiData && marketBenchmarks.length === 0 && (
        <div className="no-data-message">
          <p>{benchmarkData.data_availability}</p>
          <small>
            Benchmark data may not be available for all asset classes and vintage years. 
            We continue expanding our benchmark database with additional public sources.
          </small>
        </div>
      )}
    </div>
  );
};

export default BenchmarkComparison;