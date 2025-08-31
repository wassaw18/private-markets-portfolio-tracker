import React, { useState, useEffect } from 'react';
import { EntityWithMembers, FamilyMember, RelationshipType } from '../types/entity';
import { entityAPI, familyMemberAPI } from '../services/api';
import CreateFamilyMemberModal from './CreateFamilyMemberModal';
import EditFamilyMemberModal from './EditFamilyMemberModal';
import FamilyMemberCard from './FamilyMemberCard';
import './FamilyMemberManagement.css';

interface Props {
  entityId?: number; // If provided, show only family members for this entity
}

const FamilyMemberManagement: React.FC<Props> = ({ entityId }) => {
  const [entities, setEntities] = useState<EntityWithMembers[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<number>(entityId || 0);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  useEffect(() => {
    loadEntities();
  }, []);

  useEffect(() => {
    if (selectedEntityId) {
      loadFamilyMembers();
    } else {
      setFamilyMembers([]);
    }
  }, [selectedEntityId, showInactive]);

  const loadEntities = async () => {
    try {
      const data = await entityAPI.getEntities(0, 1000);
      setEntities(data);
      
      // Auto-select first entity if no entityId prop provided
      if (!entityId && data.length > 0) {
        setSelectedEntityId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading entities:', err);
      setError('Failed to load entities');
    }
  };

  const loadFamilyMembers = async () => {
    if (!selectedEntityId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await familyMemberAPI.getFamilyMembers(selectedEntityId, showInactive);
      setFamilyMembers(data);
    } catch (err) {
      console.error('Error loading family members:', err);
      setError('Failed to load family members');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberCreated = (newMember: FamilyMember) => {
    setFamilyMembers(prev => [newMember, ...prev]);
    setShowCreateModal(false);
  };

  const handleMemberUpdated = (updatedMember: FamilyMember) => {
    setFamilyMembers(prev => prev.map(member => 
      member.id === updatedMember.id ? updatedMember : member
    ));
    setEditingMember(null);
  };

  const handleMemberDeleted = async (memberId: number) => {
    const member = familyMembers.find(m => m.id === memberId);
    if (!member) return;

    if (!confirm(`Are you sure you want to deactivate ${member.full_name}? This will mark them as inactive but preserve their information.`)) {
      return;
    }

    try {
      await familyMemberAPI.deleteFamilyMember(memberId);
      // Refresh family members list
      loadFamilyMembers();
    } catch (err) {
      console.error('Error deleting family member:', err);
      alert('Failed to deactivate family member');
    }
  };

  const selectedEntity = entities.find(e => e.id === selectedEntityId);

  const getRelationshipIcon = (relationshipType: RelationshipType): string => {
    switch (relationshipType) {
      case RelationshipType.SELF:
        return '👤';
      case RelationshipType.SPOUSE:
        return '💑';
      case RelationshipType.CHILD:
        return '👶';
      case RelationshipType.PARENT:
        return '👨‍👩‍👧‍👦';
      case RelationshipType.SIBLING:
        return '👫';
      case RelationshipType.TRUSTEE:
        return '⚖️';
      case RelationshipType.BENEFICIARY:
        return '🎁';
      case RelationshipType.MANAGER:
        return '👨‍💼';
      case RelationshipType.MEMBER:
        return '🤵';
      case RelationshipType.PARTNER:
        return '🤝';
      default:
        return '👥';
    }
  };

  const groupMembersByRelationship = () => {
    const groups: { [key: string]: FamilyMember[] } = {};
    familyMembers.forEach(member => {
      const relationship = member.relationship_type;
      if (!groups[relationship]) {
        groups[relationship] = [];
      }
      groups[relationship].push(member);
    });
    return groups;
  };

  if (loading && selectedEntityId) {
    return (
      <div className="family-member-management">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading family members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="family-member-management">
      <div className="family-management-header">
        <h2>Family Member Management</h2>
        <p>Manage family members and their relationships to entities.</p>
      </div>

      {/* Entity Selector (if not locked to specific entity) */}
      {!entityId && (
        <div className="entity-selector-section">
          <label htmlFor="entity-select">Select Entity:</label>
          <select
            id="entity-select"
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(parseInt(e.target.value))}
            className="entity-select"
          >
            <option value={0}>Select an entity...</option>
            {entities.map(entity => (
              <option key={entity.id} value={entity.id}>
                {entity.name} ({entity.entity_type})
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedEntity && (
        <>
          {/* Selected Entity Info */}
          <div className="selected-entity-info">
            <h3>{selectedEntity.name}</h3>
            <span className="entity-type-badge">{selectedEntity.entity_type}</span>
            {selectedEntity.investment_count > 0 && (
              <span className="investment-count">
                {selectedEntity.investment_count} investments
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="family-controls">
            <div className="controls-left">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show inactive members
              </label>
            </div>
            
            <button 
              onClick={() => setShowCreateModal(true)}
              className="create-member-button"
            >
              + Add Family Member
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              {error}
              <button onClick={loadFamilyMembers} className="retry-button">
                Try Again
              </button>
            </div>
          )}

          {/* Family Members Display */}
          {familyMembers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>No family members found</h3>
              <p>
                Add family members to track relationships and contact information for this entity.
              </p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="create-first-member-button"
              >
                Add First Family Member
              </button>
            </div>
          ) : (
            <div className="family-members-section">
              <div className="family-stats">
                <div className="stat-item">
                  <span className="stat-number">{familyMembers.length}</span>
                  <span className="stat-label">Total Members</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{familyMembers.filter(m => m.primary_contact).length}</span>
                  <span className="stat-label">Primary Contacts</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{familyMembers.filter(m => m.email).length}</span>
                  <span className="stat-label">With Email</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{familyMembers.filter(m => m.phone).length}</span>
                  <span className="stat-label">With Phone</span>
                </div>
              </div>

              {/* Grouped by Relationship */}
              <div className="relationship-groups">
                {Object.entries(groupMembersByRelationship()).map(([relationship, members]) => (
                  <div key={relationship} className="relationship-group">
                    <h4 className="relationship-header">
                      {getRelationshipIcon(relationship as RelationshipType)} {relationship}
                      <span className="member-count">({members.length})</span>
                    </h4>
                    <div className="members-grid">
                      {members.map(member => (
                        <FamilyMemberCard
                          key={member.id}
                          member={member}
                          onEdit={() => setEditingMember(member)}
                          onDelete={() => handleMemberDeleted(member.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreateModal && selectedEntityId && (
        <CreateFamilyMemberModal
          entityId={selectedEntityId}
          entityName={selectedEntity?.name || ''}
          onClose={() => setShowCreateModal(false)}
          onMemberCreated={handleMemberCreated}
        />
      )}

      {editingMember && (
        <EditFamilyMemberModal
          member={editingMember}
          entityName={selectedEntity?.name || ''}
          onClose={() => setEditingMember(null)}
          onMemberUpdated={handleMemberUpdated}
        />
      )}
    </div>
  );
};

export default FamilyMemberManagement;