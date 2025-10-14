import axios from 'axios';
import { Investment, InvestmentCreate, InvestmentUpdate, CashFlow, CashFlowCreate, CashFlowUpdate, Valuation, ValuationCreate, ValuationUpdate, InvestmentPerformance, PortfolioPerformance, CommitmentVsCalledData, AssetAllocationData, VintageAllocationData, TimelineDataPoint, JCurveDataPoint, DashboardSummaryStats } from '../types/investment';
import { Entity, EntityCreate, EntityUpdate, EntityWithMembers, FamilyMember, FamilyMemberCreate, FamilyMemberUpdate } from '../types/entity';
import { Document, DocumentCreate, DocumentUpdate, DocumentUploadForm, DocumentFilters, DocumentSearchResult, DocumentStatistics, DocumentTag, DocumentTagCreate } from '../types/document';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://172.23.5.82:8000';

// Create axios instance with JWT token support
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Filter interfaces
export interface InvestmentFilters {
  search?: string;
  asset_classes?: string[];
  min_vintage_year?: number;
  max_vintage_year?: number;
  min_commitment?: number;
  max_commitment?: number;
  entity_ids?: number[];
  entity_names?: string[];
  entity_types?: string[];
}

export interface FilterOptions {
  asset_classes: string[];
  entity_types: string[];
  entity_names: string[];
  vintage_year_range: {
    min: number;
    max: number;
  };
  commitment_range: {
    min: number;
    max: number;
  };
}

// Bulk upload result interface
export interface BulkUploadResult {
  filename: string;
  success_count: number;
  error_count: number;
  warning_count: number;
  errors: Array<{row: number; message: string}>;
  warnings: Array<{row: number; message: string}>;
  message: string;
  has_more_errors: boolean;
  has_more_warnings: boolean;
}

// Entity API
export const entityAPI = {
  // Get all entities
  getEntities: async (skip: number = 0, limit: number = 100, entityType?: string, search?: string, includeInactive: boolean = false): Promise<EntityWithMembers[]> => {
    let url = `/api/entities?skip=${skip}&limit=${limit}`;
    
    if (entityType) {
      url += `&entity_type=${encodeURIComponent(entityType)}`;
    }
    
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    
    if (includeInactive) {
      url += `&include_inactive=true`;
    }
    
    const response = await api.get(url);
    return response.data;
  },

  // Get single entity
  getEntity: async (id: number): Promise<EntityWithMembers> => {
    const response = await api.get(`/api/entities/${id}`);
    return response.data;
  },

  // Create entity
  createEntity: async (entity: EntityCreate): Promise<Entity> => {
    const response = await api.post('/api/entities', entity);
    return response.data;
  },

  // Update entity
  updateEntity: async (id: number, entity: EntityUpdate): Promise<Entity> => {
    const response = await api.put(`/api/entities/${id}`, entity);
    return response.data;
  },

  // Delete entity (soft delete)
  deleteEntity: async (id: number): Promise<void> => {
    await api.delete(`/api/entities/${id}`);
  },

  // Get entity's investments
  getEntityInvestments: async (entityId: number): Promise<Investment[]> => {
    const response = await api.get(`/api/entities/${entityId}/investments`);
    return response.data;
  },
};

// Family Member API
export const familyMemberAPI = {
  // Get family members for an entity
  getFamilyMembers: async (entityId: number, includeInactive: boolean = false): Promise<FamilyMember[]> => {
    let url = `/api/entities/${entityId}/family-members`;
    if (includeInactive) {
      url += `?include_inactive=true`;
    }
    const response = await api.get(url);
    return response.data;
  },

  // Create family member
  createFamilyMember: async (entityId: number, familyMember: FamilyMemberCreate): Promise<FamilyMember> => {
    const response = await api.post(`/api/entities/${entityId}/family-members`, familyMember);
    return response.data;
  },

  // Update family member
  updateFamilyMember: async (memberId: number, familyMember: FamilyMemberUpdate): Promise<FamilyMember> => {
    const response = await api.put(`/api/family-members/${memberId}`, familyMember);
    return response.data;
  },

  // Delete family member (soft delete)
  deleteFamilyMember: async (memberId: number): Promise<void> => {
    await api.delete(`/api/family-members/${memberId}`);
  },
};

