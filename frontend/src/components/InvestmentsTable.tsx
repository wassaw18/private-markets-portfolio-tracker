import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Investment, InvestmentUpdate } from '../types/investment';
import { investmentAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import EditInvestmentModal from './EditInvestmentModal';
import './InvestmentsTable.css';

type SortField = 'name' | 'asset_class' | 'vintage_year' | 'commitment_amount' | 'called_amount' | 'entity';
type SortDirection = 'asc' | 'desc';

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

const InvestmentsTable: React.FC<Props> = ({ investments, onDelete, onUpdate, showImportExport = false, onToggleImportExport }) => {
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
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
    setCurrentPage(1); // Reset to first page when filtering
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

  if (investments.length === 0) {
    return (
      <div className="empty-state">
        <p>No investments found. Add your first investment to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="investments-table-section">
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

        <div className="table-container">
          <table className="investments-table">
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
                <th className="sortable" onClick={() => handleSort('commitment_amount')}>
                  Commitment <SortIcon field="commitment_amount" />
                </th>
                <th className="sortable" onClick={() => handleSort('called_amount')}>
                  Called <SortIcon field="called_amount" />
                </th>
                <th>Fees</th>
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
                  <td className="currency">{formatCurrency(investment.commitment_amount)}</td>
                  <td className="currency">{formatCurrency(investment.called_amount)}</td>
                  <td className="currency">{formatCurrency(investment.fees)}</td>
                  <td className="actions">
                    <button
                      onClick={() => handleViewDetails(investment.id)}
                      className="details-button"
                      title="View Investment Details"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => handleEdit(investment)}
                      className="edit-button"
                      title="Edit Investment"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(investment.id, investment.name)}
                      className="delete-button"
                      title="Delete Investment"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

export default InvestmentsTable;