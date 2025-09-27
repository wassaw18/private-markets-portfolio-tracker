import React, { useState, useEffect } from 'react';
import { Investment, InvestmentUpdate, AssetClass, InvestmentStructure, LiquidityProfile, ReportingFrequency, RiskRating, TaxClassification, ActivityClassification } from '../types/investment';
import { investmentAPI } from '../services/api';
import { validateInvestment } from '../utils/validation';
import EntitySelector from './EntitySelector';
import './EditInvestmentModal.css';

interface Props {
  investment: Investment;
  onSuccess: () => void;
  onCancel: () => void;
}

type TabType = 'basic' | 'financial' | 'operational' | 'legal';

interface TabValidation {
  basic: boolean;
  financial: boolean;
  operational: boolean;
  legal: boolean;
}

const EditInvestmentModal: React.FC<Props> = ({ investment, onSuccess, onCancel }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  
  const [formData, setFormData] = useState<InvestmentUpdate>({
    name: investment.name,
    asset_class: investment.asset_class,
    investment_structure: investment.investment_structure,
    entity_id: investment.entity_id,
    strategy: investment.strategy,
    vintage_year: investment.vintage_year,
    commitment_amount: investment.commitment_amount,
    called_amount: investment.called_amount,
    fees: investment.fees,
    commitment_date: investment.commitment_date,
    liquidity_profile: investment.liquidity_profile,
    currency: investment.currency,
    management_fee: investment.management_fee,
    performance_fee: investment.performance_fee,
    hurdle_rate: investment.hurdle_rate,
    contact_person: investment.contact_person,
    email: investment.email,
    target_raise: investment.target_raise,
    target_irr: investment.target_irr,
    investment_period: investment.investment_period,
    fund_life: investment.fund_life,
    reporting_frequency: investment.reporting_frequency,
    geography_focus: investment.geography_focus,
    risk_rating: investment.risk_rating,
    tax_classification: investment.tax_classification,
    activity_classification: investment.activity_classification,
    due_diligence_date: investment.due_diligence_date,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [tabValidation, setTabValidation] = useState<TabValidation>({
    basic: true,
    financial: true,
    operational: true,
    legal: true,
  });

  // Real-time validation effect
  useEffect(() => {
    validateCurrentTab();
    validateAllTabs();
  }, [formData, activeTab]);

  const validateCurrentTab = () => {
    const errors: string[] = [];
    
    if (activeTab === 'basic') {
      if (!formData.name?.trim()) errors.push('Investment name is required');
      if (!formData.entity_id) errors.push('Entity selection is required');
      if (!formData.strategy?.trim()) errors.push('Strategy is required');
      if (formData.vintage_year && (formData.vintage_year < 1900 || formData.vintage_year > 2100)) errors.push('Invalid vintage year');
    } else if (activeTab === 'financial') {
      if (!formData.commitment_date) errors.push('Commitment date is required');
      if (!formData.commitment_amount || formData.commitment_amount <= 0) errors.push('Commitment amount must be greater than 0');
      if (formData.management_fee && (formData.management_fee < 0 || formData.management_fee > 1)) {
        errors.push('Management fee must be between 0% and 100%');
      }
      if (formData.performance_fee && (formData.performance_fee < 0 || formData.performance_fee > 1)) {
        errors.push('Performance fee must be between 0% and 100%');
      }
    }
    
    setValidationErrors(errors);
  };

  const validateAllTabs = () => {
    const validation: TabValidation = {
      basic: !!(formData.name?.trim() && formData.entity_id && formData.strategy?.trim() && 
               formData.vintage_year && formData.vintage_year >= 1900 && formData.vintage_year <= 2100),
      financial: !!(formData.commitment_date && formData.commitment_amount && formData.commitment_amount > 0 &&
                   (!formData.management_fee || (formData.management_fee >= 0 && formData.management_fee <= 1)) &&
                   (!formData.performance_fee || (formData.performance_fee >= 0 && formData.performance_fee <= 1))),
      operational: true, // Optional fields only
      legal: true, // Optional fields only
    };
    
    setTabValidation(validation);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => {
      let processedValue: any = value;
      
      // Handle different field types
      if (type === 'number') {
        processedValue = value === '' ? undefined : parseFloat(value);
      } else if (['management_fee', 'performance_fee', 'hurdle_rate', 'target_irr'].includes(name)) {
        // Convert percentage fields
        processedValue = value === '' ? undefined : parseFloat(value) / 100;
      } else if (['vintage_year', 'investment_period', 'fund_life'].includes(name)) {
        processedValue = value === '' ? undefined : parseInt(value);
      } else if (type === 'checkbox') {
        processedValue = (e.target as HTMLInputElement).checked;
      }
      
      return {
        ...prev,
        [name]: processedValue
      };
    });
  };

  const handleEntityChange = (entityId: number | null) => {
    setFormData(prev => ({
      ...prev,
      entity_id: entityId
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all required fields
    if (!tabValidation.basic || !tabValidation.financial) {
      setError('Please complete all required fields in Basic Information and Financial Terms tabs.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await investmentAPI.updateInvestment(investment.id, formData);
      onSuccess();
    } catch (err) {
      setError('Failed to update investment. Please check all fields.');
      console.error('Error updating investment:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextTab = () => {
    const tabs: TabType[] = ['basic', 'financial', 'operational', 'legal'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  const prevTab = () => {
    const tabs: TabType[] = ['basic', 'financial', 'operational', 'legal'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  const getTabIcon = (tab: TabType): string => {
    if (tabValidation[tab]) return '✓';
    if (tab === activeTab) return '○';
    return '○';
  };

  const formatPercentageValue = (value?: number): string => {
    return value ? (value * 100).toString() : '';
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content add-investment-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Investment: {investment.name}</h2>
          <button type="button" className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="tab-navigation">
          <button
            type="button"
            className={`tab-button ${activeTab === 'basic' ? 'active' : ''} ${tabValidation.basic ? 'valid' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            <span className="tab-icon">{getTabIcon('basic')}</span>
            Basic Information
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'financial' ? 'active' : ''} ${tabValidation.financial ? 'valid' : ''}`}
            onClick={() => setActiveTab('financial')}
          >
            <span className="tab-icon">{getTabIcon('financial')}</span>
            Financial Terms
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'operational' ? 'active' : ''} ${tabValidation.operational ? 'valid' : ''}`}
            onClick={() => setActiveTab('operational')}
          >
            <span className="tab-icon">{getTabIcon('operational')}</span>
            Operational Details
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'legal' ? 'active' : ''} ${tabValidation.legal ? 'valid' : ''}`}
            onClick={() => setActiveTab('legal')}
          >
            <span className="tab-icon">{getTabIcon('legal')}</span>
            Legal & Risk
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {validationErrors.length > 0 && (
          <div className="validation-errors">
            <ul>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="tab-content">
            {activeTab === 'basic' && (
              <div className="tab-panel">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="edit-name">Investment Name *</label>
                    <input
                      type="text"
                      id="edit-name"
                      name="name"
                      value={formData.name || ''}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Fund ABC I"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-asset_class">Asset Class *</label>
                    <select
                      id="edit-asset_class"
                      name="asset_class"
                      value={formData.asset_class || ''}
                      onChange={handleChange}
                      required
                    >
                      {Object.values(AssetClass).map(ac => (
                        <option key={ac} value={ac}>{ac}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-investment_structure">Investment Structure *</label>
                    <select
                      id="edit-investment_structure"
                      name="investment_structure"
                      value={formData.investment_structure || ''}
                      onChange={handleChange}
                      required
                    >
                      {Object.values(InvestmentStructure).map(is => (
                        <option key={is} value={is}>{is}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-entity">Entity *</label>
                    <EntitySelector
                      value={formData.entity_id || null}
                      onChange={handleEntityChange}
                      required
                      className="entity-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-strategy">Strategy *</label>
                    <input
                      type="text"
                      id="edit-strategy"
                      name="strategy"
                      value={formData.strategy || ''}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Growth Buyout"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-vintage_year">Vintage Year *</label>
                    <input
                      type="number"
                      id="edit-vintage_year"
                      name="vintage_year"
                      value={formData.vintage_year || ''}
                      onChange={handleChange}
                      required
                      min="1900"
                      max="2100"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'financial' && (
              <div className="tab-panel">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="edit-commitment_amount">Commitment Amount ($) *</label>
                    <input
                      type="number"
                      id="edit-commitment_amount"
                      name="commitment_amount"
                      value={formData.commitment_amount || ''}
                      onChange={handleChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-commitment_date">Commitment Date *</label>
                    <input
                      type="date"
                      id="edit-commitment_date"
                      name="commitment_date"
                      value={formData.commitment_date || ''}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-called_amount">Called Amount ($)</label>
                    <input
                      type="number"
                      id="edit-called_amount"
                      name="called_amount"
                      value={formData.called_amount || ''}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-liquidity_profile">Liquidity Profile</label>
                    <select
                      id="edit-liquidity_profile"
                      name="liquidity_profile"
                      value={formData.liquidity_profile || ''}
                      onChange={handleChange}
                    >
                      {Object.values(LiquidityProfile).map(lp => (
                        <option key={lp} value={lp}>{lp}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-currency">Currency</label>
                    <select
                      id="edit-currency"
                      name="currency"
                      value={formData.currency || 'USD'}
                      onChange={handleChange}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="JPY">JPY</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-management_fee">Management Fee (%)</label>
                    <input
                      type="number"
                      id="edit-management_fee"
                      name="management_fee"
                      value={formatPercentageValue(formData.management_fee)}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="e.g. 2.0"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-performance_fee">Performance Fee (%)</label>
                    <input
                      type="number"
                      id="edit-performance_fee"
                      name="performance_fee"
                      value={formatPercentageValue(formData.performance_fee)}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="e.g. 20.0"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-hurdle_rate">Hurdle Rate (%)</label>
                    <input
                      type="number"
                      id="edit-hurdle_rate"
                      name="hurdle_rate"
                      value={formatPercentageValue(formData.hurdle_rate)}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="e.g. 8.0"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-target_raise">Target Raise ($)</label>
                    <input
                      type="number"
                      id="edit-target_raise"
                      name="target_raise"
                      value={formData.target_raise || ''}
                      onChange={handleChange}
                      min="0"
                      step="1000000"
                      placeholder="100000000"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-fees">Other Fees ($)</label>
                    <input
                      type="number"
                      id="edit-fees"
                      name="fees"
                      value={formData.fees || ''}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'operational' && (
              <div className="tab-panel">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="edit-contact_person">Contact Person</label>
                    <input
                      type="text"
                      id="edit-contact_person"
                      name="contact_person"
                      value={formData.contact_person || ''}
                      onChange={handleChange}
                      placeholder="Primary contact name"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-email">Email</label>
                    <input
                      type="email"
                      id="edit-email"
                      name="email"
                      value={formData.email || ''}
                      onChange={handleChange}
                      placeholder="contact@fund.com"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-portal_link">Portal Link</label>
                    <input
                      type="url"
                      id="edit-portal_link"
                      name="portal_link"
                      value={formData.portal_link || ''}
                      onChange={handleChange}
                      placeholder="https://portal.example.com"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-fund_administrator">Fund Administrator</label>
                    <input
                      type="text"
                      id="edit-fund_administrator"
                      name="fund_administrator"
                      value={formData.fund_administrator || ''}
                      onChange={handleChange}
                      placeholder="Fund administrator name"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-expected_maturity_date">Expected Maturity Date</label>
                    <input
                      type="date"
                      id="edit-expected_maturity_date"
                      name="expected_maturity_date"
                      value={formData.expected_maturity_date || ''}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-target_irr">Target IRR (%)</label>
                    <input
                      type="number"
                      id="edit-target_irr"
                      name="target_irr"
                      value={formatPercentageValue(formData.target_irr)}
                      onChange={handleChange}
                      min="0"
                      max="1000"
                      step="0.01"
                      placeholder="e.g. 15.0"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-investment_period">Investment Period (years)</label>
                    <input
                      type="number"
                      id="edit-investment_period"
                      name="investment_period"
                      value={formData.investment_period || ''}
                      onChange={handleChange}
                      min="0"
                      max="20"
                      placeholder="e.g. 5"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-fund_life">Fund Life (years)</label>
                    <input
                      type="number"
                      id="edit-fund_life"
                      name="fund_life"
                      value={formData.fund_life || ''}
                      onChange={handleChange}
                      min="0"
                      max="50"
                      placeholder="e.g. 10"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-reporting_frequency">Reporting Frequency</label>
                    <select
                      id="edit-reporting_frequency"
                      name="reporting_frequency"
                      value={formData.reporting_frequency || ''}
                      onChange={handleChange}
                    >
                      <option value="">Select frequency</option>
                      {Object.values(ReportingFrequency).map(rf => (
                        <option key={rf} value={rf}>{rf}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="edit-distribution_target">Distribution Target</label>
                  <input
                    type="text"
                    id="edit-distribution_target"
                    name="distribution_target"
                    value={formData.distribution_target || ''}
                    onChange={handleChange}
                    placeholder="Distribution timing target"
                  />
                </div>
              </div>
            )}

            {activeTab === 'legal' && (
              <div className="tab-panel">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="edit-geography_focus">Geography Focus</label>
                    <input
                      type="text"
                      id="edit-geography_focus"
                      name="geography_focus"
                      value={formData.geography_focus || ''}
                      onChange={handleChange}
                      placeholder="e.g. North America, Europe"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-fund_domicile">Fund Domicile</label>
                    <input
                      type="text"
                      id="edit-fund_domicile"
                      name="fund_domicile"
                      value={formData.fund_domicile || ''}
                      onChange={handleChange}
                      placeholder="e.g. Delaware, Cayman Islands"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-risk_rating">Risk Rating</label>
                    <select
                      id="edit-risk_rating"
                      name="risk_rating"
                      value={formData.risk_rating || ''}
                      onChange={handleChange}
                    >
                      <option value="">Select risk rating</option>
                      {Object.values(RiskRating).map(rr => (
                        <option key={rr} value={rr}>{rr}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-tax_classification">Tax Classification</label>
                    <select
                      id="edit-tax_classification"
                      name="tax_classification"
                      value={formData.tax_classification || ''}
                      onChange={handleChange}
                    >
                      <option value="">Select tax classification</option>
                      {Object.values(TaxClassification).map(tc => (
                        <option key={tc} value={tc}>{tc}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-activity_classification">Activity Classification</label>
                    <select
                      id="edit-activity_classification"
                      name="activity_classification"
                      value={formData.activity_classification || ''}
                      onChange={handleChange}
                    >
                      <option value="">Select activity type</option>
                      {Object.values(ActivityClassification).map(ac => (
                        <option key={ac} value={ac}>{ac}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="edit-due_diligence_date">Due Diligence Date</label>
                  <input
                    type="date"
                    id="edit-due_diligence_date"
                    name="due_diligence_date"
                    value={formData.due_diligence_date || ''}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="edit-ic_approval_date">IC Approval Date</label>
                  <input
                    type="date"
                    id="edit-ic_approval_date"
                    name="ic_approval_date"
                    value={formData.ic_approval_date || ''}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-navigation">
            <div className="nav-buttons">
              {activeTab !== 'basic' && (
                <button type="button" onClick={prevTab} className="nav-button">
                  ← Previous
                </button>
              )}
              
              {activeTab !== 'legal' && (
                <button type="button" onClick={nextTab} className="nav-button">
                  Next →
                </button>
              )}
            </div>

            <div className="form-actions">
              <button type="button" onClick={onCancel} className="cancel-button">
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading || !tabValidation.basic || !tabValidation.financial} 
                className="submit-button"
              >
                {loading ? 'Updating...' : 'Update Investment'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditInvestmentModal;