import React, { useState, useEffect } from 'react';
import { EntityWithMembers, EntityType } from '../types/entity';
import { entityAPI } from '../services/api';
import './EntitySelector.css';

interface Props {
  value: number | null;
  onChange: (entityId: number, entityName: string) => void;
  required?: boolean;
  className?: string;
}

const EntitySelector: React.FC<Props> = ({ 
  value, 
  onChange, 
  required = false,
  className = '' 
}) => {
  const [entities, setEntities] = useState<EntityWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await entityAPI.getEntities(0, 1000); // Get all active entities
      setEntities(data);
    } catch (err) {
      console.error('Error loading entities:', err);
      setError('Failed to load entities');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const entityId = parseInt(e.target.value);
    const entity = entities.find(e => e.id === entityId);
    if (entity) {
      onChange(entityId, entity.name);
    }
  };

  const getEntityDisplayName = (entity: EntityWithMembers): string => {
    return `${entity.name} (${entity.entity_type})`;
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
      <select className={`entity-selector loading ${className}`} disabled>
        <option>Loading entities...</option>
      </select>
    );
  }

  if (error) {
    return (
      <div className="entity-selector-error">
        <select className={`entity-selector error ${className}`} disabled>
          <option>Error loading entities</option>
        </select>
        <button 
          type="button" 
          onClick={loadEntities}
          className="retry-button"
          title="Retry loading entities"
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <select
      className={`entity-selector ${className}`}
      value={value || ''}
      onChange={handleChange}
      required={required}
    >
      <option value="">
        {required ? 'Select entity *' : 'Select entity (optional)'}
      </option>
      
      {/* Group entities by type */}
      {Object.values(EntityType).map(entityType => {
        const entitiesOfType = entities.filter(e => e.entity_type === entityType);
        if (entitiesOfType.length === 0) return null;
        
        return (
          <optgroup key={entityType} label={`${getEntityTypeIcon(entityType)} ${entityType}`}>
            {entitiesOfType.map(entity => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
                {entity.investment_count > 0 && ` (${entity.investment_count} investments)`}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
};

export default EntitySelector;