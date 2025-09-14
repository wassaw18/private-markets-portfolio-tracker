export enum AssetClass {
  PUBLIC_EQUITY = "Public Equity",
  PUBLIC_FIXED_INCOME = "Public Fixed Income",
  PRIVATE_EQUITY = "Private Equity",
  VENTURE_CAPITAL = "Venture Capital",
  PRIVATE_CREDIT = "Private Credit",
  REAL_ESTATE = "Real Estate",
  REAL_ASSETS = "Real Assets",
  CASH_AND_EQUIVALENTS = "Cash & Cash Equivalents"
}

export enum InvestmentStructure {
  LIMITED_PARTNERSHIP = "Limited Partnership",
  DIRECT_INVESTMENT = "Direct Investment",
  CO_INVESTMENT = "Co-Investment",
  FUND_OF_FUNDS = "Fund of Funds",
  SEPARATE_ACCOUNT = "Separate Account",
  HEDGE_FUND = "Hedge Fund",
  PUBLIC_MARKETS = "Public Markets",
  BANK_ACCOUNT = "Bank Account",
  LOAN = "Loan"
}

export enum LiquidityProfile {
  ILLIQUID = "Illiquid",
  SEMI_LIQUID = "Semi-liquid",
  LIQUID = "Liquid"
}

export enum ReportingFrequency {
  MONTHLY = "Monthly",
  QUARTERLY = "Quarterly",
  SEMI_ANNUALLY = "Semi-annually",
  ANNUALLY = "Annually"
}

export enum RiskRating {
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High"
}

export enum TaxClassification {
  FORM_1099 = "1099",
  K1_PARTNERSHIP = "K-1",
  SCHEDULE_C = "Schedule C",
  W2_EMPLOYMENT = "W-2",
  FORM_1041 = "1041",
  FORM_1120S = "1120S"
}

export enum ActivityClassification {
  ACTIVE = "Active",
  PASSIVE = "Passive",
  PORTFOLIO = "Portfolio"
}

export enum CashFlowType {
  // Capital calls and contributions
  CAPITAL_CALL = "Capital Call",
  CONTRIBUTION = "Contribution",
  
  // Distributions
  DISTRIBUTION = "Distribution",
  YIELD = "Yield",
  RETURN_OF_PRINCIPAL = "Return of Principal",
  
  // Fees
  FEES = "Fees"
}

export interface CashFlow {
  id: number;
  investment_id: number;
  date: string;
  type: CashFlowType;
  amount: number;
}

export interface CashFlowCreate {
  date: string;
  type: CashFlowType;
  amount: number;
}

export interface Valuation {
  id: number;
  investment_id: number;
  date: string;
  nav_value: number;
}

export interface ValuationCreate {
  date: string;
  nav_value: number;
}

export interface Investment {
  id: number;
  name: string;
  asset_class: AssetClass;
  investment_structure: InvestmentStructure;
  entity_id: number;
  entity?: {
    id: number;
    name: string;
    entity_type: string;
  };
  strategy: string;
  vintage_year: number;
  commitment_amount: number;
  called_amount: number;
  fees: number;
  cashflows: CashFlow[];
  valuations: Valuation[];
  
  // Basic Information (new fields)
  manager?: string;
  target_raise?: number;
  geography_focus?: string;
  
  // Financial Terms (new fields)
  commitment_date?: string;
  management_fee?: number;
  performance_fee?: number;
  hurdle_rate?: number;
  distribution_target?: string;
  currency?: string;
  liquidity_profile: LiquidityProfile;
  
  // Operational Details
  expected_maturity_date?: string;
  reporting_frequency?: ReportingFrequency;
  contact_person?: string;
  email?: string;
  portal_link?: string;
  fund_administrator?: string;
  
  // Legal & Risk
  fund_domicile?: string;
  tax_classification?: TaxClassification;
  activity_classification?: ActivityClassification;
  due_diligence_date?: string;
  ic_approval_date?: string;
  risk_rating?: RiskRating;
  benchmark_index?: string;
  
  // Pacing Model Parameters
  target_irr?: number;
  target_moic?: number;
  fund_life?: number;
  investment_period?: number;
  bow_factor?: number;
  call_schedule?: 'Front Loaded' | 'Steady' | 'Back Loaded';
  distribution_timing?: 'Early' | 'Backend' | 'Steady';
  forecast_enabled?: boolean;
  last_forecast_date?: string;
}

export interface InvestmentCreate {
  name: string;
  asset_class: AssetClass;
  investment_structure: InvestmentStructure;
  entity_id: number;
  strategy: string;
  vintage_year: number;
  commitment_amount: number;
  called_amount?: number;
  fees?: number;
  
