from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Enum, Boolean, Text, DateTime, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

Base = declarative_base()

class AssetClass(str, enum.Enum):
    PUBLIC_EQUITY = "Public Equity"
    PUBLIC_FIXED_INCOME = "Public Fixed Income"
    PRIVATE_EQUITY = "Private Equity"
    VENTURE_CAPITAL = "Venture Capital"
    PRIVATE_CREDIT = "Private Credit"
    REAL_ESTATE = "Real Estate"
    REAL_ASSETS = "Real Assets"
    CASH_AND_EQUIVALENTS = "Cash & Cash Equivalents"

class InvestmentStructure(str, enum.Enum):
    LIMITED_PARTNERSHIP = "Limited Partnership"
    DIRECT_INVESTMENT = "Direct Investment"
    CO_INVESTMENT = "Co-Investment"
    FUND_OF_FUNDS = "Fund of Funds"
    SEPARATE_ACCOUNT = "Separate Account"
    HEDGE_FUND = "Hedge Fund"
    PUBLIC_MARKETS = "Public Markets"
    BANK_ACCOUNT = "Bank Account"
    LOAN = "Loan"

class InvestmentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"      # Current investments being tracked
    DORMANT = "DORMANT"    # Inactive but may resume activity
    REALIZED = "REALIZED"  # Completely finished, no future activity

class CashFlowType(str, enum.Enum):
    # Capital calls and contributions
    CAPITAL_CALL = "Capital Call"
    CONTRIBUTION = "Contribution"
    
    # Distributions
    DISTRIBUTION = "Distribution"
    YIELD = "Yield"
    RETURN_OF_PRINCIPAL = "Return of Principal"
    
    # Fees
    FEES = "Fees"

class DistributionType(str, enum.Enum):
    PRINCIPAL = "Principal"
    INTEREST = "Interest"
    CAPITAL_GAINS = "Capital Gains"
    DIVIDEND = "Dividend"
    OTHER = "Other"

class CallScheduleType(str, enum.Enum):
    FRONT_LOADED = "Front Loaded"
    STEADY = "Steady"
    BACK_LOADED = "Back Loaded"

class DistributionTimingType(str, enum.Enum):
    EARLY = "Early"
    BACKEND = "Backend"
    STEADY = "Steady"

class ForecastScenario(str, enum.Enum):
    BULL = "Bull"
    BASE = "Base"
    BEAR = "Bear"

class TaxDocumentStatus(str, enum.Enum):
    PENDING = "Pending"
    RECEIVED = "Received"
    PROCESSED = "Processed"
    AMENDED = "Amended"

class DocumentCategory(str, enum.Enum):
    CAPITAL_CALL = "Capital Call"
    DISTRIBUTION_NOTICE = "Distribution Notice"
    K1_TAX_DOCUMENT = "K-1 Tax Document"
    QUARTERLY_REPORT = "Quarterly Report"
    ANNUAL_REPORT = "Annual Report"
    GP_CORRESPONDENCE = "GP Correspondence"
    FINANCIAL_STATEMENT = "Financial Statement"
    LEGAL_DOCUMENT = "Legal Document"
    INVESTMENT_MEMO = "Investment Memo"
    SIDE_LETTER = "Side Letter"
    SUBSCRIPTION_DOCUMENT = "Subscription Document"
    OTHER = "Other"

class DocumentStatus(str, enum.Enum):
    PENDING_REVIEW = "Pending Review"
    REVIEWED = "Reviewed"
    ACTION_REQUIRED = "Action Required"
    ARCHIVED = "Archived"

class EntityType(str, enum.Enum):
    INDIVIDUAL = "Individual"
    TRUST = "Trust"
    LLC = "LLC"
    PARTNERSHIP = "Partnership"
    CORPORATION = "Corporation"
    FOUNDATION = "Foundation"
    OTHER = "Other"

class RelationshipType(str, enum.Enum):
    SELF = "Self"
    SPOUSE = "Spouse"
    CHILD = "Child"
    PARENT = "Parent"
    SIBLING = "Sibling"
    TRUSTEE = "Trustee"
    BENEFICIARY = "Beneficiary"
    MANAGER = "Manager"
    MEMBER = "Member"
    PARTNER = "Partner"
    OTHER = "Other"

class AdvancedRelationshipType(str, enum.Enum):
    # Trust relationships
    TRUST_RELATIONSHIP = "Trust Relationship"
    GRANTOR = "Grantor"
    SUCCESSOR_TRUSTEE = "Successor Trustee"
    REMAINDERMAN = "Remainderman"
    PRIMARY_BENEFICIARY = "Primary Beneficiary"
    CONTINGENT_BENEFICIARY = "Contingent Beneficiary"
    
    # Corporate relationships
    CORPORATE_RELATIONSHIP = "Corporate Relationship"
    SHAREHOLDER = "Shareholder"
    BOARD_MEMBER = "Board Member"
    OFFICER = "Officer"
    MANAGING_MEMBER = "Managing Member"
    
    # Family relationships
    FAMILY_RELATIONSHIP = "Family Relationship"
    GUARDIAN = "Guardian"
    POWER_OF_ATTORNEY = "Power of Attorney"
    
    # Ownership relationships
    OWNERSHIP_RELATIONSHIP = "Ownership Relationship"
    VOTING_INTEREST = "Voting Interest"
    NON_VOTING_INTEREST = "Non-Voting Interest"
    
    # Professional relationships
    PROFESSIONAL_RELATIONSHIP = "Professional Relationship"
    ADVISOR = "Advisor"
    ACCOUNTANT = "Accountant"
    ATTORNEY = "Attorney"
    
    # Legacy support
    TRUSTEE = "Trustee"  # Kept for backward compatibility
    BENEFICIARY = "Beneficiary"  # Kept for backward compatibility
    MANAGER = "Manager"  # Kept for backward compatibility
    MEMBER = "Member"  # Kept for backward compatibility
    PARTNER = "Partner"  # Kept for backward compatibility
    OTHER = "Other"

class OwnershipType(str, enum.Enum):
    DIRECT = "Direct"
    INDIRECT = "Indirect"
    BENEFICIAL = "Beneficial"
    FIDUCIARY = "Fiduciary"
    NOMINEE = "Nominee"

class LiquidityProfile(str, enum.Enum):
    ILLIQUID = "Illiquid"
    SEMI_LIQUID = "Semi-liquid"
    LIQUID = "Liquid"

class ReportingFrequency(str, enum.Enum):
    MONTHLY = "Monthly"
    QUARTERLY = "Quarterly"
    SEMI_ANNUALLY = "Semi-annually"
    ANNUALLY = "Annually"

class RiskRating(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"

class TaxClassification(str, enum.Enum):
    FORM_1099 = "1099"
    K1_PARTNERSHIP = "K-1"
    SCHEDULE_C = "Schedule C"
    W2_EMPLOYMENT = "W-2"
    FORM_1041 = "1041"
    FORM_1120S = "1120S"

class ActivityClassification(str, enum.Enum):
    ACTIVE = "Active"
    PASSIVE = "Passive"
    PORTFOLIO = "Portfolio"

class Entity(Base):
    """
    Represents legal entities that can own investments (Individuals, Trusts, LLCs, etc.)
    """
    __tablename__ = "entities"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    entity_type = Column(Enum(EntityType), nullable=False)
    
    # Legal and tax information
    tax_id = Column(String, nullable=True, unique=True)  # SSN/EIN/TIN
    legal_address = Column(Text, nullable=True)
    formation_date = Column(Date, nullable=True)  # For legal entities
    
    # Entity status and metadata
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record
    updated_by = Column(String, nullable=True)  # Username who last updated the record
    
    # Relationships
    investments = relationship("Investment", back_populates="entity", cascade="all, delete-orphan")
    family_members = relationship("FamilyMember", back_populates="entity")
    
    # New relationship fields
    entity_relationships_from = relationship(
        "EntityRelationship", 
        foreign_keys="EntityRelationship.from_entity_id",
        back_populates="from_entity",
        cascade="all, delete-orphan"
    )
    entity_relationships_to = relationship(
        "EntityRelationship", 
        foreign_keys="EntityRelationship.to_entity_id", 
        back_populates="to_entity",
        cascade="all, delete-orphan"
    )
    investment_ownerships = relationship(
        "InvestmentOwnership", 
        back_populates="entity",
        cascade="all, delete-orphan"
    )
    hierarchy_entries = relationship(
        "EntityHierarchy",
        foreign_keys="EntityHierarchy.entity_id",
        back_populates="entity",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index('ix_entity_name_type', 'name', 'entity_type'),
    )

class FamilyMember(Base):
    """
    Represents individual family members and their relationships to entities
    """
    __tablename__ = "family_members"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    
    # Personal information
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    
    # Relationship information
    relationship_type = Column(Enum(RelationshipType), nullable=False)
    primary_contact = Column(Boolean, default=False)  # Is this the primary contact for the entity?
    
    # Contact information
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    
    # Status and metadata
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record
    updated_by = Column(String, nullable=True)  # Username who last updated the record
    
    # Relationships
    entity = relationship("Entity", back_populates="family_members")
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    __table_args__ = (
        Index('ix_family_member_name', 'last_name', 'first_name'),
        Index('ix_family_member_entity', 'entity_id', 'relationship_type'),
    )

class Investment(Base):
    __tablename__ = "investments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    asset_class = Column(Enum(AssetClass), nullable=False)
    investment_structure = Column(Enum(InvestmentStructure), nullable=False)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False, index=True)
    strategy = Column(String, nullable=False)
    vintage_year = Column(Integer, nullable=False)
    commitment_amount = Column(Float, nullable=False)
    called_amount = Column(Float, default=0.0)
    fees = Column(Float, default=0.0)
    
    # Basic Information (new fields)
    manager = Column(String, nullable=True)
    target_raise = Column(Float, nullable=True)  # Total fund size
    geography_focus = Column(String, nullable=True)  # US, Europe, Global, etc.
    
    # Financial Terms (new fields)
    commitment_date = Column(Date, nullable=True)
    management_fee = Column(Float, nullable=True)  # As decimal (0.02 for 2%)
    performance_fee = Column(Float, nullable=True)  # As decimal (0.20 for 20%)
    hurdle_rate = Column(Float, nullable=True)  # As decimal (0.08 for 8%)
    distribution_target = Column(String, nullable=True)  # Free text description
    currency = Column(String, default="USD")
    liquidity_profile = Column(Enum(LiquidityProfile), nullable=False, default=LiquidityProfile.ILLIQUID)
    
    # Operational Details
    expected_maturity_date = Column(Date, nullable=True)
    reporting_frequency = Column(Enum(ReportingFrequency), nullable=True)
    contact_person = Column(String, nullable=True)
    email = Column(String, nullable=True)
    portal_link = Column(String, nullable=True)
    fund_administrator = Column(String, nullable=True)
    
    # Legal & Risk
    fund_domicile = Column(String, nullable=True)
    tax_classification = Column(Enum(TaxClassification), nullable=True)
    activity_classification = Column(Enum(ActivityClassification), nullable=True)
    due_diligence_date = Column(Date, nullable=True)
    ic_approval_date = Column(Date, nullable=True)  # Investment Committee approval
    risk_rating = Column(Enum(RiskRating), nullable=True)
    benchmark_index = Column(String, nullable=True)
    
    # Pacing Model Parameters
    target_irr = Column(Float, default=0.15)  # 15% default IRR
    target_moic = Column(Float, default=2.5)  # 2.5x default MOIC
    fund_life = Column(Integer, default=10)  # 10 year default fund life
    investment_period = Column(Integer, default=4)  # 4 year investment period
    bow_factor = Column(Float, default=0.3)  # J-curve depth factor (0.1-0.5)
    call_schedule = Column(Enum(CallScheduleType), default=CallScheduleType.STEADY)
    distribution_timing = Column(Enum(DistributionTimingType), default=DistributionTimingType.BACKEND)
    
    # Forecast configuration
    forecast_enabled = Column(Boolean, default=True)
    last_forecast_date = Column(DateTime)
    
    # Investment Status Management
    status = Column(Enum(InvestmentStatus), default=InvestmentStatus.ACTIVE, nullable=False)
    realization_date = Column(Date, nullable=True)
    realization_notes = Column(String(500), nullable=True)
    status_changed_by = Column(String, nullable=True)  # Username who changed status
    status_changed_date = Column(DateTime, nullable=True)
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record
    updated_by = Column(String, nullable=True)  # Username who last updated the record
    
    entity = relationship("Entity", back_populates="investments")
    ownership_records = relationship("InvestmentOwnership", back_populates="investment", cascade="all, delete-orphan")
    cashflows = relationship("CashFlow", back_populates="investment", cascade="all, delete-orphan")
    valuations = relationship("Valuation", back_populates="investment", cascade="all, delete-orphan")
    forecasts = relationship("CashFlowForecast", back_populates="investment", cascade="all, delete-orphan")
    forecast_adjustments = relationship("ForecastAdjustment", back_populates="investment", cascade="all, delete-orphan")
    tax_documents = relationship("TaxDocument", back_populates="investment", cascade="all, delete-orphan")

class CashFlow(Base):
    __tablename__ = "cashflows"
    
    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False)
    date = Column(Date, nullable=False)
    type = Column(Enum(CashFlowType), nullable=False)
    amount = Column(Float, nullable=False)
    
    # K-1 Tax Tracking Fields
    distribution_type = Column(Enum(DistributionType), nullable=True)  # Only for distributions
    tax_year = Column(Integer, nullable=True)  # Tax year for K-1 reporting
    k1_reportable = Column(Boolean, default=True)  # Whether included in K-1
    notes = Column(Text, nullable=True)  # Additional tax notes
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record
    updated_by = Column(String, nullable=True)  # Username who last updated the record
    
    investment = relationship("Investment", back_populates="cashflows")

class Valuation(Base):
    __tablename__ = "valuations"
    
    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False)
    date = Column(Date, nullable=False)
    nav_value = Column(Float, nullable=False)
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record
    updated_by = Column(String, nullable=True)  # Username who last updated the record
    
    investment = relationship("Investment", back_populates="valuations")

class PerformanceBenchmark(Base):
    """Static benchmark data for performance comparison"""
    __tablename__ = "performance_benchmarks"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_class = Column(Enum(AssetClass), nullable=False, index=True)
    vintage_year = Column(Integer, nullable=False, index=True)
    metric_type = Column(String, nullable=False)  # 'IRR' or 'TVPI'
    
    # Quartile performance data
    q1_performance = Column(Float, nullable=False)  # Top quartile (75th percentile)
    median_performance = Column(Float, nullable=False)  # Median (50th percentile)
    q3_performance = Column(Float, nullable=False)  # Bottom quartile (25th percentile)
    
    # Data quality and attribution
    sample_size = Column(Integer)  # Number of funds in sample
    data_source = Column(String, nullable=False)  # Attribution to data source
    report_date = Column(Date, nullable=False)  # When benchmark data was published
    methodology_notes = Column(String)  # Brief methodology description
    
    # Composite index for fast lookups
    __table_args__ = (
        Index('ix_benchmark_lookup', 'asset_class', 'vintage_year', 'metric_type'),
    )

class CashFlowForecast(Base):
    """Projected cash flows generated by pacing model"""
    __tablename__ = "cash_flow_forecasts"
    
    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False, index=True)
    forecast_date = Column(Date, nullable=False)  # Date when forecast was generated
    scenario = Column(Enum(ForecastScenario), nullable=False, default=ForecastScenario.BASE)
    
    # Forecast period (years from vintage)
    forecast_year = Column(Integer, nullable=False)  # Year 0, 1, 2, etc.
    forecast_period_start = Column(Date, nullable=False)  # Start of forecast period
    forecast_period_end = Column(Date, nullable=False)  # End of forecast period
    
    # Projected cash flows
    projected_calls = Column(Float, default=0.0)  # Expected capital calls in period
    projected_distributions = Column(Float, default=0.0)  # Expected distributions in period
    projected_nav = Column(Float, default=0.0)  # Expected NAV at period end
    
    # Cumulative projections
    cumulative_calls = Column(Float, default=0.0)  # Cumulative calls to date
    cumulative_distributions = Column(Float, default=0.0)  # Cumulative distributions to date
    cumulative_net_cf = Column(Float, default=0.0)  # Cumulative net cash flow (J-curve)
    
    # Model parameters used
    model_version = Column(String, default="1.0")  # Track model version
    confidence_level = Column(Float, default=0.68)  # 68% confidence (1-sigma)
    
    investment = relationship("Investment", back_populates="forecasts")
    
    __table_args__ = (
        Index('ix_forecast_lookup', 'investment_id', 'scenario', 'forecast_year'),
    )

class ForecastAdjustment(Base):
    """Override specific forecast periods with known/confirmed cash flows"""
    __tablename__ = "forecast_adjustments"
    
    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False, index=True)
    
    # Override details
    adjustment_date = Column(Date, nullable=False)  # Specific date of known cash flow
    adjustment_type = Column(String, nullable=False)  # "capital_call", "distribution", "nav_update"
    adjustment_amount = Column(Float, nullable=False)  # Override amount
    
    # Override metadata
    reason = Column(String)  # Why this override exists ("GP confirmed call date", "Early exit notice")
    confidence = Column(String, default="confirmed")  # "confirmed", "likely", "possible"
    created_by = Column(String, nullable=True)
    created_date = Column(DateTime, default=datetime.utcnow)
    
    # Whether this override is active
    is_active = Column(Boolean, default=True, nullable=False)
    
    investment = relationship("Investment", back_populates="forecast_adjustments")
    
    __table_args__ = (
        Index('ix_adjustment_lookup', 'investment_id', 'adjustment_date', 'is_active'),
    )

class ForecastAccuracy(Base):
    """Track forecast accuracy for model improvement"""
    __tablename__ = "forecast_accuracy"
    
    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False, index=True)
    forecast_period = Column(Date, nullable=False)  # The period being tracked
    
    # Original forecast vs actual results
    forecast_calls = Column(Float, default=0.0)
    actual_calls = Column(Float, default=0.0)
    forecast_distributions = Column(Float, default=0.0)
    actual_distributions = Column(Float, default=0.0)
    forecast_nav = Column(Float, default=0.0)
    actual_nav = Column(Float, default=0.0)
    
    # Variance analysis
    calls_variance = Column(Float, default=0.0)  # (actual - forecast) / forecast
    distributions_variance = Column(Float, default=0.0)
    nav_variance = Column(Float, default=0.0)
    
    # Tracking metadata
    recorded_date = Column(DateTime, default=datetime.utcnow)
    model_version = Column(String)
    
    investment = relationship("Investment")
    
    __table_args__ = (
        Index('ix_accuracy_lookup', 'investment_id', 'forecast_period'),
    )

class TaxDocument(Base):
    """K-1 and other tax documents for investments"""
    __tablename__ = "tax_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False, index=True)
    tax_year = Column(Integer, nullable=False, index=True)
    document_type = Column(String, nullable=False)  # "K-1", "1099", "Tax Statement", etc.
    
    # Document status and dates
    status = Column(Enum(TaxDocumentStatus), nullable=False, default=TaxDocumentStatus.PENDING)
    date_expected = Column(Date, nullable=True)  # When document is expected
    date_received = Column(Date, nullable=True)  # When document was received
    date_processed = Column(Date, nullable=True)  # When document was processed
    
    # Core K-1 tax information
    ordinary_income = Column(Float, default=0.0)  # Box 1 - Ordinary business income
    guaranteed_payments = Column(Float, default=0.0)  # Box 4 - Guaranteed payments
    interest_income = Column(Float, default=0.0)  # Box 5 - Interest income
    dividend_income = Column(Float, default=0.0)  # Box 6a - Ordinary dividends
    net_short_term_capital_gain = Column(Float, default=0.0)  # Box 8 - Net short-term capital gain
    net_long_term_capital_gain = Column(Float, default=0.0)  # Box 9a - Net long-term capital gain
    
    # Section 199A information (QBI deduction)
    section_199a_income = Column(Float, default=0.0)  # Qualified business income
    
    # Foreign tax information
    foreign_tax_paid = Column(Float, default=0.0)  # Foreign taxes paid
    
    # File and notes
    file_path = Column(String, nullable=True)  # Path to stored document file
    notes = Column(Text, nullable=True)  # Additional notes about the document
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    investment = relationship("Investment", back_populates="tax_documents")
    
    __table_args__ = (
        Index('ix_tax_document_lookup', 'investment_id', 'tax_year', 'document_type'),
    )

class Document(Base):
    """Document management system for family office documents"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic document information
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(Enum(DocumentCategory), nullable=False, index=True)
    status = Column(Enum(DocumentStatus), nullable=False, default=DocumentStatus.PENDING_REVIEW)
    
    # File information
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # Path to stored file
    file_size = Column(Integer, nullable=False)  # Size in bytes
    mime_type = Column(String, nullable=False)  # MIME type
    file_hash = Column(String, nullable=False, index=True)  # SHA-256 hash for deduplication
    
    # Document dates
    document_date = Column(Date, nullable=True)  # Date on the document itself
    due_date = Column(Date, nullable=True)  # Due date for action (if applicable)
    
    # Relationships
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=True, index=True)
    
    # Search and indexing
    searchable_content = Column(Text, nullable=True)  # Extracted text content for search
    
    # Metadata
    is_confidential = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    
    # Audit trail
    uploaded_by = Column(String, nullable=True)  # User who uploaded the document
    created_date = Column(DateTime, default=datetime.utcnow, index=True)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    investment = relationship("Investment", backref="documents")
    entity = relationship("Entity", backref="documents")
    tags = relationship("DocumentTag", back_populates="document", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_document_category_date', 'category', 'document_date'),
        Index('ix_document_investment_category', 'investment_id', 'category'),
        Index('ix_document_entity_category', 'entity_id', 'category'),
        Index('ix_document_search', 'title', 'searchable_content'),
    )

class DocumentTag(Base):
    """Tags for categorizing and organizing documents"""
    __tablename__ = "document_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    tag_name = Column(String, nullable=False, index=True)
    
    # Color coding for visual organization
    color = Column(String, nullable=True, default="#007bff")  # Hex color code
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="tags")
    
    __table_args__ = (
        Index('ix_document_tag_lookup', 'document_id', 'tag_name'),
    )

class EntityRelationship(Base):
    """Advanced entity relationships for family office structures"""
    __tablename__ = "entity_relationships"
    
    id = Column(Integer, primary_key=True, index=True)
    from_entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    to_entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    
    # Relationship details
    relationship_type = Column(Enum(AdvancedRelationshipType), nullable=False)
    relationship_subtype = Column(String, nullable=True)
    
    # Ownership and control
    percentage_ownership = Column(Float, default=0.0)
    is_voting_interest = Column(Boolean, default=True)
    
    # Temporal aspects
    effective_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    
    # Status and metadata
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record
    updated_by = Column(String, nullable=True)  # Username who last updated the record
    
    # Relationships
    from_entity = relationship("Entity", foreign_keys=[from_entity_id], back_populates="entity_relationships_from")
    to_entity = relationship("Entity", foreign_keys=[to_entity_id], back_populates="entity_relationships_to")
    
    __table_args__ = (
        Index('ix_entity_rel_from_entity', 'from_entity_id'),
        Index('ix_entity_rel_to_entity', 'to_entity_id'),
        Index('ix_entity_rel_type', 'relationship_type'),
        Index('ix_entity_rel_active', 'is_active', 'effective_date'),
    )

class InvestmentOwnership(Base):
    """Multi-entity investment ownership tracking"""
    __tablename__ = "investment_ownership"
    
    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    
    # Ownership details
    ownership_percentage = Column(Float, nullable=False)
    ownership_type = Column(Enum(OwnershipType), default=OwnershipType.DIRECT)
    is_beneficial_owner = Column(Boolean, default=True)
    
    # Temporal aspects
    effective_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    
    # Metadata
    notes = Column(Text, nullable=True)
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record
    updated_by = Column(String, nullable=True)  # Username who last updated the record
    
    # Relationships
    investment = relationship("Investment", back_populates="ownership_records")
    entity = relationship("Entity", back_populates="investment_ownerships")
    
    __table_args__ = (
        Index('ix_inv_ownership_investment', 'investment_id'),
        Index('ix_inv_ownership_entity', 'entity_id'),
        Index('ix_inv_ownership_effective', 'effective_date', 'end_date'),
    )

class EntityHierarchy(Base):
    """Entity hierarchy for family tree and org chart visualization"""
    __tablename__ = "entity_hierarchy"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    parent_entity_id = Column(Integer, ForeignKey("entities.id"), nullable=True)
    
    # Hierarchy structure
    hierarchy_level = Column(Integer, default=1)
    hierarchy_path = Column(String, nullable=True)  # Dot-separated path like "1.3.7"
    sort_order = Column(Integer, default=0)
    is_primary_parent = Column(Boolean, default=True)
    
    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    entity = relationship("Entity", foreign_keys=[entity_id], back_populates="hierarchy_entries")
    parent_entity = relationship("Entity", foreign_keys=[parent_entity_id])
    
    __table_args__ = (
        Index('ix_entity_hierarchy_entity', 'entity_id'),
        Index('ix_entity_hierarchy_parent', 'parent_entity_id'),
        Index('ix_entity_hierarchy_level', 'hierarchy_level'),
    )