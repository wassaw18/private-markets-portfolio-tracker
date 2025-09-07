import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Investment } from '../types/investment';
import { investmentAPI, ImportResult, InvestmentFilters } from '../services/api';
import AddInvestmentModal from '../components/AddInvestmentModal';
import CreateEntityModal from '../components/CreateEntityModal';
import EnhancedInvestmentsTable from '../components/EnhancedInvestmentsTable';
import PortfolioSummary from '../components/PortfolioSummary';
import ImportExportModal from '../components/ImportExportModal';
import FilterPanel from '../components/FilterPanel';
import UploadWidget from '../components/UploadWidget';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import ComponentErrorBoundary from '../components/ComponentErrorBoundary';
import './Holdings.css';

const Holdings: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateEntityModal, setShowCreateEntityModal] = useState(false);
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [portfolioUpdateTrigger, setPortfolioUpdateTrigger] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<InvestmentFilters>({});

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

  const handleFiltersChange = useCallback((filters: InvestmentFilters) => {
    setCurrentFilters(filters);
    fetchInvestments(filters);
  }, [fetchInvestments]);

  const handleClearFilters = useCallback(() => {
    setCurrentFilters({});
    fetchInvestments({});
  }, [fetchInvestments]);

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

  if (loading) {
    return <div className="holdings-container"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="holdings-container">
      <div className="holdings-header">
        <h2>Holdings Management</h2>
        <div className="header-actions">
          <button 
            className="add-button secondary"
            onClick={() => setShowCreateEntityModal(true)}
            title="Create a new entity (Individual, Trust, LLC, etc.)"
          >
            Add New Entity
          </button>
          <button 
            className="add-button primary"
            onClick={() => setShowAddModal(true)}
          >
            Add New Investment
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <SectionErrorBoundary sectionName="Portfolio Summary">
        <PortfolioSummary onUpdate={portfolioUpdateTrigger} />
      </SectionErrorBoundary>

      <div className="investment-upload-section">
        <UploadWidget 
          type="investments" 
          onUploadComplete={handleInvestmentUploadComplete}
          size="medium"
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
            investments={investments}
            onDelete={handleDeleteInvestment}
            onUpdate={handleUpdateInvestment}
            onToggleImportExport={() => setShowImportExportModal(true)}
          />
        </SectionErrorBoundary>
      </div>
    </div>
  );
};

export default Holdings;