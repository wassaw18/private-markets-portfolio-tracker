import React from 'react';
import { Document } from '../types/document';
import './DocumentCard.css';

interface Props {
  document: Document;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDownloading: boolean;
  getFileTypeIcon: (mimeType: string) => string;
  getCategoryColor: (category: string) => string;
  getStatusColor: (status: string) => string;
  formatFileSize: (bytes: number) => string;
  formatDate: (dateString?: string) => string;
}

const DocumentCard: React.FC<Props> = ({
  document: doc,
  onDownload,
  onEdit,
  onDelete,
  isDownloading,
  getFileTypeIcon,
  getCategoryColor,
  getStatusColor,
  formatFileSize,
  formatDate
}) => {
  const isOverdue = doc.due_date && new Date(doc.due_date) < new Date() && doc.status !== 'Archived';

  return (
    <div className={`document-card ${isOverdue ? 'overdue' : ''} ${doc.is_confidential ? 'confidential' : ''}`}>
      {/* Header */}
      <div className="document-header">
        <div className="document-title-section">
          <span className="file-type-icon">
            {getFileTypeIcon(doc.mime_type)}
          </span>
          <div className="title-info">
            <h3 className="document-title">{doc.title}</h3>
            <p className="document-filename">{doc.original_filename}</p>
          </div>
        </div>
        
        <div className="document-badges">
          <span 
            className="category-badge"
            style={{ backgroundColor: getCategoryColor(doc.category) }}
          >
            {doc.category}
          </span>
          <span 
            className="status-badge"
            style={{ backgroundColor: getStatusColor(doc.status) }}
          >
            {doc.status}
          </span>
          {doc.is_confidential && (
            <span className="confidential-badge">🔒 Confidential</span>
          )}
          {isOverdue && (
            <span className="overdue-badge">⚠️ Overdue</span>
          )}
        </div>
      </div>

      {/* Description */}
      {doc.description && (
        <div className="document-description">
          <p>{doc.description}</p>
        </div>
      )}

      {/* Details */}
      <div className="document-details">
        <div className="detail-row">
          <span className="detail-label">File Size:</span>
          <span className="detail-value">{formatFileSize(doc.file_size)}</span>
        </div>
        
        {doc.document_date && (
          <div className="detail-row">
            <span className="detail-label">Document Date:</span>
            <span className="detail-value">{formatDate(doc.document_date)}</span>
          </div>
        )}
        
        {doc.due_date && (
          <div className="detail-row">
            <span className="detail-label">Due Date:</span>
            <span className={`detail-value ${isOverdue ? 'overdue-text' : ''}`}>
              {formatDate(doc.due_date)}
            </span>
          </div>
        )}

        <div className="detail-row">
          <span className="detail-label">Uploaded:</span>
          <span className="detail-value">
            {formatDate(doc.created_date)}
            {doc.uploaded_by && ` by ${doc.uploaded_by}`}
          </span>
        </div>
      </div>

      {/* Relationships */}
      {(doc.investment || doc.entity) && (
        <div className="document-relationships">
          {doc.investment && (
            <div className="relationship-item">
              <span className="relationship-label">Investment:</span>
              <span className="relationship-value">
                {doc.investment.name} ({doc.investment.asset_class})
              </span>
            </div>
          )}
          {doc.entity && (
            <div className="relationship-item">
              <span className="relationship-label">Entity:</span>
              <span className="relationship-value">
                {doc.entity.name} ({doc.entity.entity_type})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {doc.tags && doc.tags.length > 0 && (
        <div className="document-tags">
          {doc.tags.map((tag) => (
            <span 
              key={tag.id} 
              className="document-tag"
              style={{ backgroundColor: tag.color || '#007bff' }}
            >
              {tag.tag_name}
            </span>
          ))}
        </div>
      )}

      {/* Notes */}
      {doc.notes && (
        <div className="document-notes">
          <span className="notes-label">Notes:</span>
          <p className="notes-text">{doc.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="document-actions">
        <button
          onClick={onDownload}
          disabled={isDownloading}
          className="action-button download-button"
          title="Download Document"
        >
          {isDownloading ? (
            <>⏳ Downloading...</>
          ) : (
            <>📥 Download</>
          )}
        </button>
        
        <button
          onClick={onEdit}
          className="action-button edit-button"
          title="Edit Document Details"
        >
          ✏️ Edit
        </button>
        
        <button
          onClick={onDelete}
          className="action-button delete-button"
          title="Archive Document"
        >
          🗄️ Archive
        </button>
      </div>
    </div>
  );
};

export default DocumentCard;