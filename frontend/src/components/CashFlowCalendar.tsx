import React, { useState, useEffect } from 'react';
import { calendarAPI, unifiedForecastAPI, DailyFlow, MonthlyCalendar } from '../services/api';
import DateRangePicker from './DateRangePicker';
import './CashFlowCalendar.css';

interface ViewType {
  type: 'month' | 'quarter' | 'year';
  label: string;
}

interface NavigationIncrement {
  days: number;
  label: string;
}

const CashFlowCalendar: React.FC = () => {
  // Initialize with current month as default range
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(endOfMonth);
  const [viewType, setViewType] = useState<'month' | 'quarter' | 'year'>('month');
  const [monthlyData, setMonthlyData] = useState<MonthlyCalendar | null>(null);
  const [selectedDay, setSelectedDay] = useState<DailyFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeManual, setIncludeManual] = useState(true);
  const [includePacingModel, setIncludePacingModel] = useState(true);

  const viewTypes: ViewType[] = [
    { type: 'month', label: 'Month' },
    { type: 'quarter', label: 'Quarter' },
    { type: 'year', label: 'Year' }
  ];

  // Navigation increments based on view type
  const getNavigationIncrement = (): NavigationIncrement => {
    switch (viewType) {
      case 'month':
        return { days: 30, label: 'month' }; // Approximate, will be adjusted
      case 'quarter':
        return { days: 90, label: 'quarter' }; // Approximate, will be adjusted
      case 'year':
        return { days: 365, label: 'year' }; // Approximate, will be adjusted
      default:
        return { days: 30, label: 'month' };
    }
  };

  const fetchMonthlyData = async (year: number, month: number) => {
    setLoading(true);
    setError(null);

    try {
      // Calculate start and end dates for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Use unified forecast API with separate toggles
      const unifiedData = await unifiedForecastAPI.getUnifiedForecasts(
        startDateStr,
        endDateStr,
        includeManual,
        includePacingModel,
        'BASE'
      );

      // Convert unified API response to MonthlyCalendar format
      const convertedData: MonthlyCalendar = {
        year: year,
        month: month,
        month_name: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
        previous_month: month === 1 ? { year: year - 1, month: 12 } : { year: year, month: month - 1 },
        next_month: month === 12 ? { year: year + 1, month: 1 } : { year: year, month: month + 1 },
        period_summary: {
          start_date: startDateStr,
          end_date: endDateStr,
          total_inflows: unifiedData.daily_flows.reduce((sum, day) => sum + day.total_inflows, 0),
          total_outflows: unifiedData.daily_flows.reduce((sum, day) => sum + day.total_outflows, 0),
          net_flow: unifiedData.daily_flows.reduce((sum, day) => sum + day.net_flow, 0),
          active_days: unifiedData.daily_flows.filter(day => day.transaction_count > 0).length,
          total_transactions: unifiedData.daily_flows.reduce((sum, day) => sum + day.transaction_count, 0),
          largest_single_day: Math.max(...unifiedData.daily_flows.map(day => Math.abs(day.net_flow))),
          largest_single_day_date: null,
          most_active_day: null,
          most_active_day_count: 0
        },
        daily_flows: unifiedData.daily_flows.map(day => ({
          date: day.date,
          day: parseISODate(day.date).getDate(),
          total_inflows: day.total_inflows,
          total_outflows: day.total_outflows,
          net_flow: day.net_flow,
          transaction_count: day.transaction_count,
          transactions: day.transactions.map(txn => ({
            id: txn.id,
            investment_id: txn.investment_id,
            investment_name: txn.investment_name,
            type: txn.type,
            amount: txn.amount,
            is_forecast: txn.is_forecast,
            source: txn.source,
            confidence: txn.confidence
          }))
        }))
      };

      setMonthlyData(convertedData);
    } catch (err: any) {
      setError('Failed to load calendar data');
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // For all view types, we'll fetch monthly data but the rendering will adapt
    const fetchQuarterData = async () => {
      setLoading(true);
      setError(null);

      try {
        const quarterStart = new Date(startDate.getFullYear(), Math.floor(startDate.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);

        const startDateStr = quarterStart.toISOString().split('T')[0];
        const endDateStr = quarterEnd.toISOString().split('T')[0];

        // Use unified forecast API with separate toggles
        const unifiedData = await unifiedForecastAPI.getUnifiedForecasts(
          startDateStr,
          endDateStr,
          includeManual,
          includePacingModel,
          'BASE'
        );

        // Convert to MonthlyCalendar format
        const convertedData: MonthlyCalendar = {
          year: quarterStart.getFullYear(),
          month: quarterStart.getMonth() + 1,
          month_name: quarterStart.toLocaleString('default', { month: 'long' }),
          previous_month: { year: quarterStart.getFullYear(), month: quarterStart.getMonth() },
          next_month: { year: quarterEnd.getFullYear(), month: quarterEnd.getMonth() + 2 },
          period_summary: {
            start_date: startDateStr,
            end_date: endDateStr,
            total_inflows: unifiedData.daily_flows.reduce((sum, day) => sum + day.total_inflows, 0),
            total_outflows: unifiedData.daily_flows.reduce((sum, day) => sum + day.total_outflows, 0),
            net_flow: unifiedData.daily_flows.reduce((sum, day) => sum + day.net_flow, 0),
            active_days: unifiedData.daily_flows.filter(day => day.transaction_count > 0).length,
            total_transactions: unifiedData.daily_flows.reduce((sum, day) => sum + day.transaction_count, 0),
            largest_single_day: Math.max(...unifiedData.daily_flows.map(day => Math.abs(day.net_flow))),
            largest_single_day_date: null,
            most_active_day: null,
            most_active_day_count: 0
          },
          daily_flows: unifiedData.daily_flows.map(day => ({
            date: day.date,
            day: parseISODate(day.date).getDate(),
            total_inflows: day.total_inflows,
            total_outflows: day.total_outflows,
            net_flow: day.net_flow,
            transaction_count: day.transaction_count,
            transactions: day.transactions.map(txn => ({
              id: txn.id,
              investment_id: txn.investment_id,
              investment_name: txn.investment_name,
              type: txn.type,
              amount: txn.amount,
              is_forecast: txn.is_forecast,
              source: txn.source,
              confidence: txn.confidence
            }))
          }))
        };

        setMonthlyData(convertedData);
      } catch (err: any) {
        setError('Failed to load calendar data');
        console.error('Error fetching calendar data:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchYearData = async () => {
      setLoading(true);
      setError(null);

      try {
        const year = startDate.getFullYear();
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);

        const startDateStr = yearStart.toISOString().split('T')[0];
        const endDateStr = yearEnd.toISOString().split('T')[0];

        // Use unified forecast API with separate toggles
        const unifiedData = await unifiedForecastAPI.getUnifiedForecasts(
          startDateStr,
          endDateStr,
          includeManual,
          includePacingModel,
          'BASE'
        );

        // Convert to MonthlyCalendar format
        const convertedData: MonthlyCalendar = {
          year: year,
          month: 1,
          month_name: 'January',
          previous_month: { year: year - 1, month: 12 },
          next_month: { year: year + 1, month: 1 },
          period_summary: {
            start_date: startDateStr,
            end_date: endDateStr,
            total_inflows: unifiedData.daily_flows.reduce((sum, day) => sum + day.total_inflows, 0),
            total_outflows: unifiedData.daily_flows.reduce((sum, day) => sum + day.total_outflows, 0),
            net_flow: unifiedData.daily_flows.reduce((sum, day) => sum + day.net_flow, 0),
            active_days: unifiedData.daily_flows.filter(day => day.transaction_count > 0).length,
            total_transactions: unifiedData.daily_flows.reduce((sum, day) => sum + day.transaction_count, 0),
            largest_single_day: Math.max(...unifiedData.daily_flows.map(day => Math.abs(day.net_flow))),
            largest_single_day_date: null,
            most_active_day: null,
            most_active_day_count: 0
          },
          daily_flows: unifiedData.daily_flows.map(day => ({
            date: day.date,
            day: parseISODate(day.date).getDate(),
            total_inflows: day.total_inflows,
            total_outflows: day.total_outflows,
            net_flow: day.net_flow,
            transaction_count: day.transaction_count,
            transactions: day.transactions.map(txn => ({
              id: txn.id,
              investment_id: txn.investment_id,
              investment_name: txn.investment_name,
              type: txn.type,
              amount: txn.amount,
              is_forecast: txn.is_forecast,
              source: txn.source,
              confidence: txn.confidence
            }))
          }))
        };

        setMonthlyData(convertedData);
      } catch (err: any) {
        setError('Failed to load calendar data');
        console.error('Error fetching calendar data:', err);
      } finally {
        setLoading(false);
      }
    };

    switch (viewType) {
      case 'month':
        fetchMonthlyData(startDate.getFullYear(), startDate.getMonth() + 1);
        break;
      case 'quarter':
        // Fetch all 3 months of the quarter
        fetchQuarterData();
        break;
      case 'year':
        // Fetch all 12 months of the year
        fetchYearData();
        break;
      default:
        fetchMonthlyData(startDate.getFullYear(), startDate.getMonth() + 1);
    }
  }, [startDate, endDate, viewType, includeManual, includePacingModel]);

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

  // Helper to parse ISO date strings without timezone conversion
  const parseISODate = (dateString: string): Date => {
    // Parse "2025-12-01" as local date, not UTC
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const navigatePeriod = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(startOfMonth);
      setEndDate(endOfMonth);
      setViewType('month');
    } else {
      const increment = direction === 'prev' ? -1 : 1;
      let newStartDate = new Date(startDate);
      let newEndDate = new Date(endDate);

      switch (viewType) {
        case 'month':
          newStartDate.setMonth(newStartDate.getMonth() + increment);
          newEndDate.setMonth(newEndDate.getMonth() + increment);
          break;
        case 'quarter':
          newStartDate.setMonth(newStartDate.getMonth() + (3 * increment));
          newEndDate.setMonth(newEndDate.getMonth() + (3 * increment));
          break;
        case 'year':
          newStartDate.setFullYear(newStartDate.getFullYear() + increment);
          newEndDate.setFullYear(newEndDate.getFullYear() + increment);
          break;
      }

      setStartDate(newStartDate);
      setEndDate(newEndDate);
    }

    setSelectedDay(null);
  };

  const handleDateRangeChange = (newStartDate: Date, newEndDate: Date, newViewType: 'month' | 'quarter' | 'year') => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setViewType(newViewType);
    setSelectedDay(null);
  };

  const getViewModeLabel = (): string => {
    switch (viewType) {
      case 'month':
        return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'quarter':
        const quarter = Math.floor((startDate.getMonth() + 3) / 3);
        return `Q${quarter} ${startDate.getFullYear()}`;
      case 'year':
        return startDate.getFullYear().toString();
      default:
        return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };


  const getStartOfQuarter = (date: Date): Date => {
    const quarter = Math.floor((date.getMonth() + 3) / 3);
    return new Date(date.getFullYear(), (quarter - 1) * 3, 1);
  };

  const getDayIntensity = (flow: DailyFlow): number => {
    if (!monthlyData || flow.transaction_count === 0) return 0;
    
    const maxFlow = Math.max(
      ...monthlyData.daily_flows.map(df => Math.abs(df.net_flow))
    );
    
    return maxFlow > 0 ? Math.abs(flow.net_flow) / maxFlow : 0;
  };

  const getDayClassNames = (flow: DailyFlow): string => {
    let classes = 'calendar-day';
    
    if (flow.transaction_count === 0) {
      classes += ' no-activity';
    } else {
      const intensity = getDayIntensity(flow);
      classes += flow.net_flow >= 0 ? ' positive' : ' negative';
      
      if (intensity > 0.7) classes += ' high-intensity';
      else if (intensity > 0.3) classes += ' medium-intensity';
      else classes += ' low-intensity';
    }
    
    if (selectedDay && selectedDay.date === flow.date) {
      classes += ' selected';
    }
    
    // Check if it's today
    const today = new Date().toISOString().split('T')[0];
    if (flow.date === today) {
      classes += ' today';
    }
    
    return classes;
  };

  const renderCalendarGrid = () => {
    if (!monthlyData) return null;

    // Get first day of month
    const firstDay = new Date(monthlyData.year, monthlyData.month - 1, 1).getDay();
    
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const calendar = [];

    // Header row with weekdays
    calendar.push(
      <div key="header" className="calendar-header">
        {weekdays.map(day => (
          <div key={day} className="weekday-header">{day}</div>
        ))}
      </div>
    );

    // Calendar rows
    const rows = [];
    let week: JSX.Element[] = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      week.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Days of the month
    monthlyData.daily_flows.forEach((flow, index) => {
      week.push(
        <div
          key={flow.date}
          className={getDayClassNames(flow)}
          onClick={() => setSelectedDay(flow)}
          title={`${flow.date}: ${formatCurrencyCompact(flow.net_flow)} net${flow.transaction_count > 0 ? ` (${flow.transaction_count} transactions)` : ''}`}
        >
          <div className="day-number">{flow.day || parseISODate(flow.date).getDate()}</div>
          {flow.transaction_count > 0 && (
            <div className="day-amount">
              {formatCurrencyCompact(flow.net_flow)}
            </div>
          )}
          {flow.transaction_count > 1 && (
            <div className="transaction-count">
              {flow.transaction_count}
            </div>
          )}
        </div>
      );
      
      if (week.length === 7) {
        rows.push(
          <div key={`week-${rows.length}`} className="calendar-row">
            {week}
          </div>
        );
        week = [];
      }
    });
    
    // Fill remaining empty cells
    while (week.length > 0 && week.length < 7) {
      week.push(<div key={`empty-end-${week.length}`} className="calendar-day empty"></div>);
    }
    
    if (week.length > 0) {
      rows.push(
        <div key={`week-${rows.length}`} className="calendar-row">
          {week}
        </div>
      );
    }
    
    calendar.push(...rows);
    return calendar;
  };

  const renderDayDetail = () => {
    if (!selectedDay || selectedDay.transaction_count === 0) return null;

    return (
      <div className="day-detail-panel">
        <div className="day-detail-header">
          <h4>
            {parseISODate(selectedDay.date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h4>
          <button 
            className="close-detail"
            onClick={() => setSelectedDay(null)}
          >
            ×
          </button>
        </div>
        
        <div className="day-summary">
          <div className="summary-metric">
            <span className="label">Total Inflows:</span>
            <span className="value positive">{formatCurrency(selectedDay.total_inflows)}</span>
          </div>
          <div className="summary-metric">
            <span className="label">Total Outflows:</span>
            <span className="value negative">{formatCurrency(selectedDay.total_outflows)}</span>
          </div>
          <div className="summary-metric">
            <span className="label">Net Flow:</span>
            <span className={`value ${selectedDay.net_flow >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(selectedDay.net_flow)}
            </span>
          </div>
        </div>

        <div className="transactions-list">
          <h5>Transactions ({selectedDay.transaction_count})</h5>
          {selectedDay.transactions.map((txn: any, index) => {
            // Check if this is an inflow (distribution, yield, return of principal)
            const isInflow = txn.type.includes('Distribution') ||
                           txn.type.includes('Yield') ||
                           txn.type.includes('Return of Principal') ||
                           txn.type.includes('Forecasted Distribution');

            // Determine the source badge
            let sourceBadge = '';
            let sourceBadgeClass = '';
            if (txn.source) {
              if (txn.source === 'actual') {
                // Don't show badge for historical actuals - they're the default
                sourceBadge = '';
                sourceBadgeClass = '';
              } else if (txn.source === 'manual') {
                sourceBadge = 'Manual';
                sourceBadgeClass = 'source-manual';
              } else if (txn.source === 'pacing_model') {
                sourceBadge = 'Pacing';
                sourceBadgeClass = 'source-pacing';
              }
            } else if (txn.is_forecast) {
              // Fallback for legacy data
              sourceBadge = 'Forecast';
              sourceBadgeClass = 'source-forecast';
            }

            return (
              <div key={`${txn.id}-${index}`} className="transaction-item">
                <div className="transaction-main">
                  <span className="investment-name">{txn.investment_name}</span>
                  <span className={`transaction-amount ${isInflow ? 'positive' : 'negative'}`}>
                    {isInflow ? '+' : '-'}
                    {formatCurrency(txn.amount)}
                  </span>
                </div>
                <div className="transaction-meta">
                  <span className={`transaction-type ${txn.is_forecast ? 'forecast' : 'actual'}`}>
                    {txn.type}
                  </span>
                  {sourceBadge && (
                    <span className={`source-badge ${sourceBadgeClass}`}>
                      {sourceBadge}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCalendarView = () => {
    if (!monthlyData) return null;

    switch (viewType) {
      case 'month':
        return renderCalendarGrid();
      case 'quarter':
        return renderQuarterView();
      case 'year':
        return renderYearView();
      default:
        return renderCalendarGrid();
    }
  };


  const renderQuarterView = () => {
    // Quarter view - 1x3 grid with color-coded monthly boxes
    const quarterStart = new Date(startDate.getFullYear(), Math.floor(startDate.getMonth() / 3) * 3, 1);
    const months = [];

    for (let i = 0; i < 3; i++) {
      const month = new Date(quarterStart);
      month.setMonth(quarterStart.getMonth() + i);
      months.push(month);
    }

    // Calculate month totals and determine intensity for color coding
    const monthData = months.map(month => {
      const monthTotal = monthlyData?.daily_flows.reduce((sum, flow) => {
        const flowDate = parseISODate(flow.date);
        return flowDate.getMonth() === month.getMonth() ? sum + flow.net_flow : sum;
      }, 0) || 0;

      const transactionCount = monthlyData?.daily_flows.reduce((count, flow) => {
        const flowDate = parseISODate(flow.date);
        return flowDate.getMonth() === month.getMonth() ? count + flow.transaction_count : count;
      }, 0) || 0;

      return { month, monthTotal, transactionCount };
    });

    // Calculate max absolute value for intensity scaling
    const maxAbsValue = Math.max(...monthData.map(data => Math.abs(data.monthTotal)));

    const getMonthIntensity = (total: number): string => {
      if (maxAbsValue === 0) return 'no-activity';
      const intensity = Math.abs(total) / maxAbsValue;
      if (intensity > 0.7) return 'high-intensity';
      else if (intensity > 0.3) return 'medium-intensity';
      else if (intensity > 0) return 'low-intensity';
      return 'no-activity';
    };

    return (
      <div className="quarter-view">
        <div className="quarter-header">
          <h3>Q{Math.floor(startDate.getMonth() / 3) + 1} {startDate.getFullYear()}</h3>
          <p>Monthly cash flow overview for the quarter</p>
        </div>
        <div className="quarter-grid">
          {monthData.map(({ month, monthTotal, transactionCount }) => {
            const intensityClass = getMonthIntensity(monthTotal);
            const flowDirection = monthTotal >= 0 ? 'positive' : 'negative';

            // Generate detailed tooltip for this month
            const monthFlows = monthlyData?.daily_flows
              .filter(flow => parseISODate(flow.date).getMonth() === month.getMonth()) || [];

            const monthTransactions = monthFlows.flatMap(flow =>
              flow.transactions.map(txn => ({ ...txn, date: flow.date }))
            );

            const inflows = monthTransactions.filter(txn =>
              txn.type.includes('Distribution') ||
              txn.type.includes('Yield') ||
              txn.type.includes('Return of Principal') ||
              txn.type.includes('Forecasted Distribution')
            );
            const outflows = monthTransactions.filter(txn =>
              !txn.type.includes('Distribution') &&
              !txn.type.includes('Yield') &&
              !txn.type.includes('Return of Principal') &&
              !txn.type.includes('Forecasted Distribution')
            );

            const tooltipContent = `${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

NET FLOW: ${formatCurrency(monthTotal)}
Total Transactions: ${transactionCount}

INFLOWS (${inflows.length}):
${inflows.slice(0, 5).map(txn => `• ${txn.investment_name}: ${formatCurrency(txn.amount)} (${parseISODate(txn.date).toLocaleDateString()})`).join('\n')}${inflows.length > 5 ? `\n... and ${inflows.length - 5} more` : ''}

OUTFLOWS (${outflows.length}):
${outflows.slice(0, 5).map(txn => `• ${txn.investment_name}: ${formatCurrency(txn.amount)} (${parseISODate(txn.date).toLocaleDateString()})`).join('\n')}${outflows.length > 5 ? `\n... and ${outflows.length - 5} more` : ''}`;
            return (
              <div
                key={month.toISOString()}
                className={`quarter-month-box ${flowDirection} ${intensityClass}`}
                onClick={() => {
                  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
                  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
                  setStartDate(monthStart);
                  setEndDate(monthEnd);
                  setViewType('month');
                }}
                title={tooltipContent}
              >
                <div className="month-header">
                  <div className="month-name">{month.toLocaleDateString('en-US', { month: 'long' })}</div>
                  <div className="month-year">{month.getFullYear()}</div>
                </div>
                <div className="month-metrics">
                  <div className={`month-total ${flowDirection}`}>
                    {formatCurrencyCompact(monthTotal)}
                  </div>
                  <div className="month-transactions">
                    {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="month-indicator">
                  <div className={`flow-indicator ${flowDirection} ${intensityClass}`}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    // Year view - 3x4 grid of months instead of calendar view
    const year = startDate.getFullYear();
    const months = [];

    // Generate all 12 months of the year
    for (let i = 0; i < 12; i++) {
      const month = new Date(year, i, 1);
      months.push(month);
    }

    // Calculate month data from the loaded daily flows
    const monthDataArray = months.map(month => {
      // Filter daily flows for this specific month
      const monthFlows = monthlyData?.daily_flows.filter(flow => {
        const flowDate = parseISODate(flow.date);
        return flowDate.getMonth() === month.getMonth() && flowDate.getFullYear() === month.getFullYear();
      }) || [];

      const monthTotal = monthFlows.reduce((sum, flow) => sum + flow.net_flow, 0);
      const transactionCount = monthFlows.reduce((count, flow) => count + flow.transaction_count, 0);
      const hasData = monthFlows.length > 0;

      return { month, monthTotal, transactionCount, hasData };
    });

    // Calculate max absolute value for intensity scaling
    const maxAbsValue = Math.max(...monthDataArray.map(data => Math.abs(data.monthTotal)));

    const getMonthIntensity = (total: number): string => {
      if (maxAbsValue === 0) return 'no-activity';
      const intensity = Math.abs(total) / maxAbsValue;
      if (intensity > 0.7) return 'high-intensity';
      else if (intensity > 0.3) return 'medium-intensity';
      else if (intensity > 0) return 'low-intensity';
      return 'no-activity';
    };

    return (
      <div className="year-view">
        <div className="year-header">
          <h3>{year}</h3>
          <p>Annual cash flow overview - click any month to view details</p>
        </div>
        <div className="year-grid quarterly-layout">
          {monthDataArray.map(({ month, monthTotal, transactionCount, hasData }) => {
            const intensityClass = getMonthIntensity(monthTotal);
            const flowDirection = monthTotal >= 0 ? 'positive' : 'negative';
            const isCurrentMonth = month.getMonth() === startDate.getMonth() && month.getFullYear() === startDate.getFullYear();

            // Generate detailed tooltip for year view
            let tooltipContent;
            if (hasData) {
              // Filter flows for this specific month
              const monthFlows = monthlyData?.daily_flows.filter(flow => {
                const flowDate = parseISODate(flow.date);
                return flowDate.getMonth() === month.getMonth() && flowDate.getFullYear() === month.getFullYear();
              }) || [];

              const monthTransactions = monthFlows.flatMap(flow =>
                flow.transactions.map(txn => ({ ...txn, date: flow.date }))
              );

              const inflows = monthTransactions.filter(txn =>
                txn.type.includes('Distribution') ||
                txn.type.includes('Yield') ||
                txn.type.includes('Return of Principal') ||
                txn.type.includes('Forecasted Distribution')
              );
              const outflows = monthTransactions.filter(txn =>
                !txn.type.includes('Distribution') &&
                !txn.type.includes('Yield') &&
                !txn.type.includes('Return of Principal') &&
                !txn.type.includes('Forecasted Distribution')
              );

              tooltipContent = `${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

NET FLOW: ${formatCurrency(monthTotal)}
Total Transactions: ${transactionCount}

INFLOWS (${inflows.length}):
${inflows.slice(0, 3).map(txn => `• ${txn.investment_name}: ${formatCurrency(txn.amount)} (${parseISODate(txn.date).toLocaleDateString()})`).join('\n')}${inflows.length > 3 ? `\n... and ${inflows.length - 3} more` : ''}

OUTFLOWS (${outflows.length}):
${outflows.slice(0, 3).map(txn => `• ${txn.investment_name}: ${formatCurrency(txn.amount)} (${parseISODate(txn.date).toLocaleDateString()})`).join('\n')}${outflows.length > 3 ? `\n... and ${outflows.length - 3} more` : ''}`;
            } else {
              tooltipContent = `${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

Click to view this month's data`;
            }

            return (
              <div
                key={month.toISOString()}
                className={`year-month-box ${flowDirection} ${intensityClass} ${isCurrentMonth ? 'current-month' : ''}`}
                onClick={() => {
                  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
                  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
                  setStartDate(monthStart);
                  setEndDate(monthEnd);
                  setViewType('month');
                }}
                title={tooltipContent}
              >
                <div className="month-header">
                  <div className="month-name">{month.toLocaleDateString('en-US', { month: 'short' })}</div>
                  {isCurrentMonth && <div className="current-indicator">●</div>}
                </div>
                <div className="month-metrics">
                  <div className={`month-total ${flowDirection}`}>
                    {formatCurrencyCompact(monthTotal)}
                  </div>
                  <div className="month-transactions">
                    {transactionCount} txn{transactionCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="month-indicator">
                  <div className={`flow-indicator ${flowDirection} ${intensityClass}`}></div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="year-view-note">
          <p><strong>Note:</strong> Click any month to view its cash flow details.</p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="cash-flow-calendar">
        <div className="calendar-loading">Loading calendar...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cash-flow-calendar">
        <div className="calendar-error">{error}</div>
      </div>
    );
  }

  if (!monthlyData) {
    return (
      <div className="cash-flow-calendar">
        <div className="calendar-no-data">No calendar data available</div>
      </div>
    );
  }

  return (
    <div className="cash-flow-calendar">
      <div className="calendar-header-controls">
        <div className="calendar-title">
          <h2>Cash Flow Calendar</h2>
          <span className="calendar-subtitle">
            {getViewModeLabel()}
          </span>
        </div>

        <div className="calendar-controls">
          <div className="view-type-selector">
            {viewTypes.map(vt => (
              <button
                key={vt.type}
                className={`view-type-btn ${viewType === vt.type ? 'active' : ''}`}
                onClick={() => setViewType(vt.type)}
              >
                {vt.label}
              </button>
            ))}
          </div>

          <div className="forecast-toggles">
            <div className="toggle-group">
              <label className="forecast-toggle-label">
                <input
                  type="checkbox"
                  checked={includeManual}
                  onChange={(e) => setIncludeManual(e.target.checked)}
                />
                <span className="toggle-text">Manual Forecasts</span>
              </label>
              <label className="forecast-toggle-label">
                <input
                  type="checkbox"
                  checked={includePacingModel}
                  onChange={(e) => setIncludePacingModel(e.target.checked)}
                />
                <span className="toggle-text">Pacing Model</span>
              </label>
            </div>
          </div>

          <div className="date-navigation-section">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={handleDateRangeChange}
              className="calendar-date-range-picker"
              placeholder="Select date range"
            />
          </div>

          <div className="navigation-controls">
            <button 
              className="nav-btn"
              onClick={() => navigatePeriod('prev')}
              title={`Previous ${getNavigationIncrement().label}`}
            >
              ←
            </button>
            <div className="current-period-display">
              <span className="period-label">{getViewModeLabel()}</span>
            </div>
            <button 
              className="nav-btn"
              onClick={() => navigatePeriod('next')}
              title={`Next ${getNavigationIncrement().label}`}
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-main">
        <div className="calendar-grid">
          {renderCalendarView()}
        </div>

        {selectedDay && (
          <div className="calendar-sidebar">
            {renderDayDetail()}
          </div>
        )}
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color positive"></div>
          <span>Net Positive</span>
        </div>
        <div className="legend-item">
          <div className="legend-color negative"></div>
          <span>Net Negative</span>
        </div>
        <div className="legend-item">
          <div className="legend-color no-activity"></div>
          <span>No Activity</span>
        </div>
        <div className="legend-note">
          Intensity represents relative cash flow amounts
        </div>
      </div>
    </div>
  );
};

export default CashFlowCalendar;