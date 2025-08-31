import React, { useState, useEffect } from 'react';
import { calendarAPI, DailyFlow, MonthlyCalendar } from '../services/api';
import DatePicker from './DatePicker';
import './CashFlowCalendar.css';

interface ViewType {
  type: 'day' | 'week' | 'month' | 'quarter' | 'year';
  label: string;
}

interface NavigationIncrement {
  days: number;
  label: string;
}

const CashFlowCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [monthlyData, setMonthlyData] = useState<MonthlyCalendar | null>(null);
  const [selectedDay, setSelectedDay] = useState<DailyFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeForecasts, setIncludeForecasts] = useState(true);

  const viewTypes: ViewType[] = [
    { type: 'day', label: 'Day' },
    { type: 'week', label: 'Week' },
    { type: 'month', label: 'Month' },
    { type: 'quarter', label: 'Quarter' },
    { type: 'year', label: 'Year' }
  ];

  // Navigation increments based on view type
  const getNavigationIncrement = (): NavigationIncrement => {
    switch (viewType) {
      case 'day':
        return { days: 1, label: 'day' };
      case 'week':
        return { days: 7, label: 'week' };
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
      const data = await calendarAPI.getMonthlyCalendar(year, month, includeForecasts);
      setMonthlyData(data);
    } catch (err: any) {
      setError('Failed to load calendar data');
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewType === 'month') {
      fetchMonthlyData(currentDate.getFullYear(), currentDate.getMonth() + 1);
    }
  }, [currentDate, viewType, includeForecasts]);

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

  const navigatePeriod = (direction: 'prev' | 'next' | 'today') => {
    let newDate = new Date(currentDate);
    
    if (direction === 'today') {
      newDate = new Date();
    } else {
      const increment = direction === 'prev' ? -1 : 1;
      
      switch (viewType) {
        case 'day':
          newDate.setDate(newDate.getDate() + increment);
          break;
        case 'week':
          newDate.setDate(newDate.getDate() + (7 * increment));
          break;
        case 'month':
          newDate.setMonth(newDate.getMonth() + increment);
          break;
        case 'quarter':
          newDate.setMonth(newDate.getMonth() + (3 * increment));
          break;
        case 'year':
          newDate.setFullYear(newDate.getFullYear() + increment);
          break;
      }
    }
    
    setCurrentDate(newDate);
    setSelectedDay(null);
  };

  const handleDatePickerChange = (date: Date) => {
    setCurrentDate(date);
    setSelectedDay(null);
  };

  const getViewModeLabel = (): string => {
    const increment = getNavigationIncrement();
    const direction = increment.label;
    
    switch (viewType) {
      case 'day':
        return currentDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'week':
        const startOfWeek = getStartOfWeek(currentDate);
        const endOfWeek = getEndOfWeek(currentDate);
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month':
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'quarter':
        const quarter = Math.floor((currentDate.getMonth() + 3) / 3);
        return `Q${quarter} ${currentDate.getFullYear()}`;
      case 'year':
        return currentDate.getFullYear().toString();
      default:
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const getStartOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const getEndOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (6 - day));
    result.setHours(23, 59, 59, 999);
    return result;
  };

  const getQuickJumpOptions = () => {
    const today = new Date();
    const options = [
      { label: 'Today', date: new Date(today) },
      { label: 'This Week', date: getStartOfWeek(today) },
      { label: 'This Month', date: new Date(today.getFullYear(), today.getMonth(), 1) },
      { label: 'This Quarter', date: getStartOfQuarter(today) },
      { label: 'This Year', date: new Date(today.getFullYear(), 0, 1) }
    ];
    return options;
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

    // Get first day of month and number of days
    const firstDay = new Date(monthlyData.year, monthlyData.month - 1, 1).getDay();
    const daysInMonth = monthlyData.daily_flows.length;
    
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
          <div className="day-number">{flow.day || new Date(flow.date).getDate()}</div>
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
            {new Date(selectedDay.date).toLocaleDateString('en-US', { 
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
          {selectedDay.transactions.map((txn, index) => (
            <div key={`${txn.id}-${index}`} className="transaction-item">
              <div className="transaction-main">
                <span className="investment-name">{txn.investment_name}</span>
                <span className={`transaction-amount ${txn.type.includes('Distribution') || txn.type.includes('Forecasted Distribution') ? 'positive' : 'negative'}`}>
                  {txn.type.includes('Distribution') || txn.type.includes('Forecasted Distribution') ? '+' : '-'}
                  {formatCurrency(txn.amount)}
                </span>
              </div>
              <div className="transaction-meta">
                <span className={`transaction-type ${txn.is_forecast ? 'forecast' : 'actual'}`}>
                  {txn.type}
                  {txn.is_forecast && ' (Projected)'}
                </span>
              </div>
            </div>
          ))}
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

          <div className="forecast-toggle">
            <label>
              <input
                type="checkbox"
                checked={includeForecasts}
                onChange={(e) => setIncludeForecasts(e.target.checked)}
              />
              Include Forecasts
            </label>
          </div>

          <div className="date-navigation-section">
            <DatePicker
              selectedDate={currentDate}
              onDateChange={handleDatePickerChange}
              viewMode={viewType}
              className="calendar-date-picker"
              showToday={true}
              placeholder={`Select ${viewType}`}
            />
            
            <div className="quick-jump-buttons">
              {getQuickJumpOptions().map((option) => (
                <button
                  key={option.label}
                  className="quick-jump-btn"
                  onClick={() => handleDatePickerChange(option.date)}
                  title={`Jump to ${option.label}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
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
          {renderCalendarGrid()}
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