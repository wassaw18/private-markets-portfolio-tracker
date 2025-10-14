import React, { useState } from 'react';
import CashFlowCalendar from '../components/CashFlowCalendar';
import CashFlowInsightsPanel from '../components/CashFlowInsightsPanel';
import PeriodSelector, { PeriodSelection } from '../components/PeriodSelector';
import './Calendar.css';

const Calendar: React.FC = () => {
  const currentDate = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>({
    type: 'month',
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
    label: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  });

  // Convert PeriodSelection to props for CashFlowInsightsPanel
  const getInsightsPanelProps = () => {
    switch (selectedPeriod.type) {
      case 'month':
        return {
          year: selectedPeriod.year,
          month: selectedPeriod.month
        };
      case 'quarter':
        return {
          year: selectedPeriod.year,
          quarter: selectedPeriod.quarter
        };
      case 'year':
        return {
          year: selectedPeriod.year
        };
      case 'custom':
        return {
          customStartDate: selectedPeriod.customStartDate,
          customEndDate: selectedPeriod.customEndDate
        };
      case 'mtd':
      case 'qtd':
      case 'ytd':
        // For to-date periods, calculate the date range
        const now = new Date();
        let startDate: Date;
        
        if (selectedPeriod.type === 'mtd') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (selectedPeriod.type === 'qtd') {
          const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
          const quarterStartMonth = (currentQuarter - 1) * 3;
          startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
        } else { // ytd
          startDate = new Date(now.getFullYear(), 0, 1);
        }
        
        return {
          customStartDate: startDate.toISOString().split('T')[0],
          customEndDate: now.toISOString().split('T')[0]
        };
      default:
        return {
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1
        };
    }
  };

  return (
    <div className="calendar-page">
      <div className="luxury-card page-header">
        <h1 className="luxury-heading-1">Cash Flow Calendar</h1>
        <p className="luxury-body-large">
          Visualize cash flow timing and patterns across your portfolio with comprehensive period insights
        </p>
      </div>

      {/* Period Selector */}
      <PeriodSelector 
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
      />

      <CashFlowCalendar />
      
      <CashFlowInsightsPanel 
        {...getInsightsPanelProps()}
        key={`${selectedPeriod.type}-${selectedPeriod.year}-${selectedPeriod.month}-${selectedPeriod.quarter}-${selectedPeriod.customStartDate}-${selectedPeriod.customEndDate}`}
      />
    </div>
  );
};

export default Calendar;