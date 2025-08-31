import React, { useState } from 'react';
import { DocumentFilters, DocumentCategory, DocumentStatus } from '../types/document';
import './DocumentFilterPanel.css';

interface Props {
  onFiltersChange: (filters: DocumentFilters) => void;
  onClearFilters: () => void;
  resultCount?: number;
  isSearchMode?: boolean;
}

const DocumentFilterPanel: React.FC<Props> = ({
  onFiltersChange,
  onClearFilters,
  resultCount,
  isSearchMode = false
}) => {
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof DocumentFilters, value: any) => {
    const newFilters = {
      ...filters,
      [key]: value
    };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    setFilters({});
    onClearFilters();
  };

  const hasActiveFilters = Object.values(filters).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== '';
  });

  const handleCategoryChange = (category: DocumentCategory, checked: boolean) => {
    const current = filters.categories || [];
    if (checked) {
      updateFilter('categories', [...current, category]);
    } else {
      updateFilter('categories', current.filter(c => c !== category));
    }
  };

  const handleStatusChange = (status: DocumentStatus, checked: boolean) => {
    const current = filters.statuses || [];
    if (checked) {
      updateFilter('statuses', [...current, status]);
    } else {
      updateFilter('statuses', current.filter(s => s !== status));
    }
  };

  if (isSearchMode) {
    return (
      <div className="filter-panel search-mode">
        <div className="filter-header">
          <div className="filter-title">
            <span>🔍 Search Results</span>
            {resultCount !== undefined && (
              <span className="result-count">({resultCount} results)</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="filter-panel">
      <div className="filter-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="filter-title">
          <span>🔧 Filters</span>
          {resultCount !== undefined && (
            <span className="result-count">({resultCount} results)</span>
          )}
        </div>
        <div className="filter-controls">
          {hasActiveFilters && (
            <button 
              className="clear-filters-btn"
              onClick={(e) => {
                e.stopPropagation();
                clearAllFilters();
              }}
            >
              Clear All
            </button>
          )}
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Document Categories */}
          <div className="filter-section">
            <label className="filter-label">Categories</label>
            <div className="checkbox-group">
              {Object.values(DocumentCategory).map(category => (
                <label key={category} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.categories?.includes(category) || false}
                    onChange={(e) => handleCategoryChange(category, e.target.checked)}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Document Status */}
          <div className="filter-section">
            <label className="filter-label">Status</label>
            <div className="checkbox-group">
              {Object.values(DocumentStatus).map(status => (
                <label key={status} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.statuses?.includes(status) || false}
                    onChange={(e) => handleStatusChange(status, e.target.checked)}
                  />
                  <span>{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Filters */}
          <div className="filter-section">
            <label className="filter-label">Document Date Range</label>
            <div className="date-inputs">
              <input
                type="date"
                className="date-input"
                placeholder="From"
                value={filters.date_from || ''}
                onChange={(e) => updateFilter('date_from', e.target.value)}
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                className="date-input"
                placeholder="To"
                value={filters.date_to || ''}
                onChange={(e) => updateFilter('date_to', e.target.value)}
              />
            </div>
          </div>

          {/* Due Date Filters */}
          <div className="filter-section">
            <label className="filter-label">Due Date Range</label>
            <div className="date-inputs">
              <input
                type="date"
                className="date-input"
                placeholder="From"
                value={filters.due_date_from || ''}
                onChange={(e) => updateFilter('due_date_from', e.target.value)}
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                className="date-input"
                placeholder="To"
                value={filters.due_date_to || ''}
                onChange={(e) => updateFilter('due_date_to', e.target.value)}
              />
            </div>
          </div>

          {/* Additional Filters */}
          <div className="filter-section">
            <label className="filter-label">Additional Options</label>
            <div className="checkbox-group">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={filters.is_confidential === true}
                  onChange={(e) => updateFilter('is_confidential', e.target.checked ? true : undefined)}
                />
                <span>Confidential only</span>
              </label>
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={filters.is_archived === true}
                  onChange={(e) => updateFilter('is_archived', e.target.checked ? true : undefined)}
                />
                <span>Include archived</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentFilterPanel;