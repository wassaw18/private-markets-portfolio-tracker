import React, { useState, useRef, useEffect } from 'react';
import './DateRangePicker.css';

export interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (startDate: Date, endDate: Date, viewType: 'month' | 'quarter' | 'year') => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onDateRangeChange,
  placeholder = 'Select date range',
  disabled = false,
  className = '',
  minDate,
  maxDate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(new Date(startDate));
  const [tempEndDate, setTempEndDate] = useState(new Date(endDate));
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Update input value when dates change
  useEffect(() => {
    setInputValue(formatDateRange(startDate, endDate));
  }, [startDate, endDate]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectingEnd(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateRange = (start: Date, end: Date): string => {
    const startStr = start.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const endStr = end.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    return `${startStr} - ${endStr}`;
  };

  const isValidDate = (date: Date): boolean => {
    return date instanceof Date && !isNaN(date.getTime());
  };

  const isDateInRange = (date: Date): boolean => {
    if (minDate && date < minDate) return false;
    if (maxDate && date > maxDate) return false;
    return true;
  };

  const calculateDaysBetween = (start: Date, end: Date): number => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const determineViewType = (start: Date, end: Date): 'month' | 'quarter' | 'year' => {
    const days = calculateDaysBetween(start, end);

    if (days <= 62) { // Up to 2 months
      return 'month';
    } else if (days <= 366) { // Up to 1 year
      return 'quarter';
    } else {
      return 'year';
    }
  };

  const handleDateSelect = (date: Date) => {
    if (!isValidDate(date) || !isDateInRange(date)) return;

    if (!selectingEnd) {
      // Selecting start date
      setTempStartDate(date);
      setTempEndDate(date);
      setSelectingEnd(true);
    } else {
      // Selecting end date
      let finalStartDate = tempStartDate;
      let finalEndDate = date;

      // Ensure start is before end
      if (date < tempStartDate) {
        finalStartDate = date;
        finalEndDate = tempStartDate;
      }

      setTempEndDate(finalEndDate);

      // Auto-determine view type and trigger callback
      const viewType = determineViewType(finalStartDate, finalEndDate);
      onDateRangeChange(finalStartDate, finalEndDate, viewType);

      setIsOpen(false);
      setSelectingEnd(false);
    }
  };

  const handlePresetSelect = (preset: string) => {
    const today = new Date();
    let start: Date;
    let end: Date;
    let viewType: 'month' | 'quarter' | 'year';

    switch (preset) {
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        viewType = 'month';
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        viewType = 'month';
        break;
      case 'thisQuarter':
        const quarterStart = Math.floor(today.getMonth() / 3) * 3;
        start = new Date(today.getFullYear(), quarterStart, 1);
        end = new Date(today.getFullYear(), quarterStart + 3, 0);
        viewType = 'quarter';
        break;
      case 'lastQuarter':
        const lastQuarterStart = Math.floor(today.getMonth() / 3) * 3 - 3;
        const lastQuarterYear = lastQuarterStart < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const adjustedQuarterStart = lastQuarterStart < 0 ? 9 : lastQuarterStart;
        start = new Date(lastQuarterYear, adjustedQuarterStart, 1);
        end = new Date(lastQuarterYear, adjustedQuarterStart + 3, 0);
        viewType = 'quarter';
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        viewType = 'year';
        break;
      case 'lastYear':
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
        viewType = 'year';
        break;
      case 'last30Days':
        end = new Date(today);
        start = new Date(today);
        start.setDate(start.getDate() - 29);
        viewType = 'month';
        break;
      case 'last90Days':
        end = new Date(today);
        start = new Date(today);
        start.setDate(start.getDate() - 89);
        viewType = 'quarter';
        break;
      default:
        return;
    }

    onDateRangeChange(start, end, viewType);
    setIsOpen(false);
    setSelectingEnd(false);
  };

  const renderCalendar = () => {
    const displayDate = selectingEnd ? tempEndDate : tempStartDate;
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOfCalendar = getStartOfWeek(firstDay);
    const endOfCalendar = getEndOfWeek(lastDay);

    const weeks = [];
    let currentDate = new Date(startOfCalendar);

    while (currentDate <= endOfCalendar) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="date-range-picker-calendar">
        <div className="calendar-header">
          <button
            type="button"
            onClick={() => navigateMonth(-1)}
            className="nav-button"
            title="Previous month"
          >
            ‹
          </button>
          <div className="calendar-title">
            <span className="month-year">
              {displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigateMonth(1)}
            className="nav-button"
            title="Next month"
          >
            ›
          </button>
        </div>

        <div className="calendar-weekdays">
          {weekdays.map(day => (
            <div key={day} className="weekday-header">
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-days">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="calendar-week">
              {week.map((date, dayIndex) => {
                const isCurrentMonth = date.getMonth() === month;
                const isStartSelected = date.toDateString() === tempStartDate.toDateString();
                const isEndSelected = date.toDateString() === tempEndDate.toDateString();
                const isInRange = tempStartDate <= date && date <= tempEndDate;
                const isToday = date.toDateString() === new Date().toDateString();
                const isDateValid = isDateInRange(date);

                return (
                  <button
                    key={dayIndex}
                    type="button"
                    className={`calendar-day ${
                      !isCurrentMonth ? 'other-month' : ''
                    } ${isStartSelected ? 'start-selected' : ''} ${
                      isEndSelected ? 'end-selected' : ''
                    } ${isInRange && tempStartDate !== tempEndDate ? 'in-range' : ''} ${
                      isToday ? 'today' : ''
                    } ${!isDateValid ? 'disabled' : ''}`}
                    onClick={() => handleDateSelect(date)}
                    disabled={!isDateValid}
                    title={date.toLocaleDateString()}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getStartOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    return result;
  };

  const getEndOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (6 - day));
    return result;
  };

  const navigateMonth = (direction: 1 | -1) => {
    if (selectingEnd) {
      const newDate = new Date(tempEndDate);
      newDate.setMonth(newDate.getMonth() + direction);
      setTempEndDate(newDate);
    } else {
      const newDate = new Date(tempStartDate);
      newDate.setMonth(newDate.getMonth() + direction);
      setTempStartDate(newDate);
    }
  };

  const renderPresets = () => {
    const presets = [
      { key: 'thisMonth', label: 'This Month' },
      { key: 'lastMonth', label: 'Last Month' },
      { key: 'thisQuarter', label: 'This Quarter' },
      { key: 'lastQuarter', label: 'Last Quarter' },
      { key: 'thisYear', label: 'This Year' },
      { key: 'lastYear', label: 'Last Year' },
      { key: 'last30Days', label: 'Last 30 Days' },
      { key: 'last90Days', label: 'Last 90 Days' }
    ];

    return (
      <div className="date-range-presets">
        <h4>Quick Select</h4>
        {presets.map(preset => (
          <button
            key={preset.key}
            type="button"
            className="preset-button"
            onClick={() => handlePresetSelect(preset.key)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`date-range-picker ${className} ${isOpen ? 'open' : ''}`}
    >
      <div className="date-range-picker-input-container">
        <input
          type="text"
          className="date-range-picker-input"
          value={inputValue}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={true}
        />
        <button
          type="button"
          className="date-range-picker-toggle"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-label="Open calendar"
        >
          📅
        </button>
      </div>

      {isOpen && (
        <div className="date-range-picker-dropdown">
          <div className="date-range-picker-content">
            <div className="date-range-picker-sidebar">
              {renderPresets()}
            </div>
            <div className="date-range-picker-calendar-container">
              <div className="selection-status">
                {!selectingEnd ? (
                  <span>Select start date</span>
                ) : (
                  <span>Select end date</span>
                )}
              </div>
              {renderCalendar()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;