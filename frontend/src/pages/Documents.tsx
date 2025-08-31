import React, { useState, useEffect, useCallback } from 'react';
import { documentAPI } from '../services/api';
import { Document, DocumentFilters, DocumentStatistics } from '../types/document';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import ComponentErrorBoundary from '../components/ComponentErrorBoundary';
import DocumentsList from '../components/DocumentsList';
import DocumentUploadModal from '../components/DocumentUploadModal';
import DocumentFilterPanel from '../components/DocumentFilterPanel';
import DocumentStatisticsPanel from '../components/DocumentStatisticsPanel';
import './Documents.css';

const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<DocumentFilters>({});
  const [statistics, setStatistics] = useState<DocumentStatistics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);

  const fetchDocuments = useCallback(async (filters: DocumentFilters = {}) => {
    try {
      setLoading(true);
      const data = await documentAPI.getDocuments(0, 1000, filters, false);
      setDocuments(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch documents. Please check if the backend is running.');
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatistics = useCallback(async () => {
    try {
      const stats = await documentAPI.getStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchStatistics();
  }, [fetchDocuments, fetchStatistics]);

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    fetchDocuments(currentFilters);
    fetchStatistics();
  };

  const handleDeleteDocument = async (documentId: number) => {
    try {
      await documentAPI.deleteDocument(documentId, false); // Soft delete
      fetchDocuments(currentFilters);
      fetchStatistics();
    } catch (err) {
      setError('Failed to delete document');
      console.error('Error deleting document:', err);
    }
  };

  const handleUpdateDocument = () => {
    fetchDocuments(currentFilters);
    fetchStatistics();
  };

  const handleFiltersChange = (filters: DocumentFilters) => {
    setCurrentFilters(filters);
    setIsSearchMode(false);
    fetchDocuments(filters);
  };

  const handleClearFilters = () => {
    setCurrentFilters({});
    setSearchQuery('');
    setIsSearchMode(false);
    fetchDocuments({});
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setIsSearchMode(false);
      fetchDocuments(currentFilters);
      return;
    }

    try {
      setLoading(true);
      setSearchQuery(query);
      setIsSearchMode(true);
      const searchResults = await documentAPI.searchDocuments(query, 0, 100);
      
      // Extract documents from search results
      const searchedDocuments = searchResults.map(result => result.document);
      setDocuments(searchedDocuments);
      setError(null);
    } catch (err) {
      setError('Failed to search documents');
      console.error('Error searching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && documents.length === 0) {
    return <div className="documents-container"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="documents-container">
      <div className="documents-header">
        <div className="header-content">
          <h2>Document Management</h2>
          <p className="header-subtitle">
            Organize and manage your family office documents including capital calls, 
            K-1s, quarterly reports, and GP correspondence.
          </p>
        </div>
        <button 
          className="upload-button"
          onClick={() => setShowUploadModal(true)}
        >
          📁 Upload Document
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Statistics Panel */}
      <SectionErrorBoundary sectionName="Document Statistics">
        {statistics && (
          <DocumentStatisticsPanel 
            statistics={statistics} 
            onRefresh={fetchStatistics}
          />
        )}
      </SectionErrorBoundary>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search documents by title, content, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchQuery);
              }
            }}
            className="search-input"
          />
          <button 
            onClick={() => handleSearch(searchQuery)}
            className="search-button"
          >
            🔍 Search
          </button>
          {isSearchMode && (
            <button 
              onClick={handleClearFilters}
              className="clear-search-button"
            >
              ✕ Clear Search
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      <SectionErrorBoundary sectionName="Document Filters">
        <DocumentFilterPanel 
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
          resultCount={documents.length}
          isSearchMode={isSearchMode}
        />
      </SectionErrorBoundary>

      {/* Documents List */}
      <div className="documents-section">
        <h3>
          {isSearchMode ? (
            <>Search Results ({documents.length})</>
          ) : (
            <>Documents ({documents.length})</>
          )}
        </h3>
        <SectionErrorBoundary sectionName="Documents List">
          <DocumentsList 
            documents={documents}
            onDelete={handleDeleteDocument}
            onUpdate={handleUpdateDocument}
            loading={loading}
          />
        </SectionErrorBoundary>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <ComponentErrorBoundary componentName="Document Upload Modal">
          <DocumentUploadModal
            onSuccess={handleUploadSuccess}
            onCancel={() => setShowUploadModal(false)}
          />
        </ComponentErrorBoundary>
      )}
    </div>
  );
};

export default Documents;