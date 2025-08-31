import React, { useState } from 'react';
import { EntityCreate, EntityType, EntityWithMembers } from '../types/entity';
import { entityAPI } from '../services/api';
import './CreateEntityModal.css';

interface Props {
  onClose: () => void;
  onEntityCreated: (entity: EntityWithMembers) => void;
}

const CreateEntityModal: React.FC<Props> = ({ onClose, onEntityCreated }) => {
  const [formData, setFormData] = useState<EntityCreate>({
    name: '',
    entity_type: EntityType.INDIVIDUAL,
    tax_id: '',
    legal_address: '',
    formation_date: '',
    notes: '',
    is_active: true
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
      // Clean up the form data before sending
      const cleanedData = {
        ...formData,
        tax_id: formData.tax_id || undefined,
        legal_address: formData.legal_address || undefined,
        formation_date: formData.formation_date || undefined,
        notes: formData.notes || undefined
      };

      // Create the entity
      const createdEntity = await entityAPI.createEntity(cleanedData);
      
      // Fetch the full entity with members to match the expected type
      const fullEntity = await entityAPI.getEntity(createdEntity.id);
      
      onEntityCreated(fullEntity);
    } catch (err) {
      console.error('Error creating entity:', err);
      setError('Failed to create entity. Please check all fields and try again.');
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
          <h3>Create New Entity</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="create-entity-form">
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
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Creating...' : 'Create Entity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEntityModal;