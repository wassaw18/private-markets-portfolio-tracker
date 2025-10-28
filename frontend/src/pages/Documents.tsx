import React, { useState, useEffect, useCallback } from 'react';
import { documentAPI } from '../services/api';
import { Document, DocumentFilters, DocumentStatistics } from '../types/document';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import ComponentErrorBoundary from '../components/ComponentErrorBoundary';
import DocumentsList from '../components/DocumentsList';
import DocumentUploadModal from '../components/DocumentUploadModal';
import DocumentFilterPanel from '../components/DocumentFilterPanel';
import DocumentStatisticsPanel from '../components/DocumentStatisticsPanel';
import '../styles/luxury-design-system.css';
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
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const fetchDocuments = useCallback(async (filters: DocumentFilters = {}) => {
    try {
      setLoading(true);
      const data = await documentAPI.getDocuments(0, 1000, filters, false);
      setDocuments(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching documents:', err);

      // Check for specific error types
      if (err.response) {
        // Server responded with error status
        const status = err.response.status;
        if (status === 404) {
          // 404 means endpoint not found or no documents exist
          setError('Document service not available. Please check your configuration.');
        } else if (status === 401 || status === 403) {
          setError('You are not authorized to view documents. Please check your login status.');
        } else if (status >= 500) {
          setError('Server error occurred while fetching documents. Please try again later.');
        } else {
          setError(`Failed to fetch documents (Error ${status}). Please try again.`);
        }
      } else if (err.request) {
        // Request was made but no response received (network error, backend down)
        setError('Unable to connect to the server. Please check if the backend is running and try again.');
      } else {
        // Something else happened
        setError('An unexpected error occurred while fetching documents. Please try again.');
      }
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
    } catch (err: any) {
      console.error('Error deleting document:', err);

      if (err.response) {
        const status = err.response.status;
        if (status === 404) {
          setError('Document not found. It may have already been deleted.');
        } else if (status === 401 || status === 403) {
          setError('You are not authorized to delete this document.');
        } else if (status >= 500) {
          setError('Server error occurred while deleting document. Please try again later.');
        } else {
          setError(`Failed to delete document (Error ${status}). Please try again.`);
        }
      } else if (err.request) {
        setError('Unable to connect to the server to delete document. Please check if the backend is running.');
      } else {
        setError('An unexpected error occurred while deleting document. Please try again.');
      }
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

  const handleTemplateDownload = async (templateType: string) => {
    try {
      let downloadUrl = '';
      let fileName = '';

      switch (templateType) {
        case 'entities':
          downloadUrl = '/api/templates/entity-template';
          fileName = 'Entity_Upload_Template.xlsx';
          break;
        case 'investments':
          downloadUrl = '/api/templates/investment-template';
          fileName = 'Investment_Upload_Template.xlsx';
          break;
        case 'navs':
          downloadUrl = '/api/templates/nav-template';
          fileName = 'NAV_Upload_Template.xlsx';
          break;
        case 'cashflows':
          downloadUrl = '/api/templates/cashflow-template';
          fileName = 'CashFlow_Upload_Template.xlsx';
          break;
        default:
          throw new Error(`Unknown template type: ${templateType}`);
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download template: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setShowTemplateSelector(false);
    } catch (error: any) {
      console.error('Error downloading template:', error);

      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          setError('Template not found. Please check your template configuration.');
        } else if (status === 401 || status === 403) {
          setError('You are not authorized to download templates.');
        } else if (status >= 500) {
          setError('Server error occurred while downloading template. Please try again later.');
        } else {
          setError(`Failed to download template (Error ${status}). Please try again.`);
        }
      } else if (error.request) {
        setError('Unable to connect to the server to download template. Please check if the backend is running.');
      } else {
        setError(`Failed to download template: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleBulkUpload = (uploadType: string) => {
    // Create file input for the specific upload type
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Here you would handle the upload - for now we'll just log it
        console.log(`Uploading ${uploadType} file:`, file.name);
        // TODO: Implement actual upload logic similar to BulkUpload component
        alert(`Upload functionality for ${uploadType} will be implemented soon!`);
      }
    };
    input.click();
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
    } catch (err: any) {
      console.error('Error searching documents:', err);

      if (err.response) {
        const status = err.response.status;
        if (status === 404) {
          setError('Search service not available. Please check your configuration.');
        } else if (status === 401 || status === 403) {
          setError('You are not authorized to search documents. Please check your login status.');
        } else if (status >= 500) {
          setError('Server error occurred during search. Please try again later.');
        } else {
          setError(`Search failed (Error ${status}). Please try again.`);
        }
      } else if (err.request) {
        setError('Unable to connect to the server for search. Please check if the backend is running.');
      } else {
        setError('An unexpected error occurred during search. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && documents.length === 0) {
    return <div className="documents-container"><div className="loading">Loading...</div></div>;
  }

  return (
    <>
      <div className="luxury-card page-header">
        <h1 className="luxury-heading-1">Document Management</h1>
      </div>

      <div className="luxury-card">
        <div className="documents-header">
          <div className="header-content">
            <h3 className="luxury-heading-3">Document Library</h3>
            <p className="luxury-body">Upload and search through your document collection</p>
          </div>
          <button
            className="luxury-button"
            onClick={() => setShowUploadModal(true)}
          >
            📁 Upload Document
          </button>
        </div>
      </div>

      {error && (
        <div className="luxury-card" style={{ marginTop: 'var(--space-lg)', borderLeft: '4px solid #dc3545' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
            <span style={{ fontSize: '1.5rem', color: '#dc3545' }}>⚠️</span>
            <div>
              <h4 style={{ color: '#dc3545', margin: '0 0 var(--space-sm) 0' }}>
                {error.includes('not available') || error.includes('not found') ? 'Service Issue' :
                 error.includes('not authorized') ? 'Authorization Error' :
                 error.includes('Unable to connect') ? 'Connection Error' :
                 error.includes('Server error') ? 'Server Error' : 'Error'}
              </h4>
              <p style={{ margin: 0 }}>{error}</p>
              {error.includes('no documents') ? (
                <p style={{ marginTop: 'var(--space-sm)', fontStyle: 'italic', color: '#666' }}>
                  This is normal for a new system. Try uploading your first document to get started.
                </p>
              ) : error.includes('backend is running') ? (
                <p style={{ marginTop: 'var(--space-sm)', fontStyle: 'italic', color: '#666' }}>
                  Please ensure the backend service is started and accessible.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

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

      {/* Bulk Upload Section */}
      <div className="luxury-card" style={{ marginTop: 'var(--space-xl)' }}>
        <div className="documents-header">
          <div className="header-content">
            <h3 className="luxury-heading-3">Bulk Data Upload</h3>
            <p className="luxury-body">Upload structured data files for investments, entities, NAVs, and cash flows</p>
          </div>
          <button
            className="luxury-button-secondary"
            onClick={() => setShowTemplateSelector(!showTemplateSelector)}
          >
            📥 Download Templates
          </button>
        </div>

        {showTemplateSelector && (
          <div className="template-selector" style={{ marginTop: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
            <h4 className="luxury-heading-4">Select Template to Download:</h4>
            <div className="template-options">
              <button className="template-option" onClick={() => handleTemplateDownload('entities')}>
                🏢 Entity Upload Template
              </button>
              <button className="template-option" onClick={() => handleTemplateDownload('investments')}>
                💼 Investment Portfolio Template
              </button>
              <button className="template-option" onClick={() => handleTemplateDownload('navs')}>
                📈 NAV & Valuations Template
              </button>
              <button className="template-option" onClick={() => handleTemplateDownload('cashflows')}>
                💰 Cash Flow Data Template
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div className="bulk-upload-preview">
            <div className="upload-categories">
              <div className="upload-category-item" onClick={() => handleBulkUpload('entities')}>
                <span className="category-icon">🏢</span>
                <div>
                  <div className="category-title">Entity Management</div>
                  <div className="category-description">Upload entities (Trusts, LLCs, Individuals)</div>
                </div>
                <span className="upload-action">📤</span>
              </div>
              <div className="upload-category-item" onClick={() => handleBulkUpload('investments')}>
                <span className="category-icon">💼</span>
                <div>
                  <div className="category-title">Investment Portfolio</div>
                  <div className="category-description">Upload investment data with 32-field validation</div>
                </div>
                <span className="upload-action">📤</span>
              </div>
              <div className="upload-category-item" onClick={() => handleBulkUpload('navs')}>
                <span className="category-icon">📈</span>
                <div>
                  <div className="category-title">NAV & Valuations</div>
                  <div className="category-description">Upload Net Asset Value updates and valuations</div>
                </div>
                <span className="upload-action">📤</span>
              </div>
              <div className="upload-category-item" onClick={() => handleBulkUpload('cashflows')}>
                <span className="category-icon">💰</span>
                <div>
                  <div className="category-title">Cash Flow Data</div>
                  <div className="category-description">Upload capital calls, distributions, and transactions</div>
                </div>
                <span className="upload-action">📤</span>
              </div>
            </div>
          </div>
        </div>
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
    </>
  );
};

export default Documents;