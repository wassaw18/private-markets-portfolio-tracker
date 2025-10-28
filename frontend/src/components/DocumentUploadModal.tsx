import React, { useState, useRef, useEffect } from 'react';
import { DocumentCategory, DocumentStatus, DocumentUploadForm, DocumentCategoryGroup, getCategoryGroup } from '../types/document';
import { validateDocument, ValidationResult } from '../utils/validation';
import { useAuth } from '../contexts/AuthContext';
import { documentAPI } from '../services/api';
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
    category_group: DocumentCategoryGroup.OTHER,
    status: DocumentStatus.PENDING_REVIEW,
    document_date: '',
    due_date: '',
    investment_id: null,
    entity_id: null,
    is_confidential: false,
    uploaded_by: authState.user?.username || '',
    tags: '',
    document_metadata: {}
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

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value as DocumentCategory;
    setFormData(prev => ({
      ...prev,
      category: newCategory,
      category_group: getCategoryGroup(newCategory),
      document_metadata: {} // Reset metadata when category changes
    }));
  };

  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      document_metadata: {
        ...prev.document_metadata,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }
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
      uploadData.append('category_group', formData.category_group);
      uploadData.append('status', formData.status);

      if (formData.description) uploadData.append('description', formData.description);
      if (formData.document_date) uploadData.append('document_date', formData.document_date);
      if (formData.due_date) uploadData.append('due_date', formData.due_date);
      if (formData.investment_id) uploadData.append('investment_id', formData.investment_id.toString());
      if (formData.entity_id) uploadData.append('entity_id', formData.entity_id.toString());
      if (formData.uploaded_by) uploadData.append('uploaded_by', formData.uploaded_by);
      if (formData.tags) uploadData.append('tags', formData.tags);

      // Add document metadata as JSON string if not empty
      if (Object.keys(formData.document_metadata).length > 0) {
        uploadData.append('document_metadata', JSON.stringify(formData.document_metadata));
      }

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
                  onChange={handleCategoryChange}
                  required
                >
                  <optgroup label="━━━ TAX DOCUMENTS ━━━">
                    <option value={DocumentCategory.K1}>{DocumentCategory.K1}</option>
                    <option value={DocumentCategory.FORM_1099}>{DocumentCategory.FORM_1099}</option>
                    <option value={DocumentCategory.W9}>{DocumentCategory.W9}</option>
                    <option value={DocumentCategory.W2}>{DocumentCategory.W2}</option>
                    <option value={DocumentCategory.OTHER_TAX_DOCUMENT}>{DocumentCategory.OTHER_TAX_DOCUMENT}</option>
                  </optgroup>

                  <optgroup label="━━━ NOTICES & STATEMENTS ━━━">
                    <option value={DocumentCategory.CAPITAL_CALL}>{DocumentCategory.CAPITAL_CALL}</option>
                    <option value={DocumentCategory.DISTRIBUTION_NOTICE}>{DocumentCategory.DISTRIBUTION_NOTICE}</option>
                    <option value={DocumentCategory.CONTRIBUTION_NOTICE}>{DocumentCategory.CONTRIBUTION_NOTICE}</option>
                    <option value={DocumentCategory.RETURN_OF_CAPITAL}>{DocumentCategory.RETURN_OF_CAPITAL}</option>
                    <option value={DocumentCategory.NAV_STATEMENT}>{DocumentCategory.NAV_STATEMENT}</option>
                    <option value={DocumentCategory.GP_CORRESPONDENCE}>{DocumentCategory.GP_CORRESPONDENCE}</option>
                    <option value={DocumentCategory.INVESTOR_UPDATE}>{DocumentCategory.INVESTOR_UPDATE}</option>
                    <option value={DocumentCategory.NOTICE}>{DocumentCategory.NOTICE}</option>
                    <option value={DocumentCategory.MEETING_MINUTES}>{DocumentCategory.MEETING_MINUTES}</option>
                  </optgroup>

                  <optgroup label="━━━ PERFORMANCE ━━━">
                    <option value={DocumentCategory.PERFORMANCE_REPORT}>{DocumentCategory.PERFORMANCE_REPORT}</option>
                  </optgroup>

                  <optgroup label="━━━ LEGAL DOCUMENTS ━━━">
                    <option value={DocumentCategory.LEGAL_DOCUMENT}>{DocumentCategory.LEGAL_DOCUMENT}</option>
                    <option value={DocumentCategory.SIDE_LETTER}>{DocumentCategory.SIDE_LETTER}</option>
                    <option value={DocumentCategory.SUBSCRIPTION_DOCUMENT}>{DocumentCategory.SUBSCRIPTION_DOCUMENT}</option>
                    <option value={DocumentCategory.PARTNERSHIP_AGREEMENT}>{DocumentCategory.PARTNERSHIP_AGREEMENT}</option>
                    <option value={DocumentCategory.OPERATING_AGREEMENT}>{DocumentCategory.OPERATING_AGREEMENT}</option>
                    <option value={DocumentCategory.AMENDMENT}>{DocumentCategory.AMENDMENT}</option>
                  </optgroup>

                  <optgroup label="━━━ FINANCIAL STATEMENTS ━━━">
                    <option value={DocumentCategory.FINANCIAL_STATEMENT}>{DocumentCategory.FINANCIAL_STATEMENT}</option>
                    <option value={DocumentCategory.AUDITED_FINANCIALS}>{DocumentCategory.AUDITED_FINANCIALS}</option>
                    <option value={DocumentCategory.BALANCE_SHEET}>{DocumentCategory.BALANCE_SHEET}</option>
                    <option value={DocumentCategory.INCOME_STATEMENT}>{DocumentCategory.INCOME_STATEMENT}</option>
                    <option value={DocumentCategory.CASH_FLOW_STATEMENT}>{DocumentCategory.CASH_FLOW_STATEMENT}</option>
                  </optgroup>

                  <optgroup label="━━━ INVESTMENT DOCUMENTS ━━━">
                    <option value={DocumentCategory.INVESTMENT_MEMO}>{DocumentCategory.INVESTMENT_MEMO}</option>
                    <option value={DocumentCategory.DUE_DILIGENCE_REPORT}>{DocumentCategory.DUE_DILIGENCE_REPORT}</option>
                    <option value={DocumentCategory.VALUATION_REPORT}>{DocumentCategory.VALUATION_REPORT}</option>
                    <option value={DocumentCategory.APPRAISAL}>{DocumentCategory.APPRAISAL}</option>
                    <option value={DocumentCategory.OTHER_DILIGENCE_ITEM}>{DocumentCategory.OTHER_DILIGENCE_ITEM}</option>
                  </optgroup>

                  <optgroup label="━━━ OTHER ━━━">
                    <option value={DocumentCategory.OTHER}>{DocumentCategory.OTHER}</option>
                  </optgroup>
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

          {/* Category-Specific Metadata */}
          {formData.category_group === DocumentCategoryGroup.TAX_DOCUMENTS && (
            <div className="form-section">
              <label className="section-label">Tax Document Details</label>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="tax_year">Tax Year</label>
                  <input
                    type="text"
                    id="tax_year"
                    name="tax_year"
                    value={formData.document_metadata.tax_year || ''}
                    onChange={handleMetadataChange}
                    placeholder="e.g., 2024"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="document_type">Document Type</label>
                  <input
                    type="text"
                    id="document_type"
                    name="document_type"
                    value={formData.document_metadata.document_type || ''}
                    onChange={handleMetadataChange}
                    placeholder="e.g., Final, Amended"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="filing_status">Filing Status</label>
                  <select
                    id="filing_status"
                    name="filing_status"
                    value={formData.document_metadata.filing_status || ''}
                    onChange={handleMetadataChange}
                  >
                    <option value="">Select status...</option>
                    <option value="Single">Single</option>
                    <option value="Married Filing Jointly">Married Filing Jointly</option>
                    <option value="Married Filing Separately">Married Filing Separately</option>
                    <option value="Head of Household">Head of Household</option>
                  </select>
                </div>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="is_amendment"
                      checked={formData.document_metadata.is_amendment || false}
                      onChange={handleMetadataChange}
                    />
                    <span>This is an amended return</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {formData.category_group === DocumentCategoryGroup.NOTICES_AND_STATEMENTS && (
            <div className="form-section">
              <label className="section-label">Notice & Statement Details</label>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="statement_notice_date">Notice Date</label>
                  <input
                    type="date"
                    id="statement_notice_date"
                    name="statement_notice_date"
                    value={formData.document_metadata.statement_notice_date || ''}
                    onChange={handleMetadataChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="amount">Amount</label>
                  <input
                    type="text"
                    id="amount"
                    name="amount"
                    value={formData.document_metadata.amount || ''}
                    onChange={handleMetadataChange}
                    placeholder="e.g., $50,000"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="from_sender">From/Sender</label>
                  <input
                    type="text"
                    id="from_sender"
                    name="from_sender"
                    value={formData.document_metadata.from_sender || ''}
                    onChange={handleMetadataChange}
                    placeholder="GP or fund name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="subject">Subject</label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.document_metadata.subject || ''}
                    onChange={handleMetadataChange}
                    placeholder="Brief subject"
                  />
                </div>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="response_required"
                      checked={formData.document_metadata.response_required || false}
                      onChange={handleMetadataChange}
                    />
                    <span>Response required</span>
                  </label>
                </div>
                {formData.document_metadata.response_required && (
                  <div className="form-group">
                    <label htmlFor="response_due_date">Response Due Date</label>
                    <input
                      type="date"
                      id="response_due_date"
                      name="response_due_date"
                      value={formData.document_metadata.response_due_date || ''}
                      onChange={handleMetadataChange}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {formData.category_group === DocumentCategoryGroup.PERFORMANCE && (
            <div className="form-section">
              <label className="section-label">Performance Report Details</label>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="report_period">Report Period</label>
                  <input
                    type="text"
                    id="report_period"
                    name="report_period"
                    value={formData.document_metadata.report_period || ''}
                    onChange={handleMetadataChange}
                    placeholder="e.g., Q1 2024, 2024 Annual"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="as_of_date">As Of Date</label>
                  <input
                    type="date"
                    id="as_of_date"
                    name="as_of_date"
                    value={formData.document_metadata.as_of_date || ''}
                    onChange={handleMetadataChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="report_type">Report Type</label>
                  <select
                    id="report_type"
                    name="report_type"
                    value={formData.document_metadata.report_type || ''}
                    onChange={handleMetadataChange}
                  >
                    <option value="">Select type...</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Annual">Annual</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Ad Hoc">Ad Hoc</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {formData.category_group === DocumentCategoryGroup.LEGAL_DOCUMENTS && (
            <div className="form-section">
              <label className="section-label">Legal Document Details</label>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="effective_date">Effective Date</label>
                  <input
                    type="date"
                    id="effective_date"
                    name="effective_date"
                    value={formData.document_metadata.effective_date || ''}
                    onChange={handleMetadataChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="parties_involved">Parties Involved</label>
                  <input
                    type="text"
                    id="parties_involved"
                    name="parties_involved"
                    value={formData.document_metadata.parties_involved || ''}
                    onChange={handleMetadataChange}
                    placeholder="e.g., Entity A, Entity B"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="document_version">Document Version</label>
                  <input
                    type="text"
                    id="document_version"
                    name="document_version"
                    value={formData.document_metadata.document_version || ''}
                    onChange={handleMetadataChange}
                    placeholder="e.g., v2.1, Final"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="supersedes">Supersedes</label>
                  <input
                    type="text"
                    id="supersedes"
                    name="supersedes"
                    value={formData.document_metadata.supersedes || ''}
                    onChange={handleMetadataChange}
                    placeholder="Previous version reference"
                  />
                </div>
              </div>
            </div>
          )}

          {formData.category_group === DocumentCategoryGroup.FINANCIAL_STATEMENTS && (
            <div className="form-section">
              <label className="section-label">Financial Statement Details</label>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="period_end_date">Period End Date</label>
                  <input
                    type="date"
                    id="period_end_date"
                    name="period_end_date"
                    value={formData.document_metadata.period_end_date || ''}
                    onChange={handleMetadataChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="fiscal_year">Fiscal Year</label>
                  <input
                    type="text"
                    id="fiscal_year"
                    name="fiscal_year"
                    value={formData.document_metadata.fiscal_year || ''}
                    onChange={handleMetadataChange}
                    placeholder="e.g., FY2024"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="auditor_name">Auditor Name</label>
                  <input
                    type="text"
                    id="auditor_name"
                    name="auditor_name"
                    value={formData.document_metadata.auditor_name || ''}
                    onChange={handleMetadataChange}
                    placeholder="Auditing firm name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="audit_status">Audit Status</label>
                  <select
                    id="audit_status"
                    name="audit_status"
                    value={formData.document_metadata.audit_status || ''}
                    onChange={handleMetadataChange}
                  >
                    <option value="">Select status...</option>
                    <option value="Audited">Audited</option>
                    <option value="Reviewed">Reviewed</option>
                    <option value="Compiled">Compiled</option>
                    <option value="Unaudited">Unaudited</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {formData.category_group === DocumentCategoryGroup.INVESTMENT_DOCUMENTS && (
            <div className="form-section">
              <label className="section-label">Investment Document Details</label>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="valuation_date">Valuation Date</label>
                  <input
                    type="date"
                    id="valuation_date"
                    name="valuation_date"
                    value={formData.document_metadata.valuation_date || ''}
                    onChange={handleMetadataChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="prepared_by">Prepared By</label>
                  <input
                    type="text"
                    id="prepared_by"
                    name="prepared_by"
                    value={formData.document_metadata.prepared_by || ''}
                    onChange={handleMetadataChange}
                    placeholder="Firm or individual name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="valuation_method">Valuation Method</label>
                  <input
                    type="text"
                    id="valuation_method"
                    name="valuation_method"
                    value={formData.document_metadata.valuation_method || ''}
                    onChange={handleMetadataChange}
                    placeholder="e.g., DCF, Market Comp"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="asset_investment_reference">Asset/Investment Reference</label>
                  <input
                    type="text"
                    id="asset_investment_reference"
                    name="asset_investment_reference"
                    value={formData.document_metadata.asset_investment_reference || ''}
                    onChange={handleMetadataChange}
                    placeholder="Reference to specific asset"
                  />
                </div>
              </div>
            </div>
          )}

          {formData.category_group === DocumentCategoryGroup.OTHER && (
            <div className="form-section">
              <label className="section-label">Other Document Details</label>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="custom_category">Custom Category</label>
                  <input
                    type="text"
                    id="custom_category"
                    name="custom_category"
                    value={formData.document_metadata.custom_category || ''}
                    onChange={handleMetadataChange}
                    placeholder="Describe the document type"
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="document_purpose">Document Purpose</label>
                  <textarea
                    id="document_purpose"
                    name="document_purpose"
                    value={formData.document_metadata.document_purpose || ''}
                    onChange={handleMetadataChange}
                    placeholder="Explain the purpose of this document"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

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