export const investmentAPI = {
  // Get all investments
  getInvestments: async (skip: number = 0, limit: number = 100, filters?: InvestmentFilters): Promise<Investment[]> => {
    let url = `/api/investments?skip=${skip}&limit=${limit}`;
    
    if (filters) {
      // Add search parameter
      if (filters.search) {
        url += `&search=${encodeURIComponent(filters.search)}`;
      }
      
      // Add asset class filters
      if (filters.asset_classes && filters.asset_classes.length > 0) {
        filters.asset_classes.forEach(ac => {
          url += `&asset_classes=${encodeURIComponent(ac)}`;
        });
      }
      
      // Add vintage year range
      if (filters.min_vintage_year !== undefined) {
        url += `&min_vintage_year=${filters.min_vintage_year}`;
      }
      if (filters.max_vintage_year !== undefined) {
        url += `&max_vintage_year=${filters.max_vintage_year}`;
      }
      
      // Add commitment range
      if (filters.min_commitment !== undefined) {
        url += `&min_commitment=${filters.min_commitment}`;
      }
      if (filters.max_commitment !== undefined) {
        url += `&max_commitment=${filters.max_commitment}`;
      }
      
      // Add entity filters
      if (filters.entity_ids && filters.entity_ids.length > 0) {
        filters.entity_ids.forEach(id => {
          url += `&entity_ids=${id}`;
        });
      }
      
      if (filters.entity_names && filters.entity_names.length > 0) {
        filters.entity_names.forEach(name => {
          url += `&entity_names=${encodeURIComponent(name)}`;
        });
      }
      
      if (filters.entity_types && filters.entity_types.length > 0) {
        filters.entity_types.forEach(type => {
          url += `&entity_types=${encodeURIComponent(type)}`;
        });
      }
    }
    
    const response = await api.get(url);
    return response.data;
  },
  
  // Get filter options
  getFilterOptions: async (): Promise<FilterOptions> => {
    const response = await api.get('/api/investments/filter-options');
    return response.data;
  },

  // Get single investment
  getInvestment: async (id: number): Promise<Investment> => {
    const response = await api.get(`/api/investments/${id}`);
    return response.data;
  },

  // Create investment
  createInvestment: async (investment: InvestmentCreate): Promise<Investment> => {
    const response = await api.post('/api/investments', investment);
    return response.data;
  },

  // Update investment
  updateInvestment: async (id: number, investment: InvestmentUpdate): Promise<Investment> => {
    const response = await api.put(`/api/investments/${id}`, investment);
    return response.data;
  },

  // Update investment status
  updateInvestmentStatus: async (
    id: number,
    status: string,
    password: string,
    realizationDate?: string,
    realizationNotes?: string
  ): Promise<Investment> => {
    // Use the regular update endpoint with just the status field
    // Note: password is currently not validated on backend, but kept in signature for future use
    const requestBody: any = {
      status
    };

    // Add realization fields if status is REALIZED
    if (status === 'REALIZED') {
      if (realizationDate) requestBody.realization_date = realizationDate;
      if (realizationNotes) requestBody.realization_notes = realizationNotes;
    }

    const response = await api.put(`/api/investments/${id}`, requestBody);
    return response.data;
  },

  // Delete investment (archive)
  deleteInvestment: async (id: number): Promise<void> => {
    await api.delete(`/api/investments/${id}`);
  },

  // Restore archived investment
  restoreInvestment: async (id: number): Promise<void> => {
    await api.post(`/api/investments/${id}/restore`);
  },

  // Get archived investments
  getArchivedInvestments: async (skip: number = 0, limit: number = 1000): Promise<Investment[]> => {
    const response = await api.get(`/api/investments/archived?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  // Pacing model methods
  updatePacingInputs: async (id: number, inputs: PacingModelInputs): Promise<PacingModelResponse> => {
    const response = await api.put(`/api/investments/${id}/pacing-inputs`, inputs);
    return response.data;
  },

  generateForecast: async (id: number, scenarios?: string[]): Promise<ForecastGenerationResponse> => {
    const response = await api.post(`/api/investments/${id}/forecast`, { scenarios });
    return response.data;
  },

  getForecast: async (id: number): Promise<InvestmentForecastSummary> => {
    const response = await api.get(`/api/investments/${id}/forecast`);
    return response.data;
  },
};

export const cashFlowAPI = {
  // Get cash flows for investment
  getCashFlows: async (investmentId: number): Promise<CashFlow[]> => {
    const response = await api.get(`/api/investments/${investmentId}/cashflows`);
    return response.data;
  },

  // Create cash flow
  createCashFlow: async (investmentId: number, cashFlow: CashFlowCreate): Promise<CashFlow> => {
    const response = await api.post(`/api/investments/${investmentId}/cashflows`, cashFlow);
    return response.data;
  },

  // Update cash flow
  updateCashFlow: async (investmentId: number, cashFlowId: number, cashFlow: CashFlowUpdate): Promise<CashFlow> => {
    const response = await api.put(`/api/investments/${investmentId}/cashflows/${cashFlowId}`, cashFlow);
    return response.data;
  },

  // Delete cash flow
  deleteCashFlow: async (investmentId: number, cashFlowId: number): Promise<void> => {
    await api.delete(`/api/investments/${investmentId}/cashflows/${cashFlowId}`);
  },
};

export const valuationAPI = {
  // Get valuations for investment
  getValuations: async (investmentId: number): Promise<Valuation[]> => {
    const response = await api.get(`/api/investments/${investmentId}/valuations`);
    return response.data;
  },

  // Create valuation
  createValuation: async (investmentId: number, valuation: ValuationCreate): Promise<Valuation> => {
    const response = await api.post(`/api/investments/${investmentId}/valuations`, valuation);
    return response.data;
  },

  // Update valuation
  updateValuation: async (investmentId: number, valuationId: number, valuation: ValuationUpdate): Promise<Valuation> => {
    const response = await api.put(`/api/investments/${investmentId}/valuations/${valuationId}`, valuation);
    return response.data;
  },

  // Delete valuation
  deleteValuation: async (investmentId: number, valuationId: number): Promise<void> => {
    await api.delete(`/api/investments/${investmentId}/valuations/${valuationId}`);
  },
};

export const performanceAPI = {
  // Get performance metrics for specific investment
  getInvestmentPerformance: async (investmentId: number): Promise<InvestmentPerformance> => {
    const response = await api.get(`/api/investments/${investmentId}/performance`);
    return response.data;
  },

  // Get portfolio-level performance metrics
  getPortfolioPerformance: async (): Promise<PortfolioPerformance> => {
    const response = await api.get('/api/portfolio/performance');
    return response.data;
  },
};

// Benchmark comparison interfaces
export interface BenchmarkData {
  asset_class: string;
  vintage_year: number;
  metric_type: string;
  q1_performance: number;
  median_performance: number;
  q3_performance: number;
  sample_size?: number;
  data_source: string;
  report_date: string;
  methodology_notes?: string;
}

export interface InvestmentBenchmarkComparison {
  investment_id: number;
  investment_name: string;
  asset_class: string;
  vintage_year: number;
  
  investment_irr?: number;
  investment_tvpi?: number;
  
  irr_benchmark?: BenchmarkData;
  irr_quartile_rank?: number;
  irr_vs_median?: number;
  irr_percentile?: number;
  
  tvpi_benchmark?: BenchmarkData;
  tvpi_quartile_rank?: number;
  tvpi_vs_median?: number;
  tvpi_percentile?: number;
  
  overall_performance_summary: string;
  data_availability: string;
}

export const benchmarkAPI = {
  // Get benchmark comparison for specific investment
  getInvestmentBenchmark: async (investmentId: number): Promise<InvestmentBenchmarkComparison> => {
    const response = await api.get(`/api/investments/${investmentId}/benchmark`);
    return response.data;
  },
};

export const dashboardAPI = {
  // Get commitment vs called capital data
  getCommitmentVsCalled: async (): Promise<CommitmentVsCalledData> => {
    const response = await api.get('/api/dashboard/commitment-vs-called');
    return response.data;
  },

  // Get allocation by asset class
  getAllocationByAssetClass: async (): Promise<AssetAllocationData[]> => {
    const response = await api.get('/api/dashboard/allocation-by-asset-class');
    return response.data;
  },

  // Get allocation by vintage year
  getAllocationByVintage: async (): Promise<VintageAllocationData[]> => {
    const response = await api.get('/api/dashboard/allocation-by-vintage');
    return response.data;
  },

  // Get portfolio value timeline
  getPortfolioValueTimeline: async (): Promise<TimelineDataPoint[]> => {
    const response = await api.get('/api/dashboard/portfolio-value-timeline');
    return response.data;
  },

  // Get J-curve data
  getJCurveData: async (): Promise<JCurveDataPoint[]> => {
    const response = await api.get('/api/dashboard/j-curve-data');
    return response.data;
  },

  // Get dashboard summary stats
  getSummaryStats: async (): Promise<DashboardSummaryStats> => {
    const response = await api.get('/api/dashboard/summary-stats');
    return response.data;
  },
};

// Import/Export API
export interface ImportResult {
  filename: string;
  success_count: number;
  error_count: number;
  errors: Array<{row: number; message: string}>;
  warnings: Array<{row: number; message: string}>;
  message: string;
}

export const importExportAPI = {
  // Import investments from file
  importInvestments: async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/investments/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Export investments to Excel
  exportInvestments: async (): Promise<Blob> => {
    const response = await api.get('/api/investments/export', {
      responseType: 'blob',
    });
    return response.data;
  },
  // Download NAV template
  downloadNAVTemplate: async (): Promise<Blob> => {
    const response = await api.get('/api/templates/nav-template', {
      responseType: 'blob',
    });
    return response.data;
  },

  // Download Investment template
  downloadInvestmentTemplate: async (): Promise<Blob> => {
    const response = await api.get('/api/templates/investment-template', {
      responseType: 'blob',
    });
    return response.data;
  },
  // Download Cash Flow template
  downloadCashFlowTemplate: async (): Promise<Blob> => {
    const response = await api.get('/api/templates/cashflow-template', {
      responseType: 'blob',
    });
    return response.data;
  },
  // Bulk upload NAVs
  bulkUploadNAVs: async (file: File): Promise<BulkUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/bulk-upload/navs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  // Bulk upload Cash Flows
  bulkUploadCashFlows: async (file: File): Promise<BulkUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/bulk-upload/cashflows', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Bulk upload Entities
  bulkUploadEntities: async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/bulk-upload/entities', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Pacing Model and Cash Flow Forecasting types
interface PacingModelInputs {
  target_irr: number;
  target_moic: number;
  fund_life: number;
  investment_period: number;
  bow_factor: number;
  call_schedule: 'Front Loaded' | 'Steady' | 'Back Loaded';
  distribution_timing: 'Early' | 'Backend' | 'Steady';
  forecast_enabled: boolean;
}

// API Response interfaces for proper type safety
interface PacingModelResponse {
  target_irr: number;
  target_moic: number;
  fund_life: number;
  investment_period: number;
  bow_factor: number;
  call_schedule: 'Front Loaded' | 'Steady' | 'Back Loaded';
  distribution_timing: 'Early' | 'Backend' | 'Steady';
  forecast_enabled: boolean;
  last_updated: string;
}

interface ForecastGenerationResponse {
  investment_id: number;
  scenarios_generated: string[];
  forecast_date: string;
  model_version: string;
  generation_time: number;
  message: string;
}

interface CashFlowForecast {
  id: number;
  investment_id: number;
  forecast_date: string;
  scenario: 'Bull' | 'Base' | 'Bear';
  forecast_year: number;
  forecast_period_start: string;
  forecast_period_end: string;
  projected_calls: number;
  projected_distributions: number;
  projected_nav: number;
  cumulative_calls: number;
  cumulative_distributions: number;
  cumulative_net_cf: number;
  model_version: string;
  confidence_level: number;
}

interface InvestmentForecastSummary {
  investment_id: number;
  investment_name: string;
  forecast_generated_date: string | null;
  total_projected_calls: number;
  total_projected_distributions: number;
  expected_net_cash_flow: number;
  expected_irr: number;
  expected_moic: number;
  forecast_accuracy_score: number;
  base_case: CashFlowForecast[];
  bull_case?: CashFlowForecast[];
  bear_case?: CashFlowForecast[];
}

interface PortfolioCashFlowForecast {
  forecast_date: string;
  scenario: 'Bull' | 'Base' | 'Bear';
  annual_forecasts: Array<{
    year: number;
    calls: number;
    distributions: number;
    net: number;
  }>;
  peak_capital_need_year: number;
  peak_capital_amount: number;
  break_even_year: number;
  total_capital_required: number;
  total_expected_distributions: number;
  portfolio_expected_irr: number;
  portfolio_expected_moic: number;
  liquidity_gap_periods: Array<{year: number; gap_amount: number}>;
  distribution_peak_periods: Array<{year: number; distribution_amount: number}>;
}

export const pacingModelAPI = {
  // Update pacing model parameters
  updatePacingInputs: async (investmentId: number, inputs: PacingModelInputs): Promise<PacingModelResponse> => {
    const response = await api.put(`/api/investments/${investmentId}/pacing-inputs`, inputs);
    return response.data;
  },

  // Generate cash flow forecast
  generateForecast: async (investmentId: number, scenarios?: string[]): Promise<ForecastGenerationResponse> => {
    const response = await api.post(`/api/investments/${investmentId}/forecast`, { scenarios });
    return response.data;
  },

  // Get investment forecast
  getInvestmentForecast: async (investmentId: number): Promise<InvestmentForecastSummary> => {
    const response = await api.get(`/api/investments/${investmentId}/forecast`);
    return response.data;
  },

  // Get portfolio-level forecast
  getPortfolioForecast: async (scenario: 'Bull' | 'Base' | 'Bear' = 'Base'): Promise<PortfolioCashFlowForecast> => {
    const response = await api.get(`/api/portfolio/cash-flow-forecast?scenario=${scenario}`);
    return response.data;
  },
};

// Calendar API types and methods
export interface DailyFlow {
  date: string;
  day?: number;
  total_inflows: number;
  total_outflows: number;
  net_flow: number;
  transaction_count: number;
  transactions: Array<{
    id: string | number;
    investment_id: number;
    investment_name: string;
    type: string;
    amount: number;
    is_forecast: boolean;
  }>;
}

export interface PeriodSummary {
  start_date: string;
  end_date: string;
  total_inflows: number;
  total_outflows: number;
  net_flow: number;
  active_days: number;
  total_transactions: number;
  largest_single_day: number;
  largest_single_day_date: string | null;
  most_active_day: string | null;
  most_active_day_count: number;
}

export interface MonthlyCalendar {
  year: number;
  month: number;
  month_name: string;
  previous_month: { year: number; month: number };
  next_month: { year: number; month: number };
  period_summary: PeriodSummary;
  daily_flows: DailyFlow[];
}

export const calendarAPI = {
  // Get daily cash flows for date range
  getDailyCashFlows: async (startDate: string, endDate: string, includeForecasts: boolean = true): Promise<{
    start_date: string;
    end_date: string;
    include_forecasts: boolean;
    daily_flows: DailyFlow[];
  }> => {
    const response = await api.get(`/api/calendar/cash-flows?start_date=${startDate}&end_date=${endDate}&include_forecasts=${includeForecasts}`);
    return response.data;
  },

  // Get monthly calendar
  getMonthlyCalendar: async (year: number, month: number, includeForecasts: boolean = true): Promise<MonthlyCalendar> => {
    const response = await api.get(`/api/calendar/monthly-summary/${year}/${month}?include_forecasts=${includeForecasts}`);
    return response.data;
  },

  // Get period summary for custom date range
  getPeriodSummary: async (startDate: string, endDate: string, includeForecasts: boolean = true): Promise<PeriodSummary> => {
    const response = await api.get(`/api/calendar/period-summary?start_date=${startDate}&end_date=${endDate}&include_forecasts=${includeForecasts}`);
    return response.data;
  },

  // Get quarterly summary
  getQuarterlySummary: async (year: number, quarter: number, includeForecasts: boolean = true): Promise<{
    year: number;
    quarter: number;
    quarter_name: string;
  } & PeriodSummary> => {
    const response = await api.get(`/api/calendar/quarterly-summary/${year}/${quarter}?include_forecasts=${includeForecasts}`);
    return response.data;
  },

  // Get calendar heatmap data
  getCalendarHeatmap: async (year: number, month: number, includeForecasts: boolean = true): Promise<{
    year: number;
    month: number;
    include_forecasts: boolean;
    max_flow: number;
    min_flow: number;
    daily_intensities: Record<number, {
      intensity: number;
      net_flow: number;
      is_positive: boolean;
      transaction_count: number;
    }>;
    month_summary: {
      total_inflows: number;
      total_outflows: number;
      net_flow: number;
      active_days: number;
      total_transactions: number;
    };
  }> => {
    const response = await api.get(`/api/calendar/heatmap/${year}/${month}?include_forecasts=${includeForecasts}`);
    return response.data;
  },
};

// Document API
export const documentAPI = {
  // Upload document
  uploadDocument: async (formData: FormData): Promise<Document> => {
    const response = await api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get documents with filters
  getDocuments: async (
    skip: number = 0,
    limit: number = 100,
    filters: DocumentFilters = {},
    includeArchived: boolean = false
  ): Promise<Document[]> => {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      include_archived: includeArchived.toString(),
    });

    // Add filters to params
    if (filters.search) params.append('search', filters.search);
    if (filters.categories) {
      filters.categories.forEach(cat => params.append('categories', cat));
    }
    if (filters.statuses) {
      filters.statuses.forEach(status => params.append('statuses', status));
    }
    if (filters.investment_ids) {
      filters.investment_ids.forEach(id => params.append('investment_ids', id.toString()));
    }
    if (filters.entity_ids) {
      filters.entity_ids.forEach(id => params.append('entity_ids', id.toString()));
    }
    if (filters.tags) {
      filters.tags.forEach(tag => params.append('tags', tag));
    }
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.due_date_from) params.append('due_date_from', filters.due_date_from);
    if (filters.due_date_to) params.append('due_date_to', filters.due_date_to);
    if (filters.is_confidential !== undefined) params.append('is_confidential', filters.is_confidential.toString());
    if (filters.is_archived !== undefined) params.append('is_archived', filters.is_archived.toString());
    if (filters.uploaded_by) params.append('uploaded_by', filters.uploaded_by);

    const response = await api.get(`/api/documents?${params.toString()}`);
    return response.data;
  },

  // Get single document
  getDocument: async (documentId: number): Promise<Document> => {
    const response = await api.get(`/api/documents/${documentId}`);
    return response.data;
  },

  // Update document
  updateDocument: async (documentId: number, update: DocumentUpdate): Promise<Document> => {
    const response = await api.put(`/api/documents/${documentId}`, update);
    return response.data;
  },

  // Delete document
  deleteDocument: async (documentId: number, permanent: boolean = false): Promise<{ message: string }> => {
    const params = permanent ? '?permanent=true' : '';
    const response = await api.delete(`/api/documents/${documentId}${params}`);
    return response.data;
  },

  // Download document
  downloadDocument: async (documentId: number): Promise<Blob> => {
    const response = await api.get(`/api/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Search documents
  searchDocuments: async (
    query: string,
    skip: number = 0,
    limit: number = 50
  ): Promise<DocumentSearchResult[]> => {
    const params = new URLSearchParams({
      q: query,
      skip: skip.toString(),
      limit: limit.toString(),
    });
    const response = await api.get(`/api/documents/search?${params.toString()}`);
    return response.data;
  },

  // Get document statistics
  getStatistics: async (): Promise<DocumentStatistics> => {
    const response = await api.get('/api/documents/statistics');
    return response.data;
  },

  // Tag management
  addTag: async (documentId: number, tag: DocumentTagCreate): Promise<DocumentTag> => {
    const response = await api.post(`/api/documents/${documentId}/tags`, tag);
    return response.data;
  },

  removeTag: async (documentId: number, tagName: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/documents/${documentId}/tags/${encodeURIComponent(tagName)}`);
    return response.data;
  },

  getAllTags: async (): Promise<string[]> => {
    const response = await api.get('/api/documents/tags');
    return response.data;
  },

  // Get documents by investment
  getInvestmentDocuments: async (
    investmentId: number,
    includeArchived: boolean = false
  ): Promise<Document[]> => {
    const params = includeArchived ? '?include_archived=true' : '';
    const response = await api.get(`/api/investments/${investmentId}/documents${params}`);
    return response.data;
  },

  // Get documents by entity
  getEntityDocuments: async (
    entityId: number,
    includeArchived: boolean = false
  ): Promise<Document[]> => {
    const params = includeArchived ? '?include_archived=true' : '';
    const response = await api.get(`/api/entities/${entityId}/documents${params}`);
    return response.data;
  },
};

// Market Benchmark API for monthly returns
export interface MarketBenchmark {
  id: number;
  name: string;
  ticker: string;
  category: string;
  description?: string;
  data_source: string;
  is_active: boolean;
  returns_count?: number;
}

export interface BenchmarkReturn {
  id: number;
  benchmark_id: number;
  period_date: string;
  total_return?: number;
  price_return?: number;
  dividend_yield?: number;
  notes?: string;
}

export interface BenchmarkReturnImport {
  benchmark_ticker: string;
  period_date: string;
  total_return?: number;
  price_return?: number;
  dividend_yield?: number;
  notes?: string;
}

export const marketBenchmarkAPI = {
  // Get all market benchmarks
  getMarketBenchmarks: async (): Promise<MarketBenchmark[]> => {
    const response = await api.get('/api/benchmarks');
    return response.data;
  },

  // Get single market benchmark
  getMarketBenchmark: async (id: number): Promise<MarketBenchmark> => {
    const response = await api.get(`/api/benchmarks/${id}`);
    return response.data;
  },

  // Get benchmark returns
  getBenchmarkReturns: async (benchmarkId: number): Promise<BenchmarkReturn[]> => {
    const response = await api.get(`/api/benchmarks/${benchmarkId}/returns`);
    return response.data;
  },

  // Create benchmark return
  createBenchmarkReturn: async (benchmarkId: number, returnData: Omit<BenchmarkReturn, 'id' | 'benchmark_id'>): Promise<BenchmarkReturn> => {
    const response = await api.post(`/api/benchmarks/${benchmarkId}/returns`, returnData);
    return response.data;
  },

  // Bulk import benchmark returns
  bulkImportBenchmarkReturns: async (benchmarkId: number, file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(`/api/benchmarks/${benchmarkId}/returns/bulk-import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Update benchmark return
  updateBenchmarkReturn: async (benchmarkId: number, returnId: number, returnData: Omit<BenchmarkReturn, 'id' | 'benchmark_id'>): Promise<BenchmarkReturn> => {
    const response = await api.put(`/api/benchmarks/${benchmarkId}/returns/${returnId}`, returnData);
    return response.data;
  },

  // Delete benchmark return
  deleteBenchmarkReturn: async (benchmarkId: number, returnId: number): Promise<void> => {
    await api.delete(`/api/benchmarks/${benchmarkId}/returns/${returnId}`);
  },
};

// PME (Public Markets Equivalent) Analysis API
export interface PMEDataPoint {
  date: string;
  private_tvpi: number;
  public_tvpi: number;
  illiquidity_premium: number;
  data_quality: {
    nav_age_days: number;
    confidence: 'high' | 'medium' | 'low';
    latest_nav_date?: string;
    warning?: string;
  };
}

export interface PMESummaryMetrics {
  final_private_tvpi: number;
  final_public_tvpi: number;
  final_illiquidity_premium: number;
  average_illiquidity_premium: number;
  pme_ratio: number;
  data_quality: {
    nav_age_days: number;
    confidence: 'high' | 'medium' | 'low';
    latest_nav_date?: string;
  };
}

export interface PMEAnalysisResult {
  investment_id?: number;
  investment_name?: string;
  scope?: {
    asset_class?: string;
    vintage_years?: number[];
    investment_count?: number;
  };
  benchmark_id: number;
  benchmark_name: string;
  start_date: string;
  end_date: string;
  pme_series: PMEDataPoint[];
  summary_metrics: PMESummaryMetrics;
  investments?: Array<{id: number; name: string}>;
}

export interface PMEBenchmark {
  id: number;
  name: string;
  ticker: string;
  category: string;
  description?: string;
  data_source: string;
  returns_count: number;
  start_date?: string;
  end_date?: string;
}

export const pmeAPI = {
  // Get PME analysis for a specific investment
  getInvestmentPME: async (
    investmentId: number,
    benchmarkId: number,
    endDate?: string
  ): Promise<PMEAnalysisResult> => {
    const params = new URLSearchParams({
      benchmark_id: benchmarkId.toString()
    });
    if (endDate) {
      params.append('end_date', endDate);
    }
    
    const response = await api.get(`/api/investments/${investmentId}/pme-analysis?${params}`);
    return response.data;
  },

  // Get PME analysis for portfolio or subset
  getPortfolioPME: async (
    benchmarkId: number,
    options?: {
      assetClass?: string;
      vintageYears?: number[];
      investmentIds?: number[];
      endDate?: string;
    }
  ): Promise<PMEAnalysisResult> => {
    const params = new URLSearchParams({
      benchmark_id: benchmarkId.toString()
    });
    
    if (options?.assetClass) {
      params.append('asset_class', options.assetClass);
    }
    if (options?.vintageYears && options.vintageYears.length > 0) {
      params.append('vintage_years', options.vintageYears.join(','));
    }
    if (options?.investmentIds && options.investmentIds.length > 0) {
      params.append('investment_ids', options.investmentIds.join(','));
    }
    if (options?.endDate) {
      params.append('end_date', options.endDate);
    }
    
    const response = await api.get(`/api/portfolio/pme-analysis?${params}`);
    return response.data;
  },

  // Get available benchmarks for PME analysis
  getAvailableBenchmarks: async (): Promise<PMEBenchmark[]> => {
    const response = await api.get('/api/pme/benchmarks');
    return response.data;
  },
};

// PitchBook Benchmark Data Types
// Original interface for legacy compatibility
export interface PitchBookIRRData {
  id: number;
  asset_class: string;
  vintage_year: number;
  pooled_irr?: number;
  equal_weighted_pooled_irr?: number;
  top_decile?: number;
  top_quartile?: number;
  median_irr?: number;
  bottom_quartile?: number;
  bottom_decile?: number;
  standard_deviation?: number;
  number_of_funds?: number;
  import_date: string;
}

// New interface that matches actual API response
export interface PitchBookPerformanceData {
  asset_class: string;
  metric_code: string;
  vintage_year: number;
  top_quartile_value: number;
  median_value: number;
  bottom_quartile_value: number;
  pooled_irr?: number;
  equal_weighted_pooled_irr?: number;
  sample_size: number;
  methodology_notes?: string;
}

export interface PitchBookMultiplesData {
  id: number;
  asset_class: string;
  vintage_year: number;
  pooled_tvpi?: number;
  pooled_dpi?: number;
  pooled_rvpi?: number;
  equal_weighted_tvpi?: number;
  equal_weighted_dpi?: number;
  equal_weighted_rvpi?: number;
  number_of_funds?: number;
  import_date: string;
}

export interface PitchBookQuantilesData {
  id: number;
  asset_class: string;
  vintage_year: number;
  tvpi_top_decile?: number;
  tvpi_top_quartile?: number;
  tvpi_median?: number;
  tvpi_bottom_quartile?: number;
  tvpi_bottom_decile?: number;
  dpi_top_decile?: number;
  dpi_top_quartile?: number;
  dpi_median?: number;
  dpi_bottom_quartile?: number;
  dpi_bottom_decile?: number;
  number_of_funds?: number;
  import_date: string;
}

export interface PitchBookQuarterlyData {
  id: number;
  asset_class: string;
  time_period: string;
  return_value: number;
  quarter_end_date: string;
  import_date: string;
}

// PitchBook API Functions
export const pitchBookAPI = {
  // Get IRR performance data
  getIRRData: async (filters?: {
    asset_class?: string;
    vintage_year?: number;
    start_year?: number;
    end_year?: number;
  }): Promise<PitchBookIRRData[]> => {
    const params = new URLSearchParams();
    if (filters?.asset_class) params.append('asset_class', filters.asset_class);
    if (filters?.vintage_year) params.append('vintage_year', filters.vintage_year.toString());
    if (filters?.start_year) params.append('start_year', filters.start_year.toString());
    if (filters?.end_year) params.append('end_year', filters.end_year.toString());

    const response = await api.get(`/api/pitchbook/performance-data?${params}`);
    const rawData: PitchBookPerformanceData[] = response.data;

    // Convert to legacy format for compatibility
    return rawData
      .filter(item => item.metric_code === 'IRR')
      .map(item => ({
        id: 0, // Legacy field, not used
        asset_class: item.asset_class,
        vintage_year: item.vintage_year,
        top_quartile: item.top_quartile_value,
        median_irr: item.median_value,
        bottom_quartile: item.bottom_quartile_value,
        pooled_irr: item.pooled_irr,
        equal_weighted_pooled_irr: item.equal_weighted_pooled_irr,
        number_of_funds: item.sample_size,
        import_date: new Date().toISOString(), // Legacy field, not used
      }));
  },

  // Get multiples data
  getMultiplesData: async (filters?: {
    asset_class?: string;
    vintage_year?: number;
    start_year?: number;
    end_year?: number;
  }): Promise<PitchBookMultiplesData[]> => {
    const params = new URLSearchParams();
    if (filters?.asset_class) params.append('asset_class', filters.asset_class);
    if (filters?.vintage_year) params.append('vintage_year', filters.vintage_year.toString());
    if (filters?.start_year) params.append('start_year', filters.start_year.toString());
    if (filters?.end_year) params.append('end_year', filters.end_year.toString());

    const response = await api.get(`/api/pitchbook/multiples-data?${params}`);
    return response.data;
  },

  // Get quantiles data
  getQuantilesData: async (filters?: {
    asset_class?: string;
    vintage_year?: number;
    start_year?: number;
    end_year?: number;
  }): Promise<PitchBookQuantilesData[]> => {
    const params = new URLSearchParams();
    if (filters?.asset_class) params.append('asset_class', filters.asset_class);
    if (filters?.vintage_year) params.append('vintage_year', filters.vintage_year.toString());
    if (filters?.start_year) params.append('start_year', filters.start_year.toString());
    if (filters?.end_year) params.append('end_year', filters.end_year.toString());

    const response = await api.get(`/api/pitchbook/multiples-data?${params}`);
    return response.data;
  },

  // Get quarterly returns data
  getQuarterlyReturns: async (filters?: {
    asset_class?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PitchBookQuarterlyData[]> => {
    const params = new URLSearchParams();
    if (filters?.asset_class) params.append('asset_class', filters.asset_class);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);

    const response = await api.get(`/api/pitchbook/quarterly-returns?${params}`);
    return response.data;
  },

  // Get available asset classes
  getAssetClasses: async (): Promise<string[]> => {
    const response = await api.get('/api/pitchbook/asset-classes');
    return response.data;
  },

  // Get available vintage years
  getVintageYears: async (): Promise<number[]> => {
    const response = await api.get('/api/pitchbook/vintage-years');
    return response.data;
  },
};

// Reports API
export const reportsAPI = {
  // Generate any report by endpoint
  generateReport: async (endpoint: string, asOfDate?: string): Promise<ArrayBuffer> => {
    let url = endpoint;
    if (asOfDate) {
      url += `?as_of_date=${asOfDate}`;
    }

    const response = await api.get(url, {
      responseType: 'arraybuffer',
    });
    return response.data;
  },

  // Specific report generators
  generatePortfolioSummary: async (asOfDate?: string): Promise<ArrayBuffer> => {
    return reportsAPI.generateReport('/api/reports/portfolio-summary', asOfDate);
  },

  generateHoldingsReport: async (asOfDate?: string, groupBy?: string, statusFilter?: string): Promise<ArrayBuffer> => {
    let url = '/api/reports/holdings';
    const params = new URLSearchParams();

    if (asOfDate) params.append('as_of_date', asOfDate);
    if (groupBy) params.append('group_by', groupBy);
    if (statusFilter) params.append('status_filter', statusFilter);

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;

    const response = await api.get(url, {
      responseType: 'arraybuffer',
    });
    return response.data;
  },

  generateEntityPerformance: async (asOfDate?: string): Promise<ArrayBuffer> => {
    return reportsAPI.generateReport('/api/reports/entity-performance', asOfDate);
  },
};

export default api;