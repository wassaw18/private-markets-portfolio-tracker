import React, { useState, useEffect, useCallback } from 'react';
import { investmentAPI } from '../services/api';
import './InvestmentForecastChart.css';

interface CashFlowForecast {
  id: number;
  forecast_year: number;
  forecast_period_start: string;
  forecast_period_end: string;
  projected_calls: number;
  projected_distributions: number;
  projected_nav: number;
  cumulative_calls: number;
  cumulative_distributions: number;
  cumulative_net_cf: number;
  scenario: 'Bull' | 'Base' | 'Bear';
}

interface InvestmentForecastSummary {
  investment_id: number;
  investment_name: string;
  forecast_generated_date: string | null;
  total_projected_calls: number;
  total_projected_distributions: number;
  expected_net_cash_flow: number;
  expected_irr: number;
  expected_moic: number;
  forecast_accuracy_score: number;
  base_case: CashFlowForecast[];
  bull_case?: CashFlowForecast[];
  bear_case?: CashFlowForecast[];
}

interface InvestmentForecastChartProps {
  investmentId: number;
  onUpdate?: () => void;
}

const InvestmentForecastChart: React.FC<InvestmentForecastChartProps> = ({ 
  investmentId, 
  onUpdate 
}) => {
  const [forecast, setForecast] = useState<InvestmentForecastSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<'Bull' | 'Base' | 'Bear'>('Base');
  const [showCumulative, setShowCumulative] = useState(true);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await investmentAPI.getForecast(investmentId);
      setForecast(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('No forecast data available. Generate forecast first using the pacing model.');
      } else {
        setError('Failed to load forecast data');
      }
      console.error('Error fetching forecast:', err);
    } finally {
      setLoading(false);
    }
  }, [investmentId]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatMultiple = (value: number) => `${value.toFixed(1)}x`;

  const getScenarioData = (): CashFlowForecast[] => {
    if (!forecast) return [];
    
    switch (activeScenario) {
      case 'Bull':
        return forecast.bull_case || [];
      case 'Bear':
        return forecast.bear_case || [];
      default:
        return forecast.base_case || [];
    }
  };

  const getScenarioColor = (scenario: string) => {
    switch (scenario) {
      case 'Bull': return '#28a745';
      case 'Bear': return '#dc3545';
      default: return '#007bff';
    }
  };

  const getMaxValue = (data: CashFlowForecast[]) => {
    if (!data.length) return 100;
    
    const values = showCumulative
      ? data.map(d => Math.max(Math.abs(d.cumulative_calls), Math.abs(d.cumulative_distributions), d.projected_nav))
      : data.map(d => Math.max(Math.abs(d.projected_calls), Math.abs(d.projected_distributions), d.projected_nav));
    
    return Math.max(...values) * 1.1; // Add 10% padding
  };

  const renderChart = () => {
    const data = getScenarioData();
    if (!data.length) return <div className="no-data">No forecast data available</div>;

    const maxValue = getMaxValue(data);
    const chartHeight = 300;
    const chartWidth = 800;
    const padding = { top: 20, right: 50, bottom: 60, left: 80 };
    
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;
    
    const xScale = (index: number) => (index / (data.length - 1)) * innerWidth;
    const yScale = (value: number) => innerHeight - (value / maxValue) * innerHeight;
    
    // Create paths for the different metrics
    const createPath = (valueAccessor: (d: CashFlowForecast) => number, isNegative = false) => {
      return data.map((d, i) => {
        const x = xScale(i);
        const value = isNegative ? -Math.abs(valueAccessor(d)) : valueAccessor(d);
        const y = yScale(value);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      }).join(' ');
    };
    
    const callsPath = createPath(d => showCumulative ? d.cumulative_calls : d.projected_calls, true);
    const distributionsPath = createPath(d => showCumulative ? d.cumulative_distributions : d.projected_distributions);
    const navPath = createPath(d => d.projected_nav);
    
    return (
      <div className="forecast-chart">
        <svg width={chartWidth} height={chartHeight} className="chart-svg">
          {/* Grid lines */}
          <g className="grid">
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
              <line
                key={ratio}
                x1={padding.left}
                y1={padding.top + ratio * innerHeight}
                x2={padding.left + innerWidth}
                y2={padding.top + ratio * innerHeight}
                stroke="#e9ecef"
                strokeDasharray="2,2"
              />
            ))}
            {data.map((_, i) => (
              <line
                key={i}
                x1={padding.left + xScale(i)}
                y1={padding.top}
                x2={padding.left + xScale(i)}
                y2={padding.top + innerHeight}
                stroke="#f8f9fa"
                strokeWidth="1"
              />
            ))}
          </g>
          
          {/* Zero line */}
          <line
            x1={padding.left}
            y1={padding.top + yScale(0)}
            x2={padding.left + innerWidth}
            y2={padding.top + yScale(0)}
            stroke="#666"
            strokeWidth="1"
          />
          
          {/* Area under curves */}
          <g className="areas">
            {/* Negative cash flows area */}
            <path
              d={`M${padding.left},${padding.top + yScale(0)} ${callsPath.replace(/M|L/g, match => 
                match === 'M' ? `M${padding.left},` : `L${padding.left},`
              )} L${padding.left + xScale(data.length - 1)},${padding.top + yScale(0)} Z`}
              fill="rgba(220, 53, 69, 0.2)"
              className="calls-area"
            />
            
            {/* Positive distributions area */}
            <path
              d={`M${padding.left},${padding.top + yScale(0)} ${distributionsPath.replace(/M|L/g, match => 
                match === 'M' ? `M${padding.left},` : `L${padding.left},`
              )} L${padding.left + xScale(data.length - 1)},${padding.top + yScale(0)} Z`}
              fill="rgba(40, 167, 69, 0.2)"
              className="distributions-area"
            />
          </g>
          
          {/* Lines */}
          <g className="lines" transform={`translate(${padding.left},${padding.top})`}>
            <path
              d={callsPath}
              fill="none"
              stroke="#dc3545"
              strokeWidth="3"
              className="calls-line"
            />
            <path
              d={distributionsPath}
              fill="none"
              stroke="#28a745"
              strokeWidth="3"
              className="distributions-line"
            />
            <path
              d={navPath}
              fill="none"
              stroke="#007bff"
              strokeWidth="3"
              strokeDasharray="5,5"
              className="nav-line"
            />
          </g>
          
          {/* Data points */}
          <g className="points" transform={`translate(${padding.left},${padding.top})`}>
            {data.map((d, i) => {
              const x = xScale(i);
              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={yScale(showCumulative ? -d.cumulative_calls : -d.projected_calls)}
                    r="4"
                    fill="#dc3545"
                    className="call-point"
                  />
                  <circle
                    cx={x}
                    cy={yScale(showCumulative ? d.cumulative_distributions : d.projected_distributions)}
                    r="4"
                    fill="#28a745"
                    className="distribution-point"
                  />
                  <circle
                    cx={x}
                    cy={yScale(d.projected_nav)}
                    r="4"
                    fill="#007bff"
                    className="nav-point"
                  />
                </g>
              );
            })}
          </g>
          
          {/* Axes */}
          <g className="axes">
            {/* Y-axis */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + innerHeight}
              stroke="#333"
              strokeWidth="2"
            />
            
            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
              const value = maxValue * (1 - ratio);
              return (
                <text
                  key={ratio}
                  x={padding.left - 10}
                  y={padding.top + ratio * innerHeight + 5}
                  textAnchor="end"
                  className="axis-label"
                  fontSize="12"
                  fill="#666"
                >
                  {formatCurrency(value)}
                </text>
              );
            })}
            
            {/* X-axis */}
            <line
              x1={padding.left}
              y1={padding.top + innerHeight}
              x2={padding.left + innerWidth}
              y2={padding.top + innerHeight}
              stroke="#333"
              strokeWidth="2"
            />
            
            {/* X-axis labels */}
            {data.map((d, i) => (
              <text
                key={i}
                x={padding.left + xScale(i)}
                y={padding.top + innerHeight + 20}
                textAnchor="middle"
                className="axis-label"
                fontSize="12"
                fill="#666"
              >
                {new Date(d.forecast_period_start).getFullYear()}
              </text>
            ))}
          </g>
        </svg>
        
        {/* Legend */}
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#dc3545' }}></div>
            <span>Capital Calls</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#28a745' }}></div>
            <span>Distributions</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ border: '2px dashed #007bff', backgroundColor: 'transparent' }}></div>
            <span>NAV</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="forecast-loading">Loading forecast chart...</div>;
  }

  if (error) {
    return <div className="forecast-error">{error}</div>;
  }

  if (!forecast) {
    return <div className="forecast-no-data">No forecast data available</div>;
  }

  return (
    <div className="investment-forecast-chart">
      <div className="chart-header">
        <h3>Cash Flow Forecast</h3>
        <div className="chart-controls">
          <div className="scenario-tabs">
            {['Base', 'Bull', 'Bear'].map((scenario) => (
              <button
                key={scenario}
                className={`scenario-tab ${activeScenario === scenario ? 'active' : ''}`}
                onClick={() => setActiveScenario(scenario as any)}
                style={{ 
                  borderColor: activeScenario === scenario ? getScenarioColor(scenario) : '#e9ecef',
                  color: activeScenario === scenario ? getScenarioColor(scenario) : '#666'
                }}
              >
                {scenario}
              </button>
            ))}
          </div>
          
          <div className="view-toggle">
            <button
              className={`toggle-btn ${showCumulative ? 'active' : ''}`}
              onClick={() => setShowCumulative(true)}
            >
              Cumulative
            </button>
            <button
              className={`toggle-btn ${!showCumulative ? 'active' : ''}`}
              onClick={() => setShowCumulative(false)}
            >
              Annual
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="forecast-summary-metrics">
        <div className="metric">
          <span className="metric-label">Expected IRR:</span>
          <span className="metric-value">{formatPercentage(forecast.expected_irr)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Expected MOIC:</span>
          <span className="metric-value">{formatMultiple(forecast.expected_moic)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Net Cash Flow:</span>
          <span className={`metric-value ${forecast.expected_net_cash_flow >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(forecast.expected_net_cash_flow)}
          </span>
        </div>
      </div>

      {renderChart()}
    </div>
  );
};

export default InvestmentForecastChart;