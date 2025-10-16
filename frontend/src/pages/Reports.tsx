import React, { useState } from 'react';
import { reportsAPI } from '../services/api';
import CashFlowReportModal, { CashFlowReportConfig } from '../components/CashFlowReportModal';
import LPQuarterlyStatementModal, { LPQuarterlyStatementConfig } from '../components/LPQuarterlyStatementModal';
import './Reports.css';

interface ReportSection {
  id: string;
  title: string;
  description: string;
  reports: Report[];
}

interface Report {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  icon: string;
}

const Reports: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCashFlowModal, setShowCashFlowModal] = useState(false);
  const [showLPStatementModal, setShowLPStatementModal] = useState(false);

  const reportSections: ReportSection[] = [
    {
      id: 'fund-manager',
      title: 'Fund Manager Reports',
      description: 'LP statements and fund-level reporting',
      reports: [
        {
          id: 'lp-quarterly-statement',
          name: 'LP Quarterly Statement',
          description: 'Comprehensive quarterly statement for Limited Partners including capital account summary, performance metrics, portfolio details, and transaction history',
          endpoint: '/api/reports/lp-quarterly-statement',
          icon: '📄'
        }
      ]
    },
    {
      id: 'performance',
      title: 'Performance Reports',
      description: 'Portfolio-wide and investment-level performance analytics',
      reports: [
        {
          id: 'portfolio-summary',
          name: 'Portfolio Summary',
          description: 'Comprehensive overview including NAV, commitments, performance metrics (IRR, TVPI, DPI, RVPI), asset allocation, and vintage analysis',
          endpoint: '/api/reports/portfolio-summary',
          icon: '📊'
        }
      ]
    },
    {
      id: 'holdings',
      title: 'Holdings & Positions',
      description: 'Current investment positions and holdings data',
      reports: [
        {
          id: 'holdings',
          name: 'Holdings Report',
          description: 'Detailed view of all active investments with commitments, called amounts, uncalled capital, current NAV, and performance metrics',
          endpoint: '/api/reports/holdings',
          icon: '💼'
        }
      ]
    },
    {
      id: 'entities',
      title: 'Entity Reports',
      description: 'Entity-level aggregations and performance',
      reports: [
        {
          id: 'entity-performance',
          name: 'Entity Performance',
          description: 'Performance metrics aggregated by entity including total commitments, distributions, NAV, TVPI, and IRR for each entity',
          endpoint: '/api/reports/entity-performance',
          icon: '🏢'
        }
      ]
    },
    {
      id: 'cash-flow',
      title: 'Cash Flow Reports',
      description: 'Capital calls, distributions, and cash flow activity',
      reports: [
        {
          id: 'cash-flow-activity',
          name: 'Cash Flow Activity',
          description: 'Detailed analysis of capital calls and distributions over a selected time period with various grouping and filtering options',
          endpoint: '/api/reports/cash-flow-activity',
          icon: '💰'
        }
      ]
    }
  ];

  const handleGenerateReport = async (report: Report) => {
    // Show modal for LP quarterly statement
    if (report.id === 'lp-quarterly-statement') {
      setShowLPStatementModal(true);
      return;
    }

    // Show modal for cash flow activity report
    if (report.id === 'cash-flow-activity') {
      setShowCashFlowModal(true);
      return;
    }

    setLoading(report.id);
    setError(null);

    try {
      const response = await reportsAPI.generateReport(report.endpoint);

      // Create blob from response
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.id}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.response?.data?.detail || 'Failed to generate report. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateCashFlowReport = async (config: CashFlowReportConfig) => {
    setShowCashFlowModal(false);
    setLoading('cash-flow-activity');
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        time_period: config.timePeriod,
        cash_flow_types: config.cashFlowTypes.join(','),
        group_by: config.groupBy,
        ...(config.startDate && { start_date: config.startDate }),
        ...(config.endDate && { end_date: config.endDate })
      });

      const response = await reportsAPI.generateReport(`/api/reports/cash-flow-activity?${params.toString()}`);

      // Create blob from response
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `cash-flow-activity_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error('Error generating cash flow report:', err);
      setError(err.response?.data?.detail || 'Failed to generate report. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateLPStatement = async (config: LPQuarterlyStatementConfig) => {
    setShowLPStatementModal(false);
    setLoading('lp-quarterly-statement');
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        lp_id: config.lpId,
        quarter: config.quarter,
        year: config.year,
        include_portfolio_details: config.includePortfolioDetails.toString(),
        include_transaction_history: config.includeTransactionHistory.toString(),
        include_projections: config.includeProjections.toString()
      });

      // For now, simulate PDF generation with a success message
      // In production, this would call: reportsAPI.generateReport(`/api/reports/lp-quarterly-statement?${params.toString()}`)

      console.log('Generating LP Quarterly Statement with config:', config);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Create a mock PDF blob for demonstration
      const mockPdfContent = `LP Quarterly Statement Mock PDF\n\nLP: ${config.lpName}\nPeriod: ${config.quarter} ${config.year}\n\nThis is a mockup. In production, this would be a real PDF generated from the backend.`;
      const blob = new Blob([mockPdfContent], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `lp-quarterly-statement_${config.lpName.replace(/\s/g, '_')}_${config.quarter}_${config.year}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show success message
      alert(`Successfully generated LP Quarterly Statement for ${config.lpName} (${config.quarter} ${config.year})`);

    } catch (err: any) {
      console.error('Error generating LP statement:', err);
      setError(err.response?.data?.detail || 'Failed to generate LP statement. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Reports</h1>
        <p className="reports-subtitle">Generate professional PDF reports for your portfolio analytics</p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="reports-grid">
        {reportSections.map(section => (
          <div key={section.id} className="report-section">
            <div className="section-header">
              <h2>{section.title}</h2>
              <p className="section-description">{section.description}</p>
            </div>

            <div className="reports-list">
              {section.reports.map(report => (
                <div key={report.id} className="report-card">
                  <div className="report-icon">{report.icon}</div>
                  <div className="report-content">
                    <h3>{report.name}</h3>
                    <p className="report-description">{report.description}</p>
                  </div>
                  <button
                    className="generate-button"
                    onClick={() => handleGenerateReport(report)}
                    disabled={loading === report.id}
                  >
                    {loading === report.id ? (
                      <>
                        <span className="spinner"></span>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                        </svg>
                        Generate PDF
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="reports-info">
        <h3>Report Information</h3>
        <ul>
          <li>All reports are generated as of today's date</li>
          <li>Reports include only your tenant's data with full isolation</li>
          <li>PDFs are formatted for professional presentation</li>
          <li>Future enhancements will include date range selection and scheduling</li>
        </ul>
      </div>

      <CashFlowReportModal
        isOpen={showCashFlowModal}
        onClose={() => setShowCashFlowModal(false)}
        onGenerate={handleGenerateCashFlowReport}
      />

      <LPQuarterlyStatementModal
        isOpen={showLPStatementModal}
        onClose={() => setShowLPStatementModal(false)}
        onGenerate={handleGenerateLPStatement}
      />
    </div>
  );
};

export default Reports;
