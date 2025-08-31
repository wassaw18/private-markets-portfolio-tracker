import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Treemap, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Investment } from '../types/investment';
import { investmentAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import './ChartComponents.css';

interface OwnershipData {
  name: string;
  entityType: string;
  commitment: number;
  currentValue: number;
  investments: number;
  color: string;
}

const ENTITY_COLORS = [
  '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
  '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6c757d',
  '#495057', '#343a40', '#f8f9fa', '#e9ecef', '#dee2e6'
];

const OwnershipVisualizationChart: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'pie' | 'treemap'>('pie');
  const [valueType, setValueType] = useState<'commitment' | 'currentValue'>('commitment');

  useEffect(() => {
    fetchInvestments();
  }, []);

  const fetchInvestments = async () => {
    try {
      setLoading(true);
      const data = await investmentAPI.getInvestments(0, 1000);
      setInvestments(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch investment data');
      console.error('Error fetching investments:', err);
    } finally {
      setLoading(false);
    }
  };

  const processOwnershipData = (): OwnershipData[] => {
    const entityMap = new Map<string, OwnershipData>();

    investments.forEach((investment, index) => {
      const entityKey = investment.entity ? 
        `${investment.entity.name} (${investment.entity.entity_type})` : 
        'Unassigned Entity';
      
      const entityType = investment.entity?.entity_type || 'Unassigned';
      
      // Calculate current value (latest NAV if available, otherwise called amount)
      const latestValuation = investment.valuations && investment.valuations.length > 0
        ? investment.valuations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        : null;
      const currentValue = latestValuation?.nav_value || investment.called_amount;

      if (!entityMap.has(entityKey)) {
        entityMap.set(entityKey, {
          name: investment.entity?.name || 'Unassigned Entity',
          entityType,
          commitment: 0,
          currentValue: 0,
          investments: 0,
          color: ENTITY_COLORS[entityMap.size % ENTITY_COLORS.length]
        });
      }

      const entity = entityMap.get(entityKey)!;
      entity.commitment += investment.commitment_amount;
      entity.currentValue += currentValue;
      entity.investments += 1;
    });

    return Array.from(entityMap.values()).sort((a, b) => 
      valueType === 'commitment' ? b.commitment - a.commitment : b.currentValue - a.currentValue
    );
  };

  const ownershipData = processOwnershipData();
  const totalValue = ownershipData.reduce((sum, item) => 
    sum + (valueType === 'commitment' ? item.commitment : item.currentValue), 0
  );

  const pieData = ownershipData.map(item => ({
    name: item.name,
    value: valueType === 'commitment' ? item.commitment : item.currentValue,
    percentage: totalValue > 0 ? ((valueType === 'commitment' ? item.commitment : item.currentValue) / totalValue * 100).toFixed(1) : '0',
    entityType: item.entityType,
    investments: item.investments,
    commitment: item.commitment,
    currentValue: item.currentValue,
    fill: item.color
  }));

  const treemapData = ownershipData.map(item => ({
    name: item.name,
    size: valueType === 'commitment' ? item.commitment : item.currentValue,
    entityType: item.entityType,
    investments: item.investments,
    commitment: item.commitment,
    currentValue: item.currentValue,
    fill: item.color
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{data.name}</p>
          <p className="tooltip-content">
            <span className="tooltip-entity">Entity Type: {data.entityType}</span>
          </p>
          <p className="tooltip-content">
            <span className="tooltip-value">Commitment: {formatCurrency(data.commitment)}</span>
          </p>
          <p className="tooltip-content">
            <span className="tooltip-value">Current Value: {formatCurrency(data.currentValue)}</span>
          </p>
          <p className="tooltip-content">
            <span className="tooltip-count">Investments: {data.investments}</span>
          </p>
          {pieData.find(d => d.name === data.name) && (
            <p className="tooltip-content">
              <span className="tooltip-percentage">{pieData.find(d => d.name === data.name)?.percentage}% of portfolio</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const TreemapTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = totalValue > 0 ? ((data.size / totalValue) * 100).toFixed(1) : '0';
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{data.name}</p>
          <p className="tooltip-content">
            <span className="tooltip-entity">Entity Type: {data.entityType}</span>
          </p>
          <p className="tooltip-content">
            <span className="tooltip-value">Commitment: {formatCurrency(data.commitment)}</span>
          </p>
          <p className="tooltip-content">
            <span className="tooltip-value">Current Value: {formatCurrency(data.currentValue)}</span>
          </p>
          <p className="tooltip-content">
            <span className="tooltip-count">Investments: {data.investments}</span>
          </p>
          <p className="tooltip-content">
            <span className="tooltip-percentage">{percentage}% of portfolio</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3>Investment Ownership Distribution</h3>
        </div>
        <div className="chart-loading">Loading ownership data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3>Investment Ownership Distribution</h3>
        </div>
        <div className="chart-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>Investment Ownership Distribution</h3>
        <div className="chart-controls">
          <div className="control-group">
            <label>View:</label>
            <select 
              value={viewMode} 
              onChange={(e) => setViewMode(e.target.value as 'pie' | 'treemap')}
              className="chart-select"
            >
              <option value="pie">Pie Chart</option>
              <option value="treemap">Treemap</option>
            </select>
          </div>
          <div className="control-group">
            <label>Value:</label>
            <select 
              value={valueType} 
              onChange={(e) => setValueType(e.target.value as 'commitment' | 'currentValue')}
              className="chart-select"
            >
              <option value="commitment">Commitment Amount</option>
              <option value="currentValue">Current Value</option>
            </select>
          </div>
        </div>
      </div>

      {ownershipData.length === 0 ? (
        <div className="chart-empty">
          No ownership data available. Add investments with entities to see the distribution.
        </div>
      ) : (
        <>
          <div className="chart-content">
            <ResponsiveContainer width="100%" height={400}>
              {viewMode === 'pie' ? (
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              ) : (
                <Treemap
                  data={treemapData}
                  dataKey="size"
                  aspectRatio={4/3}
                  stroke="#fff"
                  fill="#8884d8"
                >
                  <Tooltip content={<TreemapTooltip />} />
                </Treemap>
              )}
            </ResponsiveContainer>
          </div>

          {/* Summary Table */}
          <div className="ownership-summary">
            <h4>Ownership Summary</h4>
            <div className="summary-table">
              <div className="summary-header">
                <span>Entity</span>
                <span>Type</span>
                <span>Investments</span>
                <span>Commitment</span>
                <span>Current Value</span>
                <span>Share</span>
              </div>
              {ownershipData.map((entity, index) => (
                <div key={index} className="summary-row">
                  <span className="entity-name">
                    <span 
                      className="color-indicator" 
                      style={{ backgroundColor: entity.color }}
                    ></span>
                    {entity.name}
                  </span>
                  <span className="entity-type">{entity.entityType}</span>
                  <span className="investment-count">{entity.investments}</span>
                  <span className="commitment">{formatCurrency(entity.commitment)}</span>
                  <span className="current-value">{formatCurrency(entity.currentValue)}</span>
                  <span className="share">
                    {totalValue > 0 ? (
                      ((valueType === 'commitment' ? entity.commitment : entity.currentValue) / totalValue * 100).toFixed(1)
                    ) : '0'}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OwnershipVisualizationChart;