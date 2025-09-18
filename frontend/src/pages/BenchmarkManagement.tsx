import React, { useState, useEffect } from 'react';
import { marketBenchmarkAPI, MarketBenchmark, BenchmarkReturn, investmentAPI, pmeAPI, PMEAnalysisResult } from '../services/api';
import { Investment } from '../types/investment';
import BenchmarkModal from '../components/BenchmarkModal';
import './BenchmarkManagement.css';

const BenchmarkManagement: React.FC = () => {
  const [benchmarks, setBenchmarks] = useState<MarketBenchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalBenchmark, setModalBenchmark] = useState<MarketBenchmark | null>(null);

  // Performance Comparison State
  const [availableInvestments, setAvailableInvestments] = useState<Investment[]>([]);
  const [selectedInvestmentOption, setSelectedInvestmentOption] = useState<{type: 'investment' | 'asset_class', value: string}>({type: 'investment', value: ''});
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [pmeResult, setPmeResult] = useState<PMEAnalysisResult | null>(null);
  const [pmeLoading, setPmeLoading] = useState(false);
  const [pmeError, setPmeError] = useState<string | null>(null);

  const fetchBenchmarks = async () => {
    try {
      setLoading(true);
      setError(null);
      const [benchmarkData, investmentData] = await Promise.all([
        marketBenchmarkAPI.getMarketBenchmarks(),
        investmentAPI.getInvestments()
      ]);
      setBenchmarks(benchmarkData);
      setAvailableInvestments(investmentData);
    } catch (err: any) {
      setError('Failed to fetch data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBenchmarks();
  }, []);

  const handleBenchmarkClick = (benchmark: MarketBenchmark) => {
    setModalBenchmark(benchmark);
  };

  const closeModal = () => {
    setModalBenchmark(null);
    fetchBenchmarks(); // Refresh the list in case data was updated
  };




  // Performance Comparison Functions
  const getInvestmentOptions = () => {
    const investments = availableInvestments.map(inv => ({
      type: 'investment' as const,
      value: inv.id.toString(),
      label: inv.name,
      subLabel: inv.asset_class
    }));

    const assetClasses = Array.from(new Set(availableInvestments.map(inv => inv.asset_class)))
      .sort()
      .map(assetClass => ({
        type: 'asset_class' as const,
        value: assetClass,
        label: `${assetClass} (Asset Class)`,
        subLabel: `${availableInvestments.filter(inv => inv.asset_class === assetClass).length} investments`
      }));

    return [...investments, ...assetClasses];
  };

  const calculateCommonInceptionDate = () => {
    if (!selectedInvestmentOption.value || !selectedBenchmarkId) return '';
    
    // This would need to be calculated based on actual data availability
    // For now, return a reasonable default
    const defaultStart = new Date();
    defaultStart.setFullYear(defaultStart.getFullYear() - 5);
    return defaultStart.toISOString().split('T')[0];
  };

  const runComparison = async () => {
    if (!selectedInvestmentOption.value || !selectedBenchmarkId) {
      setPmeError('Please select both an investment/asset class and a benchmark');
      return;
    }

    setPmeLoading(true);
    setPmeError(null);

    try {
      let result: PMEAnalysisResult;
      
      if (selectedInvestmentOption.type === 'investment') {
        result = await pmeAPI.getInvestmentPME(parseInt(selectedInvestmentOption.value), selectedBenchmarkId);
      } else {
        // Asset class comparison - would need new API endpoint
        result = await pmeAPI.getPortfolioPME(selectedBenchmarkId, {
          assetClass: selectedInvestmentOption.value
        });
      }
      
      setPmeResult(result);
    } catch (err: any) {
      console.error('Error running comparison:', err);
      setPmeError(err.response?.data?.detail || 'Failed to run comparison');
    } finally {
      setPmeLoading(false);
    }
  };

  const clearComparison = () => {
    setPmeResult(null);
    setPmeError(null);
    setSelectedInvestmentOption({type: 'investment', value: ''});
    setSelectedBenchmarkId(null);
  };

  const normalizeToIndex = (series: any[], baseValue: number = 100) => {
    if (series.length === 0) return [];
    
    const firstValue = series[0].private_tvpi;
    const firstPublicValue = series[0].public_tvpi;
    
    return series.map(point => ({
      ...point,
      private_index: (point.private_tvpi / firstValue) * baseValue,
      public_index: (point.public_tvpi / firstPublicValue) * baseValue
    }));
  };

  const formatPercentage = (value?: number): string => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatDate = (dateString: string): string => {
    // Parse as local date to avoid timezone shift (2025-07-01 stays July, not June)
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
  };

  if (loading) {
    return (
      <div className="benchmark-management">
        <div className="loading-state">Loading benchmark data...</div>
      </div>
    );
  }

  return (
    <div className="benchmark-management">
      <div className="benchmark-header">
        <h2>📈 Market Benchmark Management</h2>
        <p className="subtitle">Manage monthly returns data for market benchmarks used in PME analysis</p>
      </div>

      <div className="benchmark-layout">
        {/* Benchmarks List - Minimal Sidebar */}
        <div className="benchmarks-sidebar">
          <h4>📈 Benchmarks</h4>
          <div className="benchmarks-list">
            {benchmarks.map((benchmark) => (
              <button
                key={benchmark.id}
                className="benchmark-link"
                onClick={() => handleBenchmarkClick(benchmark)}
              >
                {benchmark.name}
              </button>
            ))}
          </div>
        </div>

        {/* Performance Comparison Chart - Primary Focus */}
        <div className="performance-comparison">
          {/* Control Panel */}
          <div className="comparison-controls">
            <h3>📊 Performance Comparison</h3>
            
            <div className="controls-grid">
              {/* Investment/Asset Class Dropdown */}
              <div className="control-group">
                <label htmlFor="investment-select">Investment/Asset Class:</label>
                <select 
                  id="investment-select"
                  value={`${selectedInvestmentOption.type}:${selectedInvestmentOption.value}`}
                  onChange={(e) => {
                    const [type, value] = e.target.value.split(':');
                    setSelectedInvestmentOption({type: type as 'investment' | 'asset_class', value: value || ''});
                  }}
                  className="dropdown-select"
                >
                  <option value="investment:">Select Investment or Asset Class...</option>
                  
                  <optgroup label="INVESTMENTS">
                    {availableInvestments.map(inv => (
                      <option key={`investment:${inv.id}`} value={`investment:${inv.id}`}>
                        {inv.name} ({inv.asset_class})
                      </option>
                    ))}
                  </optgroup>
                  
                  <optgroup label="ASSET CLASSES">
                    {Array.from(new Set(availableInvestments.map(inv => inv.asset_class)))
                      .sort()
                      .map(assetClass => (
                        <option key={`asset_class:${assetClass}`} value={`asset_class:${assetClass}`}>
                          {assetClass} ({availableInvestments.filter(inv => inv.asset_class === assetClass).length} investments)
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* Benchmark Dropdown */}
              <div className="control-group">
                <label htmlFor="benchmark-select">Benchmark:</label>
                <select 
                  id="benchmark-select"
                  value={selectedBenchmarkId || ''}
                  onChange={(e) => setSelectedBenchmarkId(e.target.value ? parseInt(e.target.value) : null)}
                  className="dropdown-select"
                >
                  <option value="">Select Benchmark...</option>
                  {benchmarks.map((benchmark) => (
                    <option key={benchmark.id} value={benchmark.id}>
                      {benchmark.name} ({benchmark.ticker})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="control-group">
                <label htmlFor="start-date">Start Date:</label>
                <input 
                  type="date"
                  id="start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="date-input"
                />
              </div>

              <div className="control-group">
                <label htmlFor="end-date">End Date:</label>
                <input 
                  type="date"
                  id="end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="date-input"
                />
              </div>

              {/* Action Buttons */}
              <div className="control-group action-buttons">
                <button 
                  onClick={runComparison}
                  disabled={!selectedInvestmentOption.value || !selectedBenchmarkId || pmeLoading}
                  className="run-comparison-btn"
                >
                  {pmeLoading ? 'Running...' : 'Run Comparison'}
                </button>
                <button 
                  onClick={clearComparison}
                  className="clear-comparison-btn"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

              {/* Chart Display Area */}
          <div className="chart-section">
            {/* Error Display */}
            {pmeError && (
              <div className="error-display">
                <span className="error-icon">⚠️</span>
                <span>{pmeError}</span>
              </div>
            )}

            {/* Chart Container */}
            <div className="chart-container">
              {pmeLoading ? (
                <div className="chart-loading">
                  <div className="loading-spinner"></div>
                  <span>Running performance comparison...</span>
                </div>
              ) : pmeResult && pmeResult.pme_series.length > 0 ? (
                <div className="chart-display">
                  <h4>Performance Comparison Chart</h4>
                  <div className="chart-legend">
                    <span className="legend-item">
                      <span className="legend-color private"></span>
                      Investment Performance
                    </span>
                    <span className="legend-item">
                      <span className="legend-color public"></span>
                      {benchmarks.find(b => b.id === selectedBenchmarkId)?.name || 'Benchmark'} Performance
                    </span>
                  </div>
                  
                  <div className="chart-svg-container">
                    <svg className="performance-chart" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
                      {(() => {
                        const normalizedData = normalizeToIndex(pmeResult.pme_series, 100);
                        const maxValue = Math.max(...normalizedData.map(d => Math.max(d.private_index, d.public_index)));
                        const minValue = Math.min(...normalizedData.map(d => Math.min(d.private_index, d.public_index)));
                        const valueRange = maxValue - minValue;
                        const padding = 40;
                        const chartWidth = 800 - (padding * 2);
                        const chartHeight = 400 - (padding * 2);
                        
                        const getX = (index: number) => padding + (index / (normalizedData.length - 1)) * chartWidth;
                        const getY = (value: number) => padding + ((maxValue - value) / valueRange) * chartHeight;
                        
                        const privatePoints = normalizedData.map((d, i) => `${getX(i)},${getY(d.private_index)}`).join(' ');
                        const publicPoints = normalizedData.map((d, i) => `${getX(i)},${getY(d.public_index)}`).join(' ');
                        
                        return (
                          <>
                            {/* Grid lines */}
                            {[0, 25, 50, 75, 100, 125, 150].filter(val => val >= minValue && val <= maxValue).map(value => (
                              <line 
                                key={value} 
                                x1={padding} 
                                y1={getY(value)} 
                                x2={800-padding} 
                                y2={getY(value)} 
                                stroke="#e5e7eb" 
                                strokeWidth="1"
                              />
                            ))}
                            
                            {/* Y-axis labels */}
                            {[0, 50, 100, 150].filter(val => val >= minValue && val <= maxValue).map(value => (
                              <text 
                                key={value} 
                                x={padding - 10} 
                                y={getY(value) + 5} 
                                textAnchor="end" 
                                fontSize="12" 
                                fill="#6b7280"
                              >
                                {value}
                              </text>
                            ))}
                            
                            {/* Private line */}
                            <polyline
                              points={privatePoints}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="3"
                              className="private-line"
                            />
                            
                            {/* Public line */}
                            <polyline
                              points={publicPoints}
                              fill="none"
                              stroke="#059669"
                              strokeWidth="3"
                              className="public-line"
                            />
                            
                            {/* Data points */}
                            {normalizedData.map((d, i) => (
                              <g key={i}>
                                <circle cx={getX(i)} cy={getY(d.private_index)} r="4" fill="#3b82f6" />
                                <circle cx={getX(i)} cy={getY(d.public_index)} r="4" fill="#059669" />
                              </g>
                            ))}
                            
                            {/* X-axis labels */}
                            {normalizedData.filter((_, i) => i % Math.ceil(normalizedData.length / 6) === 0).map((d, i, arr) => {
                              const originalIndex = normalizedData.indexOf(d);
                              return (
                                <text 
                                  key={originalIndex} 
                                  x={getX(originalIndex)} 
                                  y={400 - padding + 20} 
                                  textAnchor="middle" 
                                  fontSize="12" 
                                  fill="#6b7280"
                                >
                                  {formatDate(d.date)}
                                </text>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="chart-empty">
                  <div className="empty-icon">📊</div>
                  <h4>Performance Comparison Chart</h4>
                  <p>Select an investment/asset class and benchmark above, then click "Run Comparison" to display the performance comparison chart.</p>
                </div>
              )}
            </div>

            {/* Results Summary */}
            {pmeResult && (
              <div className="results-summary">
                <h4>Analysis Results</h4>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <span className="metric-label">Investment TVPI</span>
                    <span className="metric-value">{pmeResult.summary_metrics.final_private_tvpi.toFixed(2)}x</span>
                  </div>
                  
                  <div className="metric-card">
                    <span className="metric-label">Benchmark TVPI</span>
                    <span className="metric-value">{pmeResult.summary_metrics.final_public_tvpi.toFixed(2)}x</span>
                  </div>
                  
                  <div className="metric-card">
                    <span className="metric-label">PME Ratio</span>
                    <span className={`metric-value ${pmeResult.summary_metrics.pme_ratio >= 1 ? 'positive' : 'negative'}`}>
                      {pmeResult.summary_metrics.pme_ratio.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="metric-card">
                    <span className="metric-label">Outperformance</span>
                    <span className={`metric-value ${pmeResult.summary_metrics.final_illiquidity_premium >= 0 ? 'positive' : 'negative'}`}>
                      {pmeResult.summary_metrics.final_illiquidity_premium >= 0 ? '+' : ''}{(pmeResult.summary_metrics.final_illiquidity_premium * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Benchmark Modal */}
      {modalBenchmark && (
        <BenchmarkModal
          benchmark={modalBenchmark}
          onClose={closeModal}
        />
      )}

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
};

export default BenchmarkManagement;