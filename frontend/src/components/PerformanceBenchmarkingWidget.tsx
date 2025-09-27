import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Investment, PerformanceMetrics } from '../types/investment';
import { performanceAPI } from '../services/api';
import '../styles/luxury-design-system.css';
import './PerformanceBenchmarkingWidget.css';

interface BenchmarkData {
  id: string;
  name: string;
  description: string;
  type: 'market_index' | 'peer_group' | 'custom';
  returns: {
    '1Y': number;
    '3Y': number;
    '5Y': number;
    'ITD': number; // Inception to Date
  };
  color: string;
}

interface PerformanceBenchmarkingWidgetProps {
  investments: Investment[];
  selectedBenchmarks?: string[];
  onBenchmarkChange?: (benchmarks: string[]) => void;
}

const PerformanceBenchmarkingWidget: React.FC<PerformanceBenchmarkingWidgetProps> = ({
  investments,
  selectedBenchmarks = [],
  onBenchmarkChange
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<Map<number, PerformanceMetrics>>(new Map());
  const [activeTimeframe, setActiveTimeframe] = useState<'1Y' | '3Y' | '5Y' | 'ITD'>('3Y');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [comparisonType, setComparisonType] = useState<'absolute' | 'relative'>('absolute');

  // Mock benchmark data - in real implementation, this would come from an API
  const availableBenchmarks: BenchmarkData[] = [
    {
      id: 'sp500',
      name: 'S&P 500',
      description: 'Large-cap US equity benchmark',
      type: 'market_index',
      returns: { '1Y': 12.5, '3Y': 8.2, '5Y': 11.1, 'ITD': 9.8 },
      color: '#3498db'
    },
    {
      id: 'cambridge_pe',
      name: 'Cambridge PE Index',
      description: 'Private equity benchmark',
      type: 'peer_group',
      returns: { '1Y': 15.2, '3Y': 12.8, '5Y': 14.5, 'ITD': 13.2 },
      color: '#e74c3c'
    },
    {
      id: 'cambridge_vc',
      name: 'Cambridge VC Index',
      description: 'Venture capital benchmark',
      type: 'peer_group',
      returns: { '1Y': 18.7, '3Y': 16.4, '5Y': 19.2, 'ITD': 17.8 },
      color: '#f39c12'
    },
    {
      id: 'russell2000',
      name: 'Russell 2000',
      description: 'Small-cap US equity benchmark',
      type: 'market_index',
      returns: { '1Y': 10.1, '3Y': 6.8, '5Y': 9.4, 'ITD': 8.1 },
      color: '#9b59b6'
    },
    {
      id: 'msci_world',
      name: 'MSCI World',
      description: 'Global developed markets equity',
      type: 'market_index',
      returns: { '1Y': 11.8, '3Y': 7.9, '5Y': 10.3, 'ITD': 9.2 },
      color: '#1abc9c'
    },
    {
      id: 'preqin_re',
      name: 'Preqin Real Estate',
      description: 'Private real estate benchmark',
      type: 'peer_group',
      returns: { '1Y': 8.5, '3Y': 6.2, '5Y': 7.8, 'ITD': 7.1 },
      color: '#34495e'
    }
  ];

  const selectedBenchmarkData = useMemo(() =>
    availableBenchmarks.filter(b => selectedBenchmarks.includes(b.id)),
    [selectedBenchmarks, availableBenchmarks]
  );

  // Fetch performance data for investments
  const fetchPerformanceData = useCallback(async () => {
    if (investments.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const performanceMap = new Map<number, PerformanceMetrics>();
      const performancePromises = investments.map(async (investment) => {
        try {
          const result = await performanceAPI.getInvestmentPerformance(investment.id);
          return { id: investment.id, performance: result.performance };
        } catch (error) {
          console.warn(`Failed to fetch performance for investment ${investment.id}:`, error);
          return null;
        }
      });

      const results = await Promise.all(performancePromises);
      results.forEach(result => {
        if (result && result.performance) {
          performanceMap.set(result.id, result.performance);
        }
      });

      setPerformanceData(performanceMap);
    } catch (error) {
      setError('Failed to fetch performance data');
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  }, [investments]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Calculate portfolio-level performance
  const portfolioPerformance = useMemo(() => {
    if (performanceData.size === 0) return null;

    const performances = Array.from(performanceData.values());
    const totalContributions = performances.reduce((sum, p) => sum + (p.total_contributions || 0), 0);
    const totalDistributions = performances.reduce((sum, p) => sum + (p.total_distributions || 0), 0);
    const totalCurrentNav = performances.reduce((sum, p) => sum + (p.current_nav || 0), 0);

    const tvpi = totalContributions > 0 ? (totalDistributions + totalCurrentNav) / totalContributions : 0;
    const dpi = totalContributions > 0 ? totalDistributions / totalContributions : 0;
    const rvpi = totalContributions > 0 ? totalCurrentNav / totalContributions : 0;

    // Mock annualized returns - in real implementation, calculate based on cash flows and dates
    return {
      tvpi,
      dpi,
      rvpi,
      annualizedReturns: {
        '1Y': (tvpi - 1) * 0.8, // Mock calculation
        '3Y': (tvpi - 1) * 0.6,
        '5Y': (tvpi - 1) * 0.4,
        'ITD': (tvpi - 1) * 0.3
      }
    };
  }, [performanceData]);

  const handleBenchmarkToggle = useCallback((benchmarkId: string) => {
    const newSelection = selectedBenchmarks.includes(benchmarkId)
      ? selectedBenchmarks.filter(id => id !== benchmarkId)
      : [...selectedBenchmarks, benchmarkId];

    if (onBenchmarkChange) {
      onBenchmarkChange(newSelection);
    }
  }, [selectedBenchmarks, onBenchmarkChange]);

  const getBenchmarkIcon = (type: BenchmarkData['type']) => {
    switch (type) {
      case 'market_index': return '📊';
      case 'peer_group': return '👥';
      case 'custom': return '🎯';
      default: return '📈';
    }
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  const getPerformanceStatus = (portfolioReturn: number, benchmarkReturn: number) => {
    const diff = portfolioReturn - benchmarkReturn;
    if (Math.abs(diff) < 0.005) return 'neutral'; // Within 0.5%
    return diff > 0 ? 'outperform' : 'underperform';
  };

  if (loading) {
    return (
      <div className="benchmarking-widget loading">
        <div className="loading-spinner"></div>
        <p>Loading performance benchmarking data...</p>
      </div>
    );
  }

  return (
    <div className="benchmarking-widget">
      {/* Header */}
      <div className="widget-header">
        <div className="header-content">
          <h3 className="luxury-heading-3">Performance Benchmarking</h3>
          <p className="luxury-body">Compare portfolio performance against market and peer benchmarks</p>
        </div>
        <div className="header-controls">
          <div className="view-mode-toggle">
            <button
              className={`toggle-button ${viewMode === 'chart' ? 'active' : ''}`}
              onClick={() => setViewMode('chart')}
            >
              📊 Chart
            </button>
            <button
              className={`toggle-button ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              📋 Table
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Benchmark Selection */}
      <div className="benchmark-selection">
        <h4 className="selection-title">Select Benchmarks</h4>
        <div className="benchmark-grid">
          {availableBenchmarks.map(benchmark => (
            <button
              key={benchmark.id}
              className={`benchmark-option ${selectedBenchmarks.includes(benchmark.id) ? 'selected' : ''}`}
              onClick={() => handleBenchmarkToggle(benchmark.id)}
              style={{
                borderColor: selectedBenchmarks.includes(benchmark.id) ? benchmark.color : 'var(--luxury-border)'
              }}
            >
              <span className="benchmark-icon">{getBenchmarkIcon(benchmark.type)}</span>
              <div className="benchmark-info">
                <span className="benchmark-name">{benchmark.name}</span>
                <span className="benchmark-description">{benchmark.description}</span>
              </div>
              <div className="benchmark-return">
                {formatPercentage(benchmark.returns[activeTimeframe])}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Timeframe Selection */}
      <div className="timeframe-selection">
        <div className="timeframe-buttons">
          {(['1Y', '3Y', '5Y', 'ITD'] as const).map(timeframe => (
            <button
              key={timeframe}
              className={`timeframe-button ${activeTimeframe === timeframe ? 'active' : ''}`}
              onClick={() => setActiveTimeframe(timeframe)}
            >
              {timeframe}
            </button>
          ))}
        </div>
        <div className="comparison-toggle">
          <button
            className={`comparison-button ${comparisonType === 'absolute' ? 'active' : ''}`}
            onClick={() => setComparisonType('absolute')}
          >
            Absolute
          </button>
          <button
            className={`comparison-button ${comparisonType === 'relative' ? 'active' : ''}`}
            onClick={() => setComparisonType('relative')}
          >
            Relative
          </button>
        </div>
      </div>

      {/* Performance Display */}
      {portfolioPerformance && selectedBenchmarkData.length > 0 && (
        <div className="performance-display">
          {viewMode === 'chart' ? (
            <div className="performance-chart">
              <div className="chart-container">
                <div className="chart-header">
                  <h4>Performance Comparison - {activeTimeframe}</h4>
                  <div className="chart-legend">
                    <div className="legend-item portfolio">
                      <span className="legend-color portfolio"></span>
                      <span>Portfolio</span>
                    </div>
                    {selectedBenchmarkData.map(benchmark => (
                      <div key={benchmark.id} className="legend-item">
                        <span
                          className="legend-color"
                          style={{ backgroundColor: benchmark.color }}
                        ></span>
                        <span>{benchmark.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="chart-bars">
                  {/* Portfolio Bar */}
                  <div className="performance-bar-container">
                    <div className="bar-label">
                      <span className="bar-name">Portfolio</span>
                      <span className="bar-value">
                        {formatPercentage(portfolioPerformance.annualizedReturns[activeTimeframe])}
                      </span>
                    </div>
                    <div className="performance-bar">
                      <div
                        className="bar-fill portfolio"
                        style={{
                          width: `${Math.min(100, Math.max(10,
                            (portfolioPerformance.annualizedReturns[activeTimeframe] / 0.25) * 100
                          ))}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Benchmark Bars */}
                  {selectedBenchmarkData.map(benchmark => {
                    const benchmarkReturn = benchmark.returns[activeTimeframe] / 100;
                    const portfolioReturn = portfolioPerformance.annualizedReturns[activeTimeframe];
                    const status = getPerformanceStatus(portfolioReturn, benchmarkReturn);

                    return (
                      <div key={benchmark.id} className="performance-bar-container">
                        <div className="bar-label">
                          <span className="bar-name">{benchmark.name}</span>
                          <div className="bar-value-with-status">
                            <span className="bar-value">
                              {formatPercentage(benchmarkReturn)}
                            </span>
                            <span className={`performance-status ${status}`}>
                              {status === 'outperform' && '↗️'}
                              {status === 'underperform' && '↘️'}
                              {status === 'neutral' && '➡️'}
                            </span>
                          </div>
                        </div>
                        <div className="performance-bar">
                          <div
                            className="bar-fill benchmark"
                            style={{
                              backgroundColor: benchmark.color,
                              width: `${Math.min(100, Math.max(10, (benchmarkReturn / 0.25) * 100))}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="performance-table">
              <table>
                <thead>
                  <tr>
                    <th>Benchmark</th>
                    <th>Type</th>
                    <th>1Y Return</th>
                    <th>3Y Return</th>
                    <th>5Y Return</th>
                    <th>ITD Return</th>
                    <th>vs Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="portfolio-row">
                    <td><strong>Portfolio</strong></td>
                    <td>-</td>
                    <td>{formatPercentage(portfolioPerformance.annualizedReturns['1Y'])}</td>
                    <td>{formatPercentage(portfolioPerformance.annualizedReturns['3Y'])}</td>
                    <td>{formatPercentage(portfolioPerformance.annualizedReturns['5Y'])}</td>
                    <td>{formatPercentage(portfolioPerformance.annualizedReturns['ITD'])}</td>
                    <td>-</td>
                  </tr>
                  {selectedBenchmarkData.map(benchmark => {
                    const activeReturn = benchmark.returns[activeTimeframe] / 100;
                    const portfolioReturn = portfolioPerformance.annualizedReturns[activeTimeframe];
                    const difference = portfolioReturn - activeReturn;
                    const status = getPerformanceStatus(portfolioReturn, activeReturn);

                    return (
                      <tr key={benchmark.id}>
                        <td>
                          <div className="benchmark-cell">
                            <span
                              className="benchmark-color-indicator"
                              style={{ backgroundColor: benchmark.color }}
                            ></span>
                            {benchmark.name}
                          </div>
                        </td>
                        <td>
                          <span className="benchmark-type">
                            {getBenchmarkIcon(benchmark.type)} {benchmark.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{formatPercentage(benchmark.returns['1Y'] / 100)}</td>
                        <td>{formatPercentage(benchmark.returns['3Y'] / 100)}</td>
                        <td>{formatPercentage(benchmark.returns['5Y'] / 100)}</td>
                        <td>{formatPercentage(benchmark.returns['ITD'] / 100)}</td>
                        <td>
                          <span className={`performance-difference ${status}`}>
                            {difference >= 0 ? '+' : ''}
                            {formatPercentage(difference)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary Statistics */}
      {portfolioPerformance && selectedBenchmarkData.length > 0 && (
        <div className="performance-summary">
          <h4>Performance Summary</h4>
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <span className="card-label">Portfolio TVPI</span>
                <span className="card-value">{portfolioPerformance.tvpi.toFixed(2)}x</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">💰</div>
              <div className="card-content">
                <span className="card-label">Distribution Ratio</span>
                <span className="card-value">{portfolioPerformance.dpi.toFixed(2)}x</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">📈</div>
              <div className="card-content">
                <span className="card-label">Benchmarks Tracked</span>
                <span className="card-value">{selectedBenchmarkData.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBenchmarks.length === 0 && (
        <div className="no-benchmarks-message">
          <div className="message-icon">📊</div>
          <h4>Select Benchmarks to Compare</h4>
          <p>Choose from market indices, peer group benchmarks, or custom benchmarks to compare your portfolio performance.</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceBenchmarkingWidget;