import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { jwtAPI } from '../services/api-jwt';
import './Benchmarks.css';

interface Benchmark {
  id: number;
  name: string;
  ticker: string;
  category: string;
  description: string;
}

interface Investment {
  id: number;
  name: string;
  asset_class: string;
  vintage_year?: number;
  manager?: string;
  entity_name?: string;
  inception_date?: string;
}

interface PerformanceDataPoint {
  date: string;
  indexed_value: number;
  tvpi?: number;
  cumulative_contributions?: number;
  cumulative_distributions?: number;
  total_nav?: number;
  monthly_return?: number;
}

interface ComparisonResult {
  investment_performance: PerformanceDataPoint[];
  benchmark_performances: { [benchmarkId: number]: PerformanceDataPoint[] };
  benchmarks: { id: number; name: string; ticker: string; category: string }[];
  date_range: { start: string; end: string };
}

interface PitchBookPerformanceData {
  asset_class: string;
  metric_code: string;
  vintage_year: number;
  top_quartile_value: number | null;
  median_value: number | null;
  bottom_quartile_value: number | null;
  pooled_irr: number | null;
  equal_weighted_pooled_irr: number | null;
  sample_size: number | null;
  methodology_notes: string | null;
}

interface PitchBookMultiplesData {
  asset_class: string;
  vintage_year: number;
  tvpi_top_quartile: number | null;
  tvpi_median: number | null;
  tvpi_bottom_quartile: number | null;
  tvpi_top_decile: number | null;
  tvpi_bottom_decile: number | null;
  dpi_top_quartile: number | null;
  dpi_median: number | null;
  dpi_bottom_quartile: number | null;
  dpi_top_decile: number | null;
  dpi_bottom_decile: number | null;
  fund_count: number | null;
}

interface PitchBookQuarterlyReturns {
  asset_class: string;
  quarter_year: string;
  quarter_date: string;
  top_quartile_return: number | null;
  median_return: number | null;
  bottom_quartile_return: number | null;
  sample_size: number | null;
}

interface InvestmentsResponse {
  investments: Investment[];
  asset_classes: string[];
  earliest_portfolio_date: string;
}

// Helper functions for chart data preparation and styling
const prepareChartData = (comparisonResult: ComparisonResult) => {
  // Combine all dates from investment and benchmark data
  const allDates = new Set<string>();

  // Add investment dates
  comparisonResult.investment_performance.forEach(point => {
    allDates.add(point.date);
  });

  // Add benchmark dates
  Object.values(comparisonResult.benchmark_performances).forEach(benchmarkData => {
    benchmarkData.forEach(point => {
      allDates.add(point.date);
    });
  });

  // Sort dates chronologically
  const sortedDates = Array.from(allDates).sort();

  // Create chart data with all dates
  return sortedDates.map(date => {
    const dataPoint: any = { date };

    // Find investment data for this date
    const invData = comparisonResult.investment_performance.find(p => p.date === date);
    if (invData) {
      dataPoint.investment = invData.indexed_value;
    }

    // Find benchmark data for this date
    comparisonResult.benchmarks.forEach(benchmark => {
      const benchmarkData = comparisonResult.benchmark_performances[benchmark.id];
      const benchData = benchmarkData?.find(p => p.date === date);
      if (benchData) {
        dataPoint[`benchmark_${benchmark.id}`] = benchData.indexed_value;
      }
    });

    return dataPoint;
  });
};

const getBenchmarkColor = (index: number): string => {
  const colors = [
    '#ef4444', // red
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#f97316'  // orange
  ];
  return colors[index % colors.length];
};

