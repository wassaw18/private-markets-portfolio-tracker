from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Enum, Boolean, Text, DateTime, Index, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum
import uuid
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

class RelationshipCategory(str, enum.Enum):
    """Categories for organizing relationship types"""
    FAMILY = "Family"
    BUSINESS = "Business"
    TRUST = "Trust"
    PROFESSIONAL = "Professional"
    OTHER = "Other"

class FamilyRelationshipType(str, enum.Enum):
    """Family relationship types"""
    SELF = "Self"
    SPOUSE = "Spouse"
    DOMESTIC_PARTNER = "Domestic Partner"
    CHILD = "Child"
    STEPCHILD = "Stepchild"
    ADOPTED_CHILD = "Adopted Child"
    PARENT = "Parent"
    STEPPARENT = "Stepparent"
    ADOPTIVE_PARENT = "Adoptive Parent"
    SIBLING = "Sibling"
    HALF_SIBLING = "Half Sibling"
    STEP_SIBLING = "Step Sibling"
    GRANDPARENT = "Grandparent"
    GRANDCHILD = "Grandchild"
    AUNT_UNCLE = "Aunt/Uncle"
    NIECE_NEPHEW = "Niece/Nephew"
    COUSIN = "Cousin"
    IN_LAW = "In-Law"
    GUARDIAN = "Guardian"
    WARD = "Ward"
    OTHER_RELATIVE = "Other Relative"

class BusinessRelationshipType(str, enum.Enum):
    """Business relationship types"""
    OWNER = "Owner"
    CO_OWNER = "Co-Owner"
    SHAREHOLDER = "Shareholder"
    MAJORITY_SHAREHOLDER = "Majority Shareholder"
    MINORITY_SHAREHOLDER = "Minority Shareholder"
    FOUNDER = "Founder"
    CO_FOUNDER = "Co-Founder"
    PARTNER = "Partner"
    GENERAL_PARTNER = "General Partner"
    LIMITED_PARTNER = "Limited Partner"
    MANAGING_PARTNER = "Managing Partner"
    MEMBER = "Member"
    MANAGING_MEMBER = "Managing Member"
    NON_MANAGING_MEMBER = "Non-Managing Member"
    MANAGER = "Manager"
    BOARD_MEMBER = "Board Member"
    BOARD_CHAIR = "Board Chair"
    INDEPENDENT_DIRECTOR = "Independent Director"
    OFFICER = "Officer"
    CEO = "CEO"
    PRESIDENT = "President"
    CFO = "CFO"
    COO = "COO"
    SECRETARY = "Secretary"
    TREASURER = "Treasurer"
    VICE_PRESIDENT = "Vice President"
    EMPLOYEE = "Employee"
    CONSULTANT = "Consultant"
    CONTRACTOR = "Contractor"
    VENDOR = "Vendor"
    CUSTOMER = "Customer"
    INVESTOR = "Investor"
    CREDITOR = "Creditor"

class TrustRelationshipType(str, enum.Enum):
    """Trust relationship types"""
    GRANTOR = "Grantor"
    SETTLOR = "Settlor"
    TRUSTOR = "Trustor"
    TRUSTEE = "Trustee"
    CO_TRUSTEE = "Co-Trustee"
    SUCCESSOR_TRUSTEE = "Successor Trustee"
    CONTINGENT_TRUSTEE = "Contingent Trustee"
    CORPORATE_TRUSTEE = "Corporate Trustee"
    INDIVIDUAL_TRUSTEE = "Individual Trustee"
    BENEFICIARY = "Beneficiary"
    PRIMARY_BENEFICIARY = "Primary Beneficiary"
    CONTINGENT_BENEFICIARY = "Contingent Beneficiary"
    INCOME_BENEFICIARY = "Income Beneficiary"
    REMAINDER_BENEFICIARY = "Remainder Beneficiary"
    REMAINDERMAN = "Remainderman"
    CURRENT_BENEFICIARY = "Current Beneficiary"
    FUTURE_BENEFICIARY = "Future Beneficiary"
    DISCRETIONARY_BENEFICIARY = "Discretionary Beneficiary"
    MANDATORY_BENEFICIARY = "Mandatory Beneficiary"
    TRUST_PROTECTOR = "Trust Protector"
    TRUST_ADVISOR = "Trust Advisor"
    DISTRIBUTION_COMMITTEE = "Distribution Committee"
    INVESTMENT_COMMITTEE = "Investment Committee"

