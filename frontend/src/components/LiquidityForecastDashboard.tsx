import React, { useState, useEffect } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './LiquidityForecastDashboard.css';

interface LiquidityPeriod {
  month_name: string;
  period_start: string;
  period_end: string;
  projected_calls: number;
  override_calls: number;
  total_calls: number;
  projected_distributions: number;
  override_distributions: number;
  total_distributions: number;
  net_cash_flow: number;
  cumulative_net_flow: number;
  liquidity_gap: number;
  investment_details: Array<{
    investment_name: string;
    calls: number;
    distributions: number;
    has_override: boolean;
    override_reason: string;
  }>;
}

interface LiquidityAlert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  period: string;
  amount: number;
  message: string;
}

interface LiquidityForecast {
  forecast_date: string;
  periods: LiquidityPeriod[];
  summary: {
    total_projected_calls: number;
    total_projected_distributions: number;
    total_net_flow: number;
    max_liquidity_gap: number;
    months_with_gaps: number;
  };
  stress_scenarios?: {
    [key: string]: {
      summary: {
        total_projected_calls: number;
        total_projected_distributions: number;
        max_liquidity_gap: number;
        months_with_gaps: number;
      };
    };
  };
}

interface ForecastAdjustment {
  id: number;
  adjustment_date: string;
  adjustment_type: string;
  adjustment_amount: number;
  reason?: string;
  confidence: string;
  created_by?: string;
}

const LiquidityForecastDashboard: React.FC = () => {
  const [forecast, setForecast] = useState<LiquidityForecast | null>(null);
  const [alerts, setAlerts] = useState<LiquidityAlert[]>([]);
  const [matchingOpportunities, setMatchingOpportunities] = useState<any[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
  const [includeStressTests, setIncludeStressTests] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<LiquidityPeriod | null>(null);

  useEffect(() => {
    loadForecastData();
  }, [selectedEntityId, includeStressTests]);

  const loadForecastData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load forecast
      const forecastParams = new URLSearchParams();
      if (selectedEntityId) forecastParams.append('entity_id', selectedEntityId.toString());
      if (includeStressTests) forecastParams.append('include_stress_tests', 'true');
      
      const forecastResponse = await fetch(`/api/liquidity/forecast?${forecastParams}`);
      if (!forecastResponse.ok) throw new Error('Failed to load forecast');
      const forecastData = await forecastResponse.json();
      setForecast(forecastData);
      
      // Load alerts
      const alertParams = new URLSearchParams();
      if (selectedEntityId) alertParams.append('entity_id', selectedEntityId.toString());
      
      const alertsResponse = await fetch(`/api/liquidity/alerts?${alertParams}`);
      if (!alertsResponse.ok) throw new Error('Failed to load alerts');
      const alertsData = await alertsResponse.json();
      setAlerts(alertsData);
      
      // Load matching opportunities
      const matchingResponse = await fetch(`/api/liquidity/matching?${alertParams}`);
      if (!matchingResponse.ok) throw new Error('Failed to load matching opportunities');
      const matchingData = await matchingResponse.json();
      setMatchingOpportunities(matchingData);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getChartData = () => {
    if (!forecast) return [];

    return forecast.periods.map(p => ({
      month: p.month_name.split(' ')[0],
      capitalCalls: -p.total_calls, // Negative for outflows
      distributions: p.total_distributions,
      cumulativeFlow: p.cumulative_net_flow,
      liquidityGap: p.liquidity_gap
    }));
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${formatCurrency(Math.abs(entry.value))}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="loading">Loading liquidity forecast...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!forecast) return <div className="no-data">No forecast data available</div>;

  return (
    <div className="liquidity-forecast-dashboard">
      <div className="dashboard-header">
        <h2>12-Month Liquidity Forecast Dashboard</h2>
        <div className="dashboard-controls">
          <label>
            <input
              type="checkbox"
              checked={includeStressTests}
              onChange={(e) => setIncludeStressTests(e.target.checked)}
            />
            Include Stress Tests
          </label>
          <button onClick={loadForecastData} className="refresh-btn">Refresh</button>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="metrics-summary">
        <div className="metric-card">
          <h4>Net Cash Flow</h4>
          <span className={`metric-value ${forecast.summary.total_net_flow >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(forecast.summary.total_net_flow)}
          </span>
        </div>
        <div className="metric-card">
          <h4>Total Capital Calls</h4>
          <span className="metric-value negative">
            {formatCurrency(forecast.summary.total_projected_calls)}
          </span>
        </div>
        <div className="metric-card">
          <h4>Total Distributions</h4>
          <span className="metric-value positive">
            {formatCurrency(forecast.summary.total_projected_distributions)}
          </span>
        </div>
        <div className="metric-card">
          <h4>Max Liquidity Gap</h4>
          <span className={`metric-value ${forecast.summary.max_liquidity_gap >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(forecast.summary.max_liquidity_gap)}
          </span>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <h3>Liquidity Alerts</h3>
          <div className="alerts-grid">
            {alerts.map((alert, index) => (
              <div key={index} className={`alert alert-${alert.severity}`}>
                <div className="alert-type">{alert.type.replace('_', ' ').toUpperCase()}</div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-amount">{formatCurrency(alert.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Forecast Chart */}
      <div className="chart-section">
        <div className="chart-container">
          <h3>12-Month Cash Flow Forecast</h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={getChartData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="cash-flow" tickFormatter={(value) => formatCurrency(value)} />
              <YAxis yAxisId="cumulative" orientation="right" tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="cash-flow" dataKey="capitalCalls" fill="#ef4444" name="Capital Calls" />
              <Bar yAxisId="cash-flow" dataKey="distributions" fill="#22c55e" name="Distributions" />
              <Line yAxisId="cumulative" type="monotone" dataKey="cumulativeFlow" stroke="#3b82f6" strokeWidth={3} name="Cumulative Net Flow" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="periods-table-section">
        <h3>Monthly Cash Flow Breakdown</h3>
        <div className="table-container">
          <table className="periods-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Capital Calls</th>
                <th>Distributions</th>
                <th>Net Flow</th>
                <th>Cumulative</th>
                <th>Liquidity Gap</th>
                <th>Overrides</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {forecast.periods.map((period, index) => (
                <tr key={index} className={period.liquidity_gap < 0 ? 'negative-gap' : ''}>
                  <td className="month-cell">{period.month_name}</td>
                  <td className="currency-cell negative">
                    {formatCurrency(period.total_calls)}
                    {period.override_calls > 0 && <span className="override-indicator">*</span>}
                  </td>
                  <td className="currency-cell positive">
                    {formatCurrency(period.total_distributions)}
                    {period.override_distributions > 0 && <span className="override-indicator">*</span>}
                  </td>
                  <td className={`currency-cell ${period.net_cash_flow >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(period.net_cash_flow)}
                  </td>
                  <td className={`currency-cell ${period.cumulative_net_flow >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(period.cumulative_net_flow)}
                  </td>
                  <td className={`currency-cell ${period.liquidity_gap >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(period.liquidity_gap)}
                  </td>
                  <td className="override-cell">
                    {(period.override_calls > 0 || period.override_distributions > 0) ? '✓' : '-'}
                  </td>
                  <td className="actions-cell">
                    <button
                      className="add-override-btn"
                      onClick={() => {
                        setSelectedPeriod(period);
                        setShowAdjustmentModal(true);
                      }}
                    >
                      Add Override
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Flow Matching Opportunities */}
      {matchingOpportunities.length > 0 && (
        <div className="matching-section">
          <h3>Cash Flow Matching Opportunities</h3>
          <div className="matching-grid">
            {matchingOpportunities.map((match, index) => (
              <div key={index} className={`match-card feasibility-${match.match_feasibility}`}>
                <div className="match-header">
                  <span className="shortfall-month">{match.shortfall_month}</span>
                  <span className="gap-days">{match.days_gap} days</span>
                </div>
                <div className="match-amounts">
                  <div className="shortfall">Need: {formatCurrency(match.shortfall_amount)}</div>
                  <div className="source">From: {formatCurrency(match.source_amount)} in {match.source_month}</div>
                </div>
                <div className="match-feasibility">Feasibility: {match.match_feasibility}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stress Test Results */}
      {includeStressTests && forecast.stress_scenarios && (
        <div className="stress-test-section">
          <h3>Stress Test Scenarios</h3>
          <div className="stress-scenarios-grid">
            {Object.entries(forecast.stress_scenarios).map(([scenarioName, scenario]) => (
              <div key={scenarioName} className="stress-scenario-card">
                <h4>{scenarioName.replace('_', ' ').toUpperCase()}</h4>
                <div className="scenario-metrics">
                  <div className="metric">
                    <span className="label">Max Gap:</span>
                    <span className={`value ${scenario.summary.max_liquidity_gap < 0 ? 'negative' : 'positive'}`}>
                      {formatCurrency(scenario.summary.max_liquidity_gap)}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="label">Months w/ Gaps:</span>
                    <span className="value">{scenario.summary.months_with_gaps}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecast Adjustment Modal */}
      {showAdjustmentModal && selectedPeriod && (
        <ForecastAdjustmentModal
          period={selectedPeriod}
          onClose={() => {
            setShowAdjustmentModal(false);
            setSelectedPeriod(null);
          }}
          onSave={() => {
            setShowAdjustmentModal(false);
            setSelectedPeriod(null);
            loadForecastData();
          }}
        />
      )}
    </div>
  );
};

interface ForecastAdjustmentModalProps {
  period: LiquidityPeriod;
  onClose: () => void;
  onSave: () => void;
}

const ForecastAdjustmentModal: React.FC<ForecastAdjustmentModalProps> = ({
  period,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    investment_id: '',
    adjustment_type: 'capital_call',
    adjustment_amount: 0,
    adjustment_date: period.period_start,
    reason: '',
    confidence: 'confirmed'
  });
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load investments for dropdown
    fetch('/api/investments/')
      .then(res => res.json())
      .then(data => setInvestments(data))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/liquidity/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User': 'admin' // Replace with actual user context
        },
        body: JSON.stringify({
          ...formData,
          investment_id: parseInt(formData.investment_id),
          adjustment_amount: parseFloat(formData.adjustment_amount.toString())
        })
      });

      if (!response.ok) throw new Error('Failed to add adjustment');
      
      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content forecast-adjustment-modal">
        <div className="modal-header">
          <h3>Add Forecast Override - {period.month_name}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="adjustment-form">
          <div className="form-row">
            <label>Investment</label>
            <select
              value={formData.investment_id}
              onChange={(e) => setFormData(prev => ({ ...prev, investment_id: e.target.value }))}
              required
            >
              <option value="">Select Investment</option>
              {investments.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.investment_name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Type</label>
            <select
              value={formData.adjustment_type}
              onChange={(e) => setFormData(prev => ({ ...prev, adjustment_type: e.target.value }))}
            >
              <option value="capital_call">Capital Call</option>
              <option value="distribution">Distribution</option>
              <option value="nav_update">NAV Update</option>
            </select>
          </div>

          <div className="form-row">
            <label>Amount</label>
            <input
              type="number"
              value={formData.adjustment_amount}
              onChange={(e) => setFormData(prev => ({ ...prev, adjustment_amount: parseFloat(e.target.value) || 0 }))}
              min="0"
              step="1000"
              required
            />
          </div>

          <div className="form-row">
            <label>Date</label>
            <input
              type="date"
              value={formData.adjustment_date}
              onChange={(e) => setFormData(prev => ({ ...prev, adjustment_date: e.target.value }))}
              min={period.period_start}
              max={period.period_end}
              required
            />
          </div>

          <div className="form-row">
            <label>Reason</label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g., GP confirmed call date, Early exit notice"
            />
          </div>

          <div className="form-row">
            <label>Confidence</label>
            <select
              value={formData.confidence}
              onChange={(e) => setFormData(prev => ({ ...prev, confidence: e.target.value }))}
            >
              <option value="confirmed">Confirmed</option>
              <option value="likely">Likely</option>
              <option value="possible">Possible</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="save-btn">
              {loading ? 'Adding...' : 'Add Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LiquidityForecastDashboard;