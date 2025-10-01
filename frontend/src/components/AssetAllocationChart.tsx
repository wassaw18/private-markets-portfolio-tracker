import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AssetAllocationData } from '../types/investment';
import { dashboardAPI } from '../services/api';
import './ChartComponents.css';

const AssetAllocationChart: React.FC = () => {
  const [data, setData] = useState<AssetAllocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'table' | 'pie'>('table');

  // Luxury color palette for asset classes using design system
  const COLORS = [
    '#0B1426', // Navy - Private Equity
    '#1A2B47', // Dark Blue - Private Credit  
    '#2D4263', // Medium Blue - Real Estate
    '#3B5998', // Accent Blue - Infrastructure
    '#C9A96E', // Gold - Hedge Funds
    '#B8860B', // Bronze - Venture Capital
    '#2C3E50', // Charcoal - Other
    '#34495E', // Slate - Alternative
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardAPI.getAllocationByAssetClass();
      setData(result);
    } catch (err) {
      setError('Failed to load asset allocation data');
      console.error('Error fetching asset allocation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return '$0';
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (!data) return null;

      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{data.name || 'Unknown Asset Class'}</p>
          <p className="tooltip-value">Amount: {formatCurrency(data.value)}</p>
          <p className="tooltip-value">Percentage: {(data.percentage || 0).toFixed(1)}%</p>
          <p className="tooltip-value">Count: {data.count || 0} investment{(data.count || 0) !== 1 ? 's' : ''}</p>
        </div>
      );
    }
    return null;
  };

  // Prepare data for pie chart
  const pieData = data.map((item, index) => ({
    name: item.asset_class,
    value: item.commitment_amount,
    percentage: item.percentage,
    count: item.count,
    color: COLORS[index % COLORS.length]
  }));

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    // Only show label if percentage is significant enough
    if (percent < 0.05) return null; // Don't show labels for slices less than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>Allocation by Asset Class</h3>
        </div>
        <div className="chart-loading">Loading chart data...</div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>Allocation by Asset Class</h3>
        </div>
        <div className="chart-error">{error || 'No asset allocation data available'}</div>
      </div>
    );
  }

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <h3>Allocation by Asset Class</h3>
        <div className="chart-controls">
          <button
            className={`control-button ${viewType === 'table' ? 'active' : ''}`}
            onClick={() => setViewType('table')}
          >
            Table View
          </button>
          <button
            className={`control-button ${viewType === 'pie' ? 'active' : ''}`}
            onClick={() => setViewType('pie')}
          >
            Pie Chart
          </button>
        </div>
        <div className="chart-subtitle">
          Portfolio diversification across {data.length} asset classes
        </div>
      </div>

      <div className="chart-content">
        {viewType === 'table' ? (
          <div className="compact-allocation">
            <div className="compact-table-wrapper">
              <div className="allocation-table">
                <div className="table-header">
                  <span>Asset Class</span>
                  <span>Amount</span>
                  <span>%</span>
                </div>
                {data.map((item, index) => (
                  <div key={item.asset_class} className="table-row">
                    <div className="asset-info">
                      <div
                        className="color-dot"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span className="asset-name">{item.asset_class}</span>
                    </div>
                    <span className="amount-value">{formatCurrency(item.commitment_amount)}</span>
                    <span className="percentage-value">{item.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              {/* Summary Stats */}
              <div className="table-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Classes</span>
                  <span className="summary-value">{data.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Investments</span>
                  <span className="summary-value">{data.reduce((sum, item) => sum + item.count, 0)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="pie-chart-view">
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="pie-chart-legend">
              {pieData.map((item, index) => (
                <div key={item.name} className="legend-item">
                  <div
                    className="legend-color"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="legend-label">{item.name}</span>
                  <span className="legend-value">{item.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetAllocationChart;