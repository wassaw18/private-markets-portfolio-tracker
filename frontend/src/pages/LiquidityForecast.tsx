import React, { useState, useEffect, useCallback } from 'react';
import { Investment } from '../types/investment';
import { investmentAPI, InvestmentFilters } from '../services/api';
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
        <LiquidityForecastDashboard investments={investments} currentCashBalance={5000000} />
      </div>
    </PageErrorBoundary>
  );
};

export default LiquidityForecast;