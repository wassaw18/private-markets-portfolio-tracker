import React, { useState, useCallback, useEffect } from 'react';
import { Investment, InvestmentStatus, InvestmentUpdate } from '../types/investment';
import { investmentAPI } from '../services/api';
import '../styles/luxury-design-system.css';
import './InvestmentStatusManager.css';

interface InvestmentStatusManagerProps {
  investment: Investment;
  onStatusUpdate?: (updatedInvestment: Investment) => void;
  onClose: () => void;
}

interface StatusChangeRequest {
  status: InvestmentStatus;
  realization_date?: string;
  realization_notes?: string;
  status_changed_by: string;
  status_changed_date: string;
}

const InvestmentStatusManager: React.FC<InvestmentStatusManagerProps> = ({
  investment,
  onStatusUpdate,
  onClose
}) => {
  const [selectedStatus, setSelectedStatus] = useState<InvestmentStatus>(investment.status);
  const [realizationDate, setRealizationDate] = useState(investment.realization_date || '');
  const [realizationNotes, setRealizationNotes] = useState(investment.realization_notes || '');
  const [changedBy, setChangedBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);

  // Status change warnings and requirements
  const getStatusRequirements = (status: InvestmentStatus) => {
    switch (status) {
      case InvestmentStatus.REALIZED:
        return {
          requiresDate: true,
          requiresNotes: true,
          warning: 'This will mark the investment as fully realized and remove it from active portfolio metrics.',
          confirmationText: 'Mark as Realized'
        };
      case InvestmentStatus.DORMANT:
        return {
          requiresDate: false,
          requiresNotes: true,
          warning: 'This will mark the investment as dormant but keep it in the portfolio.',
          confirmationText: 'Mark as Dormant'
        };
      case InvestmentStatus.ACTIVE:
        return {
          requiresDate: false,
          requiresNotes: false,
          warning: 'This will mark the investment as active and include it in portfolio metrics.',
          confirmationText: 'Mark as Active'
        };
      default:
        return {
          requiresDate: false,
          requiresNotes: false,
          warning: '',
          confirmationText: 'Update Status'
        };
    }
  };

  const currentRequirements = getStatusRequirements(selectedStatus);
  const hasChanges = selectedStatus !== investment.status ||
                    realizationDate !== (investment.realization_date || '') ||
                    realizationNotes !== (investment.realization_notes || '');

  // Validation
  const validateForm = useCallback(() => {
    if (currentRequirements.requiresDate && !realizationDate) {
      return 'Realization date is required for this status';
    }
    if (currentRequirements.requiresNotes && !realizationNotes.trim()) {
      return 'Notes are required for this status change';
    }
    if (!changedBy.trim()) {
      return 'Please specify who is making this status change';
    }
    return null;
  }, [selectedStatus, realizationDate, realizationNotes, changedBy, currentRequirements]);

  // Handle status update
  const handleStatusUpdate = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!confirmationRequired && hasChanges) {
      setConfirmationRequired(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updateData: InvestmentUpdate = {
        status: selectedStatus,
        status_changed_by: changedBy,
        status_changed_date: new Date().toISOString(),
        ...(currentRequirements.requiresDate && { realization_date: realizationDate }),
        ...(realizationNotes.trim() && { realization_notes: realizationNotes })
      };

      const updatedInvestment = await investmentAPI.updateInvestment(investment.id, updateData);

      if (onStatusUpdate) {
        onStatusUpdate(updatedInvestment);
      }

      onClose();
    } catch (error) {
      console.error('Error updating investment status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update investment status');
    } finally {
      setLoading(false);
    }
  }, [
    investment.id,
    selectedStatus,
    realizationDate,
    realizationNotes,
    changedBy,
    confirmationRequired,
    hasChanges,
    currentRequirements,
    validateForm,
    onStatusUpdate,
    onClose
  ]);

  // Status history effect (would be enhanced with actual history API)
  const [statusHistory, setStatusHistory] = useState<Array<{
    date: string;
    status: InvestmentStatus;
    changed_by: string;
    notes?: string;
  }>>([]);

  useEffect(() => {
    // Mock status history - in real implementation, fetch from API
    setStatusHistory([
      {
        date: investment.status_changed_date || investment.commitment_date || new Date().toISOString(),
        status: investment.status,
        changed_by: investment.status_changed_by || 'System',
        notes: investment.realization_notes
      }
    ]);
  }, [investment]);

  const formatStatusDisplay = (status: InvestmentStatus) => {
    switch (status) {
      case InvestmentStatus.ACTIVE:
        return { label: 'Active', color: 'var(--luxury-success)', icon: '🟢' };
      case InvestmentStatus.DORMANT:
        return { label: 'Dormant', color: 'var(--luxury-warning)', icon: '🟡' };
      case InvestmentStatus.REALIZED:
        return { label: 'Realized', color: 'var(--luxury-info)', icon: '🔵' };
      default:
        return { label: status, color: 'var(--luxury-text-secondary)', icon: '⚪' };
    }
  };

  if (confirmationRequired) {
    return (
      <div className="status-manager-overlay">
        <div className="status-manager-modal">
          <div className="status-manager-header">
            <h2 className="luxury-heading-2">Confirm Status Change</h2>
          </div>

          <div className="status-manager-content">
            <div className="confirmation-warning">
              <div className="warning-icon">⚠️</div>
              <div className="warning-content">
                <p className="luxury-body-large">{currentRequirements.warning}</p>
                <div className="status-change-summary">
                  <div className="status-change-row">
                    <span>Investment:</span>
                    <strong>{investment.name}</strong>
                  </div>
                  <div className="status-change-row">
                    <span>Current Status:</span>
                    <span className="status-badge" style={{ backgroundColor: formatStatusDisplay(investment.status).color }}>
                      {formatStatusDisplay(investment.status).icon} {formatStatusDisplay(investment.status).label}
                    </span>
                  </div>
                  <div className="status-change-row">
                    <span>New Status:</span>
                    <span className="status-badge" style={{ backgroundColor: formatStatusDisplay(selectedStatus).color }}>
                      {formatStatusDisplay(selectedStatus).icon} {formatStatusDisplay(selectedStatus).label}
                    </span>
                  </div>
                  {realizationDate && (
                    <div className="status-change-row">
                      <span>Realization Date:</span>
                      <strong>{new Date(realizationDate).toLocaleDateString()}</strong>
                    </div>
                  )}
                  <div className="status-change-row">
                    <span>Changed By:</span>
                    <strong>{changedBy}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="status-manager-actions">
            <button
              className="luxury-button-secondary"
              onClick={() => setConfirmationRequired(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="luxury-button-primary luxury-button-warning"
              onClick={handleStatusUpdate}
              disabled={loading}
            >
              {loading ? 'Updating...' : currentRequirements.confirmationText}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="status-manager-overlay">
      <div className="status-manager-modal">
        <div className="status-manager-header">
          <h2 className="luxury-heading-2">Investment Status Management</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="status-manager-content">
          {/* Investment Summary */}
          <div className="investment-summary">
            <div className="investment-info">
              <h3 className="luxury-heading-3">{investment.name}</h3>
              <p className="luxury-body">{investment.strategy} • {investment.asset_class}</p>
            </div>
            <div className="current-status">
              <span className="status-label">Current Status:</span>
              <span
                className="status-badge current"
                style={{ backgroundColor: formatStatusDisplay(investment.status).color }}
              >
                {formatStatusDisplay(investment.status).icon} {formatStatusDisplay(investment.status).label}
              </span>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Status Selection */}
          <div className="form-section">
            <label className="luxury-label">New Status</label>
            <div className="status-options">
              {Object.values(InvestmentStatus).map(status => {
                const display = formatStatusDisplay(status);
                return (
                  <button
                    key={status}
                    className={`status-option ${selectedStatus === status ? 'selected' : ''}`}
                    onClick={() => setSelectedStatus(status)}
                    style={{
                      borderColor: selectedStatus === status ? display.color : 'var(--luxury-border)',
                      backgroundColor: selectedStatus === status ? `${display.color}15` : 'transparent'
                    }}
                  >
                    <span className="status-icon">{display.icon}</span>
                    <span className="status-name">{display.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Realization Date (if required) */}
          {currentRequirements.requiresDate && (
            <div className="form-section">
              <label className="luxury-label">
                Realization Date <span className="required">*</span>
              </label>
              <input
                type="date"
                className="luxury-input"
                value={realizationDate}
                onChange={(e) => setRealizationDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          {/* Notes */}
          <div className="form-section">
            <label className="luxury-label">
              Notes {currentRequirements.requiresNotes && <span className="required">*</span>}
            </label>
            <textarea
              className="luxury-textarea"
              value={realizationNotes}
              onChange={(e) => setRealizationNotes(e.target.value)}
              placeholder="Enter notes about this status change..."
              rows={3}
            />
          </div>

          {/* Changed By */}
          <div className="form-section">
            <label className="luxury-label">
              Changed By <span className="required">*</span>
            </label>
            <input
              type="text"
              className="luxury-input"
              value={changedBy}
              onChange={(e) => setChangedBy(e.target.value)}
              placeholder="Enter your name or initials"
            />
          </div>

          {/* Status History */}
          <div className="form-section">
            <label className="luxury-label">Status History</label>
            <div className="status-history">
              {statusHistory.map((entry, index) => (
                <div key={index} className="history-entry">
                  <div className="history-icon">
                    {formatStatusDisplay(entry.status).icon}
                  </div>
                  <div className="history-content">
                    <div className="history-header">
                      <span className="history-status">{formatStatusDisplay(entry.status).label}</span>
                      <span className="history-date">{new Date(entry.date).toLocaleDateString()}</span>
                    </div>
                    <div className="history-details">
                      <span className="history-user">by {entry.changed_by}</span>
                      {entry.notes && <span className="history-notes">{entry.notes}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="status-manager-actions">
          <button
            className="luxury-button-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="luxury-button-primary"
            onClick={handleStatusUpdate}
            disabled={loading || !hasChanges || !!validateForm()}
          >
            {loading ? 'Updating...' : 'Update Status'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvestmentStatusManager;