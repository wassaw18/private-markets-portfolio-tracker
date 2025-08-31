import React, { useState, useEffect } from 'react';
import { Investment, InvestmentUpdate, AssetClass, InvestmentStructure } from '../types/investment';
import { investmentAPI } from '../services/api';
import EntitySelector from './EntitySelector';
import './EditInvestmentModal.css';

interface Props {
  investment: Investment;
  onSuccess: () => void;
  onCancel: () => void;
}

const EditInvestmentModal: React.FC<Props> = ({ investment, onSuccess, onCancel }) => {
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
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'vintage_year' || name === 'commitment_amount' || 
               name === 'called_amount' || name === 'fees' 
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleEntityChange = (entityId: number | null) => {
    setFormData(prev => ({
      ...prev,
      entity_id: entityId
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Edit Investment</h3>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="edit-name">Investment Name</label>
              <input
                type="text"
                id="edit-name"
                name="name"
                value={formData.name || ''}
                onChange={handleChange}
                placeholder="e.g. Fund ABC I"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-asset_class">Asset Class</label>
              <select
                id="edit-asset_class"
                name="asset_class"
                value={formData.asset_class || ''}
                onChange={handleChange}
              >
                {Object.values(AssetClass).map(ac => (
                  <option key={ac} value={ac}>{ac}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-investment_structure">Investment Structure</label>
              <select
                id="edit-investment_structure"
                name="investment_structure"
                value={formData.investment_structure || ''}
                onChange={handleChange}
              >
                {Object.values(InvestmentStructure).map(is => (
                  <option key={is} value={is}>{is}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-entity">Entity</label>
              <EntitySelector
                value={formData.entity_id || null}
                onChange={handleEntityChange}
                required
                className="entity-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-strategy">Strategy</label>
              <input
                type="text"
                id="edit-strategy"
                name="strategy"
                value={formData.strategy || ''}
                onChange={handleChange}
                placeholder="e.g. Growth Buyout"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-vintage_year">Vintage Year</label>
              <input
                type="number"
                id="edit-vintage_year"
                name="vintage_year"
                value={formData.vintage_year || ''}
                onChange={handleChange}
                min="1900"
                max="2100"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-commitment_amount">Commitment Amount ($)</label>
              <input
                type="number"
                id="edit-commitment_amount"
                name="commitment_amount"
                value={formData.commitment_amount || ''}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
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
              <label htmlFor="edit-fees">Fees ($)</label>
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

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Updating...' : 'Update Investment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditInvestmentModal;