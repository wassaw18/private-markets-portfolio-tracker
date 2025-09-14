from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
from app.models import AssetClass, InvestmentStructure, CashFlowType, CallScheduleType, DistributionTimingType, ForecastScenario, EntityType, RelationshipType, AdvancedRelationshipType, OwnershipType, DocumentCategory, DocumentStatus, LiquidityProfile, ReportingFrequency, RiskRating

class CashFlowBase(BaseModel):
    date: date
    type: CashFlowType
    amount: float = Field(..., description="Cash flow amount - can be positive or negative")

class CashFlowCreate(CashFlowBase):
    pass

class CashFlowUpdate(BaseModel):
    date: Optional[date] = None
    type: Optional[CashFlowType] = None
    amount: Optional[float] = None

class CashFlow(CashFlowBase):
    id: int
    investment_id: int
    
    class Config:
        from_attributes = True

class ValuationBase(BaseModel):
    date: date
    nav_value: float = Field(..., ge=0)

class ValuationCreate(ValuationBase):
    pass

class Valuation(ValuationBase):
    id: int
    investment_id: int
    
    class Config:
        from_attributes = True

# Entity and FamilyMember Schemas

class EntityBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    entity_type: EntityType
    tax_id: Optional[str] = Field(None, max_length=20)
    legal_address: Optional[str] = None
    formation_date: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None

class EntityCreate(EntityBase):
    pass

class EntityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    entity_type: Optional[EntityType] = None
    tax_id: Optional[str] = Field(None, max_length=20)
    legal_address: Optional[str] = None
    formation_date: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class Entity(EntityBase):
    id: int
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class FamilyMemberBase(BaseModel):
    entity_id: int
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    relationship_type: RelationshipType
    primary_contact: bool = False
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None

class FamilyMemberCreate(FamilyMemberBase):
    pass

class FamilyMemberUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    relationship_type: Optional[RelationshipType] = None
    primary_contact: Optional[bool] = None
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class FamilyMember(FamilyMemberBase):
    id: int
    full_name: str
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class EntityWithMembers(Entity):
    family_members: List[FamilyMember] = []
    investment_count: Optional[int] = 0
    total_commitment: Optional[float] = 0.0

class InvestmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    asset_class: AssetClass
    investment_structure: InvestmentStructure
    entity_id: int = Field(..., gt=0)
    strategy: str = Field(..., min_length=1, max_length=255)
    vintage_year: int = Field(..., ge=1900, le=2100)
    commitment_amount: float = Field(..., ge=0)
    called_amount: Optional[float] = Field(default=0.0)
    fees: Optional[float] = Field(default=0.0, ge=0)
    
    # Basic Information (new fields)
    manager: Optional[str] = None
    target_raise: Optional[float] = Field(None, ge=0)
    geography_focus: Optional[str] = None
    
    # Financial Terms (new fields)
    commitment_date: Optional[date] = None
    management_fee: Optional[float] = Field(None, ge=0, le=1.0, description="Management fee as decimal (0.02 = 2%)")
    performance_fee: Optional[float] = Field(None, ge=0, le=1.0, description="Performance fee as decimal (0.20 = 20%)")
    hurdle_rate: Optional[float] = Field(None, ge=0, le=1.0, description="Hurdle rate as decimal (0.08 = 8%)")
    distribution_target: Optional[str] = None
    currency: Optional[str] = Field(default="USD")
    liquidity_profile: LiquidityProfile = Field(default=LiquidityProfile.ILLIQUID)
    
    # Operational Details
    expected_maturity_date: Optional[date] = None
    reporting_frequency: Optional[ReportingFrequency] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    portal_link: Optional[str] = None
    fund_administrator: Optional[str] = None
    
    # Legal & Risk
    fund_domicile: Optional[str] = None
    tax_classification: Optional[str] = None
    due_diligence_date: Optional[date] = None
    ic_approval_date: Optional[date] = None
    risk_rating: Optional[RiskRating] = None
    benchmark_index: Optional[str] = None
    
    # Pacing Model Parameters
    target_irr: Optional[float] = Field(default=0.15, ge=0, le=1.0, description="Target IRR (0.15 = 15%)")
    target_moic: Optional[float] = Field(default=2.5, ge=1.0, le=10.0, description="Target MOIC multiple")
    fund_life: Optional[int] = Field(default=10, ge=5, le=15, description="Total fund life in years")
    investment_period: Optional[int] = Field(default=4, ge=1, le=8, description="Investment period in years")
    bow_factor: Optional[float] = Field(default=0.3, ge=0.1, le=0.5, description="J-curve depth factor")
    call_schedule: Optional[CallScheduleType] = Field(default=CallScheduleType.STEADY)
    distribution_timing: Optional[DistributionTimingType] = Field(default=DistributionTimingType.BACKEND)
    forecast_enabled: Optional[bool] = Field(default=True)

class InvestmentCreate(InvestmentBase):
    # Override to make required fields explicit for creation
    commitment_date: date = Field(..., description="Date of initial commitment")
    liquidity_profile: LiquidityProfile = Field(default=LiquidityProfile.ILLIQUID)

class InvestmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    asset_class: Optional[AssetClass] = None
    investment_structure: Optional[InvestmentStructure] = None
    entity_id: Optional[int] = Field(None, gt=0)
    strategy: Optional[str] = Field(None, min_length=1, max_length=255)
    vintage_year: Optional[int] = Field(None, ge=1900, le=2100)
    commitment_amount: Optional[float] = Field(None, ge=0)
    called_amount: Optional[float] = Field(None)
    fees: Optional[float] = Field(None, ge=0)
    
    # Basic Information updates
    manager: Optional[str] = None
    target_raise: Optional[float] = Field(None, ge=0)
    geography_focus: Optional[str] = None
    
    # Financial Terms updates
    commitment_date: Optional[date] = None
    management_fee: Optional[float] = Field(None, ge=0, le=1.0)
    performance_fee: Optional[float] = Field(None, ge=0, le=1.0)
    hurdle_rate: Optional[float] = Field(None, ge=0, le=1.0)
    distribution_target: Optional[str] = None
    currency: Optional[str] = None
    liquidity_profile: Optional[LiquidityProfile] = None
    
    # Operational Details updates
    expected_maturity_date: Optional[date] = None
    reporting_frequency: Optional[ReportingFrequency] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    portal_link: Optional[str] = None
    fund_administrator: Optional[str] = None
    
    # Legal & Risk updates
    fund_domicile: Optional[str] = None
    tax_classification: Optional[str] = None
    due_diligence_date: Optional[date] = None
    ic_approval_date: Optional[date] = None
    risk_rating: Optional[RiskRating] = None
    benchmark_index: Optional[str] = None

class Investment(InvestmentBase):
    id: int
    entity: Optional[Entity] = None
    cashflows: List[CashFlow] = []
    valuations: List[Valuation] = []
    
    class Config:
        from_attributes = True

class PerformanceMetrics(BaseModel):
    irr: Optional[float] = Field(None, description="Internal Rate of Return (decimal)")
    tvpi: Optional[float] = Field(None, description="Total Value to Paid-In (MOIC)")
    dpi: Optional[float] = Field(None, description="Distributed to Paid-In")  
    rvpi: Optional[float] = Field(None, description="Residual Value to Paid-In")
    total_contributions: float
    total_distributions: float = Field(..., ge=0, description="Total distributions received")
    current_nav: Optional[float] = Field(None, ge=0, description="Current Net Asset Value")
    total_value: Optional[float] = Field(None, ge=0, description="NAV + Distributions")
    trailing_yield: Optional[float] = Field(None, description="Trailing 12-month yield (decimal)")
    forward_yield: Optional[float] = Field(None, description="Forward yield based on most recent distribution (decimal)")
    yield_frequency: Optional[str] = Field(None, description="Detected distribution frequency for forward yield")
    trailing_yield_amount: Optional[float] = Field(None, ge=0, description="Dollar amount of trailing 12-month yield")
    latest_yield_amount: Optional[float] = Field(None, ge=0, description="Dollar amount of most recent single yield")

class InvestmentPerformance(BaseModel):
    investment_id: int
    investment_name: str
    performance: PerformanceMetrics

class PortfolioPerformance(BaseModel):
    portfolio_performance: PerformanceMetrics
    investment_count: int
    investments_with_nav: int
    entity_count: int
    asset_class_count: int
    vintage_year_count: int
    active_investment_count: int
    total_commitment: float
    total_called: float

class CommitmentVsCalledData(BaseModel):
    commitment_amount: float
    called_amount: float
    uncalled_amount: float

class AssetAllocationData(BaseModel):
    asset_class: str
    commitment_amount: float
    percentage: float
    count: int

class VintageAllocationData(BaseModel):
    vintage_year: int
    commitment_amount: float
    percentage: float
    count: int

class TimelineDataPoint(BaseModel):
    date: str
    nav_value: float
    cumulative_contributions: float
    cumulative_distributions: float
    net_value: float

class JCurveDataPoint(BaseModel):
    date: str
    cumulative_net_cash_flow: float
    cumulative_contributions: float
    cumulative_distributions: float

class DashboardSummaryStats(BaseModel):
    total_investments: int
    total_commitment: float
    total_called: float
    total_nav: float
    total_distributions: float
    asset_classes: int
    vintage_years: int
    active_investments: int

# Benchmark Performance Schemas
class BenchmarkData(BaseModel):
    """Single benchmark data point"""
    asset_class: str
    vintage_year: int
    metric_type: str
    q1_performance: float
    median_performance: float
    q3_performance: float
    sample_size: Optional[int]
    data_source: str
    report_date: date
    methodology_notes: Optional[str]
    
    class Config:
        from_attributes = True

class InvestmentBenchmarkComparison(BaseModel):
    """Benchmark comparison for a specific investment"""
    investment_id: int
    investment_name: str
    asset_class: str
    vintage_year: int
    
    # Investment performance
    investment_irr: Optional[float]
    investment_tvpi: Optional[float]
    
    # IRR Benchmark comparison
    irr_benchmark: Optional[BenchmarkData]
    irr_quartile_rank: Optional[int]  # 1=top quartile, 4=bottom quartile
    irr_vs_median: Optional[float]  # Difference from median (percentage points)
    irr_percentile: Optional[float]  # Approximate percentile (0-100)
    
    # TVPI Benchmark comparison  
    tvpi_benchmark: Optional[BenchmarkData]
    tvpi_quartile_rank: Optional[int]
    tvpi_vs_median: Optional[float]
    tvpi_percentile: Optional[float]
    
    # Overall assessment
    overall_performance_summary: str
    data_availability: str  # "Full", "Partial", "No benchmark data"

# Cash Flow Forecast Schemas
class CashFlowForecastBase(BaseModel):
    """Base schema for cash flow forecasts"""
    forecast_year: int
    forecast_period_start: date
    forecast_period_end: date
    projected_calls: float = 0.0
    projected_distributions: float = 0.0
    projected_nav: float = 0.0
    cumulative_calls: float = 0.0
    cumulative_distributions: float = 0.0
    cumulative_net_cf: float = 0.0
    scenario: ForecastScenario = ForecastScenario.BASE
    confidence_level: float = 0.68

class CashFlowForecast(CashFlowForecastBase):
    """Complete cash flow forecast"""
    id: int
    investment_id: int
    forecast_date: date
    model_version: str = "1.0"
    
    class Config:
        from_attributes = True

class PacingModelInputs(BaseModel):
    """Pacing model parameter inputs for updates"""
    target_irr: float = Field(..., ge=0, le=1.0)
    target_moic: float = Field(..., ge=1.0, le=10.0)
    fund_life: int = Field(..., ge=5, le=15)
    investment_period: int = Field(..., ge=1, le=8)
    bow_factor: float = Field(..., ge=0.1, le=0.5)
    call_schedule: CallScheduleType
    distribution_timing: DistributionTimingType
    forecast_enabled: bool = True

class InvestmentForecastSummary(BaseModel):
    """Investment forecast summary for API responses"""
    investment_id: int
    investment_name: str
    forecast_generated_date: Optional[date]
    total_projected_calls: float
    total_projected_distributions: float
    expected_net_cash_flow: float
    expected_irr: float
    expected_moic: float
    forecast_accuracy_score: Optional[float]  # 0-1 confidence score
    
    # Scenarios
    base_case: List[CashFlowForecast]
    bull_case: Optional[List[CashFlowForecast]]
    bear_case: Optional[List[CashFlowForecast]]

class PortfolioCashFlowForecast(BaseModel):
    """Portfolio-level cash flow forecast aggregation"""
    forecast_date: date
    scenario: ForecastScenario = ForecastScenario.BASE
    
    # Annual aggregated projections
    annual_forecasts: List[dict]  # [{year: 2024, calls: 1000000, distributions: 500000, net: -500000}, ...]
    
    # Key insights
    peak_capital_need_year: int
    peak_capital_amount: float
    break_even_year: int  # When cumulative net cash flow turns positive
    total_capital_required: float
    total_expected_distributions: float
    portfolio_expected_irr: float
    portfolio_expected_moic: float
    
    # Liquidity analysis
    liquidity_gap_periods: List[dict]  # Periods of high capital needs
    distribution_peak_periods: List[dict]  # Periods of high distributions

# Document Management Schemas

class DocumentTagBase(BaseModel):
    tag_name: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = Field(default="#007bff", pattern=r"^#[0-9A-Fa-f]{6}$")

class DocumentTagCreate(DocumentTagBase):
    pass

class DocumentTag(DocumentTagBase):
    id: int
    document_id: int
    created_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class DocumentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: DocumentCategory
    status: DocumentStatus = DocumentStatus.PENDING_REVIEW
    document_date: Optional[date] = None
    due_date: Optional[date] = None
    investment_id: Optional[int] = Field(None, gt=0)
    entity_id: Optional[int] = Field(None, gt=0)
    is_confidential: bool = False
    is_archived: bool = False
    notes: Optional[str] = None

class DocumentCreate(DocumentBase):
    # File information will be added during upload
    pass

class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[DocumentCategory] = None
    status: Optional[DocumentStatus] = None
    document_date: Optional[date] = None
    due_date: Optional[date] = None
    investment_id: Optional[int] = Field(None, gt=0)
    entity_id: Optional[int] = Field(None, gt=0)
    is_confidential: Optional[bool] = None
    is_archived: Optional[bool] = None
    notes: Optional[str] = None

class Document(DocumentBase):
    id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    file_hash: str
    searchable_content: Optional[str] = None
    uploaded_by: Optional[str] = None
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None
    
    # Relationships
    investment: Optional[Investment] = None
    entity: Optional[Entity] = None
    tags: List[DocumentTag] = []
    
    class Config:
        from_attributes = True

class DocumentWithRelations(Document):
    """Document with populated investment and entity relationships"""
    pass

class DocumentFilters(BaseModel):
    """Filters for document search and filtering"""
    search: Optional[str] = None
    categories: Optional[List[DocumentCategory]] = None
    statuses: Optional[List[DocumentStatus]] = None
    investment_ids: Optional[List[int]] = None
    entity_ids: Optional[List[int]] = None
    tags: Optional[List[str]] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    due_date_from: Optional[date] = None
    due_date_to: Optional[date] = None
    is_confidential: Optional[bool] = None
    is_archived: Optional[bool] = None
    uploaded_by: Optional[str] = None

class DocumentSearchResult(BaseModel):
    """Search result with relevance scoring"""
    document: Document
    relevance_score: float = Field(..., ge=0, le=1)
    highlight_snippets: List[str] = []

class DocumentStatistics(BaseModel):
    """Document management statistics"""
    total_documents: int
    by_category: dict  # {category: count}
    by_status: dict  # {status: count}
    by_entity: dict  # {entity_name: count}
    by_investment: dict  # {investment_name: count}
    pending_action_count: int
    overdue_count: int
    recent_uploads_count: int  # Last 30 days
    total_file_size: int  # In bytes

class BulkDocumentOperation(BaseModel):
    """For bulk operations on documents"""
    document_ids: List[int] = Field(..., min_items=1)
    operation: str = Field(..., pattern="^(archive|unarchive|delete|update_status|add_tags|remove_tags)$")
    parameters: Optional[dict] = None  # Operation-specific parameters

# Advanced Entity Relationship Schemas

class EntityRelationshipBase(BaseModel):
    """Base schema for entity relationships"""
    from_entity_id: int
    to_entity_id: int
    relationship_type: AdvancedRelationshipType
    relationship_subtype: Optional[str] = None
    percentage_ownership: float = Field(0.0, ge=0, le=100)
    is_voting_interest: bool = True
    effective_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None

class EntityRelationshipCreate(EntityRelationshipBase):
    pass

class EntityRelationshipUpdate(BaseModel):
    relationship_type: Optional[AdvancedRelationshipType] = None
    relationship_subtype: Optional[str] = None
    percentage_ownership: Optional[float] = Field(None, ge=0, le=100)
    is_voting_interest: Optional[bool] = None
    effective_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class EntityRelationship(EntityRelationshipBase):
    id: int
    created_date: datetime
    updated_date: datetime
    
    class Config:
        from_attributes = True

class EntityRelationshipWithEntities(EntityRelationship):
    """Entity relationship with populated entity information"""
    from_entity_name: str
    from_entity_type: EntityType
    to_entity_name: str
    to_entity_type: EntityType

# Investment Ownership Schemas

class InvestmentOwnershipBase(BaseModel):
    """Base schema for investment ownership"""
    investment_id: int
    entity_id: int
    ownership_percentage: float = Field(..., gt=0, le=100)
    ownership_type: OwnershipType = OwnershipType.DIRECT
    is_beneficial_owner: bool = True
    effective_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None

class InvestmentOwnershipCreate(InvestmentOwnershipBase):
    pass

class InvestmentOwnershipUpdate(BaseModel):
    ownership_percentage: Optional[float] = Field(None, gt=0, le=100)
    ownership_type: Optional[OwnershipType] = None
    is_beneficial_owner: Optional[bool] = None
    effective_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None

class InvestmentOwnership(InvestmentOwnershipBase):
    id: int
    created_date: datetime
    updated_date: datetime
    
    class Config:
        from_attributes = True

class InvestmentOwnershipWithDetails(InvestmentOwnership):
    """Investment ownership with entity and investment details"""
    entity_name: str
    entity_type: EntityType
    investment_name: str
    investment_asset_class: AssetClass

# Entity Hierarchy Schemas

class EntityHierarchyBase(BaseModel):
    """Base schema for entity hierarchy"""
    entity_id: int
    parent_entity_id: Optional[int] = None
    hierarchy_level: int = 1
    sort_order: int = 0
    is_primary_parent: bool = True

class EntityHierarchyCreate(EntityHierarchyBase):
    pass

class EntityHierarchyUpdate(BaseModel):
    parent_entity_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_primary_parent: Optional[bool] = None

class EntityHierarchy(EntityHierarchyBase):
    id: int
    hierarchy_path: Optional[str] = None
    created_date: datetime
    
    class Config:
        from_attributes = True

class EntityHierarchyNode(BaseModel):
    """Entity hierarchy node for tree visualization"""
    entity_id: int
    entity_name: str
    entity_type: EntityType
    parent_entity_id: Optional[int] = None
    hierarchy_level: int
    children: List['EntityHierarchyNode'] = []
    relationship_summary: str = ""  # Summary of key relationships

# Response schemas for complex queries

class EntityWithRelationships(Entity):
    """Entity with all its relationships"""
    outgoing_relationships: List[EntityRelationshipWithEntities] = []
    incoming_relationships: List[EntityRelationshipWithEntities] = []
    investment_ownerships: List[InvestmentOwnershipWithDetails] = []
    hierarchy_position: Optional[EntityHierarchy] = None

class InvestmentWithOwnership(Investment):
    """Investment with ownership breakdown"""
    ownership_records: List[InvestmentOwnershipWithDetails] = []
    ownership_validated: bool = True  # Whether ownership percentages add up to 100%
    
class FamilyTreeResponse(BaseModel):
    """Complete family tree structure"""
    root_entities: List[EntityHierarchyNode] = []
    orphaned_entities: List[EntityHierarchyNode] = []  # Entities without parents
    total_entities: int
    max_hierarchy_depth: int

class OwnershipVisualizationData(BaseModel):
    """Data for ownership visualization charts"""
    investment_id: int
    investment_name: str
    total_commitment: float
    ownership_breakdown: List[dict] = []  # [{entity_name, percentage, amount, entity_type}]
    effective_date: date

# Forecast Adjustment Schemas

class ForecastAdjustmentCreate(BaseModel):
    """Schema for creating forecast adjustments (overrides)"""
    investment_id: int
    adjustment_date: date
    adjustment_type: str  # "capital_call", "distribution", "nav_update"
    adjustment_amount: float
    reason: Optional[str] = None
    confidence: str = "confirmed"  # "confirmed", "likely", "possible"

class ForecastAdjustment(BaseModel):
    """Complete forecast adjustment data"""
    id: int
    investment_id: int
    adjustment_date: date
    adjustment_type: str
    adjustment_amount: float
    reason: Optional[str]
    confidence: str
    created_by: Optional[str]
    created_date: Optional[datetime]
    is_active: bool
    
    class Config:
        from_attributes = True