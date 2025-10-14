import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { VintageAllocationData } from '../types/investment';
import { dashboardAPI } from '../services/api';
import './ChartComponents.css';

type TimePeriod = 'inception' | '5years' | '10years';

const VintageAllocationChart: React.FC = () => {
  const [rawData, setRawData] = useState<VintageAllocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('inception');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardAPI.getAllocationByVintage();
      setRawData(result);
    } catch (err) {
      setError('Failed to load vintage allocation data');
      console.error('Error fetching vintage allocation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fill in missing years and apply time period filter
  const data = React.useMemo(() => {
    if (rawData.length === 0) return [];

    const currentYear = new Date().getFullYear();
    const minYear = Math.min(...rawData.map(d => d.vintage_year));
    const maxYear = Math.max(...rawData.map(d => d.vintage_year));

    // Determine year range based on time period
    let startYear = minYear;
    if (timePeriod === '5years') {
      startYear = Math.max(minYear, currentYear - 5);
    } else if (timePeriod === '10years') {
      startYear = Math.max(minYear, currentYear - 10);
    }

    // Create a map of existing data
    const dataMap = new Map<number, VintageAllocationData>();
    rawData.forEach(item => {
      dataMap.set(item.vintage_year, item);
    });

    // Fill in all years in the range
    const filledData: VintageAllocationData[] = [];
    for (let year = startYear; year <= maxYear; year++) {
      if (dataMap.has(year)) {
        filledData.push(dataMap.get(year)!);
      } else {
        // Add placeholder for missing year
        filledData.push({
          vintage_year: year,
          commitment_amount: 0,
          count: 0,
          percentage: 0
        });
      }
    }

    return filledData;
  }, [rawData, timePeriod]);

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">Vintage Year {label}</p>
          <p className="tooltip-value">Commitment: {formatCurrency(data.commitment_amount)}</p>
          <p className="tooltip-value">Percentage: {data.percentage.toFixed(1)}%</p>
          <p className="tooltip-value">Count: {data.count} investment{data.count !== 1 ? 's' : ''}</p>
        </div>
      );
    }
    return null;
  };

  // Generate luxury color based on vintage year (newer years get different shades)
  const getBarColor = (year: number, minYear: number, maxYear: number) => {
    if (minYear === maxYear) return '#0B1426'; // Luxury Navy
    
    const yearRange = maxYear - minYear;
    const yearPosition = (year - minYear) / yearRange;
    
    // Luxury color gradient: Navy to Accent Blue for vintage progression
    const luxuryColors = [
      '#0B1426', // Navy (oldest)
      '#1A2B47', // Dark Blue
      '#2D4263', // Medium Blue  
      '#3B5998', // Accent Blue
      '#2C3E50', // Charcoal (newest)
    ];
    
    const colorIndex = Math.floor(yearPosition * (luxuryColors.length - 1));
    return luxuryColors[colorIndex] || luxuryColors[0];
  };

  if (loading) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>Allocation by Vintage Year</h3>
        </div>
        <div className="chart-loading">Loading chart data...</div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h3>Allocation by Vintage Year</h3>
        </div>
        <div className="chart-error">{error || 'No vintage allocation data available'}</div>
      </div>
    );
  }

  const minYear = Math.min(...data.map(d => d.vintage_year));
  const maxYear = Math.max(...data.map(d => d.vintage_year));
  const yearSpread = maxYear - minYear + 1;

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <div>
          <h3>Allocation by Vintage Year</h3>
          <div className="chart-subtitle">
            {yearSpread} year{yearSpread !== 1 ? 's' : ''} ({minYear} - {maxYear})
          </div>
        </div>
        <div className="time-period-selector">
          <button
            className={`period-button ${timePeriod === 'inception' ? 'active' : ''}`}
            onClick={() => setTimePeriod('inception')}
          >
            Since Inception
          </button>
          <button
            className={`period-button ${timePeriod === '10years' ? 'active' : ''}`}
            onClick={() => setTimePeriod('10years')}
          >
            Last 10 Years
          </button>
          <button
            className={`period-button ${timePeriod === '5years' ? 'active' : ''}`}
            onClick={() => setTimePeriod('5years')}
          >
            Last 5 Years
          </button>
        </div>
      </div>

      <div className="chart-content">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart 
            data={data} 
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis 
              dataKey="vintage_year" 
              stroke="#666"
              fontSize={12}
              tick={{ fill: '#666' }}
              interval={0}
              angle={data.length > 8 ? -45 : 0}
              textAnchor={data.length > 8 ? 'end' : 'middle'}
              height={data.length > 8 ? 60 : 30}
            />
            <YAxis 
              stroke="#666"
              fontSize={12}
              tick={{ fill: '#666' }}
              tickFormatter={formatCurrency}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="commitment_amount" 
              radius={[4, 4, 0, 0]}
              stroke="#0B1426"
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getBarColor(entry.vintage_year, minYear, maxYear)} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-summary">
        <h4>Vintage Year Breakdown</h4>
        <div className="vintage-summary">
          {data.filter(item => item.count > 0).map((item) => (
            <div key={item.vintage_year} className="vintage-item">
              <div className="vintage-year">{item.vintage_year}</div>
              <div className="vintage-amount">{formatCurrency(item.commitment_amount)}</div>
              <div className="vintage-count">
                {item.count} investment{item.count !== 1 ? 's' : ''} • {item.percentage.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VintageAllocationChart;