const Benchmarks: React.FC = () => {
  // State for data
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [assetClasses, setAssetClasses] = useState<string[]>([]);
  const [earliestPortfolioDate, setEarliestPortfolioDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for comparison (Section 1)
  const [selectedSection, setSelectedSection] = useState<'relative' | 'reference'>('relative');
  const [selectionType, setSelectionType] = useState<'investment' | 'asset_class' | 'portfolio'>('investment');
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<Date>(new Date(2024, 0, 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startDatePreset, setStartDatePreset] = useState<string>('inception');
  const [endDatePreset, setEndDatePreset] = useState<string>('today');
  const [viewType, setViewType] = useState<'month' | 'quarter' | 'year'>('month');
  const [viewMode, setViewMode] = useState<'absolute' | 'rebased'>('absolute');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // State for reference data (Section 2)
  const [pitchBookPerformanceData, setPitchBookPerformanceData] = useState<PitchBookPerformanceData[]>([]);
  const [pitchBookMultiplesData, setPitchBookMultiplesData] = useState<PitchBookMultiplesData[]>([]);
  const [pitchBookQuarterlyReturns, setPitchBookQuarterlyReturns] = useState<PitchBookQuarterlyReturns[]>([]);

  // Full datasets for dropdown options (never filtered)
  const [allPerformanceData, setAllPerformanceData] = useState<PitchBookPerformanceData[]>([]);
  const [allMultiplesData, setAllMultiplesData] = useState<PitchBookMultiplesData[]>([]);
  const [allQuarterlyReturns, setAllQuarterlyReturns] = useState<PitchBookQuarterlyReturns[]>([]);

  const [referenceDataLoading, setReferenceDataLoading] = useState(false);
  const [referenceDataError, setReferenceDataError] = useState<string | null>(null);

  // State for reference data filters
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  // State for pagination
  const [currentPagePerformance, setCurrentPagePerformance] = useState(1);
  const [currentPageMultiples, setCurrentPageMultiples] = useState(1);
  const [currentPageQuarterly, setCurrentPageQuarterly] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSection === 'reference') {
      // Fetch full data on initial load or when switching to reference section
      if (allPerformanceData.length === 0 && allMultiplesData.length === 0 && allQuarterlyReturns.length === 0) {
        fetchFullReferenceData();
      } else {
        // Just apply filters to existing data
        applyFiltersToData();
      }
    }
  }, [selectedSection, selectedAssetClass, selectedMetric, selectedYear]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPagePerformance(1);
    setCurrentPageMultiples(1);
    setCurrentPageQuarterly(1);
  }, [selectedAssetClass, selectedMetric, selectedYear]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch benchmarks
      const benchmarksData = await jwtAPI.request({
        url: '/api/relative-performance/benchmarks',
        method: 'GET'
      }) as Benchmark[];

      // Fetch investments and asset classes
      const investmentsData = await jwtAPI.request({
        url: '/api/relative-performance/investments',
        method: 'GET'
      }) as InvestmentsResponse;

      setBenchmarks(benchmarksData);
      setInvestments(investmentsData.investments);
      setAssetClasses(investmentsData.asset_classes);
      setEarliestPortfolioDate(investmentsData.earliest_portfolio_date);

      // Set default selections
      if (investmentsData.investments.length > 0) {
        setSelectedValue(investmentsData.investments[0].id.toString());
      }
      if (benchmarksData.length > 0) {
        setSelectedBenchmarks([benchmarksData[0].id]);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFullReferenceData = async () => {
    try {
      setReferenceDataLoading(true);
      setReferenceDataError(null);

      // Fetch ALL data without any filters for dropdown options
      const [performanceResponse, multiplesResponse, quarterlyResponse] = await Promise.all([
        fetch(`/api/pitchbook/performance-data`),
        fetch(`/api/pitchbook/multiples-data`),
        fetch(`/api/pitchbook/quarterly-returns`)
      ]);

      if (!performanceResponse.ok || !multiplesResponse.ok || !quarterlyResponse.ok) {
        throw new Error('Failed to fetch PitchBook reference data');
      }

      const [performanceData, multiplesData, quarterlyData] = await Promise.all([
        performanceResponse.json(),
        multiplesResponse.json(),
        quarterlyResponse.json()
      ]);

      // Store full datasets for dropdown options
      setAllPerformanceData(performanceData);
      setAllMultiplesData(multiplesData);
      setAllQuarterlyReturns(quarterlyData);

      // Apply initial filters
      applyFiltersToFullData(performanceData, multiplesData, quarterlyData);

    } catch (err: any) {
      setReferenceDataError(err.message);
    } finally {
      setReferenceDataLoading(false);
    }
  };

  const applyFiltersToData = () => {
    applyFiltersToFullData(allPerformanceData, allMultiplesData, allQuarterlyReturns);
  };

  const applyFiltersToFullData = (performanceData: PitchBookPerformanceData[], multiplesData: PitchBookMultiplesData[], quarterlyData: PitchBookQuarterlyReturns[]) => {
    // Apply filters to the full datasets for display
    let filteredPerformance = performanceData;
    let filteredMultiples = multiplesData;
    let filteredQuarterly = quarterlyData;

    if (selectedAssetClass) {
      filteredPerformance = filteredPerformance.filter(d => d.asset_class === selectedAssetClass);
      filteredMultiples = filteredMultiples.filter(d => d.asset_class === selectedAssetClass);
      filteredQuarterly = filteredQuarterly.filter(d => d.asset_class === selectedAssetClass);
    }

    if (selectedYear) {
      const yearNum = parseInt(selectedYear);
      filteredPerformance = filteredPerformance.filter(d => d.vintage_year === yearNum);
      filteredMultiples = filteredMultiples.filter(d => d.vintage_year === yearNum);
      filteredQuarterly = filteredQuarterly.filter(d => {
        const match = d.quarter_year?.match(/\d{4}/);
        return match ? parseInt(match[0]) === yearNum : false;
      });
    }

    // Update displayed data
    setPitchBookPerformanceData(filteredPerformance);
    setPitchBookMultiplesData(filteredMultiples);
    setPitchBookQuarterlyReturns(filteredQuarterly);
  };

  const handleDateRangeChange = (newStartDate: Date, newEndDate: Date, newViewType: 'month' | 'quarter' | 'year') => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setViewType(newViewType);
  };

  const getSmartStartDate = (): Date => {
    if (selectionType === 'investment' && selectedValue) {
      const selectedInvestment = investments.find(inv => inv.id.toString() === selectedValue);
      if (selectedInvestment?.inception_date) {
        return new Date(selectedInvestment.inception_date);
      }
    } else if (selectionType === 'asset_class' && selectedValue) {
      // Find earliest inception date for this asset class
      const assetClassInvestments = investments.filter(inv => inv.asset_class === selectedValue);
      const inceptionDates = assetClassInvestments
        .map(inv => inv.inception_date)
        .filter(date => date !== undefined) as string[];
      if (inceptionDates.length > 0) {
        const earliestDate = inceptionDates.sort()[0];
        return new Date(earliestDate);
      }
    } else if (selectionType === 'portfolio' && earliestPortfolioDate) {
      return new Date(earliestPortfolioDate);
    }

    // Fallback to current start date or default
    return startDate;
  };

  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDateFromPreset = (preset: string, isEndDate: boolean = false): Date => {
    const now = new Date();
    const currentYear = now.getFullYear();

    switch (preset) {
      case 'inception':
        return getSmartStartDate();
      case 'last-year':
        return new Date(currentYear - 1, 0, 1); // Jan 1 of previous year
      case 'last-quarter':
        // Calculate last complete quarter
        const currentMonth = now.getMonth();
        const currentQuarterStart = Math.floor(currentMonth / 3) * 3;

        if (isEndDate) {
          // End of last complete quarter
          if (currentQuarterStart === 0) {
            // If we're in Q1, last quarter end is Dec 31 of previous year
            return new Date(currentYear - 1, 11, 31);
          } else {
            // End of previous quarter
            return new Date(currentYear, currentQuarterStart, 0); // Last day of previous month
          }
        } else {
          // Start of last complete quarter
          if (currentQuarterStart === 0) {
            // If we're in Q1, last quarter start is Oct 1 of previous year
            return new Date(currentYear - 1, 9, 1);
          } else {
            // Start of previous quarter
            return new Date(currentYear, currentQuarterStart - 3, 1);
          }
        }
      case 'ytd':
        if (isEndDate) {
          return now;
        } else {
          return new Date(currentYear, 0, 1); // Jan 1 of current year
        }
      case 'latest':
        // For end date - return today or latest data date
        return now;
      case 'today':
        return now;
      default:
        return isEndDate ? endDate : startDate;
    }
  };

  const handleStartDatePresetChange = (preset: string) => {
    setStartDatePreset(preset);
    if (preset !== 'custom') {
      const newDate = getDateFromPreset(preset, false);
      setStartDate(newDate);
    }
  };

  const handleEndDatePresetChange = (preset: string) => {
    setEndDatePreset(preset);
    if (preset !== 'custom') {
      const newDate = getDateFromPreset(preset, true);
      setEndDate(newDate);
    }
  };

  const handleCustomStartDateChange = (dateString: string) => {
    setStartDate(new Date(dateString));
    setStartDatePreset('custom');
  };

  const handleCustomEndDateChange = (dateString: string) => {
    setEndDate(new Date(dateString));
    setEndDatePreset('custom');
  };

  // Initialize dates with presets on component load
  useEffect(() => {
    if (investments.length > 0) {
      if (startDatePreset === 'inception') {
        const smartStartDate = getSmartStartDate();
        setStartDate(smartStartDate);
      }
      if (endDatePreset === 'today') {
        setEndDate(new Date());
      }
    }
  }, [investments.length > 0]); // Only run once when investments are loaded

  // Update start date when selection changes
  useEffect(() => {
    if (investments.length > 0 && startDatePreset === 'inception') {
      const smartStartDate = getSmartStartDate();
      if (smartStartDate.getTime() !== startDate.getTime()) {
        setStartDate(smartStartDate);
      }
    }
  }, [selectionType, selectedValue, investments, earliestPortfolioDate, startDatePreset]);

  const handleBenchmarkToggle = (benchmarkId: number) => {
    setSelectedBenchmarks(prev =>
      prev.includes(benchmarkId)
        ? prev.filter(id => id !== benchmarkId)
        : [...prev, benchmarkId]
    );
  };

  const runComparison = async () => {
    if (!selectedValue && selectionType !== 'portfolio') {
      setError('Please select an investment or asset class');
      return;
    }

    if (selectedBenchmarks.length === 0) {
      setError('Please select at least one benchmark');
      return;
    }

    try {
      setComparisonLoading(true);
      setError(null);

      const params = new URLSearchParams({
        selection_type: selectionType,
        benchmark_ids: selectedBenchmarks.join(','),
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        view_mode: viewMode
      });

      if (selectedValue) {
        params.append('selection_value', selectedValue);
      }

      const result = await jwtAPI.request({
        url: `/api/relative-performance/compare?${params}`,
        method: 'GET'
      }) as ComparisonResult;
      setComparisonResult(result);

    } catch (err: any) {
      setError(err.message);
      setComparisonResult(null);
    } finally {
      setComparisonLoading(false);
    }
  };

  const renderSelectionControls = () => (
    <div className="compact-form-row">
      <div className="compact-form-group">
        <label className="control-label">Compare:</label>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              value="investment"
              checked={selectionType === 'investment'}
              onChange={(e) => {
                setSelectionType('investment');
                setSelectedValue(investments.length > 0 ? investments[0].id.toString() : '');
              }}
            />
            Single Investment
          </label>
          <label className="radio-option">
            <input
              type="radio"
              value="asset_class"
              checked={selectionType === 'asset_class'}
              onChange={(e) => {
                setSelectionType('asset_class');
                setSelectedValue(assetClasses.length > 0 ? assetClasses[0] : '');
              }}
            />
            Asset Class
          </label>
          <label className="radio-option">
            <input
              type="radio"
              value="portfolio"
              checked={selectionType === 'portfolio'}
              onChange={(e) => {
                setSelectionType('portfolio');
                setSelectedValue('');
              }}
            />
            Entire Portfolio
          </label>
        </div>
      </div>

      {selectionType === 'investment' && (
        <div className="compact-form-group">
          <label className="control-label">Investment:</label>
          <select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            className="selection-select"
          >
            {investments.map(inv => (
              <option key={inv.id} value={inv.id}>
                {inv.name} ({inv.asset_class}, {inv.vintage_year})
              </option>
            ))}
          </select>
        </div>
      )}

      {selectionType === 'asset_class' && (
        <div className="compact-form-group">
          <label className="control-label">Asset Class:</label>
          <select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            className="selection-select"
          >
            {assetClasses.map(ac => (
              <option key={ac} value={ac}>
                {ac}
              </option>
            ))}
          </select>
        </div>
      )}

    </div>
  );

  const renderBenchmarkSelection = () => (
    <div className="compact-benchmarks">
      <label className="control-label">Benchmarks to Compare:</label>
      <div className="compact-benchmark-grid">
        {benchmarks.map(benchmark => (
          <label key={benchmark.id} className="compact-benchmark-checkbox">
            <input
              type="checkbox"
              checked={selectedBenchmarks.includes(benchmark.id)}
              onChange={() => handleBenchmarkToggle(benchmark.id)}
            />
            <span className="checkbox-label">
              {benchmark.name} ({benchmark.ticker})
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderRelativePerformanceSection = () => (
    <div className="relative-performance-section">
      <div className="section-header">
        <h2>Relative Performance Analysis</h2>
        <p>Compare investment TVPI progression against public market benchmarks using indexed values</p>
      </div>

      <div className="controls-panel">
        {renderSelectionControls()}

        <div className="compact-date-row">
          {/* Start Date Section */}
          <div className="compact-date-group">
            <div className="preset-label">Start Date:</div>
            <div className="preset-controls">
              <div className="preset-buttons">
                <button
                  type="button"
                  className={`preset-btn ${startDatePreset === 'inception' ? 'active' : ''}`}
                  onClick={() => handleStartDatePresetChange('inception')}
                >
                  Inception
                </button>
                <button
                  type="button"
                  className={`preset-btn ${startDatePreset === 'last-year' ? 'active' : ''}`}
                  onClick={() => handleStartDatePresetChange('last-year')}
                >
                  Last Year
                </button>
                <button
                  type="button"
                  className={`preset-btn ${startDatePreset === 'last-quarter' ? 'active' : ''}`}
                  onClick={() => handleStartDatePresetChange('last-quarter')}
                >
                  Last Quarter
                </button>
                <button
                  type="button"
                  className={`preset-btn ${startDatePreset === 'ytd' ? 'active' : ''}`}
                  onClick={() => handleStartDatePresetChange('ytd')}
                >
                  YTD
                </button>
                <button
                  type="button"
                  className={`preset-btn ${startDatePreset === 'custom' ? 'active' : ''}`}
                  onClick={() => handleStartDatePresetChange('custom')}
                >
                  Custom...
                </button>
              </div>
              <div className="date-display-box">
                {startDatePreset === 'custom' ? (
                  <input
                    type="date"
                    value={startDate.toISOString().split('T')[0]}
                    onChange={(e) => handleCustomStartDateChange(e.target.value)}
                    className="date-input editable"
                  />
                ) : (
                  <div className="date-display readonly">
                    {formatDateForDisplay(startDate)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* End Date Section */}
          <div className="compact-date-group">
            <div className="preset-label">End Date:</div>
            <div className="preset-controls">
              <div className="preset-buttons">
                <button
                  type="button"
                  className={`preset-btn ${endDatePreset === 'latest' ? 'active' : ''}`}
                  onClick={() => handleEndDatePresetChange('latest')}
                >
                  Latest
                </button>
                <button
                  type="button"
                  className={`preset-btn ${endDatePreset === 'last-quarter' ? 'active' : ''}`}
                  onClick={() => handleEndDatePresetChange('last-quarter')}
                >
                  Last Quarter
                </button>
                <button
                  type="button"
                  className={`preset-btn ${endDatePreset === 'ytd' ? 'active' : ''}`}
                  onClick={() => handleEndDatePresetChange('ytd')}
                >
                  YTD
                </button>
                <button
                  type="button"
                  className={`preset-btn ${endDatePreset === 'today' ? 'active' : ''}`}
                  onClick={() => handleEndDatePresetChange('today')}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`preset-btn ${endDatePreset === 'custom' ? 'active' : ''}`}
                  onClick={() => handleEndDatePresetChange('custom')}
                >
                  Custom...
                </button>
              </div>
              <div className="date-display-box">
                {endDatePreset === 'custom' ? (
                  <input
                    type="date"
                    value={endDate.toISOString().split('T')[0]}
                    onChange={(e) => handleCustomEndDateChange(e.target.value)}
                    className="date-input editable"
                  />
                ) : (
                  <div className="date-display readonly">
                    {formatDateForDisplay(endDate)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="view-mode-control">
          <label className="control-label">Performance View:</label>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="viewMode"
                value="absolute"
                checked={viewMode === 'absolute'}
                onChange={(e) => setViewMode(e.target.value as 'absolute' | 'rebased')}
              />
              <span>Absolute (from inception)</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="viewMode"
                value="rebased"
                checked={viewMode === 'rebased'}
                onChange={(e) => setViewMode(e.target.value as 'absolute' | 'rebased')}
              />
              <span>Rebased (from start date)</span>
            </label>
          </div>
        </div>

        {renderBenchmarkSelection()}

        <div className="compact-form-row action-row">
          <button
            onClick={runComparison}
            disabled={comparisonLoading}
            className="run-comparison-btn"
          >
            {comparisonLoading ? 'Running Comparison...' : 'Run Comparison'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {comparisonResult && (
        <div className="comparison-results">
          <div className="chart-container">
            <h3>Performance Comparison Chart</h3>
            <div style={{ width: '100%', height: 400, marginTop: '20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={prepareChartData(comparisonResult)}
                  margin={{
                    top: 80,
                    right: 30,
                    left: 80,
                    bottom: 20
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  />
                  <YAxis
                    tickFormatter={(value) => `${value.toFixed(0)}`}
                    label={{ value: 'Indexed Value (Base = 100)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: any, name: string) => [
                      typeof value === 'number' ? value.toFixed(2) : 'N/A',
                      name
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="investment"
                    stroke="#2563eb"
                    strokeWidth={3}
                    name="Investment TVPI"
                    connectNulls={false}
                    dot={{ r: 4 }}
                  />
                  {comparisonResult.benchmarks.map((benchmark, index) => (
                    <Line
                      key={benchmark.id}
                      type="monotone"
                      dataKey={`benchmark_${benchmark.id}`}
                      stroke={getBenchmarkColor(index)}
                      strokeWidth={2}
                      name={benchmark.name}
                      connectNulls={false}
                      strokeDasharray={index % 2 === 1 ? "5 5" : undefined}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-info" style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
              <p><strong>Date Range:</strong> {comparisonResult.date_range.start} to {comparisonResult.date_range.end}</p>
              <p><strong>Investment Data Points:</strong> {comparisonResult.investment_performance.length}</p>
              <p><strong>Benchmarks:</strong> {comparisonResult.benchmarks.map(b => b.name).join(', ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const formatPercentage = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatMultiple = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${value.toFixed(2)}x`;
  };

  const getUniqueAssetClasses = () => {
    // Use full datasets (not filtered) to ensure all options remain available
    const allData = [...allPerformanceData, ...allMultiplesData, ...allQuarterlyReturns];
    const uniqueClasses = Array.from(new Set(allData.map(d => d.asset_class))).sort();
    return uniqueClasses;
  };

  const getUniqueYears = () => {
    // Use full datasets (not filtered) to ensure all options remain available
    const performanceYears = allPerformanceData.map(d => d.vintage_year);
    const multiplesYears = allMultiplesData.map(d => d.vintage_year);
    const quarterlyYears = allQuarterlyReturns.map(d => {
      // Extract year from quarter_year format (e.g. "Q1 2024" -> 2024)
      const match = d.quarter_year?.match(/\d{4}/);
      return match ? parseInt(match[0]) : null;
    }).filter(year => year !== null);

    const allYears = [...performanceYears, ...multiplesYears, ...quarterlyYears];
    const uniqueYears = Array.from(new Set(allYears))
      .filter((year): year is number => year !== null)
      .sort((a, b) => b - a);
    return uniqueYears;
  };

  // Pagination helper functions
  const getPaginatedData = (data: any[], currentPage: number): any[] => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number): number => {
    return Math.ceil(totalItems / rowsPerPage);
  };

  const renderPaginationControls = (
    currentPage: number,
    totalItems: number,
    setCurrentPage: (page: number) => void,
    dataType: string
  ) => {
    const totalPages = getTotalPages(totalItems);
    if (totalPages <= 1) return null;

    return (
      <div className="table-pagination">
        <div className="pagination-info">
          Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, totalItems)} of {totalItems} records
        </div>
        <div className="pagination-controls">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const getFilteredData = () => {
    let filteredPerformance = pitchBookPerformanceData;
    let filteredMultiples = pitchBookMultiplesData;
    let filteredQuarterly = pitchBookQuarterlyReturns;

    // Apply asset class filter
    if (selectedAssetClass) {
      filteredPerformance = filteredPerformance.filter(d => d.asset_class === selectedAssetClass);
      filteredMultiples = filteredMultiples.filter(d => d.asset_class === selectedAssetClass);
      filteredQuarterly = filteredQuarterly.filter(d => d.asset_class === selectedAssetClass);
    }

    return { filteredPerformance, filteredMultiples, filteredQuarterly };
  };

  const renderReferenceDataSection = () => {
    const { filteredPerformance, filteredMultiples, filteredQuarterly } = getFilteredData();

    return (
      <div className="reference-data-section">
        <div className="section-header">
          <h2>Benchmark Reference Data</h2>
          <p>Historical performance data for private market benchmarks by asset class and vintage year</p>
        </div>

        {/* Filter Controls */}
        <div className="reference-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">Asset Class:</label>
              <select
                value={selectedAssetClass}
                onChange={(e) => setSelectedAssetClass(e.target.value)}
                className="filter-select"
              >
                <option value="">All Asset Classes</option>
                {getUniqueAssetClasses().map(assetClass => (
                  <option key={assetClass} value={assetClass}>
                    {assetClass.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Return Metric:</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="filter-select"
              >
                <option value="">All Metrics</option>
                <option value="IRR">IRR Performance</option>
                <option value="TVPI">TVPI/DPI</option>
                <option value="QUARTERLY">Quarterly Returns</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Vintage Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="filter-select"
              >
                <option value="">All Years</option>
                {getUniqueYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {(selectedAssetClass || selectedMetric || selectedYear) && (
              <div className="filter-group">
                <button
                  onClick={() => {
                    setSelectedAssetClass('');
                    setSelectedMetric('');
                    setSelectedYear('');
                  }}
                  className="clear-filters-btn"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {referenceDataError && (
          <div className="error-message">
            {referenceDataError}
          </div>
        )}

        {referenceDataLoading ? (
          <div className="loading-message">Loading PitchBook reference data...</div>
        ) : (
          <div className="reference-tables">
            {/* IRR Performance Data Table */}
            {filteredPerformance.length > 0 && (selectedMetric === '' || selectedMetric === 'IRR') && (
              <div className="reference-table-section">
                <h3>IRR Performance by Vintage Year</h3>
                <div className="table-container">
                  <table className="reference-table">
                    <thead>
                      <tr>
                        <th>Asset Class</th>
                        <th>Vintage Year</th>
                        <th>Top Quartile</th>
                        <th>Median</th>
                        <th>Bottom Quartile</th>
                        <th>Pooled IRR</th>
                        <th>Equal Weighted</th>
                        <th>Sample Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPaginatedData(filteredPerformance, currentPagePerformance).map((row, index) => (
                        <tr key={index}>
                          <td>{row.asset_class.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                          <td>{row.vintage_year}</td>
                          <td>{formatPercentage(row.top_quartile_value)}</td>
                          <td>{formatPercentage(row.median_value)}</td>
                          <td>{formatPercentage(row.bottom_quartile_value)}</td>
                          <td>{formatPercentage(row.pooled_irr)}</td>
                          <td>{formatPercentage(row.equal_weighted_pooled_irr)}</td>
                          <td>{row.sample_size || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderPaginationControls(
                  currentPagePerformance,
                  filteredPerformance.length,
                  setCurrentPagePerformance,
                  'performance'
                )}
              </div>
            )}

            {/* TVPI/DPI Multiples Data Table */}
            {filteredMultiples.length > 0 && (selectedMetric === '' || selectedMetric === 'TVPI') && (
              <div className="reference-table-section">
                <h3>TVPI & DPI Multiples by Vintage Year</h3>
                <div className="table-container">
                  <table className="reference-table">
                    <thead>
                      <tr>
                        <th>Asset Class</th>
                        <th>Vintage Year</th>
                        <th>TVPI Median</th>
                        <th>TVPI Top Q</th>
                        <th>TVPI Bottom Q</th>
                        <th>DPI Median</th>
                        <th>DPI Top Q</th>
                        <th>DPI Bottom Q</th>
                        <th>Fund Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPaginatedData(filteredMultiples, currentPageMultiples).map((row, index) => (
                        <tr key={index}>
                          <td>{row.asset_class.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                          <td>{row.vintage_year}</td>
                          <td>{formatMultiple(row.tvpi_median)}</td>
                          <td>{formatMultiple(row.tvpi_top_quartile)}</td>
                          <td>{formatMultiple(row.tvpi_bottom_quartile)}</td>
                          <td>{formatMultiple(row.dpi_median)}</td>
                          <td>{formatMultiple(row.dpi_top_quartile)}</td>
                          <td>{formatMultiple(row.dpi_bottom_quartile)}</td>
                          <td>{row.fund_count || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderPaginationControls(
                  currentPageMultiples,
                  filteredMultiples.length,
                  setCurrentPageMultiples,
                  'multiples'
                )}
              </div>
            )}


            {/* Quarterly Returns Data Table */}
            {filteredQuarterly.length > 0 && (selectedMetric === '' || selectedMetric === 'QUARTERLY') && (
              <div className="reference-table-section">
                <h3>Quarterly Returns by Asset Class</h3>
                <div className="table-container">
                  <table className="reference-table">
                    <thead>
                      <tr>
                        <th>Asset Class</th>
                        <th>Quarter</th>
                        <th>Quarter Date</th>
                        <th>Top Quartile</th>
                        <th>Median</th>
                        <th>Bottom Quartile</th>
                        <th>Sample Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPaginatedData(filteredQuarterly, currentPageQuarterly).map((row, index) => (
                        <tr key={index}>
                          <td>{row.asset_class.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                          <td>{row.quarter_year}</td>
                          <td>{row.quarter_date}</td>
                          <td>{formatPercentage(row.top_quartile_return)}</td>
                          <td>{formatPercentage(row.median_return)}</td>
                          <td>{formatPercentage(row.bottom_quartile_return)}</td>
                          <td>{row.sample_size || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderPaginationControls(
                  currentPageQuarterly,
                  filteredQuarterly.length,
                  setCurrentPageQuarterly,
                  'quarterly'
                )}
              </div>
            )}

          <div className="data-summary">
            <h4>Data Summary</h4>
            <ul>
              <li><strong>Performance Records:</strong> {allPerformanceData.length} IRR data points (showing {pitchBookPerformanceData.length} filtered)</li>
              <li><strong>Multiples Records:</strong> {allMultiplesData.length} TVPI/DPI data points (showing {pitchBookMultiplesData.length} filtered)</li>
              <li><strong>Quarterly Records:</strong> {allQuarterlyReturns.length} quarterly return data points (showing {pitchBookQuarterlyReturns.length} filtered)</li>
              <li><strong>Coverage:</strong> 7 asset classes from 2001-2024</li>
              <li><strong>Methodology:</strong> PitchBook quarterly benchmark data with historical returns</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
  };

  if (loading) {
    return (
      <div className="benchmarks-container">
        <div className="luxury-card page-header">
          <h1 className="luxury-heading-1">Benchmark Analysis</h1>
        </div>
        <div className="loading-message">Loading benchmark data...</div>
      </div>
    );
  }

  return (
    <div className="benchmarks-container">
      <div className="luxury-card page-header">
        <h1 className="luxury-heading-1">Benchmark Analysis</h1>
      </div>

      <div className="benchmarks-header">
        <div className="section-tabs">
          <button
            className={`tab-button ${selectedSection === 'relative' ? 'active' : ''}`}
            onClick={() => setSelectedSection('relative')}
          >
            Relative Performance
          </button>
          <button
            className={`tab-button ${selectedSection === 'reference' ? 'active' : ''}`}
            onClick={() => setSelectedSection('reference')}
          >
            Reference Data
          </button>
        </div>
      </div>

      <div className="section-content">
        {selectedSection === 'relative' ? renderRelativePerformanceSection() : renderReferenceDataSection()}
      </div>
    </div>
  );
};

export default Benchmarks;