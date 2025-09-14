import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Investment, CashFlow, Valuation, InvestmentStatus } from '../types/investment';
import { investmentAPI, cashFlowAPI, valuationAPI } from '../services/api';
import CashFlowSection from '../components/CashFlowSection';
import ValuationSection from '../components/ValuationSection';
import PerformanceMetrics from '../components/PerformanceMetrics';
import BenchmarkComparison from '../components/BenchmarkComparison';
import PacingModelPanel from '../components/PacingModelPanel';
import InvestmentForecastChart from '../components/InvestmentForecastChart';
import UploadWidget from '../components/UploadWidget';
import InvestmentStatusManagement from '../components/InvestmentStatusManagement';
import { ImportResult } from '../services/api';
import './InvestmentDetails.css';

const InvestmentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const investmentId = parseInt(id || '0', 10);

  const [investment, setInvestment] = useState<Investment | null>(null);
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceUpdateTrigger, setPerformanceUpdateTrigger] = useState(0);

  const fetchInvestmentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch investment details
      const investmentData = await investmentAPI.getInvestment(investmentId);
      setInvestment(investmentData);

      // Fetch cash flows and valuations
      const [cashFlowsData, valuationsData] = await Promise.all([
        cashFlowAPI.getCashFlows(investmentId),
        valuationAPI.getValuations(investmentId)
      ]);

      setCashFlows(cashFlowsData);
      setValuations(valuationsData);
    } catch (err) {
      setError('Failed to fetch investment details. Please check if the backend is running.');
      console.error('Error fetching investment details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (investmentId) {
      fetchInvestmentData();
    }
  }, [investmentId]);

  const handleCashFlowUpdate = () => {
    cashFlowAPI.getCashFlows(investmentId).then(setCashFlows);
    // Trigger performance metrics update
    setPerformanceUpdateTrigger(prev => prev + 1);
  };

  const handleValuationUpdate = () => {
    valuationAPI.getValuations(investmentId).then(setValuations);
    // Trigger performance metrics update
    setPerformanceUpdateTrigger(prev => prev + 1);
  };

  const handleDataUploadComplete = (result: ImportResult) => {
    // Refresh all data after upload (NAVs or cash flows)
    fetchInvestmentData();
    setPerformanceUpdateTrigger(prev => prev + 1);
    console.log(`Data upload completed: ${result.success_count} successful, ${result.error_count} errors`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleStatusUpdate = async (
    investmentId: number,
    status: InvestmentStatus,
    password: string,
    realizationDate?: string,
    realizationNotes?: string
  ) => {
    try {
      const updatedInvestment = await investmentAPI.updateInvestmentStatus(
        investmentId,
        status,
        password,
        realizationDate,
        realizationNotes
      );
      
      // Update the local investment state
      setInvestment(updatedInvestment);
    } catch (error: any) {
      // Re-throw the error so the component can display it
      throw new Error(error.response?.data?.detail || error.message || 'Failed to update investment status');
    }
  };

  if (loading) {
    return <div className="details-container"><div className="loading">Loading investment details...</div></div>;
  }

  if (error || !investment) {
    return (
      <div className="details-container">
        <div className="error-message">{error || 'Investment not found'}</div>
        <button onClick={() => navigate('/holdings')} className="back-button">
          Back to Holdings
        </button>
      </div>
    );
  }

  return (
    <div className="details-container">
      <div className="details-header">
        <button onClick={() => navigate('/holdings')} className="back-button">
          ← Back to Holdings
        </button>
        <h2>Investment Details</h2>
      </div>

      <div className="investment-overview">
        <div className="overview-card">
          <h3>{investment.name}</h3>
          <div className="overview-grid">
            <div className="overview-item">
              <label>Asset Class</label>
              <span>{investment.asset_class}</span>
            </div>
            <div className="overview-item">
              <label>Structure</label>
              <span>{investment.investment_structure}</span>
            </div>
            <div className="overview-item">
              <label>Owner</label>
              <span>{investment.entity?.name || 'Not assigned'}</span>
            </div>
            <div className="overview-item">
              <label>Strategy</label>
              <span>{investment.strategy}</span>
            </div>
            <div className="overview-item">
              <label>Vintage Year</label>
              <span>{investment.vintage_year}</span>
            </div>
            <div className="overview-item">
              <label>Commitment Amount</label>
              <span className="currency">{formatCurrency(investment.commitment_amount)}</span>
            </div>
            <div className="overview-item">
              <label>Called Amount</label>
              <span className="currency">{formatCurrency(investment.called_amount)}</span>
            </div>
            <div className="overview-item">
              <label>Fees</label>
              <span className="currency">{formatCurrency(investment.fees)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Widgets - moved to top for easy access */}
      <div className="data-upload-widgets">
        <h3>📤 Data Upload</h3>
        <div className="upload-widgets-row">
          <UploadWidget 
            type="cashflows" 
            onUploadComplete={handleDataUploadComplete}
            size="small"
            currentInvestmentId={investmentId}
          />
          <UploadWidget 
            type="navs" 
            onUploadComplete={handleDataUploadComplete}
            size="small"
            currentInvestmentId={investmentId}
          />
        </div>
      </div>

      {/* Investment Status Management */}
      <InvestmentStatusManagement
        investment={investment}
        onStatusUpdate={handleStatusUpdate}
      />

      <PerformanceMetrics
        investmentId={investmentId}
        onUpdate={performanceUpdateTrigger > 0 ? () => {} : undefined}
        key={performanceUpdateTrigger}
      />

      {/* Data Sections - moved up for better visibility */}
      <div className="details-sections">
        <CashFlowSection 
          investmentId={investmentId}
          cashFlows={cashFlows}
          onUpdate={handleCashFlowUpdate}
        />
        
        <ValuationSection 
          investmentId={investmentId}
          valuations={valuations}
          onUpdate={handleValuationUpdate}
        />
      </div>

      {/* Analysis Sections - moved down */}
      <BenchmarkComparison investmentId={investmentId} />

      <PacingModelPanel investment={investment} onUpdate={fetchInvestmentData} />

      <InvestmentForecastChart investmentId={investmentId} onUpdate={fetchInvestmentData} />
    </div>
  );
};

export default InvestmentDetails;