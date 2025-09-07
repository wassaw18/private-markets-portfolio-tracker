import React, { useState, useCallback } from 'react';
import { investmentAPI, ImportResult, importExportAPI } from '../services/api';
import './UploadWidget.css';

interface UploadWidgetProps {
  type: 'entities' | 'investments' | 'navs' | 'cashflows';
  onUploadComplete?: (result: ImportResult) => void;
  className?: string;
  size?: 'small' | 'medium';
  currentInvestmentId?: number; // For NAV/cash flow uploads
}

const UploadWidget: React.FC<UploadWidgetProps> = ({
  type,
  onUploadComplete,
  className = '',
  size = 'medium',
  currentInvestmentId
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const getTypeConfig = useCallback(() => {
    switch (type) {
      case 'entities':
        return {
          title: 'Upload Entities',
          templateName: 'Entity_Upload_Template.xlsx',
          downloadUrl: '/api/templates/entity-template',
          icon: '🏢',
          description: 'Add multiple entities'
        };
      case 'investments':
        return {
          title: 'Upload Investments',
          templateName: 'Investment_Upload_Template.xlsx',
          downloadUrl: '/api/templates/investment-template',
          icon: '💼',
          description: 'Add multiple investments'
        };
      case 'navs':
        return {
          title: 'Upload NAVs',
          templateName: 'NAV_Upload_Template.xlsx',
          downloadUrl: '/api/templates/nav-template',
          icon: '📈',
          description: 'Add NAV updates'
        };
      case 'cashflows':
        return {
          title: 'Upload Cash Flows',
          templateName: 'CashFlow_Upload_Template.xlsx',
          downloadUrl: '/api/templates/cashflow-template',
          icon: '💰',
          description: 'Add cash flow transactions'
        };
      default:
        throw new Error(`Unknown upload type: ${type}`);
    }
  }, [type]);

  const config = getTypeConfig();

  const handleDownloadTemplate = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(config.downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download template: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.templateName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      setError(`Failed to download template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [config]);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      let uploadResult: ImportResult;

      switch (type) {
        case 'investments':
          uploadResult = await importExportAPI.importInvestments(file);
          break;
        case 'entities':
          // TODO: Implement when backend API is ready
          throw new Error('Entity bulk upload not yet implemented');
        case 'navs':
          uploadResult = await importExportAPI.bulkUploadNAVs(file);
          break;
        case 'cashflows':
          uploadResult = await importExportAPI.bulkUploadCashFlows(file);
          break;
        default:
          throw new Error(`Unknown upload type: ${type}`);
      }

      setResult(uploadResult);
      onUploadComplete?.(uploadResult);

      if (uploadResult.success_count > 0) {
        console.log(`Successfully uploaded ${uploadResult.success_count} ${type}`);
      }

    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  }, [type, onUploadComplete]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  }, [handleFileUpload]);

  return (
    <div className={`upload-widget ${size} ${className}`}>
      <div className="upload-widget-header">
        <span className="upload-widget-icon">{config.icon}</span>
        <div className="upload-widget-info">
          <h4 className="upload-widget-title">{config.title}</h4>
          {size === 'medium' && (
            <p className="upload-widget-description">{config.description}</p>
          )}
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="download-btn"
          disabled={isLoading}
          title="Download Excel template"
        >
          📥
        </button>
      </div>

      <div className="upload-controls">
        <input
          type="file"
          id={`upload-${type}`}
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={isLoading}
          className="file-input-hidden"
        />
        <label
          htmlFor={`upload-${type}`}
          className={`upload-btn ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? (
            <>⏳ Uploading...</>
          ) : (
            <>📤 Choose File</>
          )}
        </label>
      </div>

      {error && (
        <div className="upload-widget-error">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="upload-widget-result">
          <div className={`result-summary ${result.error_count > 0 ? 'has-errors' : 'success'}`}>
            ✅ {result.success_count} uploaded
            {result.error_count > 0 && (
              <span className="error-count"> | ❌ {result.error_count} errors</span>
            )}
          </div>
          
          {result.errors && result.errors.length > 0 && size === 'medium' && (
            <div className="error-list">
              <details>
                <summary>View errors ({result.errors.length})</summary>
                <ul>
                  {result.errors.slice(0, 5).map((error, index) => (
                    <li key={index}>Row {error.row}: {error.message}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>... and {result.errors.length - 5} more errors</li>
                  )}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Special note for NAV/Cash Flow uploads */}
      {(type === 'navs' || type === 'cashflows') && currentInvestmentId && (
        <div className="upload-note">
          <small>
            💡 Upload data for this investment or any other existing investments
          </small>
        </div>
      )}
    </div>
  );
};

export default UploadWidget;