import React, { useState } from 'react';
import { EntityUpdate, EntityType, EntityWithMembers } from '../types/entity';
import { entityAPI } from '../services/api';
import './EditEntityModal.css';

interface Props {
  entity: EntityWithMembers;
  onClose: () => void;
  onEntityUpdated: (entity: EntityWithMembers) => void;
}

const EditEntityModal: React.FC<Props> = ({ entity, onClose, onEntityUpdated }) => {
  const [formData, setFormData] = useState<EntityUpdate>({
    name: entity.name,
    entity_type: entity.entity_type,
    tax_id: entity.tax_id || '',
    legal_address: entity.legal_address || '',
    formation_date: entity.formation_date || '',
    notes: entity.notes || '',
    is_active: entity.is_active
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Update the entity
      await entityAPI.updateEntity(entity.id, formData);
      
      // Fetch the updated entity with members
      const updatedEntity = await entityAPI.getEntity(entity.id);
      
      onEntityUpdated(updatedEntity);
    } catch (err) {
      console.error('Error updating entity:', err);
      setError('Failed to update entity. Please check all fields and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getEntityTypeIcon = (entityType: EntityType): string => {
    switch (entityType) {
      case EntityType.INDIVIDUAL:
        return '👤';
      case EntityType.TRUST:
        return '🏛️';
      case EntityType.LLC:
        return '🏢';
      case EntityType.PARTNERSHIP:
        return '🤝';
      case EntityType.CORPORATION:
        return '🏭';
      case EntityType.FOUNDATION:
        return '🎯';
      default:
        return '📄';
    }
  };

  const isFormationDateRequired = () => {
    return formData.entity_type !== EntityType.INDIVIDUAL;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Entity</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="edit-entity-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name">Entity Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., Smith Family Trust"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="entity_type">Entity Type *</label>
              <select
                id="entity_type"
                name="entity_type"
                value={formData.entity_type}
                onChange={handleChange}
                required
              >
                {Object.values(EntityType).map(type => (
                  <option key={type} value={type}>
                    {getEntityTypeIcon(type)} {type}
                  </option>
                ))}
              </select>
              <small className="form-help">
                Choose the legal structure of this entity
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="tax_id">Tax ID (SSN/EIN/TIN)</label>
              <input
                type="text"
                id="tax_id"
                name="tax_id"
                value={formData.tax_id}
                onChange={handleChange}
                placeholder="e.g., 12-3456789 or 123-45-6789"
              />
              <small className="form-help">
                Enter the Tax Identification Number for this entity
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="formation_date">
                Formation Date {isFormationDateRequired() && '*'}
              </label>
              <input
                type="date"
                id="formation_date"
                name="formation_date"
                value={formData.formation_date}
                onChange={handleChange}
                required={isFormationDateRequired()}
              />
              <small className="form-help">
                {formData.entity_type === EntityType.INDIVIDUAL 
                  ? 'Date of birth (optional for individuals)'
                  : 'Date when the entity was legally formed'
                }
              </small>
            </div>

            <div className="form-group full-width">
              <label htmlFor="legal_address">Legal Address</label>
              <input
                type="text"
                id="legal_address"
                name="legal_address"
                value={formData.legal_address}
                onChange={handleChange}
                placeholder="e.g., 123 Main St, City, State 12345"
              />
              <small className="form-help">
                Primary legal address for this entity
              </small>
            </div>

            <div className="form-group full-width">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Additional notes about this entity..."
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                Active Entity
              </label>
              <small className="form-help">
                Inactive entities are hidden by default but investments remain linked
              </small>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Updating...' : 'Update Entity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEntityModal;