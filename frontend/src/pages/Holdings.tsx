import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Investment } from '../types/investment';
import { investmentAPI, InvestmentFilters } from '../services/api';
import AddInvestmentModal from '../components/AddInvestmentModal';
import CreateEntityModal from '../components/CreateEntityModal';
import EnhancedInvestmentsTable from '../components/EnhancedInvestmentsTable';
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
  const [portfolioUpdateTrigger, setPortfolioUpdateTrigger] = useState(0);
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

  // Refresh investments when the page becomes visible (e.g., navigating back from details page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchInvestments();
      }
    };

    const handleFocus = () => {
      fetchInvestments();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchInvestments]);

  const handleAddInvestment = useCallback(() => {
    setShowAddModal(false);
    fetchInvestments(); // Refresh the list
    setPortfolioUpdateTrigger(prev => prev + 1); // Trigger portfolio update
  }, [fetchInvestments]);

  const handleDeleteInvestment = useCallback(async (id: number) => {
    // Show confirmation dialog
    if (!window.confirm('Archive this investment? It will be hidden from this list but can be restored later if needed.')) {
      return;
    }

    try {
      await investmentAPI.deleteInvestment(id);
      fetchInvestments(); // Refresh the list
      setPortfolioUpdateTrigger(prev => prev + 1); // Trigger portfolio update
    } catch (err) {
      setError('Failed to archive investment');
      console.error('Error archiving investment:', err);
    }
  }, [fetchInvestments]);

  const handleUpdateInvestment = useCallback(() => {
    fetchInvestments(); // Refresh the list
    setPortfolioUpdateTrigger(prev => prev + 1); // Trigger portfolio update
  }, [fetchInvestments]);


  const handleEntityCreated = useCallback(() => {
    setShowCreateEntityModal(false);
    // Entity creation doesn't directly affect investments list, but we could trigger a refresh
    // if the investments depend on entities (which they do for entity filtering)
  }, []);

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

  const handleExportData = useCallback(async () => {
    try {
      // Convert investments to CSV format
      const csvHeaders = [
        'Name', 'Asset Class', 'Structure', 'Entity', 'Strategy', 'Vintage Year',
        'Status', 'Commitment Amount', 'Called Amount', 'Commitment Date', 'Currency',
        'Management Fee', 'Performance Fee', 'Hurdle Rate', 'Fees', 'Contact Person',
        'Email', 'Portal Link', 'Target Raise', 'Target IRR', 'Investment Period',
        'Fund Life', 'Reporting Frequency', 'Geography Focus', 'Fund Domicile',
        'Risk Rating', 'Tax Classification', 'Due Diligence Date', 'IC Approval Date'
      ];

      const csvRows = filteredInvestments.map(investment => [
        investment.name,
        investment.asset_class,
        investment.investment_structure || '',
        investment.entity?.name || '',
        investment.strategy || '',
        investment.vintage_year || '',
        investment.status,
        investment.commitment_amount || '',
        investment.called_amount || '',
        investment.commitment_date || '',
        investment.currency || 'USD',
        investment.management_fee || '',
        investment.performance_fee || '',
        investment.hurdle_rate || '',
        investment.fees || '',
        investment.contact_person || '',
        investment.email || '',
        investment.portal_link || '',
        investment.target_raise || '',
        investment.target_irr || '',
        investment.investment_period || '',
        investment.fund_life || '',
        investment.reporting_frequency || '',
        investment.geography_focus || '',
        investment.fund_domicile || '',
        investment.risk_rating || '',
        investment.tax_classification || '',
        investment.due_diligence_date || '',
        investment.ic_approval_date || ''
      ]);

      // Create CSV content
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `portfolio-holdings-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Failed to export data');
    }
  }, [filteredInvestments]);

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
      </div>

      {error && (
        <div className="luxury-card" style={{borderColor: 'var(--luxury-error)', backgroundColor: 'rgba(231, 76, 60, 0.05)'}}>
          <p className="luxury-body" style={{color: 'var(--luxury-error)', margin: 0}}>{error}</p>
        </div>
      )}

      <AddInvestmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddInvestment}
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
            onAddInvestment={() => setShowAddModal(true)}
            onExportData={handleExportData}
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