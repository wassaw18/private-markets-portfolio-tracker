import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CommitmentVsCalledData } from '../types/investment';
import { dashboardAPI } from '../services/api';
import './ChartComponents.css';

const CommitmentVsCalledChart: React.FC = () => {
  const [data, setData] = useState<CommitmentVsCalledData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'stacked' | 'liability'>('stacked');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardAPI.getCommitmentVsCalled();
      setData(result);
    } catch (err) {
      setError('Failed to load commitment data');
      console.error('Error fetching commitment vs called data:', err);
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

  const formatTooltip = (value: number, name: string) => [
    formatCurrency(value),
    name === 'called_amount' ? 'Called Capital' :
    name === 'uncalled_amount' ? 'Uncalled Capital' : name
  ];

  if (loading) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>Commitment vs Called Capital</h3>
        </div>
        <div className="chart-loading">Loading chart data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>Commitment vs Called Capital</h3>
        </div>
        <div className="chart-error">{error || 'Unable to load data'}</div>
      </div>
    );
  }

  // Prepare data for bar chart
  const barData = [
    {
      name: 'Total Commitment',
      commitment_amount: data.commitment_amount,
      called_amount: data.called_amount,
      uncalled_amount: data.uncalled_amount,
    }
  ];


  const deploymentPercentage = data.commitment_amount > 0 ? 
    ((data.called_amount / data.commitment_amount) * 100).toFixed(1) : '0';

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <h3>Commitment vs Called Capital</h3>
        <div className="chart-controls">
          <button
            className={`control-button ${viewType === 'stacked' ? 'active' : ''}`}
            onClick={() => setViewType('stacked')}
          >
            Stacked Bar
          </button>
          <button
            className={`control-button ${viewType === 'liability' ? 'active' : ''}`}
            onClick={() => setViewType('liability')}
          >
            Liability View
          </button>
        </div>
      </div>

      <div className="chart-content">
        {viewType === 'stacked' ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
              <XAxis
                dataKey="name"
                stroke="#666"
                fontSize={12}
                tick={{ fill: '#666' }}
              />
              <YAxis
                stroke="#666"
                fontSize={12}
                tick={{ fill: '#666' }}
                tickFormatter={formatCurrency}
              />
              <Tooltip
                formatter={formatTooltip}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
              <Bar dataKey="called_amount" stackId="commitment" fill="#2ECC71" name="Called Capital" radius={[0, 0, 0, 0]} />
              <Bar dataKey="uncalled_amount" stackId="commitment" fill="#C9A96E" name="Uncalled Capital" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="liability-visualizer">
            <div className="liability-header">
              <h4>Outstanding Commitment Liability</h4>
              <div className="total-commitment">{formatCurrency(data.commitment_amount)}</div>
            </div>
            <div className="liability-bar-container">
              <div className="liability-bar">
                <div
                  className="called-portion"
                  style={{ width: `${(data.called_amount / data.commitment_amount) * 100}%` }}
                  title={`Called Capital: ${formatCurrency(data.called_amount)}`}
                >
                  <span className="portion-label">Called</span>
                </div>
                <div
                  className="uncalled-portion"
                  style={{ width: `${(data.uncalled_amount / data.commitment_amount) * 100}%` }}
                  title={`Uncalled Capital: ${formatCurrency(data.uncalled_amount)}`}
                >
                  <span className="portion-label">Outstanding</span>
                </div>
              </div>
              <div className="liability-labels">
                <div className="liability-label left">
                  <div className="label-indicator called"></div>
                  <span>Called: {formatCurrency(data.called_amount)} ({deploymentPercentage}%)</span>
                </div>
                <div className="liability-label right">
                  <div className="label-indicator uncalled"></div>
                  <span>Outstanding: {formatCurrency(data.uncalled_amount)} ({(100 - parseFloat(deploymentPercentage)).toFixed(1)}%)</span>
                </div>
              </div>
            </div>
            <div className="liability-insight">
              <p>💡 Outstanding commitments represent future capital calls that may be requested by fund managers.</p>
            </div>
          </div>
        )}
      </div>

      <div className="chart-summary">
        <div className="summary-stats">
          <div className="summary-stat">
            <label>Total Commitment</label>
            <span className="stat-value">{formatCurrency(data.commitment_amount)}</span>
          </div>
          <div className="summary-stat">
            <label>Called Capital</label>
            <span className="stat-value called">{formatCurrency(data.called_amount)}</span>
          </div>
          <div className="summary-stat">
            <label>Uncalled Capital</label>
            <span className="stat-value uncalled">{formatCurrency(data.uncalled_amount)}</span>
          </div>
          <div className="summary-stat">
            <label>Deployment %</label>
            <span className="stat-value">{deploymentPercentage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommitmentVsCalledChart;