import React, { useState, useRef } from 'react';
import { importExportAPI, ImportResult } from '../services/api';
import './ImportExportPanel.css';

interface ImportExportPanelProps {
  onImportComplete?: (result: ImportResult) => void;
}

const ImportExportPanel: React.FC<ImportExportPanelProps> = ({ onImportComplete }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
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
    // Validate file type
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please upload a CSV or Excel file');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await importExportAPI.importInvestments(file);
      setImportResult(result);
      
      if (onImportComplete) {
        onImportComplete(result);
      }

      // Show success message
      if (result.success_count > 0) {
        alert(`Successfully imported ${result.success_count} investments!`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format and try again.');
    } finally {
      setIsImporting(false);
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

  return (
    <div className="import-export-panel">
      <h3>Import & Export</h3>
      
      {/* Import Section */}
      <div className="import-section">
        <h4>Import Investments</h4>
        <div 
          className={`file-drop-zone ${dragActive ? 'drag-active' : ''} ${isImporting ? 'importing' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          {isImporting ? (
            <div className="importing-state">
              <div className="spinner"></div>
              <p>Processing file...</p>
            </div>
          ) : (
            <div className="drop-zone-content">
              <div className="upload-icon">📁</div>
              <p className="primary-text">Drop your CSV or Excel file here</p>
              <p className="secondary-text">or click to browse</p>
              <small className="file-info">Supported formats: .csv, .xlsx, .xls</small>
            </div>
          )}
        </div>

        {importResult && (
          <div className={`import-result ${importResult.error_count > 0 ? 'has-errors' : 'success'}`}>
            <h5>Import Results</h5>
            <div className="result-summary">
              <span className="success-count">✅ {importResult.success_count} successful</span>
              {importResult.error_count > 0 && (
                <span className="error-count">❌ {importResult.error_count} errors</span>
              )}
            </div>
            
            {importResult.errors.length > 0 && (
              <div className="error-list">
                <h6>Errors:</h6>
                <ul>
                  {importResult.errors.slice(0, 5).map((error, index) => (
                    <li key={index}>Row {error.row}: {error.message}</li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li>... and {importResult.errors.length - 5} more errors</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="export-section">
        <h4>Export Portfolio</h4>
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
              📊 Export to Excel
            </>
          )}
        </button>
        <small className="export-info">
          Exports all investments with performance metrics
        </small>
      </div>
    </div>
  );
};

export default ImportExportPanel;