  // Basic Information (new fields)
  manager?: string;
  target_raise?: number;
  geography_focus?: string;
  
  // Financial Terms (new fields)
  commitment_date: string;  // Required for creation
  management_fee?: number;
  performance_fee?: number;
  hurdle_rate?: number;
  distribution_target?: string;
  currency?: string;
  liquidity_profile: LiquidityProfile;
  
  // Operational Details
  expected_maturity_date?: string;
  reporting_frequency?: ReportingFrequency;
  contact_person?: string;
  email?: string;
  portal_link?: string;
  fund_administrator?: string;
  
  // Legal & Risk
  fund_domicile?: string;
  tax_classification?: TaxClassification;
  activity_classification?: ActivityClassification;
  due_diligence_date?: string;
  ic_approval_date?: string;
  risk_rating?: RiskRating;
  benchmark_index?: string;
}

export interface InvestmentUpdate {
  name?: string;
  asset_class?: AssetClass;
  investment_structure?: InvestmentStructure;
  entity_id?: number | null;
  strategy?: string;
  vintage_year?: number;
  commitment_amount?: number;
  called_amount?: number;
  fees?: number;
  
  // Basic Information updates
  manager?: string;
  target_raise?: number;
  geography_focus?: string;
  
  // Financial Terms updates
  commitment_date?: string;
  management_fee?: number;
  performance_fee?: number;
  hurdle_rate?: number;
  distribution_target?: string;
  currency?: string;
  liquidity_profile?: LiquidityProfile;
  
  // Operational Details updates
  expected_maturity_date?: string;
  reporting_frequency?: ReportingFrequency;
  contact_person?: string;
  email?: string;
  portal_link?: string;
  fund_administrator?: string;
  
  // Legal & Risk updates
  fund_domicile?: string;
  tax_classification?: TaxClassification;
  activity_classification?: ActivityClassification;
  due_diligence_date?: string;
  ic_approval_date?: string;
  risk_rating?: RiskRating;
  benchmark_index?: string;
  
  // Pacing Model Parameters updates
  target_irr?: number;
  target_moic?: number;
  fund_life?: number;
  investment_period?: number;
  bow_factor?: number;
  call_schedule?: 'Front Loaded' | 'Steady' | 'Back Loaded';
  distribution_timing?: 'Early' | 'Backend' | 'Steady';
  forecast_enabled?: boolean;
  last_forecast_date?: string;
}

export interface PerformanceMetrics {
  irr?: number;  // Internal Rate of Return (decimal)
  tvpi?: number; // Total Value to Paid-In (MOIC)
  dpi?: number;  // Distributed to Paid-In  
  rvpi?: number; // Residual Value to Paid-In
  total_contributions: number;
  total_distributions: number;
  current_nav?: number;
  total_value?: number; // NAV + Distributions
  trailing_yield?: number; // Trailing 12-month yield (decimal)
  forward_yield?: number;  // Forward yield projection (decimal) 
  yield_frequency?: string; // Detected distribution frequency
  trailing_yield_amount?: number; // Dollar amount of trailing 12-month yield
  latest_yield_amount?: number; // Dollar amount of most recent single yield
}

export interface InvestmentPerformance {
  investment_id: number;
  investment_name: string;
  performance: PerformanceMetrics;
}

export interface PortfolioPerformance {
  portfolio_performance: PerformanceMetrics;
  investment_count: number;
  investments_with_nav: number;
  entity_count: number;
  asset_class_count: number;
  vintage_year_count: number;
  active_investment_count: number;
  total_commitment: number;
  total_called: number;
}

export interface CommitmentVsCalledData {
  commitment_amount: number;
  called_amount: number;
  uncalled_amount: number;
}

export interface AssetAllocationData {
  asset_class: string;
  commitment_amount: number;
  percentage: number;
  count: number;
}

export interface VintageAllocationData {
  vintage_year: number;
  commitment_amount: number;
  percentage: number;
  count: number;
}

export interface TimelineDataPoint {
  date: string;
  nav_value: number;
  cumulative_contributions: number;
  cumulative_distributions: number;
  net_value: number;
}

export interface JCurveDataPoint {
  date: string;
  cumulative_net_cash_flow: number;
  cumulative_contributions: number;
  cumulative_distributions: number;
}

export interface DashboardSummaryStats {
  total_investments: number;
  total_commitment: number;
  total_called: number;
  total_nav: number;
  total_distributions: number;
  asset_classes: number;
  vintage_years: number;
  active_investments: number;
}