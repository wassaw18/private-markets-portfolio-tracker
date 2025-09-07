import React, { useState, useCallback } from 'react';
import { importExportAPI, ImportResult } from '../services/api';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import './BulkUpload.css';

interface UploadSection {
  id: string;
  title: string;
  description: string;
  templateName: string;
  uploadEndpoint: string;
  icon: string;
}

const BulkUpload: React.FC = () => {
  const [uploadResults, setUploadResults] = useState<{[key: string]: ImportResult | null}>({});
  const [uploadLoading, setUploadLoading] = useState<{[key: string]: boolean}>({});
  const [uploadErrors, setUploadErrors] = useState<{[key: string]: string | null}>({});

  const uploadSections: UploadSection[] = [
    {
      id: 'entities',
      title: 'Entity Bulk Upload',
      description: 'Upload multiple entities (Trusts, LLCs, Individuals, etc.) for family office structure',
      templateName: 'Entity_Upload_Template.xlsx',
      uploadEndpoint: '/api/bulk-upload/entities',
      icon: '🏢'
    },
    {
      id: 'investments',
      title: 'Investment Bulk Upload', 
      description: 'Upload multiple investments with comprehensive 32-field validation',
      templateName: 'Investment_Upload_Template.xlsx',
      uploadEndpoint: '/api/bulk-upload/investments',
      icon: '💼'
    },
    {
      id: 'navs',
      title: 'NAV Bulk Upload',
      description: 'Upload Net Asset Value updates for portfolio performance tracking',
      templateName: 'NAV_Upload_Template.xlsx', 
      uploadEndpoint: '/api/bulk-upload/navs',
      icon: '📈'
    },
    {
      id: 'cashflows',
      title: 'Cash Flow Bulk Upload',
      description: 'Upload capital calls, distributions, and other cash flow transactions',
      templateName: 'CashFlow_Upload_Template.xlsx',
      uploadEndpoint: '/api/bulk-upload/cashflows',
      icon: '💰'
    }
  ];

  const handleDownloadTemplate = useCallback(async (sectionId: string) => {
    const section = uploadSections.find(s => s.id === sectionId);
    if (!section) return;

    try {
      let downloadUrl = '';
      switch (sectionId) {
        case 'entities':
          downloadUrl = '/api/templates/entity-template';
          break;
        case 'investments':
          downloadUrl = '/api/templates/investment-template';
          break;
        case 'navs':
          downloadUrl = '/api/templates/nav-template';
          break;
        case 'cashflows':
          downloadUrl = '/api/templates/cashflow-template';
          break;
        default:
          throw new Error(`Unknown template type: ${sectionId}`);
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download template: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = section.templateName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      setUploadErrors(prev => ({
        ...prev,
        [sectionId]: `Failed to download template: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }, [uploadSections]);

  const handleFileUpload = useCallback(async (sectionId: string, file: File) => {
    const section = uploadSections.find(s => s.id === sectionId);
    if (!section) return;

    setUploadLoading(prev => ({ ...prev, [sectionId]: true }));
    setUploadErrors(prev => ({ ...prev, [sectionId]: null }));

    try {
      let result: ImportResult;

      switch (sectionId) {
        case 'investments':
          result = await importExportAPI.importInvestments(file);
          break;
        case 'entities':
          throw new Error('Entity bulk upload not yet implemented on backend');
        case 'navs':
          result = await importExportAPI.bulkUploadNAVs(file);
          break;
        case 'cashflows':
          result = await importExportAPI.bulkUploadCashFlows(file);
          break;
        default:
          throw new Error(`Unknown upload type: ${sectionId}`);
      }

      setUploadResults(prev => ({ ...prev, [sectionId]: result }));

      if (result.success_count > 0) {
        // Refresh relevant data - could emit events here for other components to listen
        console.log(`Successfully uploaded ${result.success_count} ${sectionId}`);
      }

    } catch (error) {
      console.error(`Error uploading ${sectionId}:`, error);
      setUploadErrors(prev => ({
        ...prev,
        [sectionId]: error instanceof Error ? error.message : 'Upload failed'
      }));
    } finally {
      setUploadLoading(prev => ({ ...prev, [sectionId]: false }));
    }
  }, [uploadSections]);

  const renderUploadSection = (section: UploadSection) => {
    const isLoading = uploadLoading[section.id];
    const error = uploadErrors[section.id];
    const result = uploadResults[section.id];

    return (
      <div key={section.id} className="upload-section">
        <div className="upload-section-header">
          <div className="upload-section-title">
            <span className="upload-icon">{section.icon}</span>
            <h3>{section.title}</h3>
          </div>
          <button
            onClick={() => handleDownloadTemplate(section.id)}
            className="download-template-btn"
            disabled={isLoading}
          >
            📥 Download Template
          </button>
        </div>
        
        <p className="upload-section-description">{section.description}</p>

        <div className="upload-area">
          <input
            type="file"
            id={`upload-${section.id}`}
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(section.id, file);
              }
            }}
            disabled={isLoading}
            className="file-input"
          />
          <label htmlFor={`upload-${section.id}`} className={`file-label ${isLoading ? 'loading' : ''}`}>
            {isLoading ? (
              <>⏳ Uploading...</>
            ) : (
              <>📤 Choose File to Upload</>
            )}
          </label>
        </div>

        {error && (
          <div className="upload-error">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="upload-result">
            <div className={`result-summary ${result.error_count > 0 ? 'has-errors' : 'success'}`}>
              ✅ {result.success_count} successful | 
              {result.error_count > 0 && (
                <span className="error-count"> ❌ {result.error_count} errors</span>
              )}
            </div>
            
            {result.errors && result.errors.length > 0 && (
              <div className="error-details">
                <h4>Upload Errors:</h4>
                <ul>
                  {result.errors.slice(0, 10).map((error, index) => (
                    <li key={index}>Row {error.row}: {error.message}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>... and {result.errors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}
            
            {result.message && (
              <div className="result-message">
                ℹ️ {result.message}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bulk-upload-page">
      <div className="page-header">
        <h1>📊 Bulk Data Management</h1>
        <p className="page-description">
          Download professional Excel templates and upload multiple records efficiently. 
          Perfect for onboarding new family office portfolios.
        </p>
      </div>

      <div className="bulk-upload-info">
        <div className="info-card">
          <h3>📋 Upload Process</h3>
          <ol>
            <li><strong>Download</strong> the Excel template for your data type</li>
            <li><strong>Fill in</strong> your data using the template format</li>
            <li><strong>Upload</strong> the completed Excel file</li>
            <li><strong>Review</strong> the results and fix any validation errors</li>
          </ol>
        </div>
        
        <div className="info-card">
          <h3>💡 Pro Tips</h3>
          <ul>
            <li>Use dropdown values from templates to avoid validation errors</li>
            <li>Upload entities first, then investments that reference those entities</li>
            <li>NAV and cash flow uploads require existing investments</li>
            <li>Templates include examples and field descriptions</li>
          </ul>
        </div>
      </div>

      <div className="upload-sections">
        {uploadSections.map(renderUploadSection)}
      </div>

      <SectionErrorBoundary>
        <div className="bulk-upload-footer">
          <div className="footer-note">
            <strong>Note:</strong> All uploads are validated before processing. 
            You can download sample data from the <code>sample-data/</code> folder in the project repository.
          </div>
        </div>
      </SectionErrorBoundary>
    </div>
  );
};

export default BulkUpload;