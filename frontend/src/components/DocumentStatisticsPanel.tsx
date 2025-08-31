import React from 'react';
import { DocumentStatistics } from '../types/document';
import './DocumentStatisticsPanel.css';

interface Props {
  statistics: DocumentStatistics;
  onRefresh: () => void;
}

const DocumentStatisticsPanel: React.FC<Props> = ({ statistics, onRefresh }) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCategoryIcon = (category: string): string => {
    const icons = {
      'Capital Call': '💰',
      'Distribution Notice': '💵',
      'K-1 Tax Document': '📊',
      'Quarterly Report': '📈',
      'Annual Report': '📋',
      'GP Correspondence': '✉️',
      'Financial Statement': '💹',
      'Legal Document': '⚖️',
      'Investment Memo': '📝',
      'Side Letter': '📄',
      'Subscription Document': '📑',
      'Other': '📎'
    };
    return icons[category as keyof typeof icons] || '📎';
  };

  const getStatusColor = (status: string): string => {
    const colors = {
      'Pending Review': '#ffc107',
      'Reviewed': '#28a745',
      'Action Required': '#dc3545',
      'Archived': '#6c757d'
    };
    return colors[status as keyof typeof colors] || '#6c757d';
  };

  return (
    <div className="statistics-panel">
      <div className="statistics-header">
        <h3>📊 Document Overview</h3>
        <button onClick={onRefresh} className="refresh-button" title="Refresh Statistics">
          🔄
        </button>
      </div>

      <div className="statistics-grid">
        {/* Summary Stats */}
        <div className="stat-card highlight">
          <div className="stat-value">{statistics.total_documents.toLocaleString()}</div>
          <div className="stat-label">Total Documents</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{formatFileSize(statistics.total_file_size)}</div>
          <div className="stat-label">Total Storage</div>
        </div>

        <div className="stat-card urgent">
          <div className="stat-value">{statistics.pending_action_count}</div>
          <div className="stat-label">Action Required</div>
        </div>

        <div className="stat-card warning">
          <div className="stat-value">{statistics.overdue_count}</div>
          <div className="stat-label">Overdue</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{statistics.recent_uploads_count}</div>
          <div className="stat-label">Recent Uploads (30d)</div>
        </div>
      </div>

      {/* Category Breakdown */}
      {Object.keys(statistics.by_category).length > 0 && (
        <div className="breakdown-section">
          <h4>📁 By Category</h4>
          <div className="breakdown-grid">
            {Object.entries(statistics.by_category)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 6)
              .map(([category, count]) => (
                <div key={category} className="breakdown-item">
                  <span className="breakdown-icon">{getCategoryIcon(category)}</span>
                  <span className="breakdown-label">{category}</span>
                  <span className="breakdown-count">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Status Breakdown */}
      {Object.keys(statistics.by_status).length > 0 && (
        <div className="breakdown-section">
          <h4>🏷️ By Status</h4>
          <div className="status-breakdown">
            {Object.entries(statistics.by_status).map(([status, count]) => (
              <div key={status} className="status-item">
                <div 
                  className="status-indicator"
                  style={{ backgroundColor: getStatusColor(status) }}
                ></div>
                <span className="status-label">{status}</span>
                <span className="status-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Entities */}
      {Object.keys(statistics.by_entity).length > 0 && (
        <div className="breakdown-section">
          <h4>🏢 Top Entities</h4>
          <div className="top-list">
            {Object.entries(statistics.by_entity)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([entity, count]) => (
                <div key={entity} className="top-item">
                  <span className="top-label">{entity}</span>
                  <span className="top-count">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Top Investments */}
      {Object.keys(statistics.by_investment).length > 0 && (
        <div className="breakdown-section">
          <h4>💼 Top Investments</h4>
          <div className="top-list">
            {Object.entries(statistics.by_investment)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([investment, count]) => (
                <div key={investment} className="top-item">
                  <span className="top-label">{investment}</span>
                  <span className="top-count">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentStatisticsPanel;