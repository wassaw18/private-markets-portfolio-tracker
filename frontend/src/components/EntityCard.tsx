import React from 'react';
import { EntityWithMembers, EntityType, RelationshipType } from '../types/entity';
import './EntityCard.css';

interface Props {
  entity: EntityWithMembers;
  onEdit: () => void;
  onDelete: () => void;
}

const EntityCard: React.FC<Props> = ({ entity, onEdit, onDelete }) => {
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

  const primaryContact = entity.family_members.find(member => member.primary_contact);
  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className={`entity-card ${!entity.is_active ? 'inactive' : ''}`}>
      <div className="entity-card-header">
        <div className="entity-icon-and-name">
          <span className="entity-icon">{getEntityTypeIcon(entity.entity_type)}</span>
          <div>
            <h3 className="entity-name">{entity.name}</h3>
            <span className="entity-type">{entity.entity_type}</span>
            {!entity.is_active && <span className="inactive-badge">Inactive</span>}
          </div>
        </div>
        <div className="entity-actions">
          <button onClick={onEdit} className="edit-button" title="Edit entity">
            ✏️
          </button>
          <button onClick={onDelete} className="delete-button" title="Deactivate entity">
            🗑️
          </button>
        </div>
      </div>

      <div className="entity-card-body">
        {/* Entity Details */}
        <div className="entity-details">
          {entity.tax_id && (
            <div className="detail-item">
              <span className="detail-label">Tax ID:</span>
              <span className="detail-value">{entity.tax_id}</span>
            </div>
          )}
          {entity.formation_date && (
            <div className="detail-item">
              <span className="detail-label">Formed:</span>
              <span className="detail-value">{formatDate(entity.formation_date)}</span>
            </div>
          )}
          {entity.legal_address && (
            <div className="detail-item address-item">
              <span className="detail-label">Address:</span>
              <span className="detail-value">{entity.legal_address}</span>
            </div>
          )}
        </div>

        {/* Primary Contact */}
        {primaryContact && (
          <div className="primary-contact">
            <h4>Primary Contact</h4>
            <div className="contact-info">
              <div className="contact-name">
                {getRelationshipIcon(primaryContact.relationship_type)} {primaryContact.full_name}
              </div>
              <div className="contact-details">
                <span className="relationship">({primaryContact.relationship_type})</span>
                {primaryContact.email && (
                  <a href={`mailto:${primaryContact.email}`} className="contact-email">
                    📧 {primaryContact.email}
                  </a>
                )}
                {primaryContact.phone && (
                  <a href={`tel:${primaryContact.phone}`} className="contact-phone">
                    📞 {primaryContact.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Family Members Summary */}
        {entity.family_members.length > 0 && (
          <div className="family-members-summary">
            <h4>Family Members ({entity.family_members.length})</h4>
            <div className="family-members-list">
              {entity.family_members.slice(0, 3).map(member => (
                <div key={member.id} className="family-member-item">
                  <span className="member-icon">
                    {getRelationshipIcon(member.relationship_type)}
                  </span>
                  <span className="member-name">{member.full_name}</span>
                  <span className="member-relationship">({member.relationship_type})</span>
                </div>
              ))}
              {entity.family_members.length > 3 && (
                <div className="more-members">
                  +{entity.family_members.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Investment Summary */}
        <div className="investment-summary">
          <h4>Investment Summary</h4>
          <div className="investment-stats">
            <div className="stat">
              <span className="stat-value">{entity.investment_count}</span>
              <span className="stat-label">Investments</span>
            </div>
            <div className="stat">
              <span className="stat-value">{formatCurrency(entity.total_commitment)}</span>
              <span className="stat-label">Total Commitment</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {entity.notes && (
          <div className="entity-notes">
            <h4>Notes</h4>
            <p>{entity.notes}</p>
          </div>
        )}
      </div>

      <div className="entity-card-footer">
        <span className="created-date">
          Created: {formatDate(entity.created_date)}
        </span>
        {entity.updated_date !== entity.created_date && (
          <span className="updated-date">
            Updated: {formatDate(entity.updated_date)}
          </span>
        )}
      </div>
    </div>
  );
};

export default EntityCard;