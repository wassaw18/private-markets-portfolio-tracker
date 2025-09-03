import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Investment, InvestmentUpdate } from '../types/investment';
import { investmentAPI } from '../services/api';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import EditInvestmentModal from './EditInvestmentModal';
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
  showImportExport?: boolean;
  onToggleImportExport?: () => void;
}

const EnhancedInvestmentsTable: React.FC<Props> = ({ 
  investments, 
  onDelete, 
  onUpdate, 
  showImportExport = false, 
  onToggleImportExport 
}) => {
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('basic');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: 'asc' });
  const [filters, setFilters] = useState<TableFilters>({
    search: '',
    assetClass: '',
    entity: '',
    vintageYear: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
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
    navigate(`/investment/${investmentId}`);
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

  // Performance comparison helper
  const getPerformanceClass = (actual: number | undefined, target: number | undefined): string => {
    if (!actual || !target) return '';
    const ratio = actual / target;
    if (ratio >= 1.1) return 'outperform';  // 10%+ above target
    if (ratio <= 0.9) return 'underperform'; // 10%+ below target
    return 'ontrack';
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvestments.map((investment) => (
            <tr key={investment.id}>
              <td className="investment-name">{investment.name}</td>
              <td>{investment.asset_class}</td>
              <td>{investment.investment_structure}</td>
              <td className="entity-cell">
                {investment.entity ? (
                  <div className="entity-info">
                    <span className="entity-name">{investment.entity.name}</span>
                    <span className="entity-type">({investment.entity.entity_type})</span>
                  </div>
                ) : (
                  <span className="no-entity">No entity assigned</span>
                )}
              </td>
              <td>{investment.strategy}</td>
              <td>{investment.vintage_year}</td>
              <td className="actions">
                <button
                  onClick={() => handleViewDetails(investment.id)}
                  className="details-button"
                  title="View Details"
                >
                  Details
                </button>
                <button
                  onClick={() => handleEdit(investment)}
                  className="edit-button"
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(investment.id, investment.name)}
                  className="delete-button"
                  title="Delete"
                >
                  Delete
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvestments.map((investment) => (
            <tr key={investment.id}>
              <td className="investment-name">{investment.name}</td>
              <td className="currency">{formatCurrency(investment.commitment_amount)}</td>
              <td className="currency">{formatCurrency(investment.called_amount)}</td>
              <td>{investment.commitment_date || '-'}</td>
              <td>{investment.currency || 'USD'}</td>
              <td>{investment.management_fee ? formatPercentage(investment.management_fee) : '-'}</td>
              <td>{investment.performance_fee ? formatPercentage(investment.performance_fee) : '-'}</td>
              <td>{investment.hurdle_rate ? formatPercentage(investment.hurdle_rate) : '-'}</td>
              <td className="currency">{formatCurrency(investment.fees)}</td>
              <td className="actions">
                <button onClick={() => handleViewDetails(investment.id)} className="details-button">Details</button>
                <button onClick={() => handleEdit(investment)} className="edit-button">Edit</button>
                <button onClick={() => handleDelete(investment.id, investment.name)} className="delete-button">Delete</button>
              </td>
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvestments.map((investment) => (
            <tr key={investment.id}>
              <td className="investment-name">{investment.name}</td>
              <td>{investment.contact_person || '-'}</td>
              <td>{investment.email || '-'}</td>
              <td>{investment.portal_link || '-'}</td>
              <td className="currency">{investment.target_raise ? formatCurrency(investment.target_raise) : '-'}</td>
              <td>{investment.target_irr ? formatPercentage(investment.target_irr) : '-'}</td>
              <td>{investment.investment_period ? `${investment.investment_period}y` : '-'}</td>
              <td>{investment.fund_life ? `${investment.fund_life}y` : '-'}</td>
              <td>{investment.reporting_frequency || '-'}</td>
              <td className="actions">
                <button onClick={() => handleViewDetails(investment.id)} className="details-button">Details</button>
                <button onClick={() => handleEdit(investment)} className="edit-button">Edit</button>
                <button onClick={() => handleDelete(investment.id, investment.name)} className="delete-button">Delete</button>
              </td>
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvestments.map((investment) => (
            <tr key={investment.id}>
              <td className="investment-name">{investment.name}</td>
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
              <td className="actions">
                <button onClick={() => handleViewDetails(investment.id)} className="details-button">Details</button>
                <button onClick={() => handleEdit(investment)} className="edit-button">Edit</button>
                <button onClick={() => handleDelete(investment.id, investment.name)} className="delete-button">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="table-container">
      <table className="enhanced-investments-table">
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
            <th>Current NAV</th>
            <th>Total Called</th>
            <th>Total Distributions</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedInvestments.map((investment) => {
            const performanceClass = '';
            
            return (
              <tr key={investment.id}>
                <td className="investment-name">{investment.name}</td>
                <td>{investment.target_irr ? formatPercentage(investment.target_irr) : '-'}</td>
                <td className="performance-metric">
                  N/A
                </td>
                <td className="performance-indicator">
                  -
                </td>
                <td className="performance-metric">
                  N/A
                </td>
                <td className="performance-metric">
                  N/A
                </td>
                <td className="currency">
                  N/A
                </td>
                <td className="currency">{formatCurrency(investment.called_amount)}</td>
                <td className="currency">
                  $0
                </td>
                <td className="actions">
                  <button onClick={() => handleViewDetails(investment.id)} className="details-button">Details</button>
                  <button onClick={() => handleEdit(investment)} className="edit-button">Edit</button>
                  <button onClick={() => handleDelete(investment.id, investment.name)} className="delete-button">Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

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
            {onToggleImportExport && (
              <button 
                className="import-export-toggle"
                onClick={onToggleImportExport}
                title="Import/Export"
              >
                📊 Import/Export
              </button>
            )}
          </div>
        </div>
        <div className="empty-state">
          <p>No investments found. Add your first investment manually or use the Import/Export button to bulk upload.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="enhanced-investments-table-section">
        {/* Header */}
        <div className="table-header">
          <div className="table-title">
            <h3>Current Investments ({processedInvestments.length})</h3>
            {onToggleImportExport && (
              <button 
                className="import-export-toggle"
                onClick={onToggleImportExport}
                title="Import/Export"
              >
                📊 Import/Export
              </button>
            )}
          </div>
          
          {/* Search and Filters */}
          <div className="table-filters">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search investments, entities, or strategies..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filter-selects">
              <select
                value={filters.assetClass}
                onChange={(e) => handleFilterChange('assetClass', e.target.value)}
                className="filter-select"
              >
                <option value="">All Asset Classes</option>
                {filterOptions.assetClasses.map(ac => (
                  <option key={ac} value={ac}>{ac}</option>
                ))}
              </select>
              
              <select
                value={filters.entity}
                onChange={(e) => handleFilterChange('entity', e.target.value)}
                className="filter-select"
              >
                <option value="">All Entities</option>
                {filterOptions.entities.map(entity => (
                  <option key={entity} value={entity}>{entity}</option>
                ))}
              </select>
              
              <select
                value={filters.vintageYear}
                onChange={(e) => handleFilterChange('vintageYear', e.target.value)}
                className="filter-select"
              >
                <option value="">All Vintage Years</option>
                {filterOptions.vintageYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              
              <button onClick={clearFilters} className="clear-filters-btn">
                Clear
              </button>
            </div>
          </div>
        </div>

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
    </>
  );
};

export default EnhancedInvestmentsTable;