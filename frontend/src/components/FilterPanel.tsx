import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { InvestmentFilters, FilterOptions, investmentAPI } from '../services/api';
import './FilterPanel.css';

interface FilterPanelProps {
  onFiltersChange: (filters: InvestmentFilters) => void;
  onClearFilters: () => void;
  resultCount?: number;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ 
  onFiltersChange, 
  onClearFilters, 
  resultCount 
}) => {
  const [filters, setFilters] = useState<InvestmentFilters>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load filter options on component mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const options = await investmentAPI.getFilterOptions();
        setFilterOptions(options);
      } catch (error) {
        console.error('Failed to load filter options:', error);
      }
    };
    
    loadFilterOptions();
  }, []);

  // Notify parent when filters change
  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const updateFilter = useCallback((key: keyof InvestmentFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({});
    onClearFilters();
  }, [onClearFilters]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '';
    });
  }, [filters]);

  const handleAssetClassChange = useCallback((assetClass: string, checked: boolean) => {
    const current = filters.asset_classes || [];
    if (checked) {
      updateFilter('asset_classes', [...current, assetClass]);
    } else {
      updateFilter('asset_classes', current.filter(ac => ac !== assetClass));
    }
  }, [filters.asset_classes, updateFilter]);

  const handleEntityChange = useCallback((entityName: string, checked: boolean) => {
    const current = filters.entity_names || [];
    if (checked) {
      updateFilter('entity_names', [...current, entityName]);
    } else {
      updateFilter('entity_names', current.filter(name => name !== entityName));
    }
  }, [filters.entity_names, updateFilter]);

  const handleEntityTypeChange = useCallback((entityType: string, checked: boolean) => {
    const current = filters.entity_types || [];
    if (checked) {
      updateFilter('entity_types', [...current, entityType]);
    } else {
      updateFilter('entity_types', current.filter(type => type !== entityType));
    }
  }, [filters.entity_types, updateFilter]);

  if (!filterOptions) {
    return (
      <div className="filter-panel">
        <div className="filter-header">
          <span>🔍 Loading filters...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="filter-panel">
      <div className="filter-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="filter-title">
          <span>🔍 Advanced Filters</span>
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
          {/* Search Input */}
          <div className="filter-section">
            <label className="filter-label">Search</label>
            <input
              type="text"
              className="search-input"
              placeholder="Search investments, entities, or strategies..."
              value={filters.search || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>

          {/* Asset Classes */}
          <div className="filter-section">
            <label className="filter-label">Asset Classes</label>
            <div className="checkbox-group">
              {filterOptions.asset_classes.map(assetClass => (
                <label key={assetClass} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.asset_classes?.includes(assetClass) || false}
                    onChange={(e) => handleAssetClassChange(assetClass, e.target.checked)}
                  />
                  <span>{assetClass}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Vintage Year Range */}
          <div className="filter-section">
            <label className="filter-label">Vintage Year Range</label>
            <div className="range-inputs">
              <input
                type="number"
                className="range-input"
                placeholder="Min"
                min={filterOptions.vintage_year_range.min}
                max={filterOptions.vintage_year_range.max}
                value={filters.min_vintage_year || ''}
                onChange={(e) => updateFilter('min_vintage_year', e.target.value ? parseInt(e.target.value) : undefined)}
              />
              <span className="range-separator">to</span>
              <input
                type="number"
                className="range-input"
                placeholder="Max"
                min={filterOptions.vintage_year_range.min}
                max={filterOptions.vintage_year_range.max}
                value={filters.max_vintage_year || ''}
                onChange={(e) => updateFilter('max_vintage_year', e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>
            <small className="range-hint">
              Available: {filterOptions.vintage_year_range.min} - {filterOptions.vintage_year_range.max}
            </small>
          </div>

          {/* Commitment Amount Range */}
          <div className="filter-section">
            <label className="filter-label">Commitment Amount ($)</label>
            <div className="range-inputs">
              <input
                type="number"
                className="range-input"
                placeholder="Min"
                min={0}
                value={filters.min_commitment || ''}
                onChange={(e) => updateFilter('min_commitment', e.target.value ? parseFloat(e.target.value) : undefined)}
              />
              <span className="range-separator">to</span>
              <input
                type="number"
                className="range-input"
                placeholder="Max"
                min={0}
                value={filters.max_commitment || ''}
                onChange={(e) => updateFilter('max_commitment', e.target.value ? parseFloat(e.target.value) : undefined)}
              />
            </div>
          </div>

          {/* Entity Types */}
          {filterOptions.entity_types && filterOptions.entity_types.length > 0 && (
            <div className="filter-section">
              <label className="filter-label">Entity Types</label>
              <div className="checkbox-group">
                {filterOptions.entity_types.map(entityType => (
                  <label key={entityType} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={filters.entity_types?.includes(entityType) || false}
                      onChange={(e) => handleEntityTypeChange(entityType, e.target.checked)}
                    />
                    <span>{entityType}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Entity Names */}
          {filterOptions.entity_names && filterOptions.entity_names.length > 0 && (
            <div className="filter-section">
              <label className="filter-label">Entities</label>
              <div className="checkbox-group entities-group">
                {filterOptions.entity_names.slice(0, 8).map(entityName => (
                  <label key={entityName} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={filters.entity_names?.includes(entityName) || false}
                      onChange={(e) => handleEntityChange(entityName, e.target.checked)}
                    />
                    <span>{entityName}</span>
                  </label>
                ))}
                {filterOptions.entity_names.length > 8 && (
                  <small className="more-options">
                    +{filterOptions.entity_names.length - 8} more entities available
                  </small>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPanel;