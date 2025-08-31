import React, { useState, useEffect } from 'react';
import { benchmarkAPI, InvestmentBenchmarkComparison } from '../services/api';
import './BenchmarkComparison.css';

interface BenchmarkComparisonProps {
  investmentId: number;
}

const BenchmarkComparison: React.FC<BenchmarkComparisonProps> = ({ investmentId }) => {
  const [benchmarkData, setBenchmarkData] = useState<InvestmentBenchmarkComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBenchmarkData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await benchmarkAPI.getInvestmentBenchmark(investmentId);
        setBenchmarkData(data);
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

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatMultiple = (value: number): string => {
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

      {/* No Data Message */}
      {!hasIrrData && !hasTvpiData && (
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