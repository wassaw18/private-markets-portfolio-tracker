import React, { useState } from 'react';
import { Document, DocumentUpdate, DocumentCategory, DocumentStatus } from '../types/document';
import { documentAPI } from '../services/api';
import EntitySelector from './EntitySelector';
import './EditDocumentModal.css';

interface Props {
  document: Document;
  onSuccess: () => void;
  onCancel: () => void;
}

const EditDocumentModal: React.FC<Props> = ({ document: doc, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<DocumentUpdate>({
    title: doc.title,
    description: doc.description || '',
    category: doc.category,
    status: doc.status,
    document_date: doc.document_date || '',
    due_date: doc.due_date || '',
    investment_id: doc.investment_id,
    entity_id: doc.entity_id,
    is_confidential: doc.is_confidential,
    is_archived: doc.is_archived,
    notes: doc.notes || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleEntityChange = (entityId: number | null) => {
    setFormData(prev => ({
      ...prev,
      entity_id: entityId,
      investment_id: entityId ? null : prev.investment_id
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await documentAPI.updateDocument(doc.id, formData);
      onSuccess();
    } catch (err: any) {
      console.error('Error updating document:', err);
      setError(err.response?.data?.detail || 'Failed to update document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content edit-document-modal">
        <div className="modal-header">
          <h3>Edit Document</h3>
          <div className="document-info">
            <span className="file-name">{doc.original_filename}</span>
          </div>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-section">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="title">Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title || ''}
                  onChange={handleInputChange}
                  placeholder="Enter document title"
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category || ''}
                  onChange={handleInputChange}
                >
                  {Object.values(DocumentCategory).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || ''}
                  onChange={handleInputChange}
                >
                  {Object.values(DocumentStatus).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="document_date">Document Date</label>
                <input
                  type="date"
                  id="document_date"
                  name="document_date"
                  value={formData.document_date || ''}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="due_date">Due Date</label>
                <input
                  type="date"
                  id="due_date"
                  name="due_date"
                  value={formData.due_date || ''}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="entity">Entity</label>
                <EntitySelector
                  value={formData.entity_id || null}
                  onChange={handleEntityChange}
                  className="entity-input"
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description || ''}
                onChange={handleInputChange}
                placeholder="Enter document description..."
                rows={3}
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes || ''}
                onChange={handleInputChange}
                placeholder="Enter additional notes..."
                rows={2}
              />
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_confidential"
                  checked={formData.is_confidential || false}
                  onChange={handleInputChange}
                />
                <span>Mark as confidential</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_archived"
                  checked={formData.is_archived || false}
                  onChange={handleInputChange}
                />
                <span>Archive document</span>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Updating...' : 'Update Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDocumentModal;