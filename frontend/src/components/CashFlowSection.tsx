import React, { useState } from 'react';
import { CashFlow, CashFlowCreate, CashFlowType } from '../types/investment';
import { cashFlowAPI } from '../services/api';
import { formatDate, formatCurrency, getTodayDateString } from '../utils/formatters';
import './CashFlowSection.css';

interface Props {
  investmentId: number;
  cashFlows: CashFlow[];
  onUpdate: () => void;
}

const CashFlowSection: React.FC<Props> = ({ investmentId, cashFlows, onUpdate }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<CashFlowCreate>({
    date: getTodayDateString(),
    type: CashFlowType.CAPITAL_CALL,
    amount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await cashFlowAPI.createCashFlow(investmentId, formData);
      setFormData({
        date: getTodayDateString(),
        type: CashFlowType.CAPITAL_CALL,
        amount: 0,
      });
      setShowAddForm(false);
      onUpdate();
    } catch (err) {
      setError('Failed to add cash flow. Please check all fields.');
      console.error('Error creating cash flow:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cashFlowId: number) => {
    if (window.confirm('Are you sure you want to delete this cash flow? This action cannot be undone.')) {
      try {
        await cashFlowAPI.deleteCashFlow(investmentId, cashFlowId);
        onUpdate();
      } catch (err) {
        setError('Failed to delete cash flow');
        console.error('Error deleting cash flow:', err);
      }
    }
  };


  // Outflows (capital going out from investor to fund)
  const getTotalOutflows = () => {
    return cashFlows
      .filter(cf => [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION, CashFlowType.FEES].includes(cf.type))
      .reduce((sum, cf) => sum + cf.amount, 0);
  };

  // Inflows (capital coming back to investor from fund)
  const getTotalInflows = () => {
    return cashFlows
      .filter(cf => [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL].includes(cf.type))
      .reduce((sum, cf) => sum + cf.amount, 0);
  };

  // Legacy functions for backwards compatibility
  const getTotalContributions = () => getTotalOutflows();
  const getTotalDistributions = () => getTotalInflows();

  return (
    <div className="cashflow-section">
      <div className="section-header">
        <h3>Cash Flows ({cashFlows.length})</h3>
        <button 
          className="add-button"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Cash Flow'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddForm && (
        <div className="add-form-container">
          <h4>Add Cash Flow</h4>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cashflow-date">Date</label>
                <input
                  type="date"
                  id="cashflow-date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="cashflow-type">Type</label>
                <select
                  id="cashflow-type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                >
                  <optgroup label="Outflows (Capital going out)">
                    <option value={CashFlowType.CAPITAL_CALL}>Capital Call</option>
                    <option value={CashFlowType.CONTRIBUTION}>Contribution</option>
                    <option value={CashFlowType.FEES}>Fees</option>
                  </optgroup>
                  <optgroup label="Inflows (Capital coming back)">
                    <option value={CashFlowType.DISTRIBUTION}>Distribution</option>
                    <option value={CashFlowType.YIELD}>Yield</option>
                    <option value={CashFlowType.RETURN_OF_PRINCIPAL}>Return of Principal</option>
                  </optgroup>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="cashflow-amount">Amount ($)</label>
                <input
                  type="number"
                  id="cashflow-amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowAddForm(false)} className="cancel-button">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="submit-button">
                {loading ? 'Adding...' : 'Add Cash Flow'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="cashflow-summary">
        <div className="summary-item">
          <label>Total Outflows</label>
          <span className="currency negative">{formatCurrency(getTotalOutflows())}</span>
          <small>Capital calls, contributions & fees</small>
        </div>
        <div className="summary-item">
          <label>Total Inflows</label>
          <span className="currency positive">{formatCurrency(getTotalInflows())}</span>
          <small>Distributions, yield & principal returns</small>
        </div>
        <div className="summary-item">
          <label>Net Cash Flow</label>
          <span className={`currency ${getTotalInflows() - getTotalOutflows() >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(getTotalInflows() - getTotalOutflows())}
          </span>
          <small>Total return to date</small>
        </div>
      </div>

      <div className="cashflow-list">
        {cashFlows.length === 0 ? (
          <div className="empty-state">
            <p>No cash flows recorded yet. Add your first transaction to get started.</p>
          </div>
        ) : (
          <div className="cashflow-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cashFlows.map((cashFlow) => {
                  const isOutflow = [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION, CashFlowType.FEES].includes(cashFlow.type);
                  return (
                    <tr key={cashFlow.id}>
                      <td>{formatDate(cashFlow.date)}</td>
                      <td>
                        <span className={`type-badge ${cashFlow.type.toLowerCase().replace(/\s+/g, '-')}`}>
                          {cashFlow.type}
                        </span>
                      </td>
                      <td className={`currency ${isOutflow ? 'negative' : 'positive'}`}>
                        {isOutflow ? '-' : '+'}
                        {formatCurrency(cashFlow.amount)}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(cashFlow.id)}
                          className="delete-button"
                          title="Delete Cash Flow"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashFlowSection;