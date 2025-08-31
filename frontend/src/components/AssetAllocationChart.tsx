import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AssetAllocationData } from '../types/investment';
import { dashboardAPI } from '../services/api';
import './ChartComponents.css';

const AssetAllocationChart: React.FC = () => {
  const [data, setData] = useState<AssetAllocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Professional color palette for asset classes
  const COLORS = [
    '#007bff', // Blue - Private Equity
    '#28a745', // Green - Private Credit
    '#17a2b8', // Teal - Real Estate
    '#ffc107', // Yellow - Infrastructure
    '#dc3545', // Red - Hedge Funds
    '#6610f2', // Purple - Venture Capital
    '#fd7e14', // Orange
    '#20c997', // Turquoise
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{data.asset_class}</p>
          <p className="tooltip-value">Amount: {formatCurrency(data.commitment_amount)}</p>
          <p className="tooltip-value">Percentage: {data.percentage.toFixed(1)}%</p>
          <p className="tooltip-value">Count: {data.count} investment{data.count !== 1 ? 's' : ''}</p>
        </div>
      );
    }
    return null;
  };

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
        <div className="chart-subtitle">
          Portfolio diversification across {data.length} asset classes
        </div>
      </div>

      <div className="chart-content">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={110}
              fill="#8884d8"
              dataKey="commitment_amount"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]} 
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, entry: any) => (
                <span style={{ color: entry.color, fontSize: '12px' }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-summary">
        <div className="allocation-breakdown">
          <h4>Asset Class Breakdown</h4>
          <div className="breakdown-list">
            {data.map((item, index) => (
              <div key={item.asset_class} className="breakdown-item">
                <div 
                  className="color-indicator" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                ></div>
                <div className="breakdown-details">
                  <span className="asset-class-name">{item.asset_class}</span>
                  <div className="breakdown-metrics">
                    <span className="metric">{formatCurrency(item.commitment_amount)}</span>
                    <span className="metric">{item.percentage.toFixed(1)}%</span>
                    <span className="metric">{item.count} inv{item.count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetAllocationChart;