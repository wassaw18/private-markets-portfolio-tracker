import React, { useState, useEffect } from 'react';
import { EntityWithMembers, EntityType } from '../types/entity';
import { entityAPI } from '../services/api';
import CreateEntityModal from './CreateEntityModal';
import EditEntityModal from './EditEntityModal';
import EntityCard from './EntityCard';
import './EntityManagement.css';

const EntityManagement: React.FC = () => {
  const [entities, setEntities] = useState<EntityWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<EntityWithMembers | null>(null);

  useEffect(() => {
    loadEntities();
  }, [selectedEntityType, showInactive]);

  const loadEntities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await entityAPI.getEntities(
        0, 
        1000, 
        selectedEntityType || undefined, 
        searchTerm || undefined, 
        showInactive
      );
      setEntities(data);
    } catch (err) {
      console.error('Error loading entities:', err);
      setError('Failed to load entities');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadEntities();
  };

  const handleEntityCreated = (newEntity: EntityWithMembers) => {
    setEntities(prev => [newEntity, ...prev]);
    setShowCreateModal(false);
  };

  const handleEntityUpdated = (updatedEntity: EntityWithMembers) => {
    setEntities(prev => prev.map(entity => 
      entity.id === updatedEntity.id ? updatedEntity : entity
    ));
    setEditingEntity(null);
  };

  const handleEntityDeleted = async (entityId: number) => {
    if (!window.confirm('Are you sure you want to deactivate this entity? This will not delete investments, but will mark the entity as inactive.')) {
      return;
    }

    try {
      await entityAPI.deleteEntity(entityId);
      // Refresh entities list
      loadEntities();
    } catch (err) {
      console.error('Error deleting entity:', err);
      alert('Failed to deactivate entity');
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

  if (loading) {
    return (
      <div className="entity-management">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading entities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="entity-management">
      <div className="entity-management-header">
        <h2>Entity Management</h2>
        <p>Manage legal entities and their family members for investment tracking.</p>
      </div>

      {/* Controls */}
      <div className="entity-controls">
        <div className="search-and-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="search-button">
              🔍 Search
            </button>
          </div>

          <div className="filters">
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="entity-type-filter"
            >
              <option value="">All Entity Types</option>
              {Object.values(EntityType).map(type => (
                <option key={type} value={type}>
                  {getEntityTypeIcon(type)} {type}
                </option>
              ))}
            </select>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive entities
            </label>
          </div>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)}
          className="create-entity-button"
        >
          + Create New Entity
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadEntities} className="retry-button">
            Try Again
          </button>
        </div>
      )}

      {/* Entity Stats */}
      <div className="entity-stats">
        <div className="stat-card">
          <div className="stat-number">{entities.length}</div>
          <div className="stat-label">
            {selectedEntityType ? `${selectedEntityType} Entities` : 'Total Entities'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            {entities.reduce((sum, entity) => sum + entity.investment_count, 0)}
          </div>
          <div className="stat-label">Total Investments</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            ${entities.reduce((sum, entity) => sum + entity.total_commitment, 0).toLocaleString()}
          </div>
          <div className="stat-label">Total Commitments</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            {entities.reduce((sum, entity) => sum + entity.family_members.length, 0)}
          </div>
          <div className="stat-label">Family Members</div>
        </div>
      </div>

      {/* Entities Grid */}
      <div className="entities-grid">
        {entities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No entities found</h3>
            <p>
              {searchTerm || selectedEntityType 
                ? 'Try adjusting your search or filters.'
                : 'Create your first entity to get started with investment tracking.'
              }
            </p>
            {!searchTerm && !selectedEntityType && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="create-first-entity-button"
              >
                Create First Entity
              </button>
            )}
          </div>
        ) : (
          entities.map(entity => (
            <EntityCard
              key={entity.id}
              entity={entity}
              onEdit={() => setEditingEntity(entity)}
              onDelete={() => handleEntityDeleted(entity.id)}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateEntityModal
          onClose={() => setShowCreateModal(false)}
          onEntityCreated={handleEntityCreated}
        />
      )}

      {editingEntity && (
        <EditEntityModal
          entity={editingEntity}
          onClose={() => setEditingEntity(null)}
          onEntityUpdated={handleEntityUpdated}
        />
      )}
    </div>
  );
};

export default EntityManagement;