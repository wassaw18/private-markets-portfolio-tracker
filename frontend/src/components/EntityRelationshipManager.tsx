import React, { useState, useEffect } from 'react';
import { 
  EntityRelationshipWithEntities, 
  EntityRelationshipCreate, 
  AdvancedRelationshipType,
  Entity,
  EntityType
} from '../types/entity';
import { api } from '../services/api';
import DatePicker from './DatePicker';
import './EntityRelationshipManager.css';

interface EntityRelationshipManagerProps {
  entityId?: number;
  onRelationshipCreate?: (relationship: EntityRelationshipWithEntities) => void;
  onRelationshipUpdate?: (relationship: EntityRelationshipWithEntities) => void;
  onRelationshipDelete?: (relationshipId: number) => void;
}

const EntityRelationshipManager: React.FC<EntityRelationshipManagerProps> = ({
  entityId,
  onRelationshipCreate,
  onRelationshipUpdate,
  onRelationshipDelete
}) => {
  const [relationships, setRelationships] = useState<EntityRelationshipWithEntities[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [newRelationship, setNewRelationship] = useState<EntityRelationshipCreate>({
    from_entity_id: entityId || 0,
    to_entity_id: 0,
    relationship_type: AdvancedRelationshipType.OTHER,
    percentage_ownership: 0,
    is_voting_interest: true,
    effective_date: new Date().toISOString().split('T')[0],
    is_active: true,
  });

  useEffect(() => {
    loadRelationships();
    loadEntities();
  }, [entityId]);

  const loadRelationships = async () => {
    setLoading(true);
    try {
      console.log('Loading relationships for entity:', entityId);
      const response = await api.get('/api/entity-relationships', {
        params: { 
          entity_id: entityId,
          include_inactive: false 
        }
      });
      console.log('Relationships response:', response.data);
      setRelationships(response.data);
    } catch (err: any) {
      setError('Failed to load relationships');
      console.error('Error loading relationships:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEntities = async () => {
    try {
      const response = await api.get('/api/entities');
      setEntities(response.data);
    } catch (err: any) {
      console.error('Error loading entities:', err);
    }
  };

  const handleCreateRelationship = async () => {
    if (!newRelationship.from_entity_id || !newRelationship.to_entity_id) {
      setError('Please select both entities');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/entity-relationships', newRelationship);
      const createdRelationship = response.data;
      
      // Need to get the full relationship with entity details
      await loadRelationships();
      
      if (onRelationshipCreate) {
        onRelationshipCreate(createdRelationship);
      }
      
      setShowCreateForm(false);
      resetForm();
      setError(null);
      setSuccessMessage('Relationship created successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Full error creating relationship:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create relationship';
      setError(`Error creating relationship: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRelationship = async (relationshipId: number) => {
    if (!window.confirm('Are you sure you want to delete this relationship?')) {
      return;
    }

    try {
      await api.delete(`/api/entity-relationships/${relationshipId}`);
      await loadRelationships();
      
      if (onRelationshipDelete) {
        onRelationshipDelete(relationshipId);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete relationship');
    }
  };

  const resetForm = () => {
    setNewRelationship({
      from_entity_id: entityId || 0,
      to_entity_id: 0,
      relationship_type: AdvancedRelationshipType.OTHER,
      percentage_ownership: 0,
      is_voting_interest: true,
      effective_date: new Date().toISOString().split('T')[0],
      is_active: true,
    });
  };

  const getRelationshipTypeOptions = () => {
    return Object.values(AdvancedRelationshipType).map(type => ({
      value: type,
      label: type,
      category: getRelationshipCategory(type)
    }));
  };

  const getRelationshipCategory = (type: AdvancedRelationshipType): string => {
    if (type.includes('TRUST')) return 'Trust';
    if (type.includes('CORPORATE') || type.includes('SHAREHOLDER') || type.includes('BOARD') || type.includes('OFFICER') || type.includes('MANAGING')) return 'Corporate';
    if (type.includes('FAMILY') || type.includes('GUARDIAN') || type.includes('POWER_OF_ATTORNEY')) return 'Family';
    if (type.includes('OWNERSHIP') || type.includes('VOTING')) return 'Ownership';
    if (type.includes('PROFESSIONAL') || type.includes('ADVISOR') || type.includes('ACCOUNTANT') || type.includes('ATTORNEY')) return 'Professional';
    return 'Other';
  };

  const formatEntityType = (entityType: EntityType): string => {
    return entityType.replace(/_/g, ' ');
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getRelationshipDescription = (relationship: EntityRelationshipWithEntities): string => {
    let description = `${relationship.from_entity_name} ${relationship.relationship_type.toLowerCase()} ${relationship.to_entity_name}`;
    
    if (relationship.percentage_ownership > 0) {
      description += ` (${relationship.percentage_ownership}% ownership)`;
    }
    
    if (relationship.relationship_subtype) {
      description += ` - ${relationship.relationship_subtype}`;
    }
    
    return description;
  };

  return (
    <div className="entity-relationship-manager">
      <div className="relationship-manager-header">
        <h3>Entity Relationships</h3>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
          disabled={loading}
        >
          Add Relationship
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          {successMessage}
          <button onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      {showCreateForm && (
        <div className="relationship-form-modal">
          <div className="relationship-form">
            <div className="form-header">
              <h4>Create New Relationship</h4>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                  setError(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>From Entity</label>
                <select
                  value={newRelationship.from_entity_id}
                  onChange={(e) => setNewRelationship({
                    ...newRelationship,
                    from_entity_id: parseInt(e.target.value)
                  })}
                >
                  <option value={0}>Select entity...</option>
                  {entities.map(entity => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name} ({formatEntityType(entity.entity_type)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>To Entity</label>
                <select
                  value={newRelationship.to_entity_id}
                  onChange={(e) => setNewRelationship({
                    ...newRelationship,
                    to_entity_id: parseInt(e.target.value)
                  })}
                >
                  <option value={0}>Select entity...</option>
                  {entities
                    .filter(entity => entity.id !== newRelationship.from_entity_id)
                    .map(entity => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name} ({formatEntityType(entity.entity_type)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Relationship Type</label>
                <select
                  value={newRelationship.relationship_type}
                  onChange={(e) => setNewRelationship({
                    ...newRelationship,
                    relationship_type: e.target.value as AdvancedRelationshipType
                  })}
                >
                  {getRelationshipTypeOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Relationship Subtype (Optional)</label>
                <input
                  type="text"
                  value={newRelationship.relationship_subtype || ''}
                  onChange={(e) => setNewRelationship({
                    ...newRelationship,
                    relationship_subtype: e.target.value || undefined
                  })}
                  placeholder="e.g., Co-Trustee, Managing Partner"
                />
              </div>

              <div className="form-group">
                <label>Percentage Ownership</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={newRelationship.percentage_ownership}
                  onChange={(e) => setNewRelationship({
                    ...newRelationship,
                    percentage_ownership: parseFloat(e.target.value) || 0
                  })}
                />
                <small>Enter 0 if not applicable</small>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newRelationship.is_voting_interest}
                    onChange={(e) => setNewRelationship({
                      ...newRelationship,
                      is_voting_interest: e.target.checked
                    })}
                  />
                  Voting Interest
                </label>
              </div>

              <div className="form-group">
                <label>Effective Date</label>
                <DatePicker
                  selectedDate={new Date(newRelationship.effective_date || new Date())}
                  onDateChange={(date) => setNewRelationship({
                    ...newRelationship,
                    effective_date: date.toISOString().split('T')[0]
                  })}
                />
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  value={newRelationship.notes || ''}
                  onChange={(e) => setNewRelationship({
                    ...newRelationship,
                    notes: e.target.value || undefined
                  })}
                  rows={3}
                  placeholder="Additional notes about this relationship"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateRelationship}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Relationship'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relationships-list">
        {loading && !showCreateForm && (
          <div className="loading-message">Loading relationships...</div>
        )}

        {relationships.length === 0 && !loading && (
          <div className="empty-state">
            <p>No relationships found.</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateForm(true)}
            >
              Create First Relationship
            </button>
          </div>
        )}

        {relationships.map((relationship) => (
          <div key={relationship.id} className="relationship-card">
            <div className="relationship-main">
              <div className="relationship-description">
                <h4>{getRelationshipDescription(relationship)}</h4>
                <div className="relationship-details">
                  <span className="relationship-type">
                    {relationship.relationship_type}
                  </span>
                  {relationship.percentage_ownership > 0 && (
                    <span className="ownership-percentage">
                      {relationship.percentage_ownership}% 
                      {relationship.is_voting_interest ? ' (Voting)' : ' (Non-voting)'}
                    </span>
                  )}
                </div>
                <div className="relationship-meta">
                  <span>Effective: {formatDate(relationship.effective_date)}</span>
                  {relationship.end_date && (
                    <span>End: {formatDate(relationship.end_date)}</span>
                  )}
                </div>
                {relationship.notes && (
                  <div className="relationship-notes">
                    <p>{relationship.notes}</p>
                  </div>
                )}
              </div>
              
              <div className="relationship-actions">
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteRelationship(relationship.id)}
                  title="Delete relationship"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntityRelationshipManager;