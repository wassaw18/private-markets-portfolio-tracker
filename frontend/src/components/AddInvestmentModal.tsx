import React, { useState, useEffect } from 'react';
import { InvestmentCreate, AssetClass, InvestmentStructure, LiquidityProfile, ReportingFrequency, RiskRating, TaxClassification, ActivityClassification } from '../types/investment';
import { investmentAPI } from '../services/api';
import { validateInvestment } from '../utils/validation';
import { getTodayDateString } from '../utils/formatters';
import EntitySelector from './EntitySelector';
import CreateEntityModal from './CreateEntityModal';
import './AddInvestmentModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type TabType = 'basic' | 'financial' | 'operational' | 'legal';

interface TabValidation {
  basic: boolean;
  financial: boolean;
  operational: boolean;
  legal: boolean;
}

const AddInvestmentModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [showCreateEntity, setShowCreateEntity] = useState(false);
  
  const [formData, setFormData] = useState<InvestmentCreate>({
    name: '',
    asset_class: AssetClass.PRIVATE_EQUITY,
    investment_structure: InvestmentStructure.LIMITED_PARTNERSHIP,
    entity_id: 0,
    strategy: '',
    vintage_year: new Date().getFullYear(),
    commitment_amount: 0,
    commitment_date: '',
    liquidity_profile: LiquidityProfile.ILLIQUID,
    currency: 'USD',
    fees: 0,
  });

  const [selectedEntityName, setSelectedEntityName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [tabValidation, setTabValidation] = useState<TabValidation>({
    basic: false,
    financial: false,
    operational: true, // Optional fields only
    legal: true, // Optional fields only
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        asset_class: AssetClass.PRIVATE_EQUITY,
        investment_structure: InvestmentStructure.LIMITED_PARTNERSHIP,
        entity_id: 0,
        strategy: '',
        vintage_year: new Date().getFullYear(),
        commitment_amount: 0,
        commitment_date: '',
        liquidity_profile: LiquidityProfile.ILLIQUID,
        currency: 'USD',
        fees: 0,
      });
      setActiveTab('basic');
      setSelectedEntityName('');
      setError(null);
      setValidationErrors([]);
      setFieldErrors({});
    }
  }, [isOpen]);

  // Real-time validation effect
  useEffect(() => {
    validateCurrentTab();
    validateAllTabs();
  }, [formData, activeTab]);

  const validateCurrentTab = () => {
    const errors: string[] = [];
    
    if (activeTab === 'basic') {
      if (!formData.name.trim()) errors.push('Investment name is required');
      if (!formData.entity_id) errors.push('Entity selection is required');
      if (!formData.strategy.trim()) errors.push('Strategy is required');
      if (formData.vintage_year < 1900 || formData.vintage_year > 2100) errors.push('Invalid vintage year');
    } else if (activeTab === 'financial') {
      if (!formData.commitment_date) errors.push('Commitment date is required');
      if (formData.commitment_amount <= 0) errors.push('Commitment amount must be greater than 0');
      if (formData.management_fee && (formData.management_fee < 0 || formData.management_fee > 1)) {
        errors.push('Management fee must be between 0% and 100%');
      }
      if (formData.performance_fee && (formData.performance_fee < 0 || formData.performance_fee > 1)) {
        errors.push('Performance fee must be between 0% and 100%');
      }
      if (formData.hurdle_rate && (formData.hurdle_rate < 0 || formData.hurdle_rate > 1)) {
        errors.push('Hurdle rate must be between 0% and 100%');
      }
    }

    setValidationErrors(errors);
  };

  const validateAllTabs = () => {
    const basicValid = !!(formData.name.trim() && formData.entity_id && 
                         formData.strategy.trim() && formData.vintage_year >= 1900 && 
                         formData.vintage_year <= 2100);
    
    const financialValid = !!(formData.commitment_date && formData.commitment_amount > 0 &&
                             (!formData.management_fee || (formData.management_fee >= 0 && formData.management_fee <= 1)) &&
                             (!formData.performance_fee || (formData.performance_fee >= 0 && formData.performance_fee <= 1)) &&
                             (!formData.hurdle_rate || (formData.hurdle_rate >= 0 && formData.hurdle_rate <= 1)));

    setTabValidation({
      basic: basicValid,
      financial: financialValid,
      operational: true, // All optional
      legal: true, // All optional
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    let processedValue: any = value;
    
    // Type conversion for numeric fields
    if (['vintage_year', 'commitment_amount', 'fees', 'target_raise'].includes(name)) {
      processedValue = parseFloat(value) || 0;
    } else if (['management_fee', 'performance_fee', 'hurdle_rate'].includes(name)) {
      // Convert percentage to decimal (e.g., 2.5% -> 0.025)
      processedValue = value ? parseFloat(value) / 100 : undefined;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const handleEntityChange = (entityId: number, entityName: string) => {
    setFormData(prev => ({
      ...prev,
      entity_id: entityId
    }));
    setSelectedEntityName(entityName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all tabs before submission
    const allTabsValid = Object.values(tabValidation).every(valid => valid);
    if (!allTabsValid) {
      setError('Please complete all required fields in all tabs before submitting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await investmentAPI.createInvestment(formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to create investment. Please check all fields.';
      setError(errorMessage);
      console.error('Error creating investment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEntityCreated = (entity: any) => {
    setShowCreateEntity(false);
    // Automatically select the newly created entity
    setFormData(prev => ({
      ...prev,
      entity_id: entity.id
    }));
    setSelectedEntityName(entity.name);
  };

  const canProceedToNext = (tab: TabType): boolean => {
    return tabValidation[tab];
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

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content add-investment-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Add New Investment</h2>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
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
                      <label htmlFor="name">Investment Name *</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="e.g. Fund ABC I"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="asset_class">Asset Class *</label>
                      <select
                        id="asset_class"
                        name="asset_class"
                        value={formData.asset_class}
                        onChange={handleChange}
                        required
                      >
                        {Object.values(AssetClass).map(ac => (
                          <option key={ac} value={ac}>{ac}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="investment_structure">Structure *</label>
                      <select
                        id="investment_structure"
                        name="investment_structure"
                        value={formData.investment_structure}
                        onChange={handleChange}
                        required
                      >
                        {Object.values(InvestmentStructure).map(is => (
                          <option key={is} value={is}>{is}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="entity">Owner Entity *</label>
                      <div className="entity-selector-wrapper">
                        <EntitySelector
                          value={formData.entity_id || null}
                          onChange={handleEntityChange}
                          required
                        />
                        <button 
                          type="button" 
                          className="create-entity-button"
                          onClick={() => setShowCreateEntity(true)}
                        >
                          + New Entity
                        </button>
                      </div>
                      {selectedEntityName && (
                        <div className="selected-entity-info">
                          Selected: <strong>{selectedEntityName}</strong>
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="manager">Manager</label>
                      <input
                        type="text"
                        id="manager"
                        name="manager"
                        value={formData.manager || ''}
                        onChange={handleChange}
                        placeholder="e.g. ABC Capital Partners"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="strategy">Strategy *</label>
                      <input
                        type="text"
                        id="strategy"
                        name="strategy"
                        value={formData.strategy}
                        onChange={handleChange}
                        required
                        placeholder="e.g. Growth Buyout"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="vintage_year">Vintage Year *</label>
                      <input
                        type="number"
                        id="vintage_year"
                        name="vintage_year"
                        value={formData.vintage_year}
                        onChange={handleChange}
                        required
                        min="1900"
                        max="2100"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="target_raise">Target Raise ($)</label>
                      <input
                        type="number"
                        id="target_raise"
                        name="target_raise"
                        value={formData.target_raise || ''}
                        onChange={handleChange}
                        min="0"
                        step="1000000"
                        placeholder="Total fund size"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="geography_focus">Geography Focus</label>
                      <select
                        id="geography_focus"
                        name="geography_focus"
                        value={formData.geography_focus || ''}
                        onChange={handleChange}
                      >
                        <option value="">Select geography</option>
                        <option value="North America">North America</option>
                        <option value="United States">United States</option>
                        <option value="Europe">Europe</option>
                        <option value="Asia">Asia</option>
                        <option value="Global">Global</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'financial' && (
                <div className="tab-panel">
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="commitment_amount">Commitment Amount ($) *</label>
                      <input
                        type="number"
                        id="commitment_amount"
                        name="commitment_amount"
                        value={formData.commitment_amount}
                        onChange={handleChange}
                        required
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="commitment_date">Commitment Date *</label>
                      <input
                        type="date"
                        id="commitment_date"
                        name="commitment_date"
                        value={formData.commitment_date}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="management_fee">Management Fee (%)</label>
                      <input
                        type="number"
                        id="management_fee"
                        name="management_fee"
                        value={formatPercentageValue(formData.management_fee)}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="2.0"
                      />
                      <small>Enter as percentage (e.g., 2.0 for 2%)</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="performance_fee">Performance Fee (%)</label>
                      <input
                        type="number"
                        id="performance_fee"
                        name="performance_fee"
                        value={formatPercentageValue(formData.performance_fee)}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="20.0"
                      />
                      <small>Enter as percentage (e.g., 20.0 for 20%)</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="hurdle_rate">Hurdle Rate (%)</label>
                      <input
                        type="number"
                        id="hurdle_rate"
                        name="hurdle_rate"
                        value={formatPercentageValue(formData.hurdle_rate)}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="8.0"
                      />
                      <small>Enter as percentage (e.g., 8.0 for 8%)</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="distribution_target">Distribution Target</label>
                      <textarea
                        id="distribution_target"
                        name="distribution_target"
                        value={formData.distribution_target || ''}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Describe distribution objectives"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="currency">Currency</label>
                      <select
                        id="currency"
                        name="currency"
                        value={formData.currency || 'USD'}
                        onChange={handleChange}
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="liquidity_profile">Liquidity Profile *</label>
                      <select
                        id="liquidity_profile"
                        name="liquidity_profile"
                        value={formData.liquidity_profile}
                        onChange={handleChange}
                        required
                      >
                        {Object.values(LiquidityProfile).map(lp => (
                          <option key={lp} value={lp}>{lp}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'operational' && (
                <div className="tab-panel">
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="expected_maturity_date">Expected Maturity Date</label>
                      <input
                        type="date"
                        id="expected_maturity_date"
                        name="expected_maturity_date"
                        value={formData.expected_maturity_date || ''}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="reporting_frequency">Reporting Frequency</label>
                      <select
                        id="reporting_frequency"
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

                    <div className="form-group">
                      <label htmlFor="contact_person">Contact Person</label>
                      <input
                        type="text"
                        id="contact_person"
                        name="contact_person"
                        value={formData.contact_person || ''}
                        onChange={handleChange}
                        placeholder="Primary contact at fund"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Email</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email || ''}
                        onChange={handleChange}
                        placeholder="contact@fund.com"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="portal_link">Portal Link</label>
                      <input
                        type="url"
                        id="portal_link"
                        name="portal_link"
                        value={formData.portal_link || ''}
                        onChange={handleChange}
                        placeholder="https://portal.fund.com"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="fund_administrator">Fund Administrator</label>
                      <input
                        type="text"
                        id="fund_administrator"
                        name="fund_administrator"
                        value={formData.fund_administrator || ''}
                        onChange={handleChange}
                        placeholder="e.g. SS&C GlobeOp"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'legal' && (
                <div className="tab-panel">
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="fund_domicile">Fund Domicile</label>
                      <input
                        type="text"
                        id="fund_domicile"
                        name="fund_domicile"
                        value={formData.fund_domicile || ''}
                        onChange={handleChange}
                        placeholder="e.g. Delaware, Cayman Islands"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="tax_classification">Tax Classification</label>
                      <select
                        id="tax_classification"
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
                      <label htmlFor="activity_classification">Activity Classification</label>
                      <select
                        id="activity_classification"
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

                    <div className="form-group">
                      <label htmlFor="due_diligence_date">Due Diligence Date</label>
                      <input
                        type="date"
                        id="due_diligence_date"
                        name="due_diligence_date"
                        value={formData.due_diligence_date || ''}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="ic_approval_date">IC Approval Date</label>
                      <input
                        type="date"
                        id="ic_approval_date"
                        name="ic_approval_date"
                        value={formData.ic_approval_date || ''}
                        onChange={handleChange}
                      />
                      <small>Investment Committee approval date</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="risk_rating">Risk Rating</label>
                      <select
                        id="risk_rating"
                        name="risk_rating"
                        value={formData.risk_rating || ''}
                        onChange={handleChange}
                      >
                        <option value="">Select rating</option>
                        {Object.values(RiskRating).map(rr => (
                          <option key={rr} value={rr}>{rr}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="benchmark_index">Benchmark Index</label>
                      <input
                        type="text"
                        id="benchmark_index"
                        name="benchmark_index"
                        value={formData.benchmark_index || ''}
                        onChange={handleChange}
                        placeholder="e.g. S&P 500, Russell 2000"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <div className="tab-navigation-buttons">
                {activeTab !== 'basic' && (
                  <button type="button" onClick={prevTab} className="nav-button">
                    ← Previous
                  </button>
                )}
                {activeTab !== 'legal' && (
                  <button 
                    type="button" 
                    onClick={nextTab}
                    className="nav-button"
                    disabled={!canProceedToNext(activeTab)}
                    style={{ visibility: 'visible' }}
                  >
                    Next →
                  </button>
                )}
              </div>
              
              <div className="action-buttons">
                <button type="button" onClick={onClose} className="cancel-button">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !Object.values(tabValidation).every(v => v)} 
                  className="submit-button"
                >
                  {loading ? 'Creating...' : 'Create Investment'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showCreateEntity && (
        <CreateEntityModal
          onClose={() => setShowCreateEntity(false)}
          onEntityCreated={handleEntityCreated}
        />
      )}
    </>
  );
};

export default AddInvestmentModal;