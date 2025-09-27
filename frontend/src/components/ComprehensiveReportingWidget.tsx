import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Investment, InvestmentStatus } from '../types/investment';
import './ComprehensiveReportingWidget.css';

interface ComprehensiveReportingWidgetProps {
  investments: Investment[];
  onReportGenerated?: (report: GeneratedReport) => void;
}

interface ReportSettings {
  reportType: 'performance' | 'risk' | 'allocation' | 'cashflow' | 'compliance' | 'comprehensive';
  frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  format: 'pdf' | 'excel' | 'powerpoint';
  audience: 'board' | 'investment_committee' | 'family_office' | 'external_auditor';
  includeCharts: boolean;
  includeExecutiveSummary: boolean;
  includeBenchmarks: boolean;
  includeStressTests: boolean;
  customSections: string[];
}

interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'table' | 'chart' | 'narrative';
  content: any;
  priority: number;
}

interface GeneratedReport {
  id: string;
  title: string;
  generatedDate: string;
  reportType: string;
  sections: ReportSection[];
  metadata: {
    totalPages: number;
    dataAsOf: string;
    reportPeriod: string;
    audience: string;
  };
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
  audience: string;
  frequency: string;
}

const ComprehensiveReportingWidget: React.FC<ComprehensiveReportingWidgetProps> = ({
  investments,
  onReportGenerated
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'custom' | 'history' | 'schedule'>('templates');
  const [reportSettings, setReportSettings] = useState<ReportSettings>({
    reportType: 'comprehensive',
    frequency: 'quarterly',
    format: 'pdf',
    audience: 'investment_committee',
    includeCharts: true,
    includeExecutiveSummary: true,
    includeBenchmarks: true,
    includeStressTests: false,
    customSections: []
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);

  // Predefined report templates
  const reportTemplates: ReportTemplate[] = useMemo(() => [
    {
      id: 'board-quarterly',
      name: 'Board Quarterly Report',
      description: 'High-level executive summary for board meetings',
      sections: ['executive_summary', 'performance_overview', 'asset_allocation', 'key_metrics', 'risk_highlights'],
      audience: 'board',
      frequency: 'quarterly'
    },
    {
      id: 'ic-comprehensive',
      name: 'Investment Committee Comprehensive',
      description: 'Detailed analysis for investment committee review',
      sections: ['executive_summary', 'performance_analysis', 'risk_analysis', 'asset_allocation', 'benchmarking', 'cash_flow_forecast', 'portfolio_changes'],
      audience: 'investment_committee',
      frequency: 'monthly'
    },
    {
      id: 'family-office-annual',
      name: 'Family Office Annual Review',
      description: 'Comprehensive annual review for family office',
      sections: ['executive_summary', 'year_in_review', 'performance_analysis', 'risk_assessment', 'asset_allocation', 'ESG_impact', 'outlook', 'recommendations'],
      audience: 'family_office',
      frequency: 'annual'
    },
    {
      id: 'compliance-audit',
      name: 'Compliance & Audit Report',
      description: 'Regulatory compliance and audit trail documentation',
      sections: ['compliance_summary', 'regulatory_metrics', 'risk_controls', 'audit_trail', 'disclosures', 'certifications'],
      audience: 'external_auditor',
      frequency: 'annual'
    },
    {
      id: 'performance-monthly',
      name: 'Monthly Performance Flash',
      description: 'Quick performance update for monthly review',
      sections: ['performance_summary', 'market_commentary', 'portfolio_changes', 'key_metrics'],
      audience: 'investment_committee',
      frequency: 'monthly'
    }
  ], []);

  // Calculate report data based on current portfolio
  const reportData = useMemo(() => {
    const activeInvestments = investments.filter(inv => inv.status === InvestmentStatus.ACTIVE);

    if (activeInvestments.length === 0) {
      return {
        totalValue: 0,
        totalCommitments: 0,
        assetAllocation: {},
        performance: { totalReturn: 0, irr: 0, tvpi: 1.0 },
        riskMetrics: { concentrationRisk: 0, diversificationScore: 0 }
      };
    }

    // Helper functions for calculated fields
    const getCurrentValue = (investment: Investment): number => {
      if (investment.valuations && investment.valuations.length > 0) {
        const latestValuation = investment.valuations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return latestValuation.nav_value || 0;
      }
      return 0;
    };

    const getCommitment = (investment: Investment): number => {
      return investment.commitment_amount || 0;
    };

    const getContributions = (investment: Investment): number => {
      return investment.called_amount || 0;
    };

    const getDistributions = (investment: Investment): number => {
      if (investment.cashflows && investment.cashflows.length > 0) {
        return investment.cashflows
          .filter(cf => cf.type === 'Distribution' || cf.type === 'Yield' || cf.type === 'Return of Principal')
          .reduce((sum, cf) => sum + cf.amount, 0);
      }
      return 0;
    };

    const totalValue = activeInvestments.reduce((sum, inv) => sum + getCurrentValue(inv), 0);
    const totalCommitments = activeInvestments.reduce((sum, inv) => sum + getCommitment(inv), 0);

    // Asset allocation
    const assetAllocation = activeInvestments.reduce((acc, inv) => {
      const assetClass = inv.asset_class || 'Other';
      acc[assetClass] = (acc[assetClass] || 0) + getCurrentValue(inv);
      return acc;
    }, {} as { [key: string]: number });

    // Performance metrics
    const totalContributions = activeInvestments.reduce((sum, inv) => sum + getContributions(inv), 0);
    const totalDistributions = activeInvestments.reduce((sum, inv) => sum + getDistributions(inv), 0);
    const tvpi = totalContributions > 0 ? (totalValue + totalDistributions) / totalContributions : 1.0;
    const totalReturn = ((totalValue + totalDistributions - totalContributions) / totalContributions) * 100;

    // Risk metrics
    const assetClassValues = Object.values(assetAllocation);
    const concentrationRisk = assetClassValues.reduce((sum: number, val: number) => {
      const weight = val / totalValue;
      return sum + weight * weight;
    }, 0) * 100;

    return {
      totalValue,
      totalCommitments,
      assetAllocation,
      performance: { totalReturn, irr: 12.5, tvpi }, // IRR simplified for demo
      riskMetrics: { concentrationRisk, diversificationScore: activeInvestments.length / 20 }
    };
  }, [investments]);

  // Generate report sections based on settings
  const generateReportSections = useCallback((settings: ReportSettings): ReportSection[] => {
    const sections: ReportSection[] = [];

    if (settings.includeExecutiveSummary) {
      sections.push({
        id: 'executive_summary',
        title: 'Executive Summary',
        type: 'narrative',
        content: {
          text: `Portfolio Performance: The portfolio generated a total return of ${reportData.performance.totalReturn.toFixed(1)}% with a TVPI of ${reportData.performance.tvpi.toFixed(2)}x. Current NAV stands at ${formatCurrency(reportData.totalValue)} across ${investments.length} investments. Risk concentration remains ${reportData.riskMetrics.concentrationRisk > 25 ? 'elevated' : 'manageable'} at ${reportData.riskMetrics.concentrationRisk.toFixed(1)}%.`
        },
        priority: 1
      });
    }

    sections.push({
      id: 'performance_overview',
      title: 'Performance Overview',
      type: 'table',
      content: {
        headers: ['Metric', 'Value', 'Benchmark', 'Variance'],
        rows: [
          ['Total Return', `${reportData.performance.totalReturn.toFixed(1)}%`, '10.5%', `+${(reportData.performance.totalReturn - 10.5).toFixed(1)}%`],
          ['TVPI', `${reportData.performance.tvpi.toFixed(2)}x`, '1.45x', `+${(reportData.performance.tvpi - 1.45).toFixed(2)}x`],
          ['IRR', `${reportData.performance.irr.toFixed(1)}%`, '12.0%', `+${(reportData.performance.irr - 12.0).toFixed(1)}%`],
          ['Current NAV', formatCurrency(reportData.totalValue), 'N/A', 'N/A']
        ]
      },
      priority: 2
    });

    sections.push({
      id: 'asset_allocation',
      title: 'Asset Allocation',
      type: 'chart',
      content: {
        type: 'pie',
        data: Object.entries(reportData.assetAllocation).map(([assetClass, value]) => ({
          label: assetClass,
          value: value,
          percentage: (((value as number) / reportData.totalValue) * 100).toFixed(1)
        }))
      },
      priority: 3
    });

    if (settings.includeBenchmarks) {
      sections.push({
        id: 'benchmark_comparison',
        title: 'Benchmark Comparison',
        type: 'table',
        content: {
          headers: ['Period', 'Portfolio', 'S&P 500', 'Private Equity Index', 'Excess Return'],
          rows: [
            ['1 Year', '15.2%', '12.1%', '14.8%', '+0.4%'],
            ['3 Year', '12.8%', '10.5%', '13.2%', '-0.4%'],
            ['5 Year', '11.9%', '9.8%', '12.5%', '-0.6%'],
            ['Since Inception', `${reportData.performance.totalReturn.toFixed(1)}%`, '8.9%', '11.2%', `+${(reportData.performance.totalReturn - 11.2).toFixed(1)}%`]
          ]
        },
        priority: 4
      });
    }

    if (settings.includeStressTests) {
      sections.push({
        id: 'stress_testing',
        title: 'Stress Test Results',
        type: 'table',
        content: {
          headers: ['Scenario', 'Expected Loss', 'Portfolio Impact', 'Recovery Time'],
          rows: [
            ['Market Downturn (-30%)', '-25%', formatCurrency(reportData.totalValue * -0.25), '18-24 months'],
            ['Credit Crisis', '-20%', formatCurrency(reportData.totalValue * -0.20), '12-18 months'],
            ['Liquidity Crunch', '-15%', formatCurrency(reportData.totalValue * -0.15), '6-12 months']
          ]
        },
        priority: 5
      });
    }

    sections.push({
      id: 'risk_analysis',
      title: 'Risk Analysis',
      type: 'summary',
      content: {
        metrics: [
          { label: 'Concentration Risk', value: `${reportData.riskMetrics.concentrationRisk.toFixed(1)}%`, status: reportData.riskMetrics.concentrationRisk > 25 ? 'warning' : 'good' },
          { label: 'Diversification Score', value: `${(reportData.riskMetrics.diversificationScore * 100).toFixed(0)}%`, status: reportData.riskMetrics.diversificationScore > 0.7 ? 'good' : 'warning' },
          { label: 'Liquidity Risk', value: 'Medium', status: 'warning' },
          { label: 'ESG Risk', value: 'Low', status: 'good' }
        ]
      },
      priority: 6
    });

    // Sort sections by priority
    return sections.sort((a, b) => a.priority - b.priority);
  }, [reportData, investments.length]);

  const handleGenerateReport = useCallback(async () => {
    setIsGenerating(true);

    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      const sections = generateReportSections(reportSettings);
      const report: GeneratedReport = {
        id: `report_${Date.now()}`,
        title: `${reportSettings.reportType.toUpperCase()} Report - ${new Date().toLocaleDateString()}`,
        generatedDate: new Date().toISOString(),
        reportType: reportSettings.reportType,
        sections,
        metadata: {
          totalPages: Math.ceil(sections.length * 1.5),
          dataAsOf: new Date().toLocaleDateString(),
          reportPeriod: reportSettings.frequency,
          audience: reportSettings.audience
        }
      };

      setGeneratedReports(prev => [report, ...prev]);
      onReportGenerated?.(report);

    } finally {
      setIsGenerating(false);
    }
  }, [reportSettings, generateReportSections, onReportGenerated]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = reportTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setReportSettings(prev => ({
        ...prev,
        frequency: template.frequency as any,
        audience: template.audience as any,
        customSections: template.sections
      }));
    }
  }, [reportTemplates]);

  const handleSettingsChange = useCallback((newSettings: Partial<ReportSettings>) => {
    setReportSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="comprehensive-reporting-widget">
      <div className="widget-header">
        <h3>Comprehensive Reporting</h3>
        <div className="reporting-controls">
          <button
            className={`generate-button ${isGenerating ? 'generating' : ''}`}
            onClick={handleGenerateReport}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner"></span>
                Generating...
              </>
            ) : (
              'Generate Report'
            )}
          </button>
        </div>
      </div>

      <div className="reporting-tabs">
        {['templates', 'custom', 'history', 'schedule'].map((tab) => (
          <button
            key={tab}
            className={`reporting-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="reporting-content">
        {activeTab === 'templates' && (
          <div className="report-templates">
            <h4>Report Templates</h4>
            <div className="templates-grid">
              {reportTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <div className="template-header">
                    <h5>{template.name}</h5>
                    <div className="template-badges">
                      <span className={`audience-badge ${template.audience.replace('_', '-')}`}>
                        {template.audience.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="frequency-badge">{template.frequency}</span>
                    </div>
                  </div>
                  <p className="template-description">{template.description}</p>
                  <div className="template-sections">
                    <strong>Included Sections:</strong>
                    <div className="sections-list">
                      {template.sections.map((section, index) => (
                        <span key={index} className="section-tag">
                          {section.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedTemplate && (
              <div className="template-preview">
                <h4>Template Preview</h4>
                <div className="preview-content">
                  <div className="preview-sections">
                    {generateReportSections(reportSettings).slice(0, 3).map((section) => (
                      <div key={section.id} className="preview-section">
                        <h5>{section.title}</h5>
                        <div className={`section-type ${section.type}`}>
                          {section.type === 'narrative' && (
                            <p>{section.content.text}</p>
                          )}
                          {section.type === 'table' && (
                            <div className="preview-table">
                              <div className="table-header">
                                {section.content.headers.map((header: string, index: number) => (
                                  <div key={index}>{header}</div>
                                ))}
                              </div>
                              {section.content.rows.slice(0, 2).map((row: string[], index: number) => (
                                <div key={index} className="table-row">
                                  {row.map((cell, cellIndex) => (
                                    <div key={cellIndex}>{cell}</div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                          {section.type === 'chart' && (
                            <div className="preview-chart">
                              <div className="chart-placeholder">
                                📊 {section.content.type.toUpperCase()} Chart
                              </div>
                            </div>
                          )}
                          {section.type === 'summary' && (
                            <div className="preview-summary">
                              {section.content.metrics.map((metric: any, index: number) => (
                                <div key={index} className="metric-item">
                                  <span className="metric-label">{metric.label}:</span>
                                  <span className={`metric-value ${metric.status}`}>{metric.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="custom-reporting">
            <h4>Custom Report Settings</h4>
            <div className="settings-grid">
              <div className="setting-section">
                <h5>Report Configuration</h5>
                <div className="setting-group">
                  <label>Report Type</label>
                  <select
                    value={reportSettings.reportType}
                    onChange={(e) => handleSettingsChange({ reportType: e.target.value as any })}
                  >
                    <option value="performance">Performance Report</option>
                    <option value="risk">Risk Assessment</option>
                    <option value="allocation">Asset Allocation</option>
                    <option value="cashflow">Cash Flow Analysis</option>
                    <option value="compliance">Compliance Report</option>
                    <option value="comprehensive">Comprehensive Report</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Frequency</label>
                  <select
                    value={reportSettings.frequency}
                    onChange={(e) => handleSettingsChange({ frequency: e.target.value as any })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi-annual">Semi-Annual</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Format</label>
                  <select
                    value={reportSettings.format}
                    onChange={(e) => handleSettingsChange({ format: e.target.value as any })}
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="excel">Excel Workbook</option>
                    <option value="powerpoint">PowerPoint Presentation</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>Target Audience</label>
                  <select
                    value={reportSettings.audience}
                    onChange={(e) => handleSettingsChange({ audience: e.target.value as any })}
                  >
                    <option value="board">Board of Directors</option>
                    <option value="investment_committee">Investment Committee</option>
                    <option value="family_office">Family Office</option>
                    <option value="external_auditor">External Auditor</option>
                  </select>
                </div>
              </div>

              <div className="setting-section">
                <h5>Content Options</h5>
                <div className="checkbox-options">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={reportSettings.includeExecutiveSummary}
                      onChange={(e) => handleSettingsChange({ includeExecutiveSummary: e.target.checked })}
                    />
                    <span>Executive Summary</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={reportSettings.includeCharts}
                      onChange={(e) => handleSettingsChange({ includeCharts: e.target.checked })}
                    />
                    <span>Include Charts & Visualizations</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={reportSettings.includeBenchmarks}
                      onChange={(e) => handleSettingsChange({ includeBenchmarks: e.target.checked })}
                    />
                    <span>Benchmark Comparisons</span>
                  </label>

                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={reportSettings.includeStressTests}
                      onChange={(e) => handleSettingsChange({ includeStressTests: e.target.checked })}
                    />
                    <span>Stress Test Results</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="report-history">
            <h4>Report History</h4>
            {generatedReports.length === 0 ? (
              <div className="no-reports">
                <div className="no-reports-icon">📋</div>
                <p>No reports generated yet. Use the templates or custom settings to generate your first report.</p>
              </div>
            ) : (
              <div className="reports-list">
                {generatedReports.map((report) => (
                  <div key={report.id} className="report-item">
                    <div className="report-header">
                      <div className="report-title">{report.title}</div>
                      <div className="report-date">{new Date(report.generatedDate).toLocaleDateString()}</div>
                    </div>
                    <div className="report-metadata">
                      <span className="report-type">{report.reportType.toUpperCase()}</span>
                      <span className="report-pages">{report.metadata.totalPages} pages</span>
                      <span className="report-audience">{report.metadata.audience.replace('_', ' ')}</span>
                    </div>
                    <div className="report-actions">
                      <button className="action-button download">Download</button>
                      <button className="action-button share">Share</button>
                      <button className="action-button archive">Archive</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="report-scheduling">
            <h4>Scheduled Reports</h4>
            <div className="schedule-options">
              <div className="schedule-card">
                <h5>Automated Report Generation</h5>
                <p>Set up automated report generation based on your preferences</p>

                <div className="schedule-settings">
                  <div className="setting-group">
                    <label>Report Template</label>
                    <select>
                      <option>Board Quarterly Report</option>
                      <option>Investment Committee Monthly</option>
                      <option>Family Office Annual</option>
                    </select>
                  </div>

                  <div className="setting-group">
                    <label>Schedule</label>
                    <select>
                      <option>First Monday of each quarter</option>
                      <option>Last Friday of each month</option>
                      <option>15th of each month</option>
                      <option>Custom schedule</option>
                    </select>
                  </div>

                  <div className="setting-group">
                    <label>Recipients</label>
                    <input type="text" placeholder="Enter email addresses separated by commas" />
                  </div>

                  <div className="checkbox-options">
                    <label className="checkbox-option">
                      <input type="checkbox" defaultChecked />
                      <span>Email notification when report is ready</span>
                    </label>
                    <label className="checkbox-option">
                      <input type="checkbox" />
                      <span>Auto-archive reports after 2 years</span>
                    </label>
                  </div>

                  <button className="schedule-button">Schedule Report</button>
                </div>
              </div>

              <div className="scheduled-reports">
                <h5>Active Schedules</h5>
                <div className="scheduled-list">
                  <div className="scheduled-item">
                    <div className="schedule-info">
                      <div className="schedule-name">Quarterly Board Report</div>
                      <div className="schedule-details">Every quarter on 1st Monday • PDF format</div>
                      <div className="schedule-next">Next: January 6, 2025</div>
                    </div>
                    <div className="schedule-actions">
                      <button className="icon-button edit-icon">✏️</button>
                      <button className="action-button pause">Pause</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComprehensiveReportingWidget;