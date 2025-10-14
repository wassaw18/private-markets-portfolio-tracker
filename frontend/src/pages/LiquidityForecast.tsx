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
          <h1 className="luxury-heading-1">Cash Flows</h1>
          <p className="luxury-body-large">Portfolio cash flow analysis and liquidity planning</p>
        </div>

        <div className="cash-flow-calendar-section">
          <div className="luxury-card">
            <CashFlowCalendar />
          </div>
        </div>

        <div className="liquidity-dashboard-section">
          <div className="luxury-card">
            {investments.length > 0 ? (
              <LiquidityForecastDashboard
                investments={investments}
                currentCashBalance={0}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-state-content">
                  <h3>📊 Liquidity Forecast Dashboard</h3>
                  <p className="empty-message">
                    No investments found. Add investments to see cash flow projections and liquidity analysis.
                  </p>
                  <div className="empty-stats">
                    <div className="empty-stat">
                      <span className="stat-label">Expected Capital Calls</span>
                      <span className="stat-value">$0</span>
                    </div>
                    <div className="empty-stat">
                      <span className="stat-label">Expected Distributions</span>
                      <span className="stat-value">$0</span>
                    </div>
                    <div className="empty-stat">
                      <span className="stat-label">Net Cash Flow</span>
                      <span className="stat-value">$0</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
};

export default LiquidityForecast;