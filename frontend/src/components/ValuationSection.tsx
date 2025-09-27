import React, { useState } from 'react';
import { Valuation, ValuationCreate, ValuationUpdate } from '../types/investment';
import { valuationAPI } from '../services/api';
import './ValuationSection.css';

interface Props {
  investmentId: number;
  valuations: Valuation[];
  onUpdate: () => void;
}

const ValuationSection: React.FC<Props> = ({ investmentId, valuations, onUpdate }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingValuation, setEditingValuation] = useState<Valuation | null>(null);
  const [formData, setFormData] = useState<ValuationCreate>({
    date: new Date().toISOString().split('T')[0],
    nav_value: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'nav_value' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingValuation) {
        // Create update object with only changed fields
        const updateData: ValuationUpdate = {};
        if (formData.date !== editingValuation.date) updateData.date = formData.date;
        if (formData.nav_value !== editingValuation.nav_value) updateData.nav_value = formData.nav_value;
        
        await valuationAPI.updateValuation(investmentId, editingValuation.id, updateData);
      } else {
        await valuationAPI.createValuation(investmentId, formData);
      }
      setFormData({
        date: new Date().toISOString().split('T')[0],
        nav_value: 0,
      });
      setShowAddForm(false);
      setEditingValuation(null);
      onUpdate();
    } catch (err) {
      setError(editingValuation ? 'Failed to update valuation. Please check all fields.' : 'Failed to add valuation. Please check all fields.');
      console.error(editingValuation ? 'Error updating valuation:' : 'Error creating valuation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (valuation: Valuation) => {
    setEditingValuation(valuation);
    setFormData({
      date: valuation.date,
      nav_value: valuation.nav_value,
    });
    setShowAddForm(true);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingValuation(null);
    setShowAddForm(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      nav_value: 0,
    });
    setError(null);
  };

  const handleDelete = async (valuationId: number) => {
    if (window.confirm('Are you sure you want to delete this valuation? This action cannot be undone.')) {
      try {
        await valuationAPI.deleteValuation(investmentId, valuationId);
        onUpdate();
      } catch (err) {
        setError('Failed to delete valuation');
        console.error('Error deleting valuation:', err);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getLatestValuation = () => {
    if (valuations.length === 0) return null;
    return valuations.reduce((latest, current) => 
      new Date(current.date) > new Date(latest.date) ? current : latest
    );
  };

  const getPerformanceMetrics = () => {
    if (valuations.length < 2) return null;
    
    const sorted = [...valuations].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    
    const totalReturn = ((latest.nav_value - earliest.nav_value) / earliest.nav_value) * 100;
    const daysDiff = Math.floor((new Date(latest.date).getTime() - new Date(earliest.date).getTime()) / (1000 * 60 * 60 * 24));
    const annualizedReturn = Math.pow((latest.nav_value / earliest.nav_value), (365 / daysDiff)) - 1;
    
    return {
      totalReturn,
      annualizedReturn: annualizedReturn * 100,
      periodDays: daysDiff
    };
  };

  const latestValuation = getLatestValuation();
  const performance = getPerformanceMetrics();

  return (
    <div className="valuation-section">
      <div className="section-header">
        <h3>Valuations ({valuations.length})</h3>
        <button 
          className="add-button"
          onClick={() => editingValuation ? handleCancelEdit() : setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Valuation'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddForm && (
        <div className="add-form-container">
          <h4>{editingValuation ? 'Edit NAV Valuation' : 'Add NAV Valuation'}</h4>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="valuation-date">Valuation Date</label>
                <input
                  type="date"
                  id="valuation-date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="valuation-nav">NAV Value ($)</label>
                <input
                  type="number"
                  id="valuation-nav"
                  name="nav_value"
                  value={formData.nav_value}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={handleCancelEdit} className="cancel-button">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="submit-button">
                {loading ? (editingValuation ? 'Updating...' : 'Adding...') : (editingValuation ? 'Update Valuation' : 'Add Valuation')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="valuation-summary">
        <div className="summary-item">
          <label>Latest NAV</label>
          <span className="currency">
            {latestValuation ? formatCurrency(latestValuation.nav_value) : 'N/A'}
          </span>
          {latestValuation && (
            <small>{formatDate(latestValuation.date)}</small>
          )}
        </div>
        
        <div className="summary-item">
          <label>Total Return</label>
          <span className={`currency ${performance && performance.totalReturn >= 0 ? 'positive' : 'negative'}`}>
            {performance ? `${performance.totalReturn >= 0 ? '+' : ''}${performance.totalReturn.toFixed(1)}%` : 'N/A'}
          </span>
          <small>{performance ? `${performance.periodDays} days` : 'Need multiple valuations'}</small>
        </div>
        
        <div className="summary-item">
          <label>Annualized Return</label>
          <span className={`currency ${performance && performance.annualizedReturn >= 0 ? 'positive' : 'negative'}`}>
            {performance ? `${performance.annualizedReturn >= 0 ? '+' : ''}${performance.annualizedReturn.toFixed(1)}%` : 'N/A'}
          </span>
          <small>{performance ? 'Estimated' : 'Need multiple valuations'}</small>
        </div>
      </div>

      <div className="valuation-list">
        {valuations.length === 0 ? (
          <div className="empty-state">
            <p>No valuations recorded yet. Add your first NAV update to track performance.</p>
          </div>
        ) : (
          <div className="valuation-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>NAV Value</th>
                  <th>Change</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {valuations.map((valuation, index) => {
                  const previousValuation = valuations[index + 1];
                  const change = previousValuation 
                    ? ((valuation.nav_value - previousValuation.nav_value) / previousValuation.nav_value) * 100
                    : null;
                  
                  return (
                    <tr key={valuation.id}>
                      <td>{formatDate(valuation.date)}</td>
                      <td className="currency">{formatCurrency(valuation.nav_value)}</td>
                      <td>
                        {change !== null ? (
                          <span className={`percentage ${change >= 0 ? 'positive' : 'negative'}`}>
                            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="no-change">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleEdit(valuation)}
                          className="icon-button edit-icon"
                          title="Edit Valuation"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(valuation.id)}
                          className="icon-button delete-icon"
                          title="Delete Valuation"
                        >
                          🗑️
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

export default ValuationSection;