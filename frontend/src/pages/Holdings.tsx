import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Investment } from '../types/investment';
import { investmentAPI, ImportResult, InvestmentFilters } from '../services/api';
import AddInvestmentModal from '../components/AddInvestmentModal';
import CreateEntityModal from '../components/CreateEntityModal';
import EnhancedInvestmentsTable from '../components/EnhancedInvestmentsTable';
import PortfolioSummary from '../components/PortfolioSummary';
import ImportExportModal from '../components/ImportExportModal';
import UploadWidget from '../components/UploadWidget';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import '../styles/luxury-design-system.css';
import './Holdings.css';

interface TableFilters {
  search: string;
  assetClass: string;
  entity: string;
  vintageYear: string;
}

const Holdings: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateEntityModal, setShowCreateEntityModal] = useState(false);
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [portfolioUpdateTrigger, setPortfolioUpdateTrigger] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<InvestmentFilters>({});
  const [tableFilters, setTableFilters] = useState<TableFilters>({
    search: '',
    assetClass: '',
    entity: '',
    vintageYear: ''
  });

  const fetchInvestments = useCallback(async (filters: InvestmentFilters = {}) => {
    try {
      setLoading(true);
      // Use proper pagination for better performance
      const data = await investmentAPI.getInvestments(0, 500, filters); // Reduced from 1000 to 500 for better performance
      setInvestments(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch investments. Please check if the backend is running.');
      console.error('Error fetching investments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const handleAddInvestment = useCallback(() => {
    setShowAddModal(false);
    fetchInvestments(currentFilters); // Refresh the list with current filters
    setPortfolioUpdateTrigger(prev => prev + 1); // Trigger portfolio update
  }, [fetchInvestments, currentFilters]);

  const handleDeleteInvestment = useCallback(async (id: number) => {
    try {
      await investmentAPI.deleteInvestment(id);
      fetchInvestments(currentFilters); // Refresh the list with current filters
      setPortfolioUpdateTrigger(prev => prev + 1); // Trigger portfolio update
    } catch (err) {
      setError('Failed to delete investment');
      console.error('Error deleting investment:', err);
    }
  }, [fetchInvestments, currentFilters]);

  const handleUpdateInvestment = useCallback(() => {
    fetchInvestments(currentFilters); // Refresh the list with current filters
    setPortfolioUpdateTrigger(prev => prev + 1); // Trigger portfolio update
  }, [fetchInvestments, currentFilters]);

  const handleImportComplete = useCallback((result: ImportResult) => {
    if (result.success_count > 0) {
      // Refresh investments list after successful import
      fetchInvestments(currentFilters);
      setPortfolioUpdateTrigger(prev => prev + 1);
    }
  }, [fetchInvestments, currentFilters]);

  const handleEntityCreated = useCallback(() => {
    setShowCreateEntityModal(false);
    // Entity creation doesn't directly affect investments list, but we could trigger a refresh
    // if the investments depend on entities (which they do for entity filtering)
  }, []);

  const handleInvestmentUploadComplete = useCallback((result: ImportResult) => {
    // Refresh investments list after successful upload
    fetchInvestments(currentFilters);
    setPortfolioUpdateTrigger(prev => prev + 1);
    console.log(`Investment upload completed: ${result.success_count} successful, ${result.error_count} errors`);
  }, [fetchInvestments, currentFilters]);

  // Filter handlers
  const handleFilterChange = useCallback((key: keyof TableFilters, value: string) => {
    setTableFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setTableFilters({ search: '', assetClass: '', entity: '', vintageYear: '' });
  }, []);

  // Get unique filter options
  const filterOptions = useMemo(() => {
    const assetClasses = Array.from(new Set(investments.map(inv => inv.asset_class))).sort();
    const entities = Array.from(new Set(investments.map(inv => inv.entity?.name).filter(Boolean))).sort() as string[];
    const vintageYears = Array.from(new Set(investments.map(inv => inv.vintage_year?.toString()).filter(Boolean))).sort();

    return { assetClasses, entities, vintageYears };
  }, [investments]);

  // Filter investments based on table filters
  const filteredInvestments = useMemo(() => {
    return investments.filter(investment => {
      const matchesSearch = !tableFilters.search ||
        investment.name.toLowerCase().includes(tableFilters.search.toLowerCase()) ||
        investment.strategy?.toLowerCase().includes(tableFilters.search.toLowerCase()) ||
        investment.entity?.name?.toLowerCase().includes(tableFilters.search.toLowerCase());

      const matchesAssetClass = !tableFilters.assetClass || investment.asset_class === tableFilters.assetClass;
      const matchesEntity = !tableFilters.entity || investment.entity?.name === tableFilters.entity;
      const matchesVintageYear = !tableFilters.vintageYear || investment.vintage_year?.toString() === tableFilters.vintageYear;

      return matchesSearch && matchesAssetClass && matchesEntity && matchesVintageYear;
    });
  }, [investments, tableFilters]);

  if (loading) {
    return (
      <div className="luxury-card">
        <div className="luxury-table-loading">Loading portfolio data...</div>
      </div>
    );
  }

  return (
    <div className="holdings-container">
      <div className="luxury-card page-header">
        <h1 className="luxury-heading-1">Portfolio Holdings</h1>
        <p className="luxury-body-large">Manage and analyze your investment portfolio holdings</p>
      </div>

      <div className="luxury-card holdings-header-card">
        <div className="holdings-header">
          <div className="header-actions">
            <button
              className="luxury-button-secondary"
              onClick={() => setShowCreateEntityModal(true)}
              title="Create a new entity (Individual, Trust, LLC, etc.)"
            >
              Add Entity
            </button>
            <button
              className="luxury-button-primary"
              onClick={() => setShowAddModal(true)}
            >
              Add Investment
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="luxury-card" style={{borderColor: 'var(--luxury-error)', backgroundColor: 'rgba(231, 76, 60, 0.05)'}}>
          <p className="luxury-body" style={{color: 'var(--luxury-error)', margin: 0}}>{error}</p>
        </div>
      )}

      <div className="investment-upload-section">
        <UploadWidget
          type="investments"
          onUploadComplete={handleInvestmentUploadComplete}
          size="small"
        />
      </div>

      <AddInvestmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddInvestment}
      />

      <ImportExportModal
        isOpen={showImportExportModal}
        onClose={() => setShowImportExportModal(false)}
        onImportComplete={handleImportComplete}
      />

      {showCreateEntityModal && (
        <CreateEntityModal
          onClose={() => setShowCreateEntityModal(false)}
          onEntityCreated={handleEntityCreated}
        />
      )}

      <div className="investments-section">
        <SectionErrorBoundary sectionName="Investments Table">
          <EnhancedInvestmentsTable
            investments={filteredInvestments}
            onDelete={handleDeleteInvestment}
            onUpdate={handleUpdateInvestment}
            onToggleImportExport={() => setShowImportExportModal(true)}
            externalFilters={tableFilters}
            onExternalFilterChange={handleFilterChange}
            onClearExternalFilters={clearFilters}
            filterOptions={filterOptions}
          />
        </SectionErrorBoundary>
      </div>
    </div>
  );
};

export default Holdings;