class ProfessionalRelationshipType(str, enum.Enum):
    """Professional service relationship types"""
    ATTORNEY = "Attorney"
    CPA = "CPA"
    ACCOUNTANT = "Accountant"
    FINANCIAL_ADVISOR = "Financial Advisor"
    INVESTMENT_ADVISOR = "Investment Advisor"
    WEALTH_MANAGER = "Wealth Manager"
    BANK_RELATIONSHIP_MANAGER = "Bank Relationship Manager"
    INSURANCE_AGENT = "Insurance Agent"
    REAL_ESTATE_AGENT = "Real Estate Agent"
    APPRAISER = "Appraiser"
    CONSULTANT = "Consultant"
    ADVISOR = "Advisor"
    POWER_OF_ATTORNEY = "Power of Attorney"
    HEALTHCARE_PROXY = "Healthcare Proxy"
    EXECUTOR = "Executor"
    ADMINISTRATOR = "Administrator"
    CUSTODIAN = "Custodian"

class OtherRelationshipType(str, enum.Enum):
    """Other relationship types that don't fit standard categories"""
    FRIEND = "Friend"
    BUSINESS_ASSOCIATE = "Business Associate"
    NEIGHBOR = "Neighbor"
    CAREGIVER = "Caregiver"
    NOMINEE = "Nominee"
    AGENT = "Agent"
    PROXY = "Proxy"
    REPRESENTATIVE = "Representative"
    CONTACT = "Contact"
    EMERGENCY_CONTACT = "Emergency Contact"
    OTHER = "Other"
    UNKNOWN = "Unknown"

# Legacy relationship type for FamilyMember (backward compatibility)
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

# Legacy advanced relationship type (backward compatibility)
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
    TRUSTEE = "Trustee"
    BENEFICIARY = "Beneficiary"
    MANAGER = "Manager"
    MEMBER = "Member"
    PARTNER = "Partner"
    LEGACY_OTHER = "Other"

class OwnershipType(str, enum.Enum):
    DIRECT = "Direct"
    INDIRECT = "Indirect"
    BENEFICIAL = "Beneficial"
    FIDUCIARY = "Fiduciary"
    NOMINEE = "Nominee"

class UserRole(str, enum.Enum):
    ADMIN = "Admin"              # Full access to tenant management and user administration
    MANAGER = "Manager"          # Full access to investment data and reporting
    CONTRIBUTOR = "Contributor"  # Can add/edit investments and data
    VIEWER = "Viewer"            # Read-only access to reports and data
    LP_CLIENT = "LP_CLIENT"      # Limited Partner client (fund manager B2B2C only)

class TenantStatus(str, enum.Enum):
    ACTIVE = "Active"
    SUSPENDED = "Suspended"
    TRIAL = "Trial"
    PENDING = "Pending"

class AccountType(str, enum.Enum):
    INDIVIDUAL = "INDIVIDUAL"
    FAMILY_OFFICE = "FAMILY_OFFICE"
    FUND_MANAGER = "FUND_MANAGER"

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

class Tenant(Base):
    """
    Represents an organization/family office using the platform.
    Provides data isolation between different client organizations.
    """
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)  # Organization name
    subdomain = Column(String, unique=True, nullable=True, index=True)  # For custom domains
    status = Column(Enum(TenantStatus), default=TenantStatus.ACTIVE, nullable=False)
    account_type = Column(Enum(AccountType), nullable=False, default=AccountType.INDIVIDUAL, index=True)
    settings = Column(Text, nullable=True)  # JSON settings for tenant configuration
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="tenant", cascade="all, delete-orphan")
    investments = relationship("Investment", back_populates="tenant", cascade="all, delete-orphan")

