import React, { useState, useEffect, useCallback } from 'react';
import { Investment } from '../types/investment';
import { investmentAPI, InvestmentFilters } from '../services/api';
import CashFlowCalendar from '../components/CashFlowCalendar';
import LiquidityForecastDashboard from '../components/LiquidityForecastDashboard';
import PageErrorBoundary from '../components/PageErrorBoundary';
import './LiquidityForecast.css';

const LiquidityForecast: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await investmentAPI.getInvestments(0, 500, {});
      setInvestments(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch investments. Please check if the backend is running.');
      console.error('Error fetching investments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  if (loading) {
    return (
      <div className="liquidity-forecast-page">
        <div className="loading">Loading investments for liquidity forecast...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="liquidity-forecast-page">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <PageErrorBoundary>
      <div className="liquidity-forecast-page">
        <div className="luxury-card page-header">
          <h1 className="luxury-heading-1">Liquidity Forecast</h1>
          <p className="luxury-body-large">Portfolio cash flow analysis and liquidity planning</p>
        </div>

        <div className="cash-flow-calendar-section">
          <div className="section-header">
            <h2>Portfolio Cash Flow Calendar</h2>
            <p>Interactive calendar view of your portfolio's cash flow timing and patterns</p>
          </div>
          <CashFlowCalendar />
        </div>

        <div className="liquidity-dashboard-section">
          <LiquidityForecastDashboard investments={investments} currentCashBalance={5000000} />
        </div>
      </div>
    </PageErrorBoundary>
  );
};

export default LiquidityForecast;