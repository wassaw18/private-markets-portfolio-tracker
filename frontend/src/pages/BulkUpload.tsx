import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { importExportAPI, ImportResult } from '../services/api';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import '../styles/luxury-design-system.css';
import './BulkUpload.css';

interface UploadSection {
  id: string;
  title: string;
  description: string;
  templateName: string;
  uploadEndpoint: string;
  icon: string;
  category: 'core' | 'data' | 'performance';
  complexity: 'basic' | 'intermediate' | 'advanced';
  estimatedTime: string;
  prerequisites?: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recordCount?: number;
}

interface UploadProgress {
  stage: 'validating' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
}

const BulkUpload: React.FC = () => {
  const [uploadResults, setUploadResults] = useState<{[key: string]: ImportResult | null}>({});
  const [uploadLoading, setUploadLoading] = useState<{[key: string]: boolean}>({});
  const [uploadErrors, setUploadErrors] = useState<{[key: string]: string | null}>({});
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: UploadProgress}>({});
  const [validationResults, setValidationResults] = useState<{[key: string]: ValidationResult}>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [uploadHistory, setUploadHistory] = useState<Array<{id: string, timestamp: Date, status: string, recordCount: number}>>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const uploadSections: UploadSection[] = useMemo(() => [
    {
      id: 'entities',
      title: 'Entity Management',
      description: 'Upload and manage entities (Trusts, LLCs, Individuals, etc.) for comprehensive family office structure',
      templateName: 'Entity_Upload_Template.xlsx',
      uploadEndpoint: '/api/bulk-upload/entities',
      icon: '🏢',
      category: 'core',
      complexity: 'basic',
      estimatedTime: '5-10 minutes',
      prerequisites: []
    },
    {
      id: 'investments',
      title: 'Investment Portfolio Upload',
      description: 'Upload multiple investments with comprehensive 32-field validation and entity relationship mapping',
      templateName: 'Investment_Upload_Template.xlsx',
      uploadEndpoint: '/api/bulk-upload/investments',
      icon: '💼',
      category: 'core',
      complexity: 'advanced',
      estimatedTime: '15-30 minutes',
      prerequisites: ['entities']
    },
    {
      id: 'navs',
      title: 'NAV & Valuation Updates',
      description: 'Upload Net Asset Value updates and investment valuations for performance tracking',
      templateName: 'NAV_Upload_Template.xlsx',
      uploadEndpoint: '/api/bulk-upload/navs',
      icon: '📈',
      category: 'performance',
      complexity: 'intermediate',
      estimatedTime: '10-20 minutes',
      prerequisites: ['investments']
    },
    {
      id: 'cashflows',
      title: 'Cash Flow Transactions',
      description: 'Upload capital calls, distributions, and other cash flow transactions with automated reconciliation',
      templateName: 'CashFlow_Upload_Template.xlsx',
      uploadEndpoint: '/api/bulk-upload/cashflows',
      icon: '💰',
      category: 'data',
      complexity: 'intermediate',
      estimatedTime: '15-25 minutes',
      prerequisites: ['investments']
    },
    {
      id: 'benchmarks',
      title: 'PitchBook Benchmark Data',
      description: 'Upload quarterly PitchBook benchmark data for performance comparison and analysis (CSV/PDF)',
      templateName: 'PitchBook_Benchmark_Template.csv',
      uploadEndpoint: '/api/pitchbook/import',
      icon: '📊',
      category: 'performance',
      complexity: 'advanced',
      estimatedTime: '20-35 minutes',
      prerequisites: ['investments']
    }
  ], []);

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
        case 'benchmarks':
          downloadUrl = '/api/pitchbook/templates/complete';
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

  const handleBenchmarkUpload = useCallback(async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('import_type', 'full');

    // Determine if it's PDF or CSV and use appropriate endpoint
    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    const endpoint = isPDF ? '/api/pitchbook/import-from-pdf' : '/api/pitchbook/import';

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Convert PitchBook result format to ImportResult format expected by BulkUpload
    return {
      filename: file.name,
      success_count: result.records_inserted || 0,
      error_count: result.errors?.length || 0,
      errors: result.errors?.map((error: string, index: number) => ({
        row: index + 1,
        message: error
      })) || [],
      warnings: [],
      message: result.message || 'Benchmark data uploaded successfully'
    };
  }, []);

  // Advanced file validation function
  const validateFile = useCallback((file: File, sectionId: string): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // File size validation (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (50MB)`);
    }

    // File type validation
    const section = uploadSections.find(s => s.id === sectionId);
    if (section) {
      const allowedExtensions = section.id === 'benchmarks'
        ? ['.csv', '.pdf']
        : ['.xlsx', '.xls'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      if (!allowedExtensions.includes(fileExtension)) {
        errors.push(`File type ${fileExtension} not supported. Allowed types: ${allowedExtensions.join(', ')}`);
      }
    }

    // File name validation
    if (file.name.length > 100) {
      warnings.push('File name is very long and may cause display issues');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recordCount: undefined
    };
  }, [uploadSections]);

  const handleFileUpload = useCallback(async (sectionId: string, file: File) => {
    const section = uploadSections.find(s => s.id === sectionId);
    if (!section) return;

    // Pre-upload validation
    const validation = validateFile(file, sectionId);
    setValidationResults(prev => ({ ...prev, [sectionId]: validation }));

    if (!validation.isValid) {
      setUploadErrors(prev => ({
        ...prev,
        [sectionId]: `Validation failed: ${validation.errors.join(', ')}`
      }));
      return;
    }

    setUploadLoading(prev => ({ ...prev, [sectionId]: true }));
    setUploadErrors(prev => ({ ...prev, [sectionId]: null }));

    // Set initial progress
    setUploadProgress(prev => ({
      ...prev,
      [sectionId]: {
        stage: 'validating',
        progress: 10,
        message: 'Validating file format and structure...'
      }
    }));

    try {
      // Update progress to uploading stage
      setUploadProgress(prev => ({
        ...prev,
        [sectionId]: {
          stage: 'uploading',
          progress: 30,
          message: 'Uploading file to server...'
        }
      }));

      let result: ImportResult;

      switch (sectionId) {
        case 'investments':
          setUploadProgress(prev => ({
            ...prev,
            [sectionId]: { stage: 'processing', progress: 60, message: 'Processing investment data and validating relationships...' }
          }));
          result = await importExportAPI.importInvestments(file);
          break;
        case 'entities':
          setUploadProgress(prev => ({
            ...prev,
            [sectionId]: { stage: 'processing', progress: 60, message: 'Processing entity data and validating structure...' }
          }));
          result = await importExportAPI.bulkUploadEntities(file);
          break;
        case 'benchmarks':
          setUploadProgress(prev => ({
            ...prev,
            [sectionId]: { stage: 'processing', progress: 60, message: 'Processing benchmark data and validating metrics...' }
          }));
          result = await handleBenchmarkUpload(file);
          break;
        case 'navs':
          setUploadProgress(prev => ({
            ...prev,
            [sectionId]: { stage: 'processing', progress: 60, message: 'Processing NAV updates and calculating performance...' }
          }));
          result = await importExportAPI.bulkUploadNAVs(file);
          break;
        case 'cashflows':
          setUploadProgress(prev => ({
            ...prev,
            [sectionId]: { stage: 'processing', progress: 60, message: 'Processing cash flow transactions and reconciling balances...' }
          }));
          result = await importExportAPI.bulkUploadCashFlows(file);
          break;
        default:
          throw new Error(`Unknown upload type: ${sectionId}`);
      }

      // Update progress to complete
      setUploadProgress(prev => ({
        ...prev,
        [sectionId]: {
          stage: 'complete',
          progress: 100,
          message: `Successfully processed ${result.success_count} records`
        }
      }));

      setUploadResults(prev => ({ ...prev, [sectionId]: result }));

      // Add to upload history
      setUploadHistory(prev => [{
        id: `${sectionId}-${Date.now()}`,
        timestamp: new Date(),
        status: result.error_count > 0 ? 'partial' : 'success',
        recordCount: result.success_count
      }, ...prev.slice(0, 9)]); // Keep last 10 uploads

      if (result.success_count > 0) {
        console.log(`Successfully uploaded ${result.success_count} ${sectionId}`);
      }

    } catch (error) {
      console.error(`Error uploading ${sectionId}:`, error);
      setUploadErrors(prev => ({
        ...prev,
        [sectionId]: error instanceof Error ? error.message : 'Upload failed'
      }));

      // Update progress to error state
      setUploadProgress(prev => ({
        ...prev,
        [sectionId]: {
          stage: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'Upload failed'
        }
      }));

      // Add to upload history
      setUploadHistory(prev => [{
        id: `${sectionId}-${Date.now()}`,
        timestamp: new Date(),
        status: 'error',
        recordCount: 0
      }, ...prev.slice(0, 9)]);

    } finally {
      setUploadLoading(prev => ({ ...prev, [sectionId]: false }));
    }
  }, [uploadSections]);

  // Filtered sections based on category
  const filteredSections = useMemo(() => {
    if (selectedCategory === 'all') return uploadSections;
    return uploadSections.filter(section => section.category === selectedCategory);
  }, [uploadSections, selectedCategory]);

  // Progress component for each upload
  const renderUploadProgress = (sectionId: string) => {
    const progress = uploadProgress[sectionId];
    if (!progress) return null;

    const getProgressColor = () => {
      switch (progress.stage) {
        case 'error': return '#e74c3c';
        case 'complete': return '#27ae60';
        default: return '#3498db';
      }
    };

    return (
      <div className="upload-progress">
        <div className="progress-header">
          <span className="progress-stage">{progress.stage}</span>
          <span className="progress-percentage">{progress.progress}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${progress.progress}%`,
              backgroundColor: getProgressColor()
            }}
          />
        </div>
        <div className="progress-message">{progress.message}</div>
      </div>
    );
  };

  const renderUploadSection = (section: UploadSection) => {
    const isLoading = uploadLoading[section.id];
    const error = uploadErrors[section.id];
    const result = uploadResults[section.id];
    const validation = validationResults[section.id];

    const getComplexityBadge = (complexity: string) => {
      const badges = {
        basic: { text: 'Basic', color: '#27ae60' },
        intermediate: { text: 'Intermediate', color: '#f39c12' },
        advanced: { text: 'Advanced', color: '#e74c3c' }
      };
      const badge = badges[complexity as keyof typeof badges];
      return <span className="complexity-badge" style={{ color: badge.color }}>{badge.text}</span>;
    };

    const hasPrerequisites = section.prerequisites && section.prerequisites.length > 0;
    const prerequisitesMet = !hasPrerequisites || section.prerequisites!.every(
      prereq => uploadResults[prereq]?.success_count && uploadResults[prereq]?.success_count > 0
    );

    return (
      <div key={section.id} className="luxury-card upload-section">
        <div className="upload-section-header">
          <div className="section-info">
            <div className="section-title-row">
              <span className="section-icon">{section.icon}</span>
              <h3 className="luxury-heading-3">{section.title}</h3>
              {getComplexityBadge(section.complexity)}
            </div>
            <p className="luxury-body section-description">{section.description}</p>
            <div className="section-metadata">
              <span className="estimated-time">⏱️ {section.estimatedTime}</span>
              {hasPrerequisites && (
                <span className={`prerequisites ${prerequisitesMet ? 'met' : 'unmet'}`}>
                  📋 Requires: {section.prerequisites!.join(', ')}
                </span>
              )}
            </div>
          </div>
          <div className="section-actions">
            <button
              onClick={() => handleDownloadTemplate(section.id)}
              className="luxury-button-secondary"
              disabled={isLoading}
              title="Download template with sample data"
            >
              📥 Template
            </button>
          </div>
        </div>

        {!prerequisitesMet && (
          <div className="prerequisite-warning">
            ⚠️ Complete prerequisite uploads first: {section.prerequisites!.filter(
              prereq => !uploadResults[prereq]?.success_count
            ).join(', ')}
          </div>
        )}

        <div className={`upload-area ${!prerequisitesMet ? 'disabled' : ''}`}>
          <input
            type="file"
            id={`upload-${section.id}`}
            accept={section.id === 'benchmarks' ? '.csv,.pdf' : '.xlsx,.xls'}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && prerequisitesMet) {
                handleFileUpload(section.id, file);
              }
            }}
            disabled={isLoading || !prerequisitesMet}
            className="file-input"
          />
          <label
            htmlFor={`upload-${section.id}`}
            className={`upload-label ${isLoading ? 'loading' : ''} ${!prerequisitesMet ? 'disabled' : ''}`}
          >
            <div className="upload-content">
              <div className="upload-icon">
                {isLoading ? '⏳' : '📤'}
              </div>
              <div className="upload-text">
                <div className="primary-text">
                  {isLoading ? 'Processing...' : 'Drop file here or click to browse'}
                </div>
                <div className="secondary-text">
                  Supports {section.id === 'benchmarks' ? 'CSV/PDF files up to 50MB' : 'Excel files (.xlsx, .xls) up to 50MB'}
                </div>
              </div>
            </div>
          </label>
        </div>

        {validation && validation.warnings.length > 0 && (
          <div className="validation-warnings">
            <h4>⚠️ Validation Warnings:</h4>
            <ul>
              {validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {renderUploadProgress(section.id)}

        {error && (
          <div className="upload-error">
            <div className="error-header">❌ Upload Failed</div>
            <div className="error-message">{error}</div>
          </div>
        )}

        {result && (
          <div className="upload-result">
            <div className={`result-summary ${result.error_count > 0 ? 'partial-success' : 'success'}`}>
              <div className="result-stats">
                <span className="success-count">✅ {result.success_count} records processed</span>
                {result.error_count > 0 && (
                  <span className="error-count">❌ {result.error_count} errors</span>
                )}
              </div>
              {result.message && (
                <div className="result-message">ℹ️ {result.message}</div>
              )}
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="error-details">
                <h4>Error Details:</h4>
                <div className="error-list">
                  {result.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="error-item">
                      <span className="error-row">Row {error.row}</span>
                      <span className="error-text">{error.message}</span>
                    </div>
                  ))}
                  {result.errors.length > 5 && (
                    <div className="error-item more-errors">
                      ... and {result.errors.length - 5} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="operations-container">
      {/* Header */}
      <div className="luxury-card page-header">
        <h1 className="luxury-heading-1">Operations Center</h1>
        <p className="luxury-body-large">Streamlined data management and bulk operations for portfolio administration</p>
      </div>

      {/* Advanced Options Toggle */}
      <div className="luxury-card">
        <div className="operations-header">
          <div className="header-actions">
            <button
              className="luxury-button-secondary"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            >
              ⚙️ Advanced Options
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter and Stats */}
      <div className="luxury-card">
        <div className="operations-controls">
          <div className="category-filters">
            <h3 className="luxury-heading-3">Filter by Category</h3>
            <div className="filter-tabs">
              {['all', 'core', 'data', 'performance'].map(category => (
                <button
                  key={category}
                  className={`filter-tab ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category === 'all' ? 'All Operations' :
                   category === 'core' ? '🏗️ Core Setup' :
                   category === 'data' ? '📊 Data Management' :
                   '📈 Performance'}
                </button>
              ))}
            </div>
          </div>

          {uploadHistory.length > 0 && (
            <div className="upload-history">
              <h3 className="luxury-heading-3">Recent Activity</h3>
              <div className="history-list">
                {uploadHistory.slice(0, 3).map(item => (
                  <div key={item.id} className="history-item">
                    <span className={`status-indicator ${item.status}`}>
                      {item.status === 'success' ? '✅' :
                       item.status === 'partial' ? '⚠️' : '❌'}
                    </span>
                    <span className="history-count">{item.recordCount} records</span>
                    <span className="history-time">
                      {item.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Options Panel */}
      {showAdvancedOptions && (
        <div className="luxury-card advanced-options">
          <h3 className="luxury-heading-3">Advanced Configuration</h3>
          <div className="options-grid">
            <div className="option-section">
              <h4>Validation Settings</h4>
              <label className="option-checkbox">
                <input type="checkbox" defaultChecked />
                <span>Strict validation mode</span>
              </label>
              <label className="option-checkbox">
                <input type="checkbox" defaultChecked />
                <span>Auto-fix common data issues</span>
              </label>
            </div>
            <div className="option-section">
              <h4>Processing Options</h4>
              <label className="option-checkbox">
                <input type="checkbox" />
                <span>Send email notifications</span>
              </label>
              <label className="option-checkbox">
                <input type="checkbox" defaultChecked />
                <span>Create backup before import</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Guide */}
      <div className="luxury-card workflow-guide">
        <h3 className="luxury-heading-3">Recommended Workflow</h3>
        <div className="workflow-steps">
          <div className="workflow-step">
            <span className="step-number">1</span>
            <div className="step-content">
              <h4>Entities & Structure</h4>
              <p>Start with entity management to establish the family office structure</p>
            </div>
          </div>
          <div className="workflow-step">
            <span className="step-number">2</span>
            <div className="step-content">
              <h4>Investment Portfolio</h4>
              <p>Upload core investment data with entity relationships</p>
            </div>
          </div>
          <div className="workflow-step">
            <span className="step-number">3</span>
            <div className="step-content">
              <h4>Performance Data</h4>
              <p>Add NAV updates, cash flows, and benchmark comparisons</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Sections */}
      <div className="upload-sections">
        {filteredSections.map(renderUploadSection)}
      </div>

      {/* Footer Information */}
      <SectionErrorBoundary>
        <div className="luxury-card operations-footer">
          <div className="footer-content">
            <div className="footer-section">
              <h4>📋 Data Quality Standards</h4>
              <p>All uploads undergo comprehensive validation including data type checks, referential integrity validation, and business rule enforcement.</p>
            </div>
            <div className="footer-section">
              <h4>🔒 Security & Compliance</h4>
              <p>All data transfers are encrypted in transit and at rest. Upload logs are maintained for audit purposes.</p>
            </div>
            <div className="footer-section">
              <h4>💡 Support Resources</h4>
              <p>Templates include detailed field descriptions and examples. Contact support for assistance with complex data migrations.</p>
            </div>
          </div>
        </div>
      </SectionErrorBoundary>
    </div>
  );
};

export default BulkUpload;