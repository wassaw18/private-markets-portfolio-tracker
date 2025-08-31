import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TimelineDataPoint } from '../types/investment';
import { dashboardAPI } from '../services/api';
import './ChartComponents.css';

const PortfolioTimelineChart: React.FC = () => {
  const [data, setData] = useState<TimelineDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'absolute' | 'cumulative'>('absolute');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardAPI.getPortfolioValueTimeline();
      setData(result);
    } catch (err) {
      setError('Failed to load portfolio timeline data');
      console.error('Error fetching portfolio timeline data:', err);
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
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>Portfolio Value Over Time</h3>
        </div>
        <div className="chart-loading">Loading timeline data...</div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>Portfolio Value Over Time</h3>
        </div>
        <div className="chart-error">{error || 'No timeline data available'}</div>
      </div>
    );
  }

  const startDate = data.length > 0 ? data[0].date : '';
  const endDate = data.length > 0 ? data[data.length - 1].date : '';
  const timeSpan = data.length > 0 ? 
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <h3>Portfolio Value Over Time</h3>
        <div className="chart-controls">
          <div className="date-range-info">
            {data.length > 0 && (
              <>
                {formatDate(startDate)} - {formatDate(endDate)} 
                <span style={{ marginLeft: '8px', color: '#999' }}>
                  ({timeSpan} days)
                </span>
              </>
            )}
          </div>
          <button 
            className={`control-button ${viewMode === 'absolute' ? 'active' : ''}`}
            onClick={() => setViewMode('absolute')}
          >
            Absolute Values
          </button>
          <button 
            className={`control-button ${viewMode === 'cumulative' ? 'active' : ''}`}
            onClick={() => setViewMode('cumulative')}
          >
            Cumulative View
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
            <Legend />
            
            {viewMode === 'absolute' ? (
              <>
                <Line 
                  type="monotone" 
                  dataKey="nav_value" 
                  stroke="#007bff" 
                  strokeWidth={3}
                  dot={{ fill: '#007bff', strokeWidth: 2, r: 4 }}
                  name="Current NAV"
                  connectNulls={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulative_distributions" 
                  stroke="#28a745" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#28a745', strokeWidth: 2, r: 3 }}
                  name="Cumulative Distributions"
                />
                <Line 
                  type="monotone" 
                  dataKey="net_value" 
                  stroke="#17a2b8" 
                  strokeWidth={3}
                  dot={{ fill: '#17a2b8', strokeWidth: 2, r: 4 }}
                  name="Total Value (NAV + Distributions)"
                />
              </>
            ) : (
              <>
                <Line 
                  type="monotone" 
                  dataKey="cumulative_contributions" 
                  stroke="#dc3545" 
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={{ fill: '#dc3545', strokeWidth: 2, r: 3 }}
                  name="Cumulative Contributions"
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulative_distributions" 
                  stroke="#28a745" 
                  strokeWidth={3}
                  dot={{ fill: '#28a745', strokeWidth: 2, r: 4 }}
                  name="Cumulative Distributions"
                />
                <Line 
                  type="monotone" 
                  dataKey="net_value" 
                  stroke="#17a2b8" 
                  strokeWidth={3}
                  dot={{ fill: '#17a2b8', strokeWidth: 2, r: 4 }}
                  name="Total Portfolio Value"
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-summary">
        <div className="summary-stats">
          <div className="summary-stat">
            <label>Latest NAV</label>
            <span className="stat-value">
              {data.length > 0 ? formatCurrency(data[data.length - 1].nav_value) : 'N/A'}
            </span>
          </div>
          <div className="summary-stat">
            <label>Total Contributions</label>
            <span className="stat-value negative">
              {data.length > 0 ? formatCurrency(data[data.length - 1].cumulative_contributions) : 'N/A'}
            </span>
          </div>
          <div className="summary-stat">
            <label>Total Distributions</label>
            <span className="stat-value positive">
              {data.length > 0 ? formatCurrency(data[data.length - 1].cumulative_distributions) : 'N/A'}
            </span>
          </div>
          <div className="summary-stat">
            <label>Current Total Value</label>
            <span className="stat-value">
              {data.length > 0 ? formatCurrency(data[data.length - 1].net_value) : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioTimelineChart;