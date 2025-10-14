import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Investment, PerformanceMetrics, InvestmentStatus } from '../types/investment';
import { performanceAPI } from '../services/api';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import EditInvestmentModal from './EditInvestmentModal';
import InvestmentStatusManager from './InvestmentStatusManager';
import './EnhancedInvestmentsTable.css';

type SortField = 'name' | 'asset_class' | 'vintage_year' | 'commitment_amount' | 'called_amount' | 'entity';
type SortDirection = 'asc' | 'desc';
type ViewTab = 'basic' | 'financial' | 'operational' | 'legal' | 'performance';

interface TableFilters {
  search: string;
  assetClass: string;
  entity: string;
  vintageYear: string;
}

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

interface Props {
  investments: Investment[];
  onDelete: (id: number) => void;
  onUpdate: () => void;
  onAddInvestment?: () => void;
  onExportData?: () => void;
  hideFilters?: boolean;
  externalFilters?: TableFilters;
  onExternalFilterChange?: (key: keyof TableFilters, value: string) => void;
  onClearExternalFilters?: () => void;
  filterOptions?: {
    assetClasses: string[];
    entities: string[];
    vintageYears: string[];
  };
}

const EnhancedInvestmentsTable: React.FC<Props> = ({
  investments,
  onDelete,
  onUpdate,
  onAddInvestment,
  onExportData,
  hideFilters = false,
  externalFilters,
  onExternalFilterChange,
  onClearExternalFilters,
  filterOptions: externalFilterOptions
}) => {
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [statusManagementInvestment, setStatusManagementInvestment] = useState<Investment | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('basic');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: 'asc' });
  const [filters, setFilters] = useState<TableFilters>({
    search: '',
    assetClass: '',
    entity: '',
    vintageYear: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [performanceData, setPerformanceData] = useState<Map<number, PerformanceMetrics>>(new Map());
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const itemsPerPage = 25;
  const navigate = useNavigate();

  const handleDelete = useCallback(async (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      onDelete(id);
    }
  }, [onDelete]);

  const handleEdit = useCallback((investment: Investment) => {
    setEditingInvestment(investment);
  }, []);

  const handleViewDetails = useCallback((investmentId: number) => {
    navigate(`/investments/${investmentId}`);
  }, [navigate]);

  const handleEditSuccess = useCallback(() => {
    setEditingInvestment(null);
    onUpdate();
  }, [onUpdate]);

  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleFilterChange = useCallback((key: keyof TableFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ search: '', assetClass: '', entity: '', vintageYear: '' });
    setCurrentPage(1);
  }, []);

  const handleStatusManagement = useCallback((investment: Investment) => {
    setStatusManagementInvestment(investment);
  }, []);

  const handleStatusUpdate = useCallback((updatedInvestment: Investment) => {
    setStatusManagementInvestment(null);
    onUpdate();
  }, [onUpdate]);

  // Fetch performance data for investments when performance tab is active
  const fetchPerformanceData = useCallback(async () => {
    if (activeTab !== 'performance' || investments.length === 0) return;
    
    setLoadingPerformance(true);
    const performanceMap = new Map<number, PerformanceMetrics>();
    
    try {
      const performancePromises = investments.map(async (investment) => {
        try {
          const result = await performanceAPI.getInvestmentPerformance(investment.id);
          return { id: investment.id, performance: result.performance };
        } catch (error) {
          console.warn(`Failed to fetch performance for investment ${investment.id}:`, error);
          return { id: investment.id, performance: null };
        }
      });
      
      const results = await Promise.all(performancePromises);
      results.forEach(result => {
        if (result.performance) {
          performanceMap.set(result.id, result.performance);
        }
      });
      
      setPerformanceData(performanceMap);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoadingPerformance(false);
    }
  }, [activeTab, investments]);

  // Effect to fetch performance data when tab changes to performance
  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Helper function to determine performance status relative to target
  const getPerformanceStatus = (actual: number | undefined, target: number | undefined): 'outperform' | 'underperform' | 'ontrack' | 'unknown' => {
    if (!actual || !target) return 'unknown';
    
    const ratio = actual / target;
    if (ratio >= 1.1) return 'outperform';     // 10%+ above target
    if (ratio <= 0.9) return 'underperform';  // 10%+ below target
    return 'ontrack';                          // Within 10% of target
  };

  // Get unique filter options
  const filterOptions = useMemo(() => {
    const assetClasses = Array.from(new Set(investments.map(inv => inv.asset_class))).sort();
    const entities = Array.from(new Set(investments.map(inv => inv.entity?.name).filter(Boolean))).sort();
    const vintageYears = Array.from(new Set(investments.map(inv => inv.vintage_year?.toString()).filter(Boolean))).sort();
    
    return { assetClasses, entities, vintageYears };
  }, [investments]);

  // Filter and sort investments
  const processedInvestments = useMemo(() => {
    let filtered = investments.filter(investment => {
      const matchesSearch = !filters.search || 
        investment.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        investment.strategy?.toLowerCase().includes(filters.search.toLowerCase()) ||
        investment.entity?.name?.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesAssetClass = !filters.assetClass || investment.asset_class === filters.assetClass;
      const matchesEntity = !filters.entity || investment.entity?.name === filters.entity;
      const matchesVintageYear = !filters.vintageYear || investment.vintage_year?.toString() === filters.vintageYear;
      
      return matchesSearch && matchesAssetClass && matchesEntity && matchesVintageYear;
    });

    // Sort
    if (sortConfig.field) {
      filtered.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortConfig.field) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'asset_class':
            aValue = a.asset_class;
            bValue = b.asset_class;
            break;
          case 'vintage_year':
            aValue = a.vintage_year || 0;
            bValue = b.vintage_year || 0;
            break;
          case 'commitment_amount':
            aValue = a.commitment_amount;
            bValue = b.commitment_amount;
            break;
          case 'called_amount':
            aValue = a.called_amount;
            bValue = b.called_amount;
            break;
          case 'entity':
            aValue = a.entity?.name?.toLowerCase() || '';
            bValue = b.entity?.name?.toLowerCase() || '';
            break;
          default:
            return 0;
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [investments, filters, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedInvestments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvestments = processedInvestments.slice(startIndex, startIndex + itemsPerPage);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };


  const renderBasicTab = () => (
    <div className="table-container">
      <table className="enhanced-investments-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort('name')}>
              Name <SortIcon field="name" />
            </th>
            <th className="sortable" onClick={() => handleSort('asset_class')}>
              Asset Class <SortIcon field="asset_class" />
            </th>
            <th>Structure</th>
            <th className="sortable" onClick={() => handleSort('entity')}>
              Entity <SortIcon field="entity" />
            </th>
            <th>Strategy</th>
            <th className="sortable" onClick={() => handleSort('vintage_year')}>
              Vintage <SortIcon field="vintage_year" />
            </th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvestments.map((investment) => (
            <tr key={investment.id}>
              <td className="investment-name" title={investment.name}>
                <span
                  onClick={() => handleViewDetails(investment.id)}
                  title={`${investment.name} - Click to view investment details`}
                >
                  {investment.name}
                </span>
              </td>
              <td title={investment.asset_class}>{investment.asset_class}</td>
              <td title={investment.investment_structure}>{investment.investment_structure}</td>
              <td className="entity-cell" title={investment.entity?.name || 'No entity assigned'}>
                {investment.entity ? (
                  <span className="entity-name-simple">{investment.entity.name}</span>
                ) : (
                  <span className="no-entity">No entity assigned</span>
                )}
              </td>
              <td className="strategy-cell" title={investment.strategy || ''}>
                <span className="strategy-text">{investment.strategy}</span>
              </td>
              <td title={investment.vintage_year?.toString()}>{investment.vintage_year}</td>
              <td className="status-cell">
                <span className={`status-badge ${investment.status.toLowerCase()}`}>
                  {investment.status === InvestmentStatus.ACTIVE && '🟢'}
                  {investment.status === InvestmentStatus.DORMANT && '🟡'}
                  {investment.status === InvestmentStatus.REALIZED && '🔵'}
                  {investment.status}
                </span>
              </td>
              <td className="actions">
                <button
                  onClick={() => handleEdit(investment)}
                  title="Edit Investment"
                  className="icon-button edit-icon"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(investment.id, investment.name)}
                  title="Delete Investment"
                  className="icon-button delete-icon"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderFinancialTab = () => (
    <div className="table-container">
      <table className="enhanced-investments-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort('name')}>
              Name <SortIcon field="name" />
            </th>
            <th className="sortable" onClick={() => handleSort('commitment_amount')}>
              Commitment <SortIcon field="commitment_amount" />
            </th>
            <th className="sortable" onClick={() => handleSort('called_amount')}>
              Called <SortIcon field="called_amount" />
            </th>
            <th>Commitment Date</th>
            <th>Currency</th>
            <th>Mgmt Fee</th>
            <th>Perf Fee</th>
            <th>Hurdle Rate</th>
            <th>Other Fees</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvestments.map((investment) => (
            <tr key={investment.id}>
              <td className="investment-name" title={investment.name}>
                <span
                  onClick={() => handleViewDetails(investment.id)}
                  title={`${investment.name} - Click to view investment details`}
                >
                  {investment.name}
                </span>
              </td>
              <td className="currency" title={formatCurrency(investment.commitment_amount)}>{formatCurrency(investment.commitment_amount)}</td>
              <td className="currency" title={formatCurrency(investment.called_amount)}>{formatCurrency(investment.called_amount)}</td>
              <td title={investment.commitment_date || '-'}>{investment.commitment_date || '-'}</td>
              <td title={investment.currency || 'USD'}>{investment.currency || 'USD'}</td>
              <td title={investment.management_fee ? formatPercentage(investment.management_fee) : '-'}>{investment.management_fee ? formatPercentage(investment.management_fee) : '-'}</td>
              <td title={investment.performance_fee ? formatPercentage(investment.performance_fee) : '-'}>{investment.performance_fee ? formatPercentage(investment.performance_fee) : '-'}</td>
              <td title={investment.hurdle_rate ? formatPercentage(investment.hurdle_rate) : '-'}>{investment.hurdle_rate ? formatPercentage(investment.hurdle_rate) : '-'}</td>
              <td className="currency">{formatCurrency(investment.fees)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOperationalTab = () => (
    <div className="table-container">
      <table className="enhanced-investments-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort('name')}>
              Name <SortIcon field="name" />
            </th>
            <th>Contact Person</th>
            <th>Email</th>
            <th>Portal Link</th>
            <th>Target Raise</th>
            <th>Target IRR</th>
            <th>Investment Period</th>
            <th>Fund Life</th>
            <th>Reporting Freq</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvestments.map((investment) => (
            <tr key={investment.id}>
              <td className="investment-name">
                <span
                  onClick={() => handleViewDetails(investment.id)}
                  title={`${investment.name} - Click to view investment details`}
                >
                  {investment.name}
                </span>
              </td>
              <td>{investment.contact_person || '-'}</td>
              <td>{investment.email || '-'}</td>
              <td>{investment.portal_link || '-'}</td>
              <td className="currency">{investment.target_raise ? formatCurrency(investment.target_raise) : '-'}</td>
              <td>{investment.target_irr ? formatPercentage(investment.target_irr) : '-'}</td>
              <td>{investment.investment_period ? `${investment.investment_period}y` : '-'}</td>
              <td>{investment.fund_life ? `${investment.fund_life}y` : '-'}</td>
              <td>{investment.reporting_frequency || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderLegalTab = () => (
    <div className="table-container">
      <table className="enhanced-investments-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort('name')}>
              Name <SortIcon field="name" />
            </th>
            <th>Geography Focus</th>
            <th>Fund Domicile</th>
            <th>Risk Rating</th>
            <th>Tax Classification</th>
            <th>Due Diligence Date</th>
            <th>IC Approval Date</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvestments.map((investment) => (
            <tr key={investment.id}>
              <td className="investment-name">
                <span
                  onClick={() => handleViewDetails(investment.id)}
                  title={`${investment.name} - Click to view investment details`}
                >
                  {investment.name}
                </span>
              </td>
              <td>{investment.geography_focus || '-'}</td>
              <td>{investment.fund_domicile || '-'}</td>
              <td>
                {investment.risk_rating && (
                  <span className={`risk-badge risk-${investment.risk_rating.toLowerCase()}`}>
                    {investment.risk_rating}
                  </span>
                )}
              </td>
              <td>{investment.tax_classification || '-'}</td>
              <td>{investment.due_diligence_date || '-'}</td>
              <td>{investment.ic_approval_date || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPerformanceTab = () => {
    if (loadingPerformance) {
      return (
        <div className="table-container">
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            Loading performance data...
          </div>
        </div>
      );
    }

    return (
      <div className="table-container">
        <table className="enhanced-investments-table performance-tab">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('name')}>
                Name <SortIcon field="name" />
              </th>
              <th>Target IRR</th>
              <th>Actual IRR</th>
              <th>Performance</th>
              <th>TVPI</th>
              <th>DPI</th>
              <th>RVPI</th>
              <th>Current NAV</th>
              <th>Total Called</th>
              <th>Total Distributions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvestments.map((investment) => {
              const performance = performanceData.get(investment.id);
              const actualIRR = performance?.irr;
              const targetIRR = investment.target_irr;
              const performanceStatus = getPerformanceStatus(actualIRR, targetIRR);

              return (
                <tr key={investment.id}>
                  <td className="investment-name">
                    <span
                      onClick={() => handleViewDetails(investment.id)}
                      style={{
                        color: '#007bff',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        fontWeight: 500,
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.color = '#0056b3';
                        target.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.color = '#007bff';
                        target.style.textDecoration = 'none';
                      }}
                      title="Click to view investment details"
                    >
                      {investment.name}
                    </span>
                  </td>
                  <td>{targetIRR ? formatPercentage(targetIRR) : '-'}</td>
                  <td className={`performance-metric ${performanceStatus}`}>
                    {actualIRR ? formatPercentage(actualIRR) : 'N/A'}
                  </td>
                  <td className="performance-indicator">
                    {performanceStatus !== 'unknown' && (
                      <span className={`performance-badge ${performanceStatus}`}>
                        {performanceStatus === 'outperform' && '⬆️ Above Target'}
                        {performanceStatus === 'underperform' && '⬇️ Below Target'}
                        {performanceStatus === 'ontrack' && '➡️ On Track'}
                      </span>
                    )}
                    {performanceStatus === 'unknown' && '-'}
                  </td>
                  <td className={`performance-metric ${performance?.tvpi ? (performance.tvpi >= 1.1 ? 'outperform' : performance.tvpi <= 0.9 ? 'underperform' : 'ontrack') : ''}`}>
                    {performance?.tvpi ? `${performance.tvpi.toFixed(2)}x` : 'N/A'}
                  </td>
                  <td className="performance-metric">
                    {performance?.dpi ? `${performance.dpi.toFixed(2)}x` : 'N/A'}
                  </td>
                  <td className="performance-metric">
                    {performance?.rvpi ? `${performance.rvpi.toFixed(2)}x` : 'N/A'}
                  </td>
                  <td className="currency">
                    {performance?.current_nav ? formatCurrency(performance.current_nav) : 'N/A'}
                  </td>
                  <td className="currency">
                    {performance?.total_contributions ? formatCurrency(Math.abs(performance.total_contributions)) : formatCurrency(investment.called_amount)}
                  </td>
                  <td className="currency">
                    {performance?.total_distributions ? formatCurrency(performance.total_distributions) : '$0'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCurrentTab = () => {
    switch (activeTab) {
      case 'basic':
        return renderBasicTab();
      case 'financial':
        return renderFinancialTab();
      case 'operational':
        return renderOperationalTab();
      case 'legal':
        return renderLegalTab();
      case 'performance':
        return renderPerformanceTab();
      default:
        return renderBasicTab();
    }
  };

  if (investments.length === 0) {
    return (
      <div className="enhanced-investments-table-section">
        <div className="table-header">
          <div className="table-title">
            <h3>Current Investments (0)</h3>
            <div className="header-actions">
              {onAddInvestment && (
                <button
                  className="luxury-button"
                  onClick={onAddInvestment}
                  title="Add Investment"
                >
                  ➕ Add Investment
                </button>
              )}
              {onExportData && (
                <button
                  className="luxury-button-secondary"
                  onClick={onExportData}
                  title="Export Data"
                >
                  📊 Export Data
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="empty-state">
          <p>No investments found. Add your first investment with the "Add Investment" button.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="enhanced-investments-table-section">
        {/* Header - Two Row Layout */}
        <div className="table-header-two-row">
          <h3 className="table-title-full">Current Investments ({investments.length})</h3>

          {/* Second row: Filters and Actions */}
          {externalFilters && onExternalFilterChange && onClearExternalFilters && externalFilterOptions && (
            <div className="filters-actions-row">
              <div className="table-filters-inline">
                <input
                  type="text"
                  placeholder="Search investments..."
                  value={externalFilters.search}
                  onChange={(e) => onExternalFilterChange('search', e.target.value)}
                  className="search-input-inline"
                />

                <select
                  value={externalFilters.assetClass}
                  onChange={(e) => onExternalFilterChange('assetClass', e.target.value)}
                  className="filter-select-inline"
                >
                  <option value="">All Asset Classes</option>
                  {externalFilterOptions.assetClasses.map(ac => (
                    <option key={ac} value={ac}>{ac}</option>
                  ))}
                </select>

                <select
                  value={externalFilters.entity}
                  onChange={(e) => onExternalFilterChange('entity', e.target.value)}
                  className="filter-select-inline"
                >
                  <option value="">All Entities</option>
                  {externalFilterOptions.entities.map(entity => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>

                <select
                  value={externalFilters.vintageYear}
                  onChange={(e) => onExternalFilterChange('vintageYear', e.target.value)}
                  className="filter-select-inline"
                >
                  <option value="">All Years</option>
                  {externalFilterOptions.vintageYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>

                <button onClick={onClearExternalFilters} className="clear-filters-btn-inline">
                  Clear
                </button>
              </div>

              <div className="header-actions-inline">
                {onAddInvestment && (
                  <button
                    className="action-button-primary"
                    onClick={onAddInvestment}
                    title="Add Investment"
                  >
                    ➕ Add Investment
                  </button>
                )}
                {onExportData && (
                  <button
                    className="action-button-primary"
                    onClick={onExportData}
                    title="Export Data"
                  >
                    📊 Export Data
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Internal Filters (when not using external) */}
        {!hideFilters && !externalFilters && (
          <div className="filters-below-title">
            <div className="table-filters-horizontal">
              <input
                type="text"
                placeholder="Search investments..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="search-input-compact"
              />

              <select
                value={filters.assetClass}
                onChange={(e) => handleFilterChange('assetClass', e.target.value)}
                className="filter-select-compact"
              >
                <option value="">All Asset Classes</option>
                {filterOptions.assetClasses.map(ac => (
                  <option key={ac} value={ac}>{ac}</option>
                ))}
              </select>

              <select
                value={filters.entity}
                onChange={(e) => handleFilterChange('entity', e.target.value)}
                className="filter-select-compact"
              >
                <option value="">All Entities</option>
                {filterOptions.entities.map(entity => (
                  <option key={entity} value={entity}>{entity}</option>
                ))}
              </select>

              <select
                value={filters.vintageYear}
                onChange={(e) => handleFilterChange('vintageYear', e.target.value)}
                className="filter-select-compact"
              >
                <option value="">All Years</option>
                {filterOptions.vintageYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <button onClick={clearFilters} className="clear-filters-btn-compact">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="view-tabs">
          <button
            className={`view-tab ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            📋 Basic Info
          </button>
          <button
            className={`view-tab ${activeTab === 'financial' ? 'active' : ''}`}
            onClick={() => setActiveTab('financial')}
          >
            💰 Financial Terms
          </button>
          <button
            className={`view-tab ${activeTab === 'operational' ? 'active' : ''}`}
            onClick={() => setActiveTab('operational')}
          >
            🏢 Operational
          </button>
          <button
            className={`view-tab ${activeTab === 'legal' ? 'active' : ''}`}
            onClick={() => setActiveTab('legal')}
          >
            ⚖️ Legal & Risk
          </button>
          <button
            className={`view-tab ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
            📊 Performance
          </button>
        </div>

        {/* Table Content */}
        {renderCurrentTab()}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ← Prev
            </button>
            
            <div className="pagination-info">
              Page {currentPage} of {totalPages} ({processedInvestments.length} investments)
            </div>
            
            <button 
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {editingInvestment && (
        <EditInvestmentModal
          investment={editingInvestment}
          onSuccess={handleEditSuccess}
          onCancel={() => setEditingInvestment(null)}
        />
      )}

      {statusManagementInvestment && (
        <InvestmentStatusManager
          investment={statusManagementInvestment}
          onStatusUpdate={handleStatusUpdate}
          onClose={() => setStatusManagementInvestment(null)}
        />
      )}
    </>
  );
};

export default EnhancedInvestmentsTable;