class User(Base):
    """
    Represents users who can access the platform.
    Each user belongs to a tenant and has specific roles and permissions.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Foreign keys
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")

    # Unique constraint: username must be unique within a tenant
    __table_args__ = (UniqueConstraint('username', 'tenant_id', name='unique_username_per_tenant'),)

class Invitation(Base):
    """
    Represents user invitations to join a tenant.
    Stores invitation tokens and tracks invitation status.
    """
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    role = Column(Enum(UserRole), nullable=False)
    invitation_token = Column(String, unique=True, nullable=False, index=True)
    is_accepted = Column(Boolean, default=False, nullable=False)
    is_expired = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Foreign keys
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    invited_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    accepted_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])
    accepted_by = relationship("User", foreign_keys=[accepted_user_id])

    __table_args__ = (
        Index('ix_invitation_tenant', 'tenant_id'),
        Index('ix_invitation_email_tenant', 'email', 'tenant_id'),
    )

class Entity(Base):
    """
    Represents legal entities that can own investments (Individuals, Trusts, LLCs, etc.)
    """
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False, index=True)
    entity_type = Column(Enum(EntityType), nullable=False)

    # Multi-tenancy
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Legal and tax information
    tax_id = Column(String, nullable=True)  # SSN/EIN/TIN (removed unique constraint for multi-tenancy)
    legal_address = Column(Text, nullable=True)
    formation_date = Column(Date, nullable=True)  # For legal entities

    # Entity status and metadata
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record (kept for backward compatibility)
    updated_by = Column(String, nullable=True)  # Username who last updated the record (kept for backward compatibility)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="entities")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id])
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
        Index('ix_entity_tenant', 'tenant_id'),
        UniqueConstraint('name', 'tenant_id', name='unique_entity_name_per_tenant'),
        UniqueConstraint('tax_id', 'tenant_id', name='unique_tax_id_per_tenant'),
    )

class FamilyMember(Base):
    """
    Represents individual family members and their relationships to entities
    """
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)

    # Multi-tenancy
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

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
    created_by = Column(String, nullable=True)  # Username who created the record (kept for backward compatibility)
    updated_by = Column(String, nullable=True)  # Username who last updated the record (kept for backward compatibility)

    # Relationships
    tenant = relationship("Tenant")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id])
    entity = relationship("Entity", back_populates="family_members")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    __table_args__ = (
        Index('ix_family_member_tenant', 'tenant_id'),
        Index('ix_family_member_name', 'last_name', 'first_name'),
        Index('ix_family_member_entity', 'entity_id', 'relationship_type'),
        Index('ix_family_member_entity_tenant', 'entity_id', 'tenant_id'),
    )

class Investment(Base):
    __tablename__ = "investments"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False, index=True)
    asset_class = Column(Enum(AssetClass), nullable=False)
    investment_structure = Column(Enum(InvestmentStructure), nullable=False)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False, index=True)

    # Multi-tenancy
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

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

    # Archive Management (Soft Delete)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    archived_date = Column(DateTime, nullable=True)
    archived_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record
    updated_by = Column(String, nullable=True)  # Username who last updated the record
    
    # Relationships
    tenant = relationship("Tenant", back_populates="investments")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id])
    entity = relationship("Entity", back_populates="investments")
    ownership_records = relationship("InvestmentOwnership", back_populates="investment", cascade="all, delete-orphan")
    cashflows = relationship("CashFlow", back_populates="investment", cascade="all, delete-orphan")
    valuations = relationship("Valuation", back_populates="investment", cascade="all, delete-orphan")
    forecasts = relationship("CashFlowForecast", back_populates="investment", cascade="all, delete-orphan")
    forecast_adjustments = relationship("ForecastAdjustment", back_populates="investment", cascade="all, delete-orphan")
    tax_documents = relationship("TaxDocument", back_populates="investment", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_investment_tenant', 'tenant_id'),
        Index('ix_investment_entity_tenant', 'entity_id', 'tenant_id'),
        UniqueConstraint('name', 'tenant_id', name='unique_investment_name_per_tenant'),
    )

class CashFlow(Base):
    __tablename__ = "cashflows"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False)

    # Multi-tenancy
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

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
    created_by = Column(String, nullable=True)  # Username who created the record (kept for backward compatibility)
    updated_by = Column(String, nullable=True)  # Username who last updated the record (kept for backward compatibility)

    # Relationships
    tenant = relationship("Tenant")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id])
    investment = relationship("Investment", back_populates="cashflows")

    __table_args__ = (
        Index('ix_cashflow_tenant', 'tenant_id'),
        Index('ix_cashflow_investment_tenant', 'investment_id', 'tenant_id'),
        Index('ix_cashflow_date_tenant', 'date', 'tenant_id'),
    )

class Valuation(Base):
    __tablename__ = "valuations"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False)

    # Multi-tenancy
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    date = Column(Date, nullable=False)
    nav_value = Column(Float, nullable=False)

    # Audit trail
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)  # Username who created the record (kept for backward compatibility)
    updated_by = Column(String, nullable=True)  # Username who last updated the record (kept for backward compatibility)

    # Relationships
    tenant = relationship("Tenant")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id])
    investment = relationship("Investment", back_populates="valuations")

    __table_args__ = (
        Index('ix_valuation_tenant', 'tenant_id'),
        Index('ix_valuation_investment_tenant', 'investment_id', 'tenant_id'),
        Index('ix_valuation_date_tenant', 'date', 'tenant_id'),
    )

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

class MarketBenchmark(Base):
    """Market benchmarks for monthly return comparison (S&P 500, bonds, etc.)"""
    __tablename__ = "market_benchmarks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # "S&P 500 Total Return"
    ticker = Column(String(50), nullable=False, unique=True)  # "SPY-TR"
    category = Column(String(100), nullable=False)  # "Equity", "Fixed Income", "Real Estate"
    description = Column(Text)  # Detailed description
    data_source = Column(String(100), nullable=False)  # "Manual", "Bloomberg", etc.
    is_active = Column(Boolean, default=True)
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to returns
    returns = relationship("BenchmarkReturn", back_populates="benchmark", cascade="all, delete-orphan")

class BenchmarkReturn(Base):
    """Monthly benchmark returns data"""
    __tablename__ = "benchmark_returns"
    
    id = Column(Integer, primary_key=True, index=True)
    benchmark_id = Column(Integer, ForeignKey("market_benchmarks.id"), nullable=False, index=True)
    period_date = Column(Date, nullable=False, index=True)  # First day of month (2024-07-01)
    
    # Return data (stored as decimals: 0.0224 = 2.24%)
    total_return = Column(Float)  # Monthly total return including dividends
    price_return = Column(Float)  # Monthly price return excluding dividends
    dividend_yield = Column(Float)  # Annualized dividend yield
    
    # Additional metrics
    volatility = Column(Float)  # Monthly volatility if available
    notes = Column(String(500))  # Any special notes about this period
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    benchmark = relationship("MarketBenchmark", back_populates="returns")
    
    # Unique constraint on benchmark + period
    __table_args__ = (
        Index('ix_benchmark_period', 'benchmark_id', 'period_date'),
    )

class QuarterlyBenchmark(Base):
    """PitchBook quarterly and time horizon benchmark data"""
    __tablename__ = "quarterly_benchmarks"

    id = Column(Integer, primary_key=True, index=True)

    # Source information
    report_period = Column(String(50), nullable=False, index=True)  # "Q1-2025"
    asset_class = Column(String(100), nullable=False, index=True)   # "private_equity", "private_capital"

    # Time period information
    quarter_year = Column(String(50), nullable=False, index=True)   # "Q1-2025" for quarterly data
    quarter_date = Column(Date, nullable=False, index=True)         # First day of quarter: 2025-01-01

    # Performance data (stored as decimals: 0.0750 = 7.50%)
    top_quartile_return = Column(Float, nullable=True)     # Top quartile performance
    median_return = Column(Float, nullable=True)           # Median performance
    bottom_quartile_return = Column(Float, nullable=True)  # Bottom quartile performance

    # Metadata
    sample_size = Column(Integer, nullable=True)           # Number of funds in sample
    data_source = Column(String(200), default="PitchBook PDF Import")
    methodology_notes = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint to prevent duplicates
    __table_args__ = (
        Index('ix_quarterly_unique', 'report_period', 'asset_class', 'quarter_year', 'quarter_date'),
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
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4, index=True)

    # Multi-tenancy
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

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
    uploaded_by = Column(String, nullable=True)  # User who uploaded the document (kept for backward compatibility)
    created_date = Column(DateTime, default=datetime.utcnow, index=True)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant")
    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by_user_id])
    investment = relationship("Investment", backref="documents")
    entity = relationship("Entity", backref="documents")
    tags = relationship("DocumentTag", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_document_tenant', 'tenant_id'),
        Index('ix_document_category_date', 'category', 'document_date'),
        Index('ix_document_investment_category', 'investment_id', 'category'),
        Index('ix_document_entity_category', 'entity_id', 'category'),
        Index('ix_document_search', 'title', 'searchable_content'),
        Index('ix_document_tenant_category', 'tenant_id', 'category'),
        UniqueConstraint('file_hash', 'tenant_id', name='unique_file_hash_per_tenant'),
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
    uuid = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4, index=True)
    from_entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    to_entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    
    # Relationship details - categorized system
    relationship_category = Column(String, nullable=False)  # Stores category as string (Family, Business, Trust, etc.)
    relationship_type = Column(String, nullable=False)  # Stores the specific relationship type as string
    relationship_subtype = Column(String, nullable=True)  # Additional details if needed
    
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

# =====================================================
# PITCHBOOK BENCHMARK MODELS
# =====================================================

class PitchBookPerformanceByVintage(Base):
    """PitchBook performance by vintage data (IRRs by vintage - page 12 format)"""
    __tablename__ = "pitchbook_performance_by_vintage"

    id = Column(Integer, primary_key=True, index=True)

    # Asset class and vintage identification
    asset_class = Column(String, nullable=False)  # private_equity, venture_capital, etc.
    vintage_year = Column(Integer, nullable=False)

    # IRR metrics
    pooled_irr = Column(Numeric(10, 4), nullable=True)
    equal_weighted_pooled_irr = Column(Numeric(10, 4), nullable=True)

    # Quantile performance
    top_decile = Column(Numeric(10, 4), nullable=True)
    top_quartile = Column(Numeric(10, 4), nullable=True)
    median_irr = Column(Numeric(10, 4), nullable=True)
    bottom_quartile = Column(Numeric(10, 4), nullable=True)
    bottom_decile = Column(Numeric(10, 4), nullable=True)

    # Statistical metrics
    standard_deviation = Column(Numeric(10, 4), nullable=True)
    number_of_funds = Column(Integer, nullable=True)

    # Import metadata
    import_date = Column(DateTime, default=datetime.utcnow)
    quarter_end_date = Column(Date, nullable=True)  # Q1 2025 = 2025-03-31

    __table_args__ = (
        Index('ix_perf_vintage_asset_vintage', 'asset_class', 'vintage_year'),
        Index('ix_perf_vintage_quarter', 'quarter_end_date'),
        UniqueConstraint('asset_class', 'vintage_year', 'quarter_end_date', name='uq_perf_vintage'),
    )

class PitchBookMultiplesByVintage(Base):
    """PitchBook multiples by vintage data (TVPI/DPI by vintage - page 15 format)"""
    __tablename__ = "pitchbook_multiples_by_vintage"

    id = Column(Integer, primary_key=True, index=True)

    # Asset class and vintage identification
    asset_class = Column(String, nullable=False)
    vintage_year = Column(Integer, nullable=False)

    # Pooled multiples
    pooled_tvpi = Column(Numeric(10, 4), nullable=True)
    pooled_dpi = Column(Numeric(10, 4), nullable=True)
    pooled_rvpi = Column(Numeric(10, 4), nullable=True)

    # Equal-weighted pooled multiples
    equal_weighted_tvpi = Column(Numeric(10, 4), nullable=True)
    equal_weighted_dpi = Column(Numeric(10, 4), nullable=True)
    equal_weighted_rvpi = Column(Numeric(10, 4), nullable=True)

    # Fund count
    number_of_funds = Column(Integer, nullable=True)

    # Import metadata
    import_date = Column(DateTime, default=datetime.utcnow)
    quarter_end_date = Column(Date, nullable=True)

    __table_args__ = (
        Index('ix_mult_vintage_asset_vintage', 'asset_class', 'vintage_year'),
        Index('ix_mult_vintage_quarter', 'quarter_end_date'),
        UniqueConstraint('asset_class', 'vintage_year', 'quarter_end_date', name='uq_mult_vintage'),
    )

class PitchBookMultiplesQuantiles(Base):
    """PitchBook multiples quantiles data (decile/quartile multiples - page 16 format)"""
    __tablename__ = "pitchbook_multiples_quantiles"

    id = Column(Integer, primary_key=True, index=True)

    # Asset class and vintage identification
    asset_class = Column(String, nullable=False)
    vintage_year = Column(Integer, nullable=False)

    # TVPI quantiles
    tvpi_top_decile = Column(Numeric(10, 4), nullable=True)
    tvpi_top_quartile = Column(Numeric(10, 4), nullable=True)
    tvpi_median = Column(Numeric(10, 4), nullable=True)
    tvpi_bottom_quartile = Column(Numeric(10, 4), nullable=True)
    tvpi_bottom_decile = Column(Numeric(10, 4), nullable=True)

    # DPI quantiles
    dpi_top_decile = Column(Numeric(10, 4), nullable=True)
    dpi_top_quartile = Column(Numeric(10, 4), nullable=True)
    dpi_median = Column(Numeric(10, 4), nullable=True)
    dpi_bottom_quartile = Column(Numeric(10, 4), nullable=True)
    dpi_bottom_decile = Column(Numeric(10, 4), nullable=True)

    # Fund count
    number_of_funds = Column(Integer, nullable=True)

    # Import metadata
    import_date = Column(DateTime, default=datetime.utcnow)
    quarter_end_date = Column(Date, nullable=True)

    __table_args__ = (
        Index('ix_mult_quant_asset_vintage', 'asset_class', 'vintage_year'),
        Index('ix_mult_quant_quarter', 'quarter_end_date'),
        UniqueConstraint('asset_class', 'vintage_year', 'quarter_end_date', name='uq_mult_quant'),
    )

class PitchBookQuarterlyReturns(Base):
    """PitchBook quarterly returns data (quarterly performance - page 17 format)"""
    __tablename__ = "pitchbook_quarterly_returns"

    id = Column(Integer, primary_key=True, index=True)

    # Asset class and time period identification
    asset_class = Column(String, nullable=False)
    time_period = Column(String, nullable=False)  # "Q1 2025", "1-year", "3-year", etc.

    # Return value
    return_value = Column(Numeric(10, 4), nullable=False)

    # Import metadata
    import_date = Column(DateTime, default=datetime.utcnow)
    quarter_end_date = Column(Date, nullable=True)

    __table_args__ = (
        Index('ix_qtrly_returns_asset_period', 'asset_class', 'time_period'),
        Index('ix_qtrly_returns_quarter', 'quarter_end_date'),
        UniqueConstraint('asset_class', 'time_period', 'quarter_end_date', name='uq_qtrly_returns'),
    )