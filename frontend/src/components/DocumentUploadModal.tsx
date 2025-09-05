import React, { useState, useRef, useEffect } from 'react';
import { DocumentCategory, DocumentStatus, DocumentUploadForm } from '../types/document';
import { documentAPI, entityAPI, investmentAPI } from '../services/api';
import { validateDocument, ValidationResult } from '../utils/validation';
import { useAuth } from '../contexts/AuthContext';
import EntitySelector from './EntitySelector';
import './DocumentUploadModal.css';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

const DocumentUploadModal: React.FC<Props> = ({ onSuccess, onCancel }) => {
  const { authState } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<DocumentUploadForm>({
    file: null,
    title: '',
    description: '',
    category: DocumentCategory.OTHER,
    status: DocumentStatus.PENDING_REVIEW,
    document_date: '',
    due_date: '',
    investment_id: null,
    entity_id: null,
    is_confidential: false,
    uploaded_by: authState.user?.username || '',
    tags: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (authState.user?.username) {
      setFormData(prev => ({ ...prev, uploaded_by: authState.user!.username }));
    }
  }, [authState.user]);
  const [dragActive, setDragActive] = useState(false);

  const validateForm = (): ValidationResult => {
    return validateDocument({
      title: formData.title,
      category: formData.category,
      file: formData.file,
      investment_id: formData.investment_id || undefined,
      entity_id: formData.entity_id || undefined,
      document_date: formData.document_date,
      due_date: formData.due_date
    });
  };

  const handleFileSelect = (file: File) => {
    setFormData(prev => ({
      ...prev,
      file,
      title: prev.title || file.name.replace(/\.[^/.]+$/, '') // Remove extension for title
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

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
      investment_id: entityId ? null : prev.investment_id // Clear investment if entity is selected
    }));
  };

  const handleInvestmentChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const investmentId = e.target.value ? parseInt(e.target.value) : null;
    setFormData(prev => ({
      ...prev,
      investment_id: investmentId,
      entity_id: investmentId ? null : prev.entity_id // Clear entity if investment is selected
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateForm();
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Clear validation errors on successful validation
    setValidationErrors([]);

    setLoading(true);
    setError(null);

    try {
      // Create FormData for file upload
      const uploadData = new FormData();
      uploadData.append('file', formData.file!);
      uploadData.append('title', formData.title);
      uploadData.append('category', formData.category);
      uploadData.append('status', formData.status);
      
      if (formData.description) uploadData.append('description', formData.description);
      if (formData.document_date) uploadData.append('document_date', formData.document_date);
      if (formData.due_date) uploadData.append('due_date', formData.due_date);
      if (formData.investment_id) uploadData.append('investment_id', formData.investment_id.toString());
      if (formData.entity_id) uploadData.append('entity_id', formData.entity_id.toString());
      if (formData.uploaded_by) uploadData.append('uploaded_by', formData.uploaded_by);
      if (formData.tags) uploadData.append('tags', formData.tags);
      
      uploadData.append('is_confidential', formData.is_confidential.toString());

      await documentAPI.uploadDocument(uploadData);
      onSuccess();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      if (err.response?.status === 409) {
        setError('A document with identical content already exists.');
      } else {
        setError(err.response?.data?.detail || 'Failed to upload document. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content upload-modal">
        <div className="modal-header">
          <h3>Upload Document</h3>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {validationErrors.length > 0 && (
          <div className="validation-errors">
            <h4>Please fix the following errors:</h4>
            <ul>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="upload-form">
          {/* File Upload Section */}
          <div className="form-section">
            <label className="section-label">Select File</label>
            <div 
              className={`file-drop-zone ${dragActive ? 'drag-active' : ''} ${formData.file ? 'has-file' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {formData.file ? (
                <div className="file-selected">
                  <span className="file-icon">📎</span>
                  <div className="file-info">
                    <div className="file-name">{formData.file.name}</div>
                    <div className="file-size">{formatFileSize(formData.file.size)}</div>
                  </div>
                  <button 
                    type="button" 
                    className="remove-file-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, file: null, title: '' }));
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="file-drop-prompt">
                  <span className="upload-icon">📁</span>
                  <p>Drop a file here or click to browse</p>
                  <small>Supports PDF, DOC, XLS, PPT, TXT, CSV and more</small>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.rtf,.html,.htm"
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Document Details */}
          <div className="form-section">
            <label className="section-label">Document Details</label>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="title">Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter document title"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
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
                  value={formData.status}
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
                  value={formData.document_date}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="due_date">Due Date</label>
                <input
                  type="date"
                  id="due_date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="uploaded_by">Uploaded By</label>
                <input
                  type="text"
                  id="uploaded_by"
                  name="uploaded_by"
                  value={formData.uploaded_by}
                  readOnly
                  disabled
                  placeholder="Auto-populated from login"
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter document description..."
                rows={3}
              />
            </div>
          </div>

          {/* Associations */}
          <div className="form-section">
            <label className="section-label">Associations *</label>
            <p className="section-help">Associate this document with either an entity or investment (required)</p>
            
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="entity">Entity</label>
                <EntitySelector
                  value={formData.entity_id || null}
                  onChange={handleEntityChange}
                  className="entity-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="investment">Investment</label>
                <select
                  id="investment"
                  name="investment_id"
                  value={formData.investment_id || ''}
                  onChange={handleInvestmentChange}
                  disabled={!!formData.entity_id}
                >
                  <option value="">Select an investment...</option>
                  {/* Investment options would be loaded here */}
                </select>
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="form-section">
            <label className="section-label">Additional Options</label>
            
            <div className="form-group">
              <label htmlFor="tags">Tags</label>
              <input
                type="text"
                id="tags"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="Enter tags separated by commas (e.g., urgent, quarterly, confidential)"
              />
              <small className="form-help">Separate multiple tags with commas</small>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_confidential"
                  checked={formData.is_confidential}
                  onChange={handleInputChange}
                />
                <span>Mark as confidential</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentUploadModal;