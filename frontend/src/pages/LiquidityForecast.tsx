import React from 'react';
import LiquidityForecastDashboard from '../components/LiquidityForecastDashboard';
import PageErrorBoundary from '../components/PageErrorBoundary';
import './LiquidityForecast.css';

const LiquidityForecast: React.FC = () => {
  return (
    <PageErrorBoundary>
      <div className="liquidity-forecast-page">
        <LiquidityForecastDashboard />
      </div>
    </PageErrorBoundary>
  );
};

export default LiquidityForecast;