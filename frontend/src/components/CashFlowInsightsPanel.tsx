import React, { useState, useEffect } from 'react';
import { calendarAPI } from '../services/api';
import './CashFlowInsightsPanel.css';

interface PeriodSummary {
  start_date: string;
  end_date: string;
  total_inflows: number;
  total_outflows: number;
  net_flow: number;
  active_days: number;
  total_transactions: number;
  largest_single_day: number;
  largest_single_day_date: string | null;
  most_active_day: string | null;
  most_active_day_count: number;
}

interface InsightsPanelProps {
  year?: number;
  month?: number;
  quarter?: number;
  customStartDate?: string;
  customEndDate?: string;
  includeForecasts?: boolean;
}

const CashFlowInsightsPanel: React.FC<InsightsPanelProps> = ({
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
  quarter,
  customStartDate,
  customEndDate,
  includeForecasts = true
}) => {
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null);
  const [previousPeriodSummary, setPreviousPeriodSummary] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPeriodData = async () => {
    setLoading(true);
    setError(null);

    try {
      let currentSummary: PeriodSummary;
      let previousSummary: PeriodSummary | null = null;

      // Fetch current period data
      if (customStartDate && customEndDate) {
        // Custom date range
        currentSummary = await calendarAPI.getPeriodSummary(customStartDate, customEndDate, includeForecasts);
      } else if (quarter) {
        // Quarterly data
        const quarterData = await calendarAPI.getQuarterlySummary(year, quarter, includeForecasts);
        currentSummary = {
          start_date: quarterData.start_date,
          end_date: quarterData.end_date,
          total_inflows: quarterData.total_inflows,
          total_outflows: quarterData.total_outflows,
          net_flow: quarterData.net_flow,
          active_days: quarterData.active_days,
          total_transactions: quarterData.total_transactions,
          largest_single_day: quarterData.largest_single_day,
          largest_single_day_date: quarterData.largest_single_day_date,
          most_active_day: quarterData.most_active_day,
          most_active_day_count: quarterData.most_active_day_count
        };

        // Get previous quarter for comparison
        const prevQuarter = quarter === 1 ? 4 : quarter - 1;
        const prevYear = quarter === 1 ? year - 1 : year;
        try {
          const prevQuarterData = await calendarAPI.getQuarterlySummary(prevYear, prevQuarter, includeForecasts);
          previousSummary = {
            start_date: prevQuarterData.start_date,
            end_date: prevQuarterData.end_date,
            total_inflows: prevQuarterData.total_inflows,
            total_outflows: prevQuarterData.total_outflows,
            net_flow: prevQuarterData.net_flow,
            active_days: prevQuarterData.active_days,
            total_transactions: prevQuarterData.total_transactions,
            largest_single_day: prevQuarterData.largest_single_day,
            largest_single_day_date: prevQuarterData.largest_single_day_date,
            most_active_day: prevQuarterData.most_active_day,
            most_active_day_count: prevQuarterData.most_active_day_count
          };
        } catch (e) {
          // Previous quarter data not available
        }
      } else {
        // Monthly data
        const monthlyData = await calendarAPI.getMonthlyCalendar(year, month, includeForecasts);
        currentSummary = monthlyData.period_summary;

        // Get previous month for comparison
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        try {
          const prevMonthData = await calendarAPI.getMonthlyCalendar(prevYear, prevMonth, includeForecasts);
          previousSummary = prevMonthData.period_summary;
        } catch (e) {
          // Previous month data not available
        }
      }

      setPeriodSummary(currentSummary);
      setPreviousPeriodSummary(previousSummary);
    } catch (err: any) {
      setError('Failed to load period insights');
      console.error('Error fetching period data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriodData();
  }, [year, month, quarter, customStartDate, customEndDate, includeForecasts]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyCompact = (amount: number) => {
    if (Math.abs(amount) >= 1e9) {
      return `$${(amount / 1e9).toFixed(1)}B`;
    } else if (Math.abs(amount) >= 1e6) {
      return `$${(amount / 1e6).toFixed(1)}M`;
    } else if (Math.abs(amount) >= 1e3) {
      return `$${(amount / 1e3).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const formatPercentageChange = (current: number, previous: number): { value: string; isPositive: boolean | null } => {
    const change = calculatePercentageChange(current, previous);
    if (Math.abs(change) < 0.1) {
      return { value: 'No change', isPositive: null };
    }
    const isPositive = change > 0;
    return { 
      value: `${isPositive ? '+' : ''}${change.toFixed(1)}%`, 
      isPositive 
    };
  };

  const getPeriodTitle = (): string => {
    if (customStartDate && customEndDate) {
      return `Custom Period (${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()})`;
    } else if (quarter) {
      return `Q${quarter} ${year}`;
    } else {
      return `${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }
  };

  const renderMetricComparison = (
    label: string,
    current: number,
    previous: number | null,
    isPositiveGood: boolean = true,
    formatter: (val: number) => string = formatCurrencyCompact
  ) => {
    const comparison = previous !== null ? formatPercentageChange(current, previous) : null;
    
    return (
      <div className="metric-comparison">
        <div className="metric-label">{label}</div>
        <div className="metric-current">{formatter(current)}</div>
        {comparison && (
          <div className={`metric-change ${
            comparison.isPositive === null ? 'neutral' : 
            (comparison.isPositive === isPositiveGood ? 'positive' : 'negative')
          }`}>
            {comparison.value} vs prev period
          </div>
        )}
      </div>
    );
  };

  const renderInsightCards = () => {
    if (!periodSummary) return null;

    const insights = [];

    // Cash flow pattern insight
    if (periodSummary.net_flow > 0) {
      insights.push({
        icon: '📈',
        title: 'Net Positive Period',
        description: `Portfolio generated ${formatCurrencyCompact(periodSummary.net_flow)} in net positive cash flow`,
        type: 'positive'
      });
    } else if (periodSummary.net_flow < 0) {
      insights.push({
        icon: '📉',
        title: 'Net Investment Period',
        description: `Portfolio deployed ${formatCurrencyCompact(Math.abs(periodSummary.net_flow))} in net capital`,
        type: 'negative'
      });
    }

    // Activity level insight
    if (periodSummary.active_days > 0) {
      const activityRate = (periodSummary.active_days / getTotalDaysInPeriod()) * 100;
      if (activityRate > 50) {
        insights.push({
          icon: '⚡',
          title: 'High Activity Period',
          description: `Cash flow activity on ${periodSummary.active_days} days (${activityRate.toFixed(0)}% of period)`,
          type: 'info'
        });
      } else if (activityRate < 10) {
        insights.push({
          icon: '😴',
          title: 'Low Activity Period',
          description: `Limited cash flow activity - only ${periodSummary.active_days} active days`,
          type: 'warning'
        });
      }
    }

    // Large transaction insight
    if (periodSummary.largest_single_day > 1000000) { // > $1M
      insights.push({
        icon: '💰',
        title: 'Major Cash Flow Event',
        description: `Largest single day: ${formatCurrencyCompact(periodSummary.largest_single_day)}${periodSummary.largest_single_day_date ? ` on ${new Date(periodSummary.largest_single_day_date).toLocaleDateString()}` : ''}`,
        type: 'info'
      });
    }

    // Comparison insights
    if (previousPeriodSummary) {
      const inflowChange = calculatePercentageChange(periodSummary.total_inflows, previousPeriodSummary.total_inflows);
      if (Math.abs(inflowChange) > 25) {
        insights.push({
          icon: inflowChange > 0 ? '⬆️' : '⬇️',
          title: `${inflowChange > 0 ? 'Increased' : 'Decreased'} Inflows`,
          description: `Distribution activity ${inflowChange > 0 ? 'up' : 'down'} ${Math.abs(inflowChange).toFixed(0)}% vs previous period`,
          type: inflowChange > 0 ? 'positive' : 'info'
        });
      }

      const outflowChange = calculatePercentageChange(periodSummary.total_outflows, previousPeriodSummary.total_outflows);
      if (Math.abs(outflowChange) > 25) {
        insights.push({
          icon: outflowChange > 0 ? '⬆️' : '⬇️',
          title: `${outflowChange > 0 ? 'Increased' : 'Decreased'} Outflows`,
          description: `Capital call activity ${outflowChange > 0 ? 'up' : 'down'} ${Math.abs(outflowChange).toFixed(0)}% vs previous period`,
          type: 'info'
        });
      }
    }

    return insights.map((insight, index) => (
      <div key={index} className={`insight-card ${insight.type}`}>
        <div className="insight-icon">{insight.icon}</div>
        <div className="insight-content">
          <h4>{insight.title}</h4>
          <p>{insight.description}</p>
        </div>
      </div>
    ));
  };

  const getTotalDaysInPeriod = (): number => {
    if (!periodSummary) return 30;
    const start = new Date(periodSummary.start_date);
    const end = new Date(periodSummary.end_date);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  if (loading) {
    return (
      <div className="cash-flow-insights-panel">
        <div className="insights-loading">Loading insights...</div>
      </div>
    );
  }

  if (error || !periodSummary) {
    return (
      <div className="cash-flow-insights-panel">
        <div className="insights-error">{error || 'No data available'}</div>
      </div>
    );
  }

  return (
    <div className="cash-flow-insights-panel">
      <div className="insights-header">
        <h3>Period Insights</h3>
        <span className="period-title">{getPeriodTitle()}</span>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        {renderMetricComparison(
          'Total Inflows',
          periodSummary.total_inflows,
          previousPeriodSummary?.total_inflows || null,
          true
        )}
        {renderMetricComparison(
          'Total Outflows',
          periodSummary.total_outflows,
          previousPeriodSummary?.total_outflows || null,
          false
        )}
        {renderMetricComparison(
          'Net Flow',
          periodSummary.net_flow,
          previousPeriodSummary?.net_flow || null,
          true
        )}
        {renderMetricComparison(
          'Active Days',
          periodSummary.active_days,
          previousPeriodSummary?.active_days || null,
          true,
          (val) => val.toString()
        )}
        {renderMetricComparison(
          'Total Transactions',
          periodSummary.total_transactions,
          previousPeriodSummary?.total_transactions || null,
          true,
          (val) => val.toString()
        )}
      </div>

      {/* Insights Cards */}
      <div className="insights-section">
        <h4>Key Insights</h4>
        <div className="insights-grid">
          {renderInsightCards()}
        </div>
      </div>

      {/* Notable Events */}
      {(periodSummary.largest_single_day_date || periodSummary.most_active_day) && (
        <div className="notable-events">
          <h4>Notable Events</h4>
          <div className="events-list">
            {periodSummary.largest_single_day_date && (
              <div className="event-item">
                <div className="event-icon">🎯</div>
                <div className="event-content">
                  <strong>Largest Cash Flow Day</strong>
                  <span>{new Date(periodSummary.largest_single_day_date).toLocaleDateString()}</span>
                  <span className="event-amount">{formatCurrency(periodSummary.largest_single_day)}</span>
                </div>
              </div>
            )}
            {periodSummary.most_active_day && (
              <div className="event-item">
                <div className="event-icon">📅</div>
                <div className="event-content">
                  <strong>Most Active Day</strong>
                  <span>{new Date(periodSummary.most_active_day).toLocaleDateString()}</span>
                  <span className="event-amount">{periodSummary.most_active_day_count} transactions</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CashFlowInsightsPanel;