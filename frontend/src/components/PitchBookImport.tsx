import React, { useState, useRef } from 'react';
import './PitchBookImport.css';

interface ImportResult {
  success: boolean;
  message: string;
  import_id?: number;
  records_processed: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  errors: string[];
  import_duration_seconds?: number;
}

interface ValidationResult {
  valid: boolean;
  data_type: string;
  total_rows: number;
  validation_errors: string[];
  error_count: number;
}

interface PDFExtractionResult {
  success: boolean;
  message: string;
  report_period?: string;
  total_performance_rows: number;
  total_quarterly_rows: number;
  extraction_timestamp?: string;
  errors: string[];
}

interface PDFPreviewData {
  performance_data: any[];
  quarterly_data: any[];
  csv_preview: string;
}

const PitchBookImport: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<string>('full');
  const [uploadType, setUploadType] = useState<string>('csv'); // 'csv' or 'pdf'
  const [reportPeriod, setReportPeriod] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [pdfExtractionResult, setPdfExtractionResult] = useState<PDFExtractionResult | null>(null);
  const [pdfPreviewData, setPdfPreviewData] = useState<PDFPreviewData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
      setValidationResult(null);
      setPdfExtractionResult(null);
      setPdfPreviewData(null);

      // Auto-detect file type
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setUploadType('pdf');
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        setUploadType('csv');
      }
    }
  };

  const handleValidation = async () => {
    if (!selectedFile) return;

    setIsValidating(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    if (uploadType === 'pdf' && reportPeriod) {
      formData.append('report_period', reportPeriod);
    }

    try {
      const endpoint = uploadType === 'pdf' ? '/api/pitchbook/validate-pdf' : '/api/pitchbook/validate';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result: ValidationResult = await response.json();
        setValidationResult(result);
      } else {
        const errorData = await response.json();
        setValidationResult({
          valid: false,
          data_type: 'unknown',
          total_rows: 0,
          validation_errors: [errorData.detail || 'Validation failed'],
          error_count: 1
        });
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        data_type: 'unknown',
        total_rows: 0,
        validation_errors: [`Network error: ${error}`],
        error_count: 1
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handlePDFExtraction = async () => {
    if (!selectedFile || uploadType !== 'pdf') return;

    setIsExtracting(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('limit_rows', '50');

    if (reportPeriod) {
      formData.append('report_period', reportPeriod);
    }

    try {
      const response = await fetch('/api/pitchbook/extract-pdf-preview', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result: PDFPreviewData = await response.json();
        setPdfPreviewData(result);
      } else {
        const errorData = await response.json();
        setPdfExtractionResult({
          success: false,
          message: errorData.detail || 'PDF extraction failed',
          total_performance_rows: 0,
          total_quarterly_rows: 0,
          errors: [errorData.detail || 'PDF extraction failed']
        });
      }
    } catch (error) {
      setPdfExtractionResult({
        success: false,
        message: `Network error: ${error}`,
        total_performance_rows: 0,
        total_quarterly_rows: 0,
        errors: [`Network error: ${error}`]
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('import_type', importType);

    if (uploadType === 'pdf' && reportPeriod) {
      formData.append('report_period', reportPeriod);
    }

    try {
      const endpoint = uploadType === 'pdf' ? '/api/pitchbook/import-from-pdf' : '/api/pitchbook/import';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const result: ImportResult = await response.json();
      setImportResult(result);

      if (result.success) {
        // Clear the file input on successful import
        setSelectedFile(null);
        setReportPeriod('');
        setPdfPreviewData(null);
        setPdfExtractionResult(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: `Network error: ${error}`,
        records_processed: 0,
        records_inserted: 0,
        records_updated: 0,
        records_skipped: 0,
        errors: [`Network error: ${error}`]
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = async (templateType: string) => {
    try {
      const response = await fetch(`/api/pitchbook/templates/${templateType}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pitchbook_${templateType}_template.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  return (
    <div className="pitchbook-import">
      <div className="import-header">
        <h2>📊 PitchBook Benchmark Data Import</h2>
        <p>Import quarterly PitchBook benchmark data for performance comparison</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📁 Upload Data
        </button>
        <button
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          📄 Templates
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📋 Import History
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="upload-section">
          <div className="file-upload-area">
            <div className="upload-instructions">
              <h3>📂 Select Data File</h3>
              <p>Choose a CSV file with pre-formatted data or a PDF report for automatic extraction.</p>
            </div>

            <div className="upload-type-selection">
              <div className="radio-group horizontal">
                <label className="radio-option">
                  <input
                    type="radio"
                    value="csv"
                    checked={uploadType === 'csv'}
                    onChange={(e) => setUploadType(e.target.value)}
                  />
                  <span>📄 CSV File</span>
                  <small>Pre-formatted benchmark data</small>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    value="pdf"
                    checked={uploadType === 'pdf'}
                    onChange={(e) => setUploadType(e.target.value)}
                  />
                  <span>📋 PDF Report</span>
                  <small>Auto-extract from PitchBook report</small>
                </label>
              </div>
            </div>

            <div className="file-input-container">
              <input
                ref={fileInputRef}
                type="file"
                accept={uploadType === 'pdf' ? '.pdf' : '.csv'}
                onChange={handleFileSelect}
                className="file-input"
                id="benchmark-file"
              />
              <label htmlFor="benchmark-file" className="file-input-label">
                {selectedFile ? selectedFile.name : `Choose ${uploadType.toUpperCase()} File`}
              </label>
            </div>

            {selectedFile && (
              <div className="file-info">
                <div className="file-details">
                  <span className="file-name">📋 {selectedFile.name}</span>
                  <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="import-options">
              {uploadType === 'pdf' && (
                <div className="pdf-options">
                  <h4>PDF Extraction Options</h4>
                  <div className="form-field">
                    <label htmlFor="report-period">Report Period (optional):</label>
                    <input
                      id="report-period"
                      type="text"
                      value={reportPeriod}
                      onChange={(e) => setReportPeriod(e.target.value)}
                      placeholder="e.g., Q4-2024"
                      className="text-input"
                    />
                    <small>Leave blank to auto-detect from PDF</small>
                  </div>
                </div>
              )}

              <div className="import-type-selection">
                <h4>Import Type</h4>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      value="full"
                      checked={importType === 'full'}
                      onChange={(e) => setImportType(e.target.value)}
                    />
                    <span>Full Import</span>
                    <small>Import both performance and quarterly data</small>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      value="performance_only"
                      checked={importType === 'performance_only'}
                      onChange={(e) => setImportType(e.target.value)}
                    />
                    <span>Performance Only</span>
                    <small>Import only vintage year performance metrics</small>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      value="quarterly_only"
                      checked={importType === 'quarterly_only'}
                      onChange={(e) => setImportType(e.target.value)}
                    />
                    <span>Quarterly Returns Only</span>
                    <small>Import only quarterly return data</small>
                  </label>
                </div>
              </div>

              <div className="action-buttons">
                {uploadType === 'pdf' && (
                  <button
                    onClick={handlePDFExtraction}
                    disabled={!selectedFile || isExtracting}
                    className="extract-button"
                  >
                    {isExtracting ? '🔄 Extracting...' : '🔍 Extract & Preview'}
                  </button>
                )}
                <button
                  onClick={handleValidation}
                  disabled={!selectedFile || isValidating}
                  className="validate-button"
                >
                  {isValidating ? '🔄 Validating...' : '✅ Validate Data'}
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedFile || isUploading || (validationResult?.valid === false)}
                  className="import-button"
                >
                  {isUploading ? '📤 Importing...' : '📊 Import Data'}
                </button>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <div className={`validation-results ${validationResult.valid ? 'valid' : 'invalid'}`}>
              <div className="validation-header">
                <h4>
                  {validationResult.valid ? '✅ Validation Passed' : '❌ Validation Failed'}
                </h4>
                <div className="validation-stats">
                  <span>Data Type: {validationResult.data_type}</span>
                  <span>Total Rows: {validationResult.total_rows}</span>
                  {validationResult.error_count > 0 && (
                    <span>Errors: {validationResult.error_count}</span>
                  )}
                </div>
              </div>

              {validationResult.validation_errors.length > 0 && (
                <div className="validation-errors">
                  <h5>Validation Errors:</h5>
                  <ul>
                    {validationResult.validation_errors.slice(0, 10).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {validationResult.validation_errors.length > 10 && (
                      <li>... and {validationResult.validation_errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* PDF Preview Results */}
          {pdfPreviewData && (
            <div className="pdf-preview-results">
              <div className="preview-header">
                <h4>📋 PDF Extraction Preview</h4>
                <p>Preview of extracted data from PDF. Review before importing.</p>
              </div>

              {pdfPreviewData.performance_data.length > 0 && (
                <div className="preview-section">
                  <h5>🎯 Performance Data ({pdfPreviewData.performance_data.length} rows)</h5>
                  <div className="data-table-container">
                    <table className="data-preview-table">
                      <thead>
                        <tr>
                          <th>Asset Class</th>
                          <th>Metric</th>
                          <th>Vintage Year</th>
                          <th>Top Quartile</th>
                          <th>Median</th>
                          <th>Bottom Quartile</th>
                          <th>Sample Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdfPreviewData.performance_data.slice(0, 10).map((row, index) => (
                          <tr key={index}>
                            <td>{row.asset_class || 'N/A'}</td>
                            <td>{row.metric_code || 'N/A'}</td>
                            <td>{row.vintage_year || 'N/A'}</td>
                            <td>{row.top_quartile_value ? (row.top_quartile_value * 100).toFixed(2) + '%' : 'N/A'}</td>
                            <td>{row.median_value ? (row.median_value * 100).toFixed(2) + '%' : 'N/A'}</td>
                            <td>{row.bottom_quartile_value ? (row.bottom_quartile_value * 100).toFixed(2) + '%' : 'N/A'}</td>
                            <td>{row.sample_size || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pdfPreviewData.performance_data.length > 10 && (
                      <p className="preview-note">... and {pdfPreviewData.performance_data.length - 10} more rows</p>
                    )}
                  </div>
                </div>
              )}

              {pdfPreviewData.quarterly_data.length > 0 && (
                <div className="preview-section">
                  <h5>📈 Quarterly Returns Data ({pdfPreviewData.quarterly_data.length} rows)</h5>
                  <div className="data-table-container">
                    <table className="data-preview-table">
                      <thead>
                        <tr>
                          <th>Asset Class</th>
                          <th>Quarter</th>
                          <th>Quarter Date</th>
                          <th>Top Quartile</th>
                          <th>Median</th>
                          <th>Bottom Quartile</th>
                          <th>Sample Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdfPreviewData.quarterly_data.slice(0, 10).map((row, index) => (
                          <tr key={index}>
                            <td>{row.asset_class || 'N/A'}</td>
                            <td>{row.quarter_year || 'N/A'}</td>
                            <td>{row.quarter_date || 'N/A'}</td>
                            <td>{row.top_quartile_return ? (row.top_quartile_return * 100).toFixed(2) + '%' : 'N/A'}</td>
                            <td>{row.median_return ? (row.median_return * 100).toFixed(2) + '%' : 'N/A'}</td>
                            <td>{row.bottom_quartile_return ? (row.bottom_quartile_return * 100).toFixed(2) + '%' : 'N/A'}</td>
                            <td>{row.sample_size || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pdfPreviewData.quarterly_data.length > 10 && (
                      <p className="preview-note">... and {pdfPreviewData.quarterly_data.length - 10} more rows</p>
                    )}
                  </div>
                </div>
              )}

              {pdfPreviewData.csv_preview && (
                <div className="preview-section">
                  <h5>📄 Generated CSV Preview</h5>
                  <div className="csv-preview-container">
                    <pre className="csv-preview">{pdfPreviewData.csv_preview}</pre>
                  </div>
                  <p className="preview-note">This is how the data will be formatted for import</p>
                </div>
              )}
            </div>
          )}

          {/* PDF Extraction Errors */}
          {pdfExtractionResult && !pdfExtractionResult.success && (
            <div className="pdf-extraction-results failure">
              <div className="extraction-header">
                <h4>❌ PDF Extraction Failed</h4>
                <p>{pdfExtractionResult.message}</p>
              </div>

              {pdfExtractionResult.errors.length > 0 && (
                <div className="extraction-errors">
                  <h5>Extraction Errors:</h5>
                  <ul>
                    {pdfExtractionResult.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className={`import-results ${importResult.success ? 'success' : 'failure'}`}>
              <div className="import-header">
                <h4>
                  {importResult.success ? '✅ Import Successful' : '❌ Import Failed'}
                </h4>
                <p>{importResult.message}</p>
              </div>

              {importResult.success && (
                <div className="import-stats">
                  <div className="stat-item">
                    <span className="stat-label">Processed:</span>
                    <span className="stat-value">{importResult.records_processed}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Inserted:</span>
                    <span className="stat-value">{importResult.records_inserted}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Updated:</span>
                    <span className="stat-value">{importResult.records_updated}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Skipped:</span>
                    <span className="stat-value">{importResult.records_skipped}</span>
                  </div>
                  {importResult.import_duration_seconds && (
                    <div className="stat-item">
                      <span className="stat-label">Duration:</span>
                      <span className="stat-value">{importResult.import_duration_seconds}s</span>
                    </div>
                  )}
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="import-errors">
                  <h5>Import Errors:</h5>
                  <ul>
                    {importResult.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>{error}</li>
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
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="templates-section">
          <div className="templates-header">
            <h3>📄 Download Templates</h3>
            <p>Download CSV templates to structure your PitchBook benchmark data for import.</p>
          </div>

          <div className="template-cards">
            <div className="template-card">
              <div className="template-icon">📊</div>
              <h4>Performance Data Template</h4>
              <p>Template for vintage year performance metrics (IRR, PME, TVPI, DPI, RVPI)</p>
              <button
                onClick={() => downloadTemplate('performance-data')}
                className="download-template-button"
              >
                📥 Download CSV
              </button>
            </div>

            <div className="template-card">
              <div className="template-icon">📈</div>
              <h4>Quarterly Returns Template</h4>
              <p>Template for quarterly return data by asset class</p>
              <button
                onClick={() => downloadTemplate('quarterly-returns')}
                className="download-template-button"
              >
                📥 Download CSV
              </button>
            </div>

            <div className="template-card">
              <div className="template-icon">📋</div>
              <h4>Complete Template</h4>
              <p>Combined template with examples for both performance and quarterly data</p>
              <button
                onClick={() => downloadTemplate('complete')}
                className="download-template-button"
              >
                📥 Download CSV
              </button>
            </div>

            <div className="template-card">
              <div className="template-icon">📖</div>
              <h4>Instructions</h4>
              <p>Detailed instructions for using the templates and formatting data</p>
              <button
                onClick={() => downloadTemplate('instructions')}
                className="download-template-button"
              >
                📥 Download Instructions
              </button>
            </div>
          </div>

          <div className="template-guidelines">
            <h4>📝 Template Guidelines</h4>
            <ul>
              <li><strong>Data Format:</strong> Enter percentages as decimals (14.20% = 0.1420)</li>
              <li><strong>Asset Classes:</strong> Use exact values: private_equity, venture_capital, real_estate, etc.</li>
              <li><strong>Metric Codes:</strong> Use exact values: IRR, PME, TVPI, DPI, RVPI</li>
              <li><strong>Quartile Order:</strong> Ensure Top ≥ Median ≥ Bottom for each row</li>
              <li><strong>Date Format:</strong> Use YYYY-MM-DD for quarter dates</li>
              <li><strong>Sample Sizes:</strong> Must be positive integers</li>
            </ul>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="history-section">
          <div className="history-header">
            <h3>📋 Import History</h3>
            <p>View previous data import operations and their results.</p>
          </div>

          <div className="import-history-placeholder">
            <div className="placeholder-icon">📊</div>
            <h4>Import History</h4>
            <p>Import history will be displayed here after implementing the backend API integration.</p>
            <p>This will show:</p>
            <ul>
              <li>Import date and time</li>
              <li>Source file name</li>
              <li>Import type and status</li>
              <li>Records processed, inserted, updated</li>
              <li>Import duration</li>
              <li>Error details (if any)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default PitchBookImport;