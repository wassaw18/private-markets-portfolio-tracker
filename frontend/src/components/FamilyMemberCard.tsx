import React from 'react';
import { FamilyMember, RelationshipType } from '../types/entity';
import './FamilyMemberCard.css';

interface Props {
  member: FamilyMember;
  onEdit: () => void;
  onDelete: () => void;
}

const FamilyMemberCard: React.FC<Props> = ({ member, onEdit, onDelete }) => {
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }
    return age;
  };

  const age = calculateAge(member.date_of_birth);

  return (
    <div className={`family-member-card ${!member.is_active ? 'inactive' : ''} ${member.primary_contact ? 'primary-contact' : ''}`}>
      <div className="member-card-header">
        <div className="member-info">
          <div className="member-icon-and-name">
            <span className="relationship-icon">
              {getRelationshipIcon(member.relationship_type)}
            </span>
            <div>
              <h4 className="member-name">{member.full_name}</h4>
              <span className="relationship-type">{member.relationship_type}</span>
              {!member.is_active && <span className="inactive-badge">Inactive</span>}
              {member.primary_contact && <span className="primary-badge">Primary Contact</span>}
            </div>
          </div>
        </div>
        
        <div className="member-actions">
          <button onClick={onEdit} className="icon-button edit-icon" title="Edit member">
            ✏️
          </button>
          <button onClick={onDelete} className="icon-button delete-icon" title="Deactivate member">
            🗑️
          </button>
        </div>
      </div>

      <div className="member-card-body">
        {/* Personal Info */}
        {(member.date_of_birth || age) && (
          <div className="personal-info">
            {member.date_of_birth && (
              <div className="info-item">
                <span className="info-label">Birth Date:</span>
                <span className="info-value">
                  {formatDate(member.date_of_birth)}
                  {age && <span className="age"> (Age {age})</span>}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Contact Information */}
        <div className="contact-info">
          {member.email && (
            <div className="contact-item">
              <span className="contact-icon">📧</span>
              <a href={`mailto:${member.email}`} className="contact-link">
                {member.email}
              </a>
            </div>
          )}
          
          {member.phone && (
            <div className="contact-item">
              <span className="contact-icon">📞</span>
              <a href={`tel:${member.phone}`} className="contact-link">
                {member.phone}
              </a>
            </div>
          )}
          
          {member.address && (
            <div className="contact-item address">
              <span className="contact-icon">🏠</span>
              <span className="contact-text">{member.address}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {member.notes && (
          <div className="member-notes">
            <div className="notes-label">Notes:</div>
            <div className="notes-content">{member.notes}</div>
          </div>
        )}
      </div>

      <div className="member-card-footer">
        <span className="created-date">
          Added: {formatDate(member.created_date)}
        </span>
        {member.updated_date !== member.created_date && (
          <span className="updated-date">
            Updated: {formatDate(member.updated_date)}
          </span>
        )}
      </div>
    </div>
  );
};

export default FamilyMemberCard;