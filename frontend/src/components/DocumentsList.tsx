import React, { useState, useCallback, useMemo } from 'react';
import { Document } from '../types/document';
import { documentAPI } from '../services/api';
import { formatFileSize, formatDate, getFileTypeIcon, getDocumentCategoryColor, getDocumentStatusColor } from '../utils/formatters';
import DocumentCard from './DocumentCard';
import EditDocumentModal from './EditDocumentModal';
import './DocumentsList.css';

interface Props {
  documents: Document[];
  onDelete: (id: number) => void;
  onUpdate: () => void;
  loading: boolean;
}

const DocumentsList: React.FC<Props> = ({ documents, onDelete, onUpdate, loading }) => {
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());

  const handleDownload = useCallback(async (doc: Document) => {
    if (downloadingIds.has(doc.id)) return;

    try {
      setDownloadingIds(prev => new Set(prev).add(doc.id));
      
      const blob = await documentAPI.downloadDocument(doc.id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.original_filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
      alert('Failed to download document');
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  }, [downloadingIds]);

  const handleDelete = useCallback(async (doc: Document) => {
    const confirmMessage = `Are you sure you want to archive "${doc.title}"? This action can be undone.`;
    if (window.confirm(confirmMessage)) {
      onDelete(doc.id);
    }
  }, [onDelete]);

  const handleEdit = useCallback((doc: Document) => {
    setEditingDocument(doc);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditingDocument(null);
    onUpdate();
  }, [onUpdate]);






  if (loading) {
    return (
      <div className="documents-loading">
        <div className="loading-spinner"></div>
        <p>Loading documents...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📁</div>
        <h3>No documents found</h3>
        <p>Upload your first document to get started with document management.</p>
      </div>
    );
  }

  return (
    <>
      <div className="documents-list">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onDownload={() => handleDownload(doc)}
            onEdit={() => handleEdit(doc)}
            onDelete={() => handleDelete(doc)}
            isDownloading={downloadingIds.has(doc.id)}
            getFileTypeIcon={getFileTypeIcon}
            getCategoryColor={getDocumentCategoryColor}
            getStatusColor={getDocumentStatusColor}
            formatFileSize={formatFileSize}
            formatDate={formatDate}
          />
        ))}
      </div>

      {editingDocument && (
        <EditDocumentModal
          document={editingDocument}
          onSuccess={handleEditSuccess}
          onCancel={() => setEditingDocument(null)}
        />
      )}
    </>
  );
};

export default DocumentsList;