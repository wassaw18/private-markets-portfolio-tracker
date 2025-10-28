import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { investmentAPI } from '../services/api';
import { Investment, AssetClass } from '../types/investment';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import '../styles/luxury-design-system.css';
import './TaxTracking.css';

interface TaxDocumentRow {
  investment_id: number;
  investment_name: string;
  entity_id: number;
  entity_name: string;
  tax_doc_type: 'K-1' | '1099-DIV' | '1099-INT' | '1099-B' | 'Other';
  received: boolean;
  expected_income: number;  // Sum of Yield + Distribution cash flows for the year
  expected_capital_gains: number;  // TODO: Need to implement capital gains calculation logic
  activity_type: 'Active' | 'Passive';  // Most private equity/VC is passive
}

// For entity filtering
interface EntityInfo {
  id: number;
  name: string;
}

const TaxTracking: React.FC = () => {
  const { authState } = useAuth();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
  const [selectedEntityName, setSelectedEntityName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [taxData, setTaxData] = useState<TaxDocumentRow[]>([]);

  // Available years: current year and previous 3 years
  const availableYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  // Fetch investments on mount
  useEffect(() => {
    fetchInvestments();
  }, []);

  // Recalculate tax data when year or entity filter changes
  useEffect(() => {
    calculateTaxData();
  }, [selectedYear, selectedEntity, investments]);

  const fetchInvestments = async () => {
    setLoading(true);
    try {
      const data = await investmentAPI.getInvestments(0, 1000);
      setInvestments(data);
    } catch (err) {
      console.error('Error fetching investments:', err);
      setInvestments([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateTaxData = useCallback(() => {
    // Filter investments by entity if selected
    let filteredInvestments = selectedEntity
      ? investments.filter(inv => inv.entity_id === selectedEntity)
      : investments;

    // Filter investments by whether they were held in the selected tax year
    // An investment was held if its commitment_date was in or before the selected year
    filteredInvestments = filteredInvestments.filter(investment => {
      if (!investment.commitment_date) {
        // If no commitment date, include it to be safe
        return true;
      }
      const commitmentYear = new Date(investment.commitment_date).getFullYear();
      return commitmentYear <= selectedYear;
    });

    const rows: TaxDocumentRow[] = filteredInvestments.map(investment => {
      // Calculate expected income from cash flows for the selected year
      const yearStart = new Date(selectedYear, 0, 1);
      const yearEnd = new Date(selectedYear, 11, 31);

      const yearCashFlows = investment.cashflows?.filter(cf => {
        const cfDate = new Date(cf.date);
        return cfDate >= yearStart && cfDate <= yearEnd;
      }) || [];

      // Sum Yield + Distribution for income
      const expectedIncome = yearCashFlows
        .filter(cf => cf.type === 'Yield' || cf.type === 'Distribution')
        .reduce((sum, cf) => sum + cf.amount, 0);

      // TODO: Capital gains calculation needs implementation
      // For now, we'll use Return of Principal as a placeholder
      // Real capital gains would need cost basis tracking and sale/distribution logic
      const expectedCapitalGains = yearCashFlows
        .filter(cf => cf.type === 'Return of Principal')
        .reduce((sum, cf) => sum + cf.amount, 0);

      // Determine tax document type based on investment asset class
      let taxDocType: TaxDocumentRow['tax_doc_type'] = 'K-1';
      if (investment.asset_class === AssetClass.PUBLIC_EQUITY || investment.asset_class === AssetClass.PUBLIC_FIXED_INCOME) {
        taxDocType = '1099-DIV';
      }

      return {
        investment_id: investment.id,
        investment_name: investment.name,
        entity_id: investment.entity_id,
        entity_name: investment.entity?.name || 'Unknown Entity',
        tax_doc_type: taxDocType,
        received: false, // TODO: Link to document management system
        expected_income: expectedIncome,
        expected_capital_gains: expectedCapitalGains,
        activity_type: 'Passive', // Most private market investments are passive
      };
    });

    setTaxData(rows);
  }, [selectedYear, selectedEntity, investments]);

  const handleReceivedToggle = (investmentId: number) => {
    // TODO: Integrate with document management system to track received status
    setTaxData(prev => prev.map(row =>
      row.investment_id === investmentId
        ? { ...row, received: !row.received }
        : row
    ));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTotals = () => {
    return {
      totalIncome: taxData.reduce((sum, row) => sum + row.expected_income, 0),
      totalCapitalGains: taxData.reduce((sum, row) => sum + row.expected_capital_gains, 0),
      receivedCount: taxData.filter(row => row.received).length,
      totalCount: taxData.length,
    };
  };

  const totals = getTotals();

  return (
    <>
      <div className="luxury-card page-header">
        <h1 className="luxury-heading-1">Tax Document Tracking</h1>
      </div>

      <div className="tax-tracking-container">
        {/* Filters Section */}
        <SectionErrorBoundary sectionName="Filters">
        <div className="luxury-card filters-card">
          <div className="filters-grid">
            <div className="filter-group">
              <label className="filter-label">Tax Year</label>
              <div className="year-buttons">
                {availableYears.map(year => (
                  <button
                    key={year}
                    className={`year-button ${selectedYear === year ? 'active' : ''}`}
                    onClick={() => setSelectedYear(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <label className="filter-label">Owner (Entity)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <select
                  className="entity-selector"
                  value={selectedEntity || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setSelectedEntity(null);
                      setSelectedEntityName('All Entities');
                    } else {
                      setSelectedEntity(parseInt(value));
                      const option = e.target.options[e.target.selectedIndex];
                      setSelectedEntityName(option.text);
                    }
                  }}
                >
                  <option value="">All Entities</option>
                  {Array.from(new Set(investments.map(inv => inv.entity_id)))
                    .map(entityId => {
                      const investment = investments.find(inv => inv.entity_id === entityId);
                      return investment?.entity ? (
                        <option key={entityId} value={entityId}>
                          {investment.entity.name}
                        </option>
                      ) : null;
                    })
                  }
                </select>
              </div>
            </div>
          </div>
        </div>
      </SectionErrorBoundary>

      {/* Summary Cards */}
      <SectionErrorBoundary sectionName="Tax Summary">
        <div className="luxury-card summary-card">
          <h2 className="luxury-heading-2 section-title">
            {selectedYear} Tax Summary
          </h2>
          <div className="summary-metrics-grid">
            <div className="summary-metric-card">
              <div className="metric-icon">📊</div>
              <div className="metric-content">
                <label className="metric-label">Total Income</label>
                <span className="metric-value">{formatCurrency(totals.totalIncome)}</span>
                <p className="metric-description">Yield + Distributions</p>
              </div>
            </div>
            <div className="summary-metric-card">
              <div className="metric-icon">💰</div>
              <div className="metric-content">
                <label className="metric-label">Capital Gains</label>
                <span className="metric-value">{formatCurrency(totals.totalCapitalGains)}</span>
                <p className="metric-description">Return of Principal (Temp)</p>
              </div>
            </div>
            <div className="summary-metric-card success">
              <div className="metric-icon">✅</div>
              <div className="metric-content">
                <label className="metric-label">Docs Received</label>
                <span className="metric-value">{totals.receivedCount} / {totals.totalCount}</span>
                <p className="metric-description">Tax documents</p>
              </div>
            </div>
          </div>
        </div>
      </SectionErrorBoundary>

      {/* Tax Document Table */}
      <SectionErrorBoundary sectionName="Tax Document Table">
        <div className="luxury-card table-card">
          <h2 className="luxury-heading-2 section-title">Tax Documents by Investment</h2>

          {loading ? (
            <div className="luxury-table-loading">Loading tax data...</div>
          ) : taxData.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📂</span>
              <p className="empty-message">No investments found for {selectedYear}</p>
              <p className="empty-hint">
                {selectedEntity
                  ? 'Try selecting a different entity or year'
                  : 'Tax data will appear here based on cash flows for the selected year'}
              </p>
            </div>
          ) : (
            <div className="tax-table-container">
              <table className="tax-table">
                <thead>
                  <tr>
                    <th>Investment</th>
                    <th>Owner</th>
                    <th>Tax Doc Type</th>
                    <th className="center-align">Received</th>
                    <th className="right-align">Expected Income</th>
                    <th className="right-align">Expected Cap Gains</th>
                    <th className="center-align">Activity Type</th>
                  </tr>
                </thead>
                <tbody>
                  {taxData.map((row) => (
                    <tr key={row.investment_id}>
                      <td className="investment-name-cell">{row.investment_name}</td>
                      <td>{row.entity_name}</td>
                      <td>
                        <span className="tax-doc-badge">{row.tax_doc_type}</span>
                      </td>
                      <td className="center-align">
                        <input
                          type="checkbox"
                          checked={row.received}
                          onChange={() => handleReceivedToggle(row.investment_id)}
                          className="received-checkbox"
                        />
                      </td>
                      <td className="right-align currency-cell">
                        {formatCurrency(row.expected_income)}
                      </td>
                      <td className="right-align currency-cell">
                        {formatCurrency(row.expected_capital_gains)}
                      </td>
                      <td className="center-align">
                        <span className={`activity-badge ${row.activity_type.toLowerCase()}`}>
                          {row.activity_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="totals-row">
                    <td colSpan={4} className="totals-label">TOTALS</td>
                    <td className="right-align currency-cell totals-value">
                      {formatCurrency(totals.totalIncome)}
                    </td>
                    <td className="right-align currency-cell totals-value">
                      {formatCurrency(totals.totalCapitalGains)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionErrorBoundary>

      {/* Information Banner */}
      <div className="luxury-card info-banner">
        <div className="info-content">
          <span className="info-icon">ℹ️</span>
          <div className="info-text">
            <h3 className="info-title">About Tax Tracking</h3>
            <p className="info-description">
              This page calculates expected tax-related income and capital gains from your private market investments based on cash flow data.
              <strong> Expected Income</strong> includes Yield and Distribution cash flows for the selected year.
              <strong> Expected Capital Gains</strong> currently uses Return of Principal as a placeholder - proper capital gains tracking with cost basis needs to be implemented.
              K-1s are typically due by March 15th (with possible extensions to September). 1099 forms are usually available by late January.
              Use the "Received" checkbox to track which tax documents you've received.
            </p>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default TaxTracking;
