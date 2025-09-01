import React, { useState, useRef } from 'react';
import { importExportAPI, ImportResult, BulkUploadResult } from '../services/api';
import './ImportExportModal.css';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: ImportResult | BulkUploadResult) => void;
}

type UploadType = 'investments' | 'navs' | 'cashflows';

const ImportExportModal: React.FC<ImportExportModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'templates'>('templates');
  const [uploadType, setUploadType] = useState<UploadType>('investments');
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImportResult | BulkUploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type based on upload type
    const validExtensions = uploadType === 'investments' 
      ? ['.csv', '.xlsx', '.xls']
      : ['.xlsx', '.xls'];
      
    const isValidType = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType) {
      const fileTypes = uploadType === 'investments' ? 'CSV or Excel' : 'Excel';
      alert(`Please upload a ${fileTypes} file`);
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      let result: ImportResult | BulkUploadResult;
      
      switch (uploadType) {
        case 'investments':
          result = await importExportAPI.importInvestments(file);
          break;
        case 'navs':
          result = await importExportAPI.bulkUploadNAVs(file);
          break;
        case 'cashflows':
          result = await importExportAPI.bulkUploadCashFlows(file);
          break;
        default:
          throw new Error('Invalid upload type');
      }
      
      setUploadResult(result);
      
      if (onImportComplete) {
        onImportComplete(result);
      }

      // Show success message
      if (result.success_count > 0) {
        const typeLabel = uploadType === 'investments' ? 'investments' : 
                         uploadType === 'navs' ? 'NAV records' : 'cash flow records';
        alert(`Successfully processed ${result.success_count} ${typeLabel}!`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please check the file format and try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const blob = await importExportAPI.exportInvestments();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `portfolio_investments_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const downloadTemplate = async (templateType: 'nav' | 'cashflow' | 'investment') => {
    setIsDownloadingTemplate(true);
    
    try {
      const blob = templateType === 'nav' 
        ? await importExportAPI.downloadNAVTemplate()
        : templateType === 'cashflow'
        ? await importExportAPI.downloadCashFlowTemplate()
        : await importExportAPI.downloadInvestmentTemplate();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = templateType === 'nav' 
        ? 'NAV_Upload_Template.xlsx'
        : templateType === 'cashflow'
        ? 'CashFlow_Upload_Template.xlsx'
        : 'Investment_Upload_Template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Template download failed:', error);
      alert('Template download failed. Please try again.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleClose = () => {
    setUploadResult(null);
    setActiveTab('templates');
    setUploadType('investments');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="import-export-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Portfolio Management Tools</h3>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            📋 Templates
          </button>
          <button 
            className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            📥 Bulk Upload
          </button>
          <button 
            className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            📊 Export Data
          </button>
        </div>
        
        <div className="modal-content">
          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="templates-section">
              <h4>📋 Download Excel Templates</h4>
              <p className="section-description">
                Professional Excel templates with validation, instructions, and examples for institutional users.
              </p>
              
              <div className="template-grid">
                <div className="template-card">
                  <div className="template-icon">🏢</div>
                  <h5>Investment Upload Template</h5>
                  <p>Bulk upload investments with all 22+ institutional fields and validation.</p>
                  <ul className="template-features">
                    <li>Required fields clearly marked (*)</li>
                    <li>Entity dropdown validation</li>
                    <li>All institutional fields included</li>
                    <li>Optional fields for later completion</li>
                  </ul>
                  <button 
                    className="template-download-button"
                    onClick={() => downloadTemplate('investment')}
                    disabled={isDownloadingTemplate}
                  >
                    {isDownloadingTemplate ? 'Downloading...' : 'Download Investment Template'}
                  </button>
                </div>

                <div className="template-card">
                  <div className="template-icon">📈</div>
                  <h5>NAV Upload Template</h5>
                  <p>Upload Net Asset Values with validation and dropdown selections.</p>
                  <ul className="template-features">
                    <li>Investment dropdown validation</li>
                    <li>Date format validation</li>
                    <li>Professional formatting</li>
                    <li>Comprehensive instructions</li>
                  </ul>
                  <button 
                    className="template-download-button"
                    onClick={() => downloadTemplate('nav')}
                    disabled={isDownloadingTemplate}
                  >
                    {isDownloadingTemplate ? 'Downloading...' : 'Download NAV Template'}
                  </button>
                </div>
                
                <div className="template-card">
                  <div className="template-icon">💰</div>
                  <h5>Cash Flow Upload Template</h5>
                  <p>Upload cash flows with enhanced categories and validation.</p>
                  <ul className="template-features">
                    <li>Enhanced cash flow categories</li>
                    <li>Investment dropdown validation</li>
                    <li>Amount sign conventions</li>
                    <li>Detailed examples included</li>
                  </ul>
                  <button 
                    className="template-download-button"
                    onClick={() => downloadTemplate('cashflow')}
                    disabled={isDownloadingTemplate}
                  >
                    {isDownloadingTemplate ? 'Downloading...' : 'Download Cash Flow Template'}
                  </button>
                </div>
              </div>
              
              <div className="template-info">
                <h6>Template Features:</h6>
                <ul>
                  <li>✅ Professional institutional-grade formatting</li>
                  <li>✅ Data validation with dropdown lists</li>
                  <li>✅ Comprehensive instructions and examples</li>
                  <li>✅ Error prevention through validation rules</li>
                  <li>✅ Support for 1000+ records per file</li>
                </ul>
              </div>
            </div>
          )}

          {/* Bulk Upload Tab */}
          {activeTab === 'import' && (
            <div className="import-section">
              <h4>📥 Bulk Upload Data</h4>
              
              {/* Upload Type Selector */}
              <div className="upload-type-selector">
                <label>Select Upload Type:</label>
                <div className="upload-type-buttons">
                  <button 
                    className={`type-button ${uploadType === 'investments' ? 'active' : ''}`}
                    onClick={() => setUploadType('investments')}
                  >
                    📊 Investments
                  </button>
                  <button 
                    className={`type-button ${uploadType === 'navs' ? 'active' : ''}`}
                    onClick={() => setUploadType('navs')}
                  >
                    📈 NAV Data
                  </button>
                  <button 
                    className={`type-button ${uploadType === 'cashflows' ? 'active' : ''}`}
                    onClick={() => setUploadType('cashflows')}
                  >
                    💰 Cash Flows
                  </button>
                </div>
              </div>
              
              <div 
                className={`file-drop-zone ${dragActive ? 'drag-active' : ''} ${isUploading ? 'uploading' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={openFileDialog}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadType === 'investments' ? '.csv,.xlsx,.xls' : '.xlsx,.xls'}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                
                {isUploading ? (
                  <div className="uploading-state">
                    <div className="spinner"></div>
                    <p>Processing {uploadType}...</p>
                  </div>
                ) : (
                  <div className="drop-zone-content">
                    <div className="upload-icon">📁</div>
                    <p className="primary-text">
                      Drop your {uploadType === 'investments' ? 'CSV or Excel' : 'Excel'} file here
                    </p>
                    <p className="secondary-text">or click to browse</p>
                    <small className="file-info">
                      {uploadType === 'investments' 
                        ? 'Supported: .csv, .xlsx, .xls' 
                        : 'Supported: .xlsx, .xls (Use templates for best results)'}\n                    </small>
                  </div>
                )}
              </div>

              {uploadResult && (
                <div className={`upload-result ${uploadResult.error_count > 0 ? 'has-errors' : 'success'}`}>
                  <h5>Upload Results</h5>
                  <div className="result-summary">
                    <span className="success-count">✅ {uploadResult.success_count} successful</span>
                    {uploadResult.error_count > 0 && (
                      <span className="error-count">❌ {uploadResult.error_count} errors</span>
                    )}
                    {'warning_count' in uploadResult && uploadResult.warning_count > 0 && (
                      <span className="warning-count">⚠️ {uploadResult.warning_count} warnings</span>
                    )}
                  </div>
                  
                  <p className="result-message">{uploadResult.message}</p>
                  
                  {uploadResult.errors.length > 0 && (
                    <div className="error-list">
                      <h6>Errors:</h6>
                      <ul>
                        {uploadResult.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>Row {error.row}: {error.message}</li>
                        ))}
                        {uploadResult.errors.length > 5 && (
                          <li>... and {uploadResult.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                  
                  {'warnings' in uploadResult && uploadResult.warnings.length > 0 && (
                    <div className="warning-list">
                      <h6>Warnings:</h6>
                      <ul>
                        {uploadResult.warnings.slice(0, 3).map((warning, index) => (
                          <li key={index}>Row {warning.row}: {warning.message}</li>
                        ))}
                        {uploadResult.warnings.length > 3 && (
                          <li>... and {uploadResult.warnings.length - 3} more warnings</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="export-section">
              <h4>📊 Export Portfolio Data</h4>
              <p className="export-description">
                Export all your investments with complete performance metrics and cash flow data in Excel format.
              </p>
              
              <div className="export-info-grid">
                <div className="export-info-card">
                  <h6>📊 Investment Data</h6>
                  <ul>
                    <li>Complete investment details</li>
                    <li>Asset class and structure</li>
                    <li>Commitment and called amounts</li>
                  </ul>
                </div>
                
                <div className="export-info-card">
                  <h6>📈 Performance Metrics</h6>
                  <ul>
                    <li>IRR calculations</li>
                    <li>TVPI and DPI ratios</li>
                    <li>Cash flow summaries</li>
                  </ul>
                </div>
                
                <div className="export-info-card">
                  <h6>💰 Financial Data</h6>
                  <ul>
                    <li>Complete cash flow history</li>
                    <li>NAV history and trends</li>
                    <li>Fee breakdowns</li>
                  </ul>
                </div>
              </div>
              
              <button 
                className="export-button"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <div className="spinner small"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    📊 Download Complete Portfolio Export
                  </>
                )}
              </button>
              <small className="export-info">
                Professional Excel format suitable for institutional reporting
              </small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportExportModal;