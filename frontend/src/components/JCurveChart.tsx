import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { JCurveDataPoint } from '../types/investment';
import { dashboardAPI } from '../services/api';
import './ChartComponents.css';

const JCurveChart: React.FC = () => {
  const [data, setData] = useState<JCurveDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'net' | 'components'>('net');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardAPI.getJCurveData();
      setData(result);
    } catch (err) {
      setError('Failed to load J-Curve data');
      console.error('Error fetching J-Curve data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short',
      day: 'numeric'
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{formatDate(label)}</p>
          <p className="tooltip-value" style={{ color: '#dc3545' }}>
            Contributions: {formatCurrency(Math.abs(dataPoint.cumulative_contributions))}
          </p>
          <p className="tooltip-value" style={{ color: '#28a745' }}>
            Distributions: {formatCurrency(dataPoint.cumulative_distributions)}
          </p>
          <p className="tooltip-value" style={{ color: '#007bff' }}>
            Net Cash Flow: {formatCurrency(dataPoint.cumulative_net_cash_flow)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>J-Curve Analysis</h3>
        </div>
        <div className="chart-loading">Loading J-Curve data...</div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>J-Curve Analysis</h3>
        </div>
        <div className="chart-error">{error || 'No J-Curve data available'}</div>
      </div>
    );
  }

  const startDate = data.length > 0 ? data[0].date : '';
  const endDate = data.length > 0 ? data[data.length - 1].date : '';
  const latestNetCashFlow = data.length > 0 ? data[data.length - 1].cumulative_net_cash_flow : 0;
  
  // Find the lowest point (most negative) in the curve
  const lowestPoint = data.reduce((min, point) => 
    point.cumulative_net_cash_flow < min.cumulative_net_cash_flow ? point : min, data[0]);
  
  const isPositive = latestNetCashFlow >= 0;
  const jCurveDescription = isPositive ? 
    "Portfolio has turned positive (J-Curve inflection point reached)" :
    "Portfolio is in negative cash flow phase (early J-Curve stage)";

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <h3>J-Curve Analysis</h3>
        <div className="chart-controls">
          <div className="date-range-info">
            {data.length > 0 && (
              <>
                {formatDate(startDate)} - {formatDate(endDate)}
                <span style={{ marginLeft: '8px', color: isPositive ? '#28a745' : '#dc3545' }}>
                  ({isPositive ? 'Positive' : 'Negative'} Phase)
                </span>
              </>
            )}
          </div>
          <button 
            className={`control-button ${viewMode === 'net' ? 'active' : ''}`}
            onClick={() => setViewMode('net')}
          >
            Net Cash Flow
          </button>
          <button 
            className={`control-button ${viewMode === 'components' ? 'active' : ''}`}
            onClick={() => setViewMode('components')}
          >
            Components
          </button>
        </div>
      </div>

      <div className="chart-content">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis 
              dataKey="date" 
              stroke="#666"
              fontSize={11}
              tick={{ fill: '#666' }}
              tickFormatter={formatDate}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#666"
              fontSize={11}
              tick={{ fill: '#666' }}
              tickFormatter={formatCurrency}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Zero reference line */}
            <ReferenceLine y={0} stroke="#999" strokeDasharray="2 2" />
            
            {viewMode === 'net' ? (
              <Line 
                type="monotone" 
                dataKey="cumulative_net_cash_flow" 
                stroke="#007bff" 
                strokeWidth={3}
                dot={{ fill: '#007bff', strokeWidth: 2, r: 4 }}
                name="Cumulative Net Cash Flow"
                connectNulls={false}
              />
            ) : (
              <>
                <Line 
                  type="monotone" 
                  dataKey="cumulative_contributions" 
                  stroke="#dc3545" 
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={{ fill: '#dc3545', strokeWidth: 2, r: 3 }}
                  name="Cumulative Contributions (Outflows)"
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulative_distributions" 
                  stroke="#28a745" 
                  strokeWidth={3}
                  dot={{ fill: '#28a745', strokeWidth: 2, r: 4 }}
                  name="Cumulative Distributions (Inflows)"
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-summary">
        <div className="summary-stats">
          <div className="summary-stat">
            <label>Current Net Cash Flow</label>
            <span className={`stat-value ${isPositive ? 'positive' : 'negative'}`}>
              {formatCurrency(latestNetCashFlow)}
            </span>
          </div>
          <div className="summary-stat">
            <label>Lowest Point</label>
            <span className="stat-value negative">
              {formatCurrency(lowestPoint.cumulative_net_cash_flow)}
            </span>
          </div>
          <div className="summary-stat">
            <label>Total Contributions</label>
            <span className="stat-value negative">
              {data.length > 0 ? formatCurrency(Math.abs(data[data.length - 1].cumulative_contributions)) : 'N/A'}
            </span>
          </div>
          <div className="summary-stat">
            <label>Total Distributions</label>
            <span className="stat-value positive">
              {data.length > 0 ? formatCurrency(data[data.length - 1].cumulative_distributions) : 'N/A'}
            </span>
          </div>
        </div>
        
        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <div className={`performance-indicator ${isPositive ? 'positive' : 'negative'}`}>
            <strong>J-Curve Status:</strong> {jCurveDescription}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JCurveChart;