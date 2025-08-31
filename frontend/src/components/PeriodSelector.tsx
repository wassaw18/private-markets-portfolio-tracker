import React from 'react';
import './PeriodSelector.css';

export interface PeriodSelection {
  type: 'mtd' | 'qtd' | 'ytd' | 'month' | 'quarter' | 'year' | 'custom';
  year?: number;
  month?: number;
  quarter?: number;
  customStartDate?: string;
  customEndDate?: string;
  label: string;
}

interface PeriodSelectorProps {
  selectedPeriod: PeriodSelection;
  onPeriodChange: (period: PeriodSelection) => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ selectedPeriod, onPeriodChange }) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  const getDateRangeForPeriod = (type: string, year?: number, month?: number, quarter?: number): { start: string, end: string } => {
    const now = new Date();
    
    switch (type) {
      case 'mtd':
        // Month to date - from start of current month to today
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      
      case 'qtd':
        // Quarter to date - from start of current quarter to today
        const qtdMonth = (Math.ceil((now.getMonth() + 1) / 3) - 1) * 3;
        return {
          start: new Date(now.getFullYear(), qtdMonth, 1).toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      
      case 'ytd':
        // Year to date - from start of current year to today
        return {
          start: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      
      case 'month':
        // Full month
        const monthStart = new Date(year!, month! - 1, 1);
        const monthEnd = new Date(year!, month!, 0);
        return {
          start: monthStart.toISOString().split('T')[0],
          end: monthEnd.toISOString().split('T')[0]
        };
      
      case 'quarter':
        // Full quarter
        const quarterStartMonth = (quarter! - 1) * 3;
        const quarterStart = new Date(year!, quarterStartMonth, 1);
        const quarterEnd = new Date(year!, quarterStartMonth + 3, 0);
        return {
          start: quarterStart.toISOString().split('T')[0],
          end: quarterEnd.toISOString().split('T')[0]
        };
      
      case 'year':
        // Full year
        return {
          start: new Date(year!, 0, 1).toISOString().split('T')[0],
          end: new Date(year!, 11, 31).toISOString().split('T')[0]
        };
      
      default:
        return {
          start: now.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
    }
  };

  const presetPeriods: PeriodSelection[] = [
    {
      type: 'mtd',
      label: 'Month to Date',
      ...getDateRangeForPeriod('mtd')
    },
    {
      type: 'qtd',
      label: 'Quarter to Date',
      ...getDateRangeForPeriod('qtd')
    },
    {
      type: 'ytd',
      label: 'Year to Date',
      ...getDateRangeForPeriod('ytd')
    },
    {
      type: 'month',
      year: currentYear,
      month: currentMonth,
      label: new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    },
    {
      type: 'quarter',
      year: currentYear,
      quarter: currentQuarter,
      label: `Q${currentQuarter} ${currentYear}`
    },
    {
      type: 'year',
      year: currentYear,
      label: currentYear.toString()
    },
    {
      type: 'month',
      year: currentYear,
      month: currentMonth === 1 ? 12 : currentMonth - 1,
      label: new Date(currentYear, (currentMonth === 1 ? 12 : currentMonth - 1) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    },
    {
      type: 'quarter',
      year: currentQuarter === 1 ? currentYear - 1 : currentYear,
      quarter: currentQuarter === 1 ? 4 : currentQuarter - 1,
      label: `Q${currentQuarter === 1 ? 4 : currentQuarter - 1} ${currentQuarter === 1 ? currentYear - 1 : currentYear}`
    },
    {
      type: 'year',
      year: currentYear - 1,
      label: (currentYear - 1).toString()
    }
  ];

  const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    
    if (selectedValue === 'custom') {
      onPeriodChange({
        type: 'custom',
        customStartDate: '',
        customEndDate: '',
        label: 'Custom Range'
      });
    } else {
      const selectedIndex = parseInt(selectedValue);
      onPeriodChange(presetPeriods[selectedIndex]);
    }
  };

  const handleCustomDateChange = (field: 'customStartDate' | 'customEndDate', value: string) => {
    if (selectedPeriod.type === 'custom') {
      const updatedPeriod = {
        ...selectedPeriod,
        [field]: value,
        label: 'Custom Range'
      };
      onPeriodChange(updatedPeriod);
    }
  };

  const getCurrentSelection = (): string => {
    if (selectedPeriod.type === 'custom') {
      return 'custom';
    }
    
    const index = presetPeriods.findIndex(period => 
      period.type === selectedPeriod.type &&
      period.year === selectedPeriod.year &&
      period.month === selectedPeriod.month &&
      period.quarter === selectedPeriod.quarter
    );
    
    return index >= 0 ? index.toString() : '0';
  };

  return (
    <div className="period-selector">
      <div className="selector-header">
        <label htmlFor="period-select">Analysis Period:</label>
        <select 
          id="period-select"
          className="period-select"
          value={getCurrentSelection()}
          onChange={handlePresetChange}
        >
          <optgroup label="Current Periods">
            <option value="0">Month to Date</option>
            <option value="1">Quarter to Date</option>
            <option value="2">Year to Date</option>
          </optgroup>
          <optgroup label="Complete Periods">
            <option value="3">{presetPeriods[3].label}</option>
            <option value="4">{presetPeriods[4].label}</option>
            <option value="5">{presetPeriods[5].label}</option>
          </optgroup>
          <optgroup label="Previous Periods">
            <option value="6">{presetPeriods[6].label}</option>
            <option value="7">{presetPeriods[7].label}</option>
            <option value="8">{presetPeriods[8].label}</option>
          </optgroup>
          <optgroup label="Custom">
            <option value="custom">Custom Date Range</option>
          </optgroup>
        </select>
      </div>

      {selectedPeriod.type === 'custom' && (
        <div className="custom-date-range">
          <div className="date-input-group">
            <label htmlFor="start-date">Start Date:</label>
            <input
              id="start-date"
              type="date"
              value={selectedPeriod.customStartDate || ''}
              onChange={(e) => handleCustomDateChange('customStartDate', e.target.value)}
              className="date-input"
            />
          </div>
          <div className="date-input-group">
            <label htmlFor="end-date">End Date:</label>
            <input
              id="end-date"
              type="date"
              value={selectedPeriod.customEndDate || ''}
              onChange={(e) => handleCustomDateChange('customEndDate', e.target.value)}
              className="date-input"
            />
          </div>
        </div>
      )}

      <div className="period-info">
        <span className="selected-period">{selectedPeriod.label}</span>
        {selectedPeriod.type !== 'custom' && (
          <small className="period-dates">
            {(() => {
              if (['mtd', 'qtd', 'ytd'].includes(selectedPeriod.type)) {
                const range = getDateRangeForPeriod(selectedPeriod.type);
                return `${new Date(range.start).toLocaleDateString()} - ${new Date(range.end).toLocaleDateString()}`;
              } else if (selectedPeriod.type === 'month' && selectedPeriod.year && selectedPeriod.month) {
                const range = getDateRangeForPeriod('month', selectedPeriod.year, selectedPeriod.month);
                return `${new Date(range.start).toLocaleDateString()} - ${new Date(range.end).toLocaleDateString()}`;
              } else if (selectedPeriod.type === 'quarter' && selectedPeriod.year && selectedPeriod.quarter) {
                const range = getDateRangeForPeriod('quarter', selectedPeriod.year, selectedPeriod.quarter);
                return `${new Date(range.start).toLocaleDateString()} - ${new Date(range.end).toLocaleDateString()}`;
              } else if (selectedPeriod.type === 'year' && selectedPeriod.year) {
                const range = getDateRangeForPeriod('year', selectedPeriod.year);
                return `${new Date(range.start).toLocaleDateString()} - ${new Date(range.end).toLocaleDateString()}`;
              }
              return '';
            })()}
          </small>
        )}
        {selectedPeriod.type === 'custom' && selectedPeriod.customStartDate && selectedPeriod.customEndDate && (
          <small className="period-dates">
            {new Date(selectedPeriod.customStartDate).toLocaleDateString()} - {new Date(selectedPeriod.customEndDate).toLocaleDateString()}
          </small>
        )}
      </div>
    </div>
  );
};

export default PeriodSelector;