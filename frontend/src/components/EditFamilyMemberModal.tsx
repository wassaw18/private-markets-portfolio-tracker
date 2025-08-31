import React, { useState } from 'react';
import { FamilyMemberUpdate, RelationshipType, FamilyMember } from '../types/entity';
import { familyMemberAPI } from '../services/api';
import './EditFamilyMemberModal.css';

interface Props {
  member: FamilyMember;
  entityName: string;
  onClose: () => void;
  onMemberUpdated: (member: FamilyMember) => void;
}

const EditFamilyMemberModal: React.FC<Props> = ({ 
  member, 
  entityName, 
  onClose, 
  onMemberUpdated 
}) => {
  const [formData, setFormData] = useState<FamilyMemberUpdate>({
    first_name: member.first_name,
    last_name: member.last_name,
    date_of_birth: member.date_of_birth || '',
    relationship_type: member.relationship_type,
    primary_contact: member.primary_contact,
    email: member.email || '',
    phone: member.phone || '',
    address: member.address || '',
    notes: member.notes || '',
    is_active: member.is_active
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
      const updatedMember = await familyMemberAPI.updateFamilyMember(member.id, formData);
      onMemberUpdated(updatedMember);
    } catch (err) {
      console.error('Error updating family member:', err);
      setError('Failed to update family member. Please check all fields and try again.');
    } finally {
      setLoading(false);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Family Member</h3>
          <div className="entity-context">for {entityName}</div>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="edit-member-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="first_name">First Name *</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                placeholder="e.g., John"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="last_name">Last Name *</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                placeholder="e.g., Smith"
              />
            </div>

            <div className="form-group">
              <label htmlFor="relationship_type">Relationship *</label>
              <select
                id="relationship_type"
                name="relationship_type"
                value={formData.relationship_type}
                onChange={handleChange}
                required
              >
                {Object.values(RelationshipType).map(type => (
                  <option key={type} value={type}>
                    {getRelationshipIcon(type)} {type}
                  </option>
                ))}
              </select>
              <small className="form-help">
                Relationship to the entity
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="date_of_birth">Date of Birth</label>
              <input
                type="date"
                id="date_of_birth"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
              />
              <small className="form-help">
                Optional - helps with age calculation
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john@example.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="address">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="123 Main St, City, State 12345"
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Additional notes about this family member..."
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="primary_contact"
                  checked={formData.primary_contact}
                  onChange={handleChange}
                />
                Primary Contact
              </label>
              <small className="form-help">
                Designate as the main point of contact for this entity
              </small>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                Active Member
              </label>
              <small className="form-help">
                Inactive members are hidden by default but information is preserved
              </small>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Updating...' : 'Update Family Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFamilyMemberModal;