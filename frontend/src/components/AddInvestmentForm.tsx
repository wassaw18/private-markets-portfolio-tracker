import React, { useState } from 'react';
import { InvestmentCreate, AssetClass, InvestmentStructure, LiquidityProfile } from '../types/investment';
import { investmentAPI } from '../services/api';
import { validateInvestment, ValidationResult, FieldValidation } from '../utils/validation';
import EntitySelector from './EntitySelector';
import './AddInvestmentForm.css';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

const AddInvestmentForm: React.FC<Props> = ({ onSuccess, onCancel }) => {
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
    called_amount: 0,
    fees: 0,
  });

  const [selectedEntityName, setSelectedEntityName] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const processedValue = name === 'vintage_year' || name === 'commitment_amount' || 
                          name === 'called_amount' || name === 'fees' 
      ? parseFloat(value) || 0
      : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));

    // Real-time validation
    validateField(name, processedValue);
  };

  const handleEntityChange = (entityId: number, entityName: string) => {
    setFormData(prev => ({
      ...prev,
      entity_id: entityId
    }));
    setSelectedEntityName(entityName);
    
    // Real-time validation for entity
    validateField('entity_id', entityId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setValidationErrors([]);
    setFieldErrors({});

    // Comprehensive validation
    const validation = validateInvestment({
      name: formData.name,
      entity_id: formData.entity_id,
      strategy: formData.strategy,
      vintage_year: formData.vintage_year,
      commitment_amount: formData.commitment_amount,
      called_amount: formData.called_amount,
      fees: formData.fees
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      setLoading(false);
      return;
    }

    try {
      await investmentAPI.createInvestment(formData);
      onSuccess();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to create investment. Please check all fields.';
      setError(errorMessage);
      console.error('Error creating investment:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time field validation
  const validateField = (name: string, value: any) => {
    const tempData = { ...formData, [name]: value };
    const validation = validateInvestment({
      name: tempData.name,
      entity_id: tempData.entity_id,
      strategy: tempData.strategy,
      vintage_year: tempData.vintage_year,
      commitment_amount: tempData.commitment_amount,
      called_amount: tempData.called_amount,
      fees: tempData.fees
    });

    // Extract field-specific errors
    const newFieldErrors = { ...fieldErrors };
    validation.errors.forEach(error => {
      const fieldName = error.toLowerCase().includes('name') ? 'name' :
                       error.toLowerCase().includes('entity') ? 'entity_id' :
                       error.toLowerCase().includes('strategy') ? 'strategy' :
                       error.toLowerCase().includes('vintage') ? 'vintage_year' :
                       error.toLowerCase().includes('commitment') ? 'commitment_amount' :
                       error.toLowerCase().includes('called') ? 'called_amount' :
                       error.toLowerCase().includes('fees') ? 'fees' : '';
      if (fieldName) {
        newFieldErrors[fieldName] = error;
      }
    });

    // Clear errors for valid fields
    if (!validation.errors.some(e => e.toLowerCase().includes(name.toLowerCase()))) {
      delete newFieldErrors[name];
    }

    setFieldErrors(newFieldErrors);
  };

  return (
    <div className="add-investment-form">
      <h3>Add New Investment</h3>
      
      {error && <div className="error-message">{error}</div>}
      {validationErrors.length > 0 && (
        <div className="validation-errors">
          <h4>Please fix the following errors:</h4>
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
              className={fieldErrors.name ? 'error' : ''}
            />
            {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
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
            <label htmlFor="investment_structure">Investment Structure *</label>
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
            <label htmlFor="entity">Entity *</label>
            <div className="entity-selector-wrapper">
              <EntitySelector
                value={formData.entity_id || null}
                onChange={handleEntityChange}
                required
                className={`entity-input ${fieldErrors.entity_id ? 'error' : ''}`}
              />
              <button 
                type="button" 
                className="create-entity-button"
                title="Create a new entity"
                onClick={() => {/* TODO: Open entity creation modal */}}
              >
                + New Entity
              </button>
            </div>
            {fieldErrors.entity_id && <div className="field-error">{fieldErrors.entity_id}</div>}
            {selectedEntityName && (
              <div className="selected-entity-info">
                Selected: <strong>{selectedEntityName}</strong>
              </div>
            )}
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
              className={fieldErrors.strategy ? 'error' : ''}
            />
            {fieldErrors.strategy && <div className="field-error">{fieldErrors.strategy}</div>}
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
              className={fieldErrors.vintage_year ? 'error' : ''}
            />
            {fieldErrors.vintage_year && <div className="field-error">{fieldErrors.vintage_year}</div>}
          </div>

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
              placeholder="0.00"
              className={fieldErrors.commitment_amount ? 'error' : ''}
            />
            {fieldErrors.commitment_amount && <div className="field-error">{fieldErrors.commitment_amount}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="called_amount">Called Amount ($)</label>
            <input
              type="number"
              id="called_amount"
              name="called_amount"
              value={formData.called_amount}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
              className={fieldErrors.called_amount ? 'error' : ''}
            />
            {fieldErrors.called_amount && <div className="field-error">{fieldErrors.called_amount}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="fees">Fees ($)</label>
            <input
              type="number"
              id="fees"
              name="fees"
              value={formData.fees}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="cancel-button">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="submit-button">
            {loading ? 'Creating...' : 'Create Investment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddInvestmentForm;