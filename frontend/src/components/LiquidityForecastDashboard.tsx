import React, { useState, useMemo } from 'react';
import { Investment } from '../types/investment';
import { formatCurrency } from '../utils/formatters';
import './LiquidityForecastDashboard.css';

interface LiquidityDataPoint {
  month: string;
  date: Date;
  capitalCalls: number;
  distributions: number;
  netCashFlow: number;
  cumulativeNet: number;
  cashGap: number;
  investmentDetails: Array<{
    name: string;
    calls: number;
    distributions: number;
    uncalledCommitment: number;
  }>;
}

interface Props {
  investments: Investment[];
  currentCashBalance?: number;
}

const LiquidityForecastDashboard: React.FC<Props> = ({ 
  investments, 
  currentCashBalance = 0 
}) => {
  const [forecastPeriod, setForecastPeriod] = useState<12 | 24 | 36>(12);
  const [showDetails, setShowDetails] = useState(false);

  // Generate monthly forecast data
  const forecastData = useMemo(() => {
    const data: LiquidityDataPoint[] = [];
    const today = new Date();
    let cumulativeNet = currentCashBalance;

    for (let i = 0; i < forecastPeriod; i++) {
      const date = new Date(today);
      date.setMonth(date.getMonth() + i);
      
      const month = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      });

      // Calculate estimated capital calls and distributions for this month
      let capitalCalls = 0;
      let distributions = 0;
      const investmentDetails: Array<{name: string; calls: number; distributions: number; uncalledCommitment: number}> = [];

      investments.forEach(investment => {
        let investmentCalls = 0;
        let investmentDistributions = 0;
        const uncalledAmount = investment.commitment_amount - investment.called_amount;

        // Estimate capital calls based on pacing model
        if (investment.call_schedule && investment.investment_period && uncalledAmount > 0) {
          const monthsFromVintage = (date.getFullYear() - (investment.vintage_year || 0)) * 12 + date.getMonth();
          const investmentPeriodMonths = investment.investment_period * 12;
          
          if (monthsFromVintage >= 0 && monthsFromVintage <= investmentPeriodMonths) {
            // Calculate call rate based on schedule
            let callRate = 0;
            const progress = monthsFromVintage / investmentPeriodMonths;
            
            switch (investment.call_schedule) {
              case 'Front Loaded':
                callRate = Math.max(0, (1 - progress) * 0.15); // Higher early, declining
                break;
              case 'Steady':
                callRate = 0.08; // Consistent monthly rate
                break;
              case 'Back Loaded':
                callRate = progress * 0.12; // Lower early, increasing
                break;
              default:
                callRate = 0.08;
            }
            
            investmentCalls = uncalledAmount * callRate;
            capitalCalls += investmentCalls;
          }
        }

        // Estimate distributions based on fund maturity and distribution timing
        if (investment.distribution_timing && investment.fund_life) {
          const fundAge = date.getFullYear() - (investment.vintage_year || 0);
          const fundLifeYears = investment.fund_life;
          
          if (fundAge >= 2 && fundAge <= fundLifeYears) { // Distributions typically start after year 2
            const totalValue = investment.called_amount * (investment.target_moic || 2.0);
            const distributionBase = totalValue * 0.6; // Assume 60% will be distributed over time
            
            let distributionRate = 0;
            const maturityProgress = fundAge / fundLifeYears;
            
            switch (investment.distribution_timing) {
              case 'Early':
                distributionRate = Math.max(0, maturityProgress * 0.1);
                break;
              case 'Backend':
                distributionRate = maturityProgress > 0.6 ? maturityProgress * 0.15 : 0;
                break;
              case 'Steady':
                distributionRate = maturityProgress > 0.3 ? 0.05 : 0;
                break;
              default:
                distributionRate = maturityProgress > 0.4 ? 0.06 : 0;
            }
            
            investmentDistributions = distributionBase * distributionRate;
            distributions += investmentDistributions;
          }
        }

        // Add to details if there's activity
        if (investmentCalls > 1000 || investmentDistributions > 1000) {
          investmentDetails.push({
            name: investment.name,
            calls: investmentCalls,
            distributions: investmentDistributions,
            uncalledCommitment: uncalledAmount
          });
        }
      });

      const netCashFlow = distributions - capitalCalls;
      cumulativeNet += netCashFlow;
      
      data.push({
        month,
        date,
        capitalCalls,
        distributions,
        netCashFlow,
        cumulativeNet,
        cashGap: Math.min(0, cumulativeNet), // Only show negative values
        investmentDetails
      });
    }

    return data;
  }, [investments, forecastPeriod, currentCashBalance]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalCalls = forecastData.reduce((sum, d) => sum + d.capitalCalls, 0);
    const totalDistributions = forecastData.reduce((sum, d) => sum + d.distributions, 0);
    const maxCashGap = Math.min(...forecastData.map(d => d.cumulativeNet));
    const monthsWithGaps = forecastData.filter(d => d.cumulativeNet < 0).length;
    
    return {
      totalCalls,
      totalDistributions,
      netCashFlow: totalDistributions - totalCalls,
      maxCashGap,
      monthsWithGaps,
      endingCash: forecastData[forecastData.length - 1]?.cumulativeNet || 0
    };
  }, [forecastData]);

  const getRowClass = (dataPoint: LiquidityDataPoint): string => {
    if (dataPoint.cumulativeNet < 0) return 'cash-deficit';
    if (dataPoint.netCashFlow > 50000) return 'strong-inflow';
    if (dataPoint.netCashFlow < -50000) return 'strong-outflow';
    return '';
  };

  return (
    <div className="liquidity-forecast-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h2>📊 Liquidity Forecast Dashboard</h2>
          <p>Projected capital calls vs distributions based on pacing models</p>
        </div>
        
        <div className="header-controls">
          <select 
            value={forecastPeriod} 
            onChange={(e) => setForecastPeriod(Number(e.target.value) as 12 | 24 | 36)}
            className="period-selector"
          >
            <option value={12}>12 Months</option>
            <option value={24}>24 Months</option>
            <option value={36}>36 Months</option>
          </select>
          
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="details-toggle"
          >
            {showDetails ? 'Hide Details' : 'Show Investment Details'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-label">Expected Capital Calls</div>
          <div className="card-value outflow">{formatCurrency(summary.totalCalls)}</div>
        </div>
        
        <div className="summary-card">
          <div className="card-label">Expected Distributions</div>
          <div className="card-value inflow">{formatCurrency(summary.totalDistributions)}</div>
        </div>
        
        <div className="summary-card">
          <div className="card-label">Net Cash Flow</div>
          <div className={`card-value ${summary.netCashFlow >= 0 ? 'inflow' : 'outflow'}`}>
            {formatCurrency(summary.netCashFlow)}
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-label">Maximum Cash Gap</div>
          <div className={`card-value ${summary.maxCashGap < 0 ? 'deficit' : 'positive'}`}>
            {formatCurrency(summary.maxCashGap)}
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-label">Ending Cash Position</div>
          <div className={`card-value ${summary.endingCash >= 0 ? 'positive' : 'deficit'}`}>
            {formatCurrency(summary.endingCash)}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {summary.monthsWithGaps > 0 && (
        <div className="alert-banner cash-warning">
          ⚠️ <strong>Cash Flow Alert:</strong> Projected cash deficits in {summary.monthsWithGaps} month(s). 
          Maximum gap: {formatCurrency(summary.maxCashGap)}
        </div>
      )}

      {summary.maxCashGap < -1000000 && (
        <div className="alert-banner critical-warning">
          🚨 <strong>Critical Alert:</strong> Projected cash gap exceeds $1M. Consider arranging credit facility or adjusting pacing.
        </div>
      )}

      {/* Monthly Forecast Table */}
      <div className="forecast-table-container">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Expected Calls</th>
              <th>Expected Distributions</th>
              <th>Net Cash Flow</th>
              <th>Cumulative Cash</th>
              <th>Status</th>
              {showDetails && <th>Investments</th>}
            </tr>
          </thead>
          <tbody>
            {forecastData.map((dataPoint, index) => (
              <tr key={index} className={getRowClass(dataPoint)}>
                <td className="month-cell">{dataPoint.month}</td>
                <td className="currency outflow">
                  {dataPoint.capitalCalls > 0 ? `-${formatCurrency(Math.abs(dataPoint.capitalCalls))}` : '-'}
                </td>
                <td className="currency inflow">
                  {dataPoint.distributions > 0 ? `+${formatCurrency(Math.abs(dataPoint.distributions))}` : '-'}
                </td>
                <td className={`currency ${dataPoint.netCashFlow >= 0 ? 'inflow' : 'outflow'}`}>
                  {dataPoint.netCashFlow >= 0 ? '+' : ''}{formatCurrency(Math.abs(dataPoint.netCashFlow))}
                </td>
                <td className={`currency ${dataPoint.cumulativeNet >= 0 ? 'positive' : 'deficit'}`}>
                  {formatCurrency(dataPoint.cumulativeNet)}
                </td>
                <td className="status-cell">
                  {dataPoint.cumulativeNet < 0 ? (
                    <span className="status-indicator deficit">Cash Gap</span>
                  ) : dataPoint.cumulativeNet < 500000 ? (
                    <span className="status-indicator low">Low Cash</span>
                  ) : (
                    <span className="status-indicator healthy">Healthy</span>
                  )}
                </td>
                {showDetails && (
                  <td className="details-cell">
                    {dataPoint.investmentDetails.length > 0 ? (
                      <div className="investment-details">
                        {dataPoint.investmentDetails.map((detail, idx) => (
                          <div key={idx} className="investment-detail">
                            <span className="investment-name">{detail.name}</span>
                            {detail.calls > 1000 && (
                              <span className="call-amount">-{formatCurrency(Math.abs(detail.calls))}</span>
                            )}
                            {detail.distributions > 1000 && (
                              <span className="dist-amount">+{formatCurrency(Math.abs(detail.distributions))}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="no-activity">-</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Methodology Note */}
      <div className="methodology-note">
        <details>
          <summary>📋 Forecast Methodology</summary>
          <div className="methodology-content">
            <p><strong>Capital Calls:</strong> Based on call schedules, uncalled commitments, and investment periods</p>
            <p><strong>Distributions:</strong> Estimated using target MOIC, fund maturity, and distribution timing</p>
            <p><strong>Assumptions:</strong> Front-loaded = 15% early decline, Steady = 8% monthly, Back-loaded = 12% late increase</p>
            <p><strong>Distributions Start:</strong> Typically begin 2+ years after vintage, vary by timing preference</p>
            <p><strong>Note:</strong> Actual timing may vary significantly based on market conditions and manager decisions</p>
          </div>
        </details>
      </div>
    </div>
  );
};

export default LiquidityForecastDashboard;