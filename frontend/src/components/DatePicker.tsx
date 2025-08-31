import React, { useState, useRef, useEffect } from 'react';
import './DatePicker.css';

export interface DatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  viewMode?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showToday?: boolean;
  showClear?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onDateChange,
  viewMode = 'month',
  placeholder = 'Select date',
  disabled = false,
  className = '',
  showToday = true,
  showClear = false,
  minDate,
  maxDate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayDate, setDisplayDate] = useState(new Date(selectedDate));
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update input value when selectedDate changes
  useEffect(() => {
    setInputValue(formatDisplayDate(selectedDate, viewMode));
  }, [selectedDate, viewMode]);

  // Update display date when selectedDate changes
  useEffect(() => {
    setDisplayDate(new Date(selectedDate));
  }, [selectedDate]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          break;
        case 'Enter':
          if (isValidDate(displayDate)) {
            handleDateSelect(displayDate);
          }
          break;
        case 'ArrowLeft':
          event.preventDefault();
          navigateDate(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          navigateDate(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          navigateDate(-7); // Previous week
          break;
        case 'ArrowDown':
          event.preventDefault();
          navigateDate(7); // Next week
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, displayDate]);

  const formatDisplayDate = (date: Date, mode: string): string => {
    const options: Intl.DateTimeFormatOptions = {};
    
    switch (mode) {
      case 'day':
        options.weekday = 'long';
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        break;
      case 'week':
        const startOfWeek = getStartOfWeek(date);
        const endOfWeek = getEndOfWeek(date);
        return `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
      case 'month':
        options.year = 'numeric';
        options.month = 'long';
        break;
      case 'quarter':
        const quarter = getQuarter(date);
        return `Q${quarter} ${date.getFullYear()}`;
      case 'year':
        options.year = 'numeric';
        break;
      default:
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
    }
    
    return date.toLocaleDateString('en-US', options);
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

  const getQuarter = (date: Date): number => {
    return Math.floor((date.getMonth() + 3) / 3);
  };

  const isValidDate = (date: Date): boolean => {
    return date instanceof Date && !isNaN(date.getTime());
  };

  const isDateInRange = (date: Date): boolean => {
    if (minDate && date < minDate) return false;
    if (maxDate && date > maxDate) return false;
    return true;
  };

  const navigateDate = (days: number) => {
    const newDate = new Date(displayDate);
    newDate.setDate(newDate.getDate() + days);
    setDisplayDate(newDate);
  };

  const navigateMonth = (direction: 1 | -1) => {
    const newDate = new Date(displayDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setDisplayDate(newDate);
  };

  const navigateYear = (direction: 1 | -1) => {
    const newDate = new Date(displayDate);
    newDate.setFullYear(newDate.getFullYear() + direction);
    setDisplayDate(newDate);
  };

  const handleDateSelect = (date: Date) => {
    if (isValidDate(date) && isDateInRange(date)) {
      onDateChange(date);
      setIsOpen(false);
    }
  };

  const handleTodayClick = () => {
    const today = new Date();
    if (isDateInRange(today)) {
      handleDateSelect(today);
    }
  };

  const handleClearClick = () => {
    onDateChange(new Date()); // Reset to current date
    setIsOpen(false);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);
    
    // Try to parse the input as a date
    const parsedDate = new Date(value);
    if (isValidDate(parsedDate) && isDateInRange(parsedDate)) {
      setDisplayDate(parsedDate);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const parsedDate = new Date(inputValue);
      if (isValidDate(parsedDate) && isDateInRange(parsedDate)) {
        handleDateSelect(parsedDate);
      } else {
        // Reset to current selected date if invalid
        setInputValue(formatDisplayDate(selectedDate, viewMode));
      }
    }
  };

  const renderCalendar = () => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = getStartOfWeek(firstDay);
    const endDate = getEndOfWeek(lastDay);
    
    const weeks = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="date-picker-calendar">
        <div className="calendar-header">
          <button
            type="button"
            onClick={() => navigateYear(-1)}
            className="nav-button"
            title="Previous year"
          >
            «
          </button>
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
          <button
            type="button"
            onClick={() => navigateYear(1)}
            className="nav-button"
            title="Next year"
          >
            »
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
                const isSelected = 
                  date.toDateString() === selectedDate.toDateString();
                const isToday = date.toDateString() === new Date().toDateString();
                const isInRange = isDateInRange(date);
                
                return (
                  <button
                    key={dayIndex}
                    type="button"
                    className={`calendar-day ${
                      !isCurrentMonth ? 'other-month' : ''
                    } ${isSelected ? 'selected' : ''} ${
                      isToday ? 'today' : ''
                    } ${!isInRange ? 'disabled' : ''}`}
                    onClick={() => handleDateSelect(date)}
                    disabled={!isInRange}
                    title={date.toLocaleDateString()}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        
        <div className="calendar-footer">
          {showToday && (
            <button
              type="button"
              className="today-button"
              onClick={handleTodayClick}
              disabled={!isDateInRange(new Date())}
            >
              Today
            </button>
          )}
          {showClear && (
            <button
              type="button"
              className="clear-button"
              onClick={handleClearClick}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={containerRef} 
      className={`date-picker ${className} ${isOpen ? 'open' : ''}`}
    >
      <div className="date-picker-input-container">
        <input
          ref={inputRef}
          type="text"
          className="date-picker-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={false}
        />
        <button
          type="button"
          className="date-picker-toggle"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-label="Open calendar"
        >
          📅
        </button>
      </div>
      
      {isOpen && (
        <div className="date-picker-dropdown">
          {renderCalendar()}
        </div>
      )}
    </div>
  );
};

export default DatePicker;