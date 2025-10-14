"""
Tenant-aware CRUD operations for multi-tenant support

This module provides CRUD operations that automatically filter by tenant_id
and include proper user audit trails.
"""

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc, func
from typing import List, Optional, Tuple, Union
from datetime import datetime
from uuid import UUID

from . import models
from . import schemas  # Import the main schemas module
from .schemas_auth.auth import TenantCreate, UserCreate, UserUpdate  # Import auth-specific schemas
from .auth import get_password_hash
from .performance import (
    calculate_investment_performance,
    calculate_true_portfolio_performance,
    CashFlowEvent
)
from .models import (
    User, Tenant, Entity, Investment, CashFlow, Valuation,
    Document, FamilyMember, UserRole, TenantStatus, CashFlowType
)

# =============================================================================
# Helper Functions for UUID/ID Lookups
# =============================================================================

def parse_id_or_uuid(id_value: str) -> Union[int, UUID]:
    """
    Parse a string that could be either an integer ID or a UUID.
    Returns the appropriate type for database lookup.
    """
    try:
        # Try parsing as UUID first
        return UUID(id_value)
    except (ValueError, AttributeError):
        # If that fails, try parsing as integer
        try:
            return int(id_value)
        except ValueError:
            raise ValueError(f"Invalid ID format: {id_value}. Must be integer or UUID.")

# =============================================================================
# Tenant CRUD Operations
# =============================================================================

def get_tenant(db: Session, tenant_id: int) -> Optional[Tenant]:
    """Get a tenant by ID"""
    return db.query(Tenant).filter(Tenant.id == tenant_id).first()

def get_tenant_by_name(db: Session, name: str) -> Optional[Tenant]:
    """Get a tenant by name"""
    return db.query(Tenant).filter(Tenant.name == name).first()

def create_tenant(db: Session, tenant: TenantCreate) -> Tenant:
    """Create a new tenant with admin user"""
    # Create tenant
    tenant_data = {
        "name": tenant.name,
        "subdomain": tenant.subdomain,
        "settings": tenant.settings,
        "status": TenantStatus.ACTIVE,
        "created_at": datetime.utcnow()
    }

    db_tenant = Tenant(**tenant_data)
    db.add(db_tenant)
    db.flush()  # Get the tenant ID

    # Create admin user for the tenant
    hashed_password = get_password_hash(tenant.admin_password)
    admin_user = User(
        username=tenant.admin_username,
        email=tenant.admin_email,
        hashed_password=hashed_password,
        first_name=tenant.admin_first_name,
        last_name=tenant.admin_last_name,
        role=UserRole.ADMIN,
        is_active=True,
        tenant_id=db_tenant.id,
        created_at=datetime.utcnow()
    )

    db.add(admin_user)
    db.commit()
    db.refresh(db_tenant)

    return db_tenant

def update_tenant(db: Session, tenant_id: int, tenant_update) -> Optional[Tenant]:
    """Update a tenant"""
    db_tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not db_tenant:
        return None

    update_data = tenant_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    for field, value in update_data.items():
        setattr(db_tenant, field, value)

    db.commit()
    db.refresh(db_tenant)
    return db_tenant

# =============================================================================
# User CRUD Operations
# =============================================================================

def get_user(db: Session, user_id: int, tenant_id: int) -> Optional[User]:
    """Get a user by ID within a tenant"""
    return db.query(User).filter(
        User.id == user_id,
        User.tenant_id == tenant_id
    ).first()

def get_user_by_email(db: Session, email: str, tenant_id: int) -> Optional[User]:
    """Get a user by email within a tenant"""
    return db.query(User).filter(
        User.email == email,
        User.tenant_id == tenant_id
    ).first()

def get_user_by_username(db: Session, username: str, tenant_id: int) -> Optional[User]:
    """Get a user by username within a tenant"""
    return db.query(User).filter(
        User.username == username,
        User.tenant_id == tenant_id
    ).first()

def get_users(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True
) -> List[User]:
    """Get users within a tenant"""
    query = db.query(User).filter(User.tenant_id == tenant_id)

    if active_only:
        query = query.filter(User.is_active == True)

    return query.offset(skip).limit(limit).all()

def create_user(
    db: Session,
    user: UserCreate,
    tenant_id: int,
    created_by_user_id: int
) -> User:
    """Create a new user within a tenant"""
    hashed_password = get_password_hash(user.password)

    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        is_active=user.is_active,
        tenant_id=tenant_id,
        created_at=datetime.utcnow()
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(
    db: Session,
    user_id: int,
    tenant_id: int,
    user_update: UserUpdate,
    updated_by_user_id: int
) -> Optional[User]:
    """Update a user within a tenant"""
    db_user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == tenant_id
    ).first()

    if not db_user:
        return None

    update_data = user_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)
    return db_user

# =============================================================================
# Entity CRUD Operations (Tenant-Aware)
# =============================================================================

def get_entity(db: Session, entity_id: Union[int, str, UUID], tenant_id: int) -> Optional[Entity]:
    """Get a single entity by ID or UUID within a tenant"""
    query = db.query(Entity).options(
        joinedload(Entity.family_members)
    )

    # Handle UUID or int lookup
    if isinstance(entity_id, str):
        parsed_id = parse_id_or_uuid(entity_id)
        if isinstance(parsed_id, UUID):
            query = query.filter(Entity.uuid == parsed_id)
        else:
            query = query.filter(Entity.id == parsed_id)
    elif isinstance(entity_id, UUID):
        query = query.filter(Entity.uuid == entity_id)
    else:
        query = query.filter(Entity.id == entity_id)

    return query.filter(Entity.tenant_id == tenant_id).first()

def get_entities(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False
) -> List[Entity]:
    """Get entities within a tenant"""
    query = db.query(Entity).options(
        joinedload(Entity.family_members)
    ).filter(Entity.tenant_id == tenant_id)

    if not include_inactive:
        query = query.filter(Entity.is_active == True)

    return query.offset(skip).limit(limit).all()

def get_entities_by_type(
    db: Session,
    tenant_id: int,
    entity_type: str,
    skip: int = 0,
    limit: int = 100
) -> List[Entity]:
    """Get entities filtered by type within a tenant"""
    return db.query(Entity).filter(
        Entity.tenant_id == tenant_id,
        Entity.entity_type == entity_type,
        Entity.is_active == True
    ).offset(skip).limit(limit).all()

def search_entities(
    db: Session,
    tenant_id: int,
    search_term: str,
    skip: int = 0,
    limit: int = 100
) -> List[Entity]:
    """Search entities by name within a tenant"""
    return db.query(Entity).filter(
        Entity.tenant_id == tenant_id,
        Entity.name.ilike(f"%{search_term}%"),
        Entity.is_active == True
    ).offset(skip).limit(limit).all()

def create_entity(
    db: Session,
    entity: schemas.EntityCreate,
    tenant_id: int,
    created_by_user_id: int
) -> Entity:
    """Create a new entity within a tenant"""
    entity_data = entity.model_dump()
    entity_data.update({
        "tenant_id": tenant_id,
        "created_by_user_id": created_by_user_id,
        "updated_by_user_id": created_by_user_id,
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow()
    })

    db_entity = Entity(**entity_data)
    db.add(db_entity)
    db.commit()
    db.refresh(db_entity)
    return db_entity

def update_entity(
    db: Session,
    entity_id: int,
    tenant_id: int,
    entity_update: schemas.EntityUpdate,
    updated_by_user_id: int
) -> Optional[Entity]:
    """Update an entity within a tenant"""
    db_entity = db.query(Entity).filter(
        Entity.id == entity_id,
        Entity.tenant_id == tenant_id
    ).first()

    if not db_entity:
        return None

    update_data = entity_update.model_dump(exclude_unset=True)
    update_data.update({
        "updated_by_user_id": updated_by_user_id,
        "updated_date": datetime.utcnow()
    })

    for field, value in update_data.items():
        setattr(db_entity, field, value)

    db.commit()
    db.refresh(db_entity)
    return db_entity

# =============================================================================
# Investment CRUD Operations (Tenant-Aware)
# =============================================================================

def get_investment(db: Session, investment_id: Union[int, str, UUID], tenant_id: int, include_archived: bool = False) -> Optional[Investment]:
    """Get a single investment by ID or UUID within a tenant"""
    query = db.query(Investment).options(
        joinedload(Investment.entity),
        joinedload(Investment.cashflows),
        joinedload(Investment.valuations)
    )

    # Handle UUID or int lookup
    if isinstance(investment_id, str):
        parsed_id = parse_id_or_uuid(investment_id)
        if isinstance(parsed_id, UUID):
            query = query.filter(Investment.uuid == parsed_id)
        else:
            query = query.filter(Investment.id == parsed_id)
    elif isinstance(investment_id, UUID):
        query = query.filter(Investment.uuid == investment_id)
    else:
        query = query.filter(Investment.id == investment_id)

    # Exclude archived by default
    if not include_archived:
        query = query.filter(Investment.is_archived == False)

    return query.filter(Investment.tenant_id == tenant_id).first()

def get_investments(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 1000,
    include_archived: bool = False
) -> List[Investment]:
    """Get investments within a tenant (excludes archived by default)"""
    query = db.query(Investment).options(
        joinedload(Investment.entity),
        joinedload(Investment.cashflows),
        joinedload(Investment.valuations)
    ).filter(
        Investment.tenant_id == tenant_id
    )

    # Exclude archived by default
    if not include_archived:
        query = query.filter(Investment.is_archived == False)

    return query.offset(skip).limit(limit).all()

def get_investments_by_entity(
    db: Session,
    entity_id: int,
    tenant_id: int,
    include_archived: bool = False
) -> List[Investment]:
    """Get investments for a specific entity within a tenant (excludes archived by default)"""
    query = db.query(Investment).options(
        joinedload(Investment.cashflows),
        joinedload(Investment.valuations)
    ).filter(
        Investment.entity_id == entity_id,
        Investment.tenant_id == tenant_id
    )

    # Exclude archived by default
    if not include_archived:
        query = query.filter(Investment.is_archived == False)

    return query.all()

def create_investment(
    db: Session,
    investment: schemas.InvestmentCreate,
    tenant_id: int,
    created_by_user_id: int
) -> Investment:
    """Create a new investment within a tenant"""
    investment_data = investment.model_dump()
    investment_data.update({
        "tenant_id": tenant_id,
        "created_by_user_id": created_by_user_id,
        "updated_by_user_id": created_by_user_id,
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow()
    })

    db_investment = Investment(**investment_data)
    db.add(db_investment)
    db.commit()
    db.refresh(db_investment)
    return db_investment

def update_investment(
    db: Session,
    investment_id: int,
    tenant_id: int,
    investment_update: schemas.InvestmentUpdate,
    updated_by_user_id: int
) -> Optional[Investment]:
    """Update an investment within a tenant"""
    db_investment = db.query(Investment).filter(
        Investment.id == investment_id,
        Investment.tenant_id == tenant_id
    ).first()

    if not db_investment:
        return None

    update_data = investment_update.model_dump(exclude_unset=True)
    update_data.update({
        "updated_by_user_id": updated_by_user_id,
        "updated_date": datetime.utcnow()
    })

    for field, value in update_data.items():
        setattr(db_investment, field, value)

    db.commit()
    db.refresh(db_investment)
    return db_investment

# =============================================================================
# CashFlow CRUD Operations (Tenant-Aware)
# =============================================================================

def get_cashflows(
    db: Session,
    tenant_id: int,
    investment_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[CashFlow]:
    """Get cash flows within a tenant with optional filtering"""
    query = db.query(CashFlow).filter(CashFlow.tenant_id == tenant_id)

    if investment_id:
        query = query.filter(CashFlow.investment_id == investment_id)

    if start_date:
        query = query.filter(CashFlow.date >= start_date)

    if end_date:
        query = query.filter(CashFlow.date <= end_date)

    return query.order_by(CashFlow.date.desc()).all()

def _apply_cash_flow_sign_convention(amount: float, cash_flow_type: CashFlowType) -> float:
    """
    Apply proper sign convention for cash flows:
    - Outflows (Capital Call, Contribution, Fees) should be negative
    - Inflows (Distribution, Yield, Return of Principal) should be positive

    Users input positive amounts, this function applies the correct sign.
    """
    # Always work with absolute value first
    amount = abs(amount)

    # Outflow types (money going out, should be negative)
    outflow_types = {
        CashFlowType.CAPITAL_CALL,
        CashFlowType.CONTRIBUTION,
        CashFlowType.FEES
    }

    # Inflow types (money coming in, should be positive)
    inflow_types = {
        CashFlowType.DISTRIBUTION,
        CashFlowType.YIELD,
        CashFlowType.RETURN_OF_PRINCIPAL
    }

    if cash_flow_type in outflow_types:
        return -amount
    elif cash_flow_type in inflow_types:
        return amount
    else:
        # Default: return as-is if type is unknown
        return amount

def update_investment_summary_fields(db: Session, investment_id: int, tenant_id: int) -> None:
    """
    Update investment called_amount and fees from cash flow data
    """
    from app.performance import calculate_called_amount_from_cashflows, calculate_fees_from_cashflows

    # Get investment
    investment = db.query(Investment).filter(
        Investment.id == investment_id,
        Investment.tenant_id == tenant_id
    ).first()
    if not investment:
        return

    # Get all cash flows for this investment
    cash_flows = db.query(CashFlow).filter(
        CashFlow.investment_id == investment_id,
        CashFlow.tenant_id == tenant_id
    ).all()

    # Calculate new values
    new_called_amount = calculate_called_amount_from_cashflows(cash_flows)
    new_fees = calculate_fees_from_cashflows(cash_flows)

    # Update investment
    investment.called_amount = abs(new_called_amount)  # Store as positive value
    investment.fees = abs(new_fees)  # Store as positive value
    investment.updated_date = datetime.utcnow()

    db.commit()

def create_cashflow(
    db: Session,
    cashflow: schemas.CashFlowCreate,
    tenant_id: int,
    created_by_user_id: int
) -> CashFlow:
    """Create a new cash flow within a tenant"""
    cashflow_data = cashflow.model_dump()

    # Apply sign convention to the amount based on cash flow type
    if 'amount' in cashflow_data and 'type' in cashflow_data:
        cashflow_data['amount'] = _apply_cash_flow_sign_convention(
            cashflow_data['amount'],
            CashFlowType(cashflow_data['type'])
        )

    cashflow_data.update({
        "tenant_id": tenant_id,
        "created_by_user_id": created_by_user_id,
        "updated_by_user_id": created_by_user_id,
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow()
    })

    db_cashflow = CashFlow(**cashflow_data)
    db.add(db_cashflow)
    db.commit()
    db.refresh(db_cashflow)

    # Update investment summary fields
    update_investment_summary_fields(db, db_cashflow.investment_id, tenant_id)

    return db_cashflow

# =============================================================================
# Valuation CRUD Operations (Tenant-Aware)
# =============================================================================

def get_valuations(
    db: Session,
    tenant_id: int,
    investment_id: Optional[int] = None
) -> List[Valuation]:
    """Get valuations within a tenant"""
    query = db.query(Valuation).filter(Valuation.tenant_id == tenant_id)

    if investment_id:
        query = query.filter(Valuation.investment_id == investment_id)

    return query.order_by(Valuation.date.desc()).all()

def create_valuation(
    db: Session,
    valuation: schemas.ValuationCreate,
    tenant_id: int,
    created_by_user_id: int
) -> Valuation:
    """Create a new valuation within a tenant"""
    valuation_data = valuation.model_dump()
    valuation_data.update({
        "tenant_id": tenant_id,
        "created_by_user_id": created_by_user_id,
        "updated_by_user_id": created_by_user_id,
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow()
    })

    db_valuation = Valuation(**valuation_data)
    db.add(db_valuation)
    db.commit()
    db.refresh(db_valuation)
    return db_valuation

# =============================================================================
# Utility Functions
# =============================================================================

def get_tenant_stats(db: Session, tenant_id: int) -> dict:
    """Get statistics for a tenant (excludes archived investments)"""
    user_count = db.query(User).filter(User.tenant_id == tenant_id).count()
    entity_count = db.query(Entity).filter(Entity.tenant_id == tenant_id).count()
    investment_count = db.query(Investment).filter(
        Investment.tenant_id == tenant_id,
        Investment.is_archived == False
    ).count()

    return {
        "user_count": user_count,
        "entity_count": entity_count,
        "investment_count": investment_count
    }


def get_portfolio_performance(db: Session, tenant_id: int) -> schemas.PortfolioPerformance:
    """Calculate and return aggregate portfolio performance metrics for a specific tenant"""
    # Get investments for the tenant
    investments = get_investments(db, tenant_id)

    investment_metrics = []
    investments_with_nav = 0
    all_cash_flows = []  # Collect all cash flows for true portfolio IRR

    for investment in investments:
        # Include ALL relevant cash flow types for contributions and distributions
        contributions = [cf for cf in investment.cashflows if cf.type in [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]]
        distributions = [cf for cf in investment.cashflows if cf.type in [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL]]
        valuations = investment.valuations

        perf_metrics = calculate_investment_performance(contributions, distributions, valuations)
        investment_metrics.append(perf_metrics)

        if perf_metrics.current_nav is not None:
            investments_with_nav += 1

        # Collect all cash flows for portfolio-level IRR calculation
        # ONLY include actual cash flows through today (exclude future projected flows)
        from datetime import date
        today = date.today()

        for cf in contributions:
            if cf.date <= today:
                all_cash_flows.append(CashFlowEvent(cf.date, -abs(cf.amount)))  # Contributions are negative
        for cf in distributions:
            if cf.date <= today:
                all_cash_flows.append(CashFlowEvent(cf.date, abs(cf.amount)))   # Distributions are positive

        # Add current NAV as final cash flow if exists
        if perf_metrics.current_nav and perf_metrics.current_nav > 0:
            # Use today's date for NAV valuation
            all_cash_flows.append(CashFlowEvent(today, perf_metrics.current_nav))

    # Calculate true portfolio-level metrics using all cash flows
    portfolio_metrics = calculate_true_portfolio_performance(all_cash_flows, investment_metrics)

    # Convert to schema
    portfolio_performance_schema = schemas.PerformanceMetrics(
        irr=portfolio_metrics.irr,
        tvpi=portfolio_metrics.tvpi,
        dpi=portfolio_metrics.dpi,
        rvpi=portfolio_metrics.rvpi,
        total_contributions=portfolio_metrics.total_contributions,
        total_distributions=portfolio_metrics.total_distributions,
        current_nav=portfolio_metrics.current_nav,
        total_value=portfolio_metrics.total_value,
        trailing_yield=portfolio_metrics.trailing_yield,
        forward_yield=portfolio_metrics.forward_yield,
        yield_frequency=portfolio_metrics.yield_frequency,
        trailing_yield_amount=portfolio_metrics.trailing_yield_amount,
        latest_yield_amount=portfolio_metrics.latest_yield_amount
    )

    # Calculate additional portfolio metrics for the tenant
    entities = db.query(Entity).filter(Entity.tenant_id == tenant_id, Entity.is_active == True).all()
    entity_count = len(entities)

    # Calculate commitment and called amounts
    total_commitment = sum(inv.commitment_amount for inv in investments)
    total_called = sum(inv.called_amount for inv in investments)

    # Get unique asset classes and vintage years
    asset_classes = set()
    vintage_years = set()
    active_investments = 0
    dormant_investments = 0
    realized_investments = 0

    for investment in investments:
        asset_classes.add(investment.asset_class)
        vintage_years.add(investment.vintage_year)
        # Count investments by their actual status
        if investment.status == "ACTIVE":
            active_investments += 1
        elif investment.status == "DORMANT":
            dormant_investments += 1
        elif investment.status == "REALIZED":
            realized_investments += 1

    return schemas.PortfolioPerformance(
        portfolio_performance=portfolio_performance_schema,
        investment_count=len(investments),
        investments_with_nav=investments_with_nav,
        entity_count=entity_count,
        asset_class_count=len(asset_classes),
        vintage_year_count=len(vintage_years),
        active_investment_count=active_investments,
        dormant_investment_count=dormant_investments,
        realized_investment_count=realized_investments,
        total_commitment=total_commitment,
        total_called=total_called
    )

# =============================================================================
# Investment Performance CRUD Operations
# =============================================================================

def get_investment_performance(db: Session, tenant_id: int, investment_id: Union[int, str, UUID]) -> Optional[schemas.InvestmentPerformance]:
    """Calculate and return performance metrics for a specific investment with tenant isolation"""
    investment = get_investment(db, investment_id, tenant_id)
    if not investment:
        return None

    # Get cash flows separated by type - include ALL relevant types
    # Contributions (outflows): CAPITAL_CALL, CONTRIBUTION, and FEES
    contributions = [cf for cf in investment.cashflows if cf.type in [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION, CashFlowType.FEES]]
    # Distributions (inflows): DISTRIBUTION, YIELD, and RETURN_OF_PRINCIPAL
    distributions = [cf for cf in investment.cashflows if cf.type in [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL]]
    valuations = investment.valuations

    # Calculate performance metrics
    perf_metrics = calculate_investment_performance(contributions, distributions, valuations)

    # Convert to schema
    performance_schema = schemas.PerformanceMetrics(
        irr=perf_metrics.irr,
        tvpi=perf_metrics.tvpi,
        dpi=perf_metrics.dpi,
        rvpi=perf_metrics.rvpi,
        total_contributions=perf_metrics.total_contributions,
        total_distributions=perf_metrics.total_distributions,
        current_nav=perf_metrics.current_nav,
        total_value=perf_metrics.total_value,
        trailing_yield=perf_metrics.trailing_yield,
        forward_yield=perf_metrics.forward_yield,
        yield_frequency=perf_metrics.yield_frequency,
        trailing_yield_amount=perf_metrics.trailing_yield_amount,
        latest_yield_amount=perf_metrics.latest_yield_amount
    )

    return schemas.InvestmentPerformance(
        investment_id=investment.id,
        investment_name=investment.name,
        performance=performance_schema
    )

# =============================================================================
# Investment Detail CRUD Operations (Tenant-Aware)
# =============================================================================

def get_investment_valuations(db: Session, tenant_id: int, investment_id: int) -> List[models.Valuation]:
    """Get all valuations for a specific investment with tenant isolation"""
    # First verify the investment belongs to this tenant
    investment = get_investment(db, investment_id, tenant_id)
    if not investment:
        return []

    return db.query(models.Valuation).filter(
        models.Valuation.investment_id == investment_id
    ).order_by(models.Valuation.date.desc()).all()

def get_investment_cashflows(db: Session, tenant_id: int, investment_id: int) -> List[models.CashFlow]:
    """Get all cash flows for a specific investment with tenant isolation"""
    # First verify the investment belongs to this tenant
    investment = get_investment(db, investment_id, tenant_id)
    if not investment:
        return []

    return db.query(models.CashFlow).filter(
        models.CashFlow.investment_id == investment_id
    ).order_by(models.CashFlow.date.desc()).all()

# =============================================================================
# Document Management CRUD Operations (Tenant-Aware)
# =============================================================================

def get_document(db: Session, document_id: int, tenant_id: int) -> Optional[models.Document]:
    """Get a single document by ID with tenant isolation"""
    return db.query(models.Document).options(
        joinedload(models.Document.investment),
        joinedload(models.Document.entity),
        joinedload(models.Document.tags)
    ).filter(
        models.Document.id == document_id,
        models.Document.tenant_id == tenant_id
    ).first()

def get_documents(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False
) -> List[models.Document]:
    """Get documents with tenant isolation"""
    query = db.query(models.Document).options(
        joinedload(models.Document.investment),
        joinedload(models.Document.entity),
        joinedload(models.Document.tags)
    ).filter(models.Document.tenant_id == tenant_id)

    if not include_archived:
        query = query.filter(models.Document.is_archived == False)

    return query.order_by(models.Document.created_date.desc()).offset(skip).limit(limit).all()

def get_documents_filtered(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 100,
    search_query: str = None,
    categories: List[str] = None,
    statuses: List[str] = None,
    investment_ids: List[int] = None,
    entity_ids: List[int] = None,
    tags: List[str] = None,
    date_from: str = None,
    date_to: str = None,
    include_archived: bool = False,
    uploaded_by: str = None
) -> List[models.Document]:
    """Get filtered documents with tenant isolation"""
    query = db.query(models.Document).options(
        joinedload(models.Document.investment),
        joinedload(models.Document.entity),
        joinedload(models.Document.tags)
    ).filter(models.Document.tenant_id == tenant_id)

    # Apply filters
    if search_query:
        search_term = f"%{search_query}%"
        query = query.filter(
            or_(
                models.Document.title.ilike(search_term),
                models.Document.description.ilike(search_term),
                models.Document.original_filename.ilike(search_term)
            )
        )

    if categories:
        query = query.filter(models.Document.category.in_(categories))

    if statuses:
        query = query.filter(models.Document.status.in_(statuses))

    if investment_ids:
        query = query.filter(models.Document.investment_id.in_(investment_ids))

    if entity_ids:
        query = query.filter(models.Document.entity_id.in_(entity_ids))

    if tags:
        query = query.join(models.DocumentTag).filter(models.DocumentTag.tag_name.in_(tags))

    if date_from:
        query = query.filter(models.Document.document_date >= date_from)
    if date_to:
        query = query.filter(models.Document.document_date <= date_to)

    if not include_archived:
        query = query.filter(models.Document.is_archived == False)

    if uploaded_by:
        query = query.filter(models.Document.uploaded_by == uploaded_by)

    return query.order_by(models.Document.created_date.desc()).offset(skip).limit(limit).all()

def create_document(
    db: Session,
    tenant_id: int,
    document: schemas.DocumentCreate,
    file_info: dict,
    current_user_id: int
) -> models.Document:
    """Create a new document with tenant isolation"""
    document_data = document.model_dump()
    document_data.update(file_info)
    document_data['tenant_id'] = tenant_id
    document_data['uploaded_by_user_id'] = current_user_id
    document_data['uploaded_by'] = f"user_{current_user_id}"
    document_data['created_date'] = datetime.utcnow()
    document_data['last_modified'] = datetime.utcnow()

    # Validate that investment and entity belong to this tenant if specified
    if document_data.get('investment_id'):
        investment = get_investment(db, document_data['investment_id'], tenant_id)
        if not investment:
            raise ValueError("Investment not found or doesn't belong to this tenant")

    if document_data.get('entity_id'):
        entity = get_entity(db, document_data['entity_id'], tenant_id)
        if not entity:
            raise ValueError("Entity not found or doesn't belong to this tenant")

    db_document = models.Document(**document_data)
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document

def update_document(
    db: Session,
    document_id: int,
    tenant_id: int,
    document_update: schemas.DocumentUpdate,
    current_user_id: int
) -> Optional[models.Document]:
    """Update an existing document with tenant isolation"""
    db_document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.tenant_id == tenant_id
    ).first()

    if db_document:
        update_data = document_update.model_dump(exclude_unset=True)

        # Validate tenant ownership for relationships
        if 'investment_id' in update_data and update_data['investment_id']:
            investment = get_investment(db, update_data['investment_id'], tenant_id)
            if not investment:
                raise ValueError("Investment not found or doesn't belong to this tenant")

        if 'entity_id' in update_data and update_data['entity_id']:
            entity = get_entity(db, update_data['entity_id'], tenant_id)
            if not entity:
                raise ValueError("Entity not found or doesn't belong to this tenant")

        for field, value in update_data.items():
            setattr(db_document, field, value)

        db_document.last_modified = datetime.utcnow()
        db_document.last_modified_by_user_id = current_user_id
        db.commit()
        db.refresh(db_document)

    return db_document

def delete_document(db: Session, document_id: int, tenant_id: int, soft_delete: bool = True) -> bool:
    """Delete a document with tenant isolation"""
    db_document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.tenant_id == tenant_id
    ).first()

    if db_document:
        if soft_delete:
            db_document.is_archived = True
            db_document.last_modified = datetime.utcnow()
            db.commit()
        else:
            # First delete related tags
            db.query(models.DocumentTag).filter(
                models.DocumentTag.document_id == document_id
            ).delete()
            db.delete(db_document)
            db.commit()
        return True
    return False

def search_documents(db: Session, tenant_id: int, search_query: str, skip: int = 0, limit: int = 50) -> List[dict]:
    """Advanced document search with relevance scoring and tenant isolation"""
    search_terms = search_query.lower().split()

    # Basic search implementation - in production, consider using Elasticsearch
    documents = db.query(models.Document).options(
        joinedload(models.Document.investment),
        joinedload(models.Document.entity),
        joinedload(models.Document.tags)
    ).filter(
        models.Document.tenant_id == tenant_id,
        models.Document.is_archived == False
    ).all()

    results = []
    for doc in documents:
        relevance_score = 0.0
        highlight_snippets = []

        # Search in title (higher weight)
        if any(term in doc.title.lower() for term in search_terms):
            relevance_score += 0.4
            highlight_snippets.append(f"Title: {doc.title}")

        # Search in description
        if doc.description and any(term in doc.description.lower() for term in search_terms):
            relevance_score += 0.3
            highlight_snippets.append(f"Description: {doc.description[:100]}...")

        # Search in filename
        if any(term in doc.original_filename.lower() for term in search_terms):
            relevance_score += 0.2
            highlight_snippets.append(f"Filename: {doc.original_filename}")

        # Search in tags
        if doc.tags and any(any(term in tag.tag_name.lower() for term in search_terms) for tag in doc.tags):
            relevance_score += 0.1
            matching_tags = [tag.tag_name for tag in doc.tags if any(term in tag.tag_name.lower() for term in search_terms)]
            highlight_snippets.append(f"Tags: {', '.join(matching_tags)}")

        if relevance_score > 0:
            results.append({
                'document': doc,
                'relevance_score': relevance_score,
                'highlight_snippets': highlight_snippets
            })

    # Sort by relevance score descending
    results.sort(key=lambda x: x['relevance_score'], reverse=True)
    return results[skip:skip + limit]

def create_document_tag(db: Session, document_id: int, tenant_id: int, tag: schemas.DocumentTagCreate) -> models.DocumentTag:
    """Add a tag to a document with tenant isolation"""
    # Verify document belongs to tenant
    document = get_document(db, document_id, tenant_id)
    if not document:
        raise ValueError("Document not found or doesn't belong to this tenant")

    # Check if tag already exists for this document
    existing_tag = db.query(models.DocumentTag).filter(
        models.DocumentTag.document_id == document_id,
        models.DocumentTag.tag_name == tag.tag_name
    ).first()

    if existing_tag:
        return existing_tag

    db_tag = models.DocumentTag(
        document_id=document_id,
        tag_name=tag.tag_name,
        color=tag.color,
        created_date=datetime.utcnow()
    )
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def remove_document_tag(db: Session, document_id: int, tenant_id: int, tag_name: str) -> bool:
    """Remove a tag from a document with tenant isolation"""
    # Verify document belongs to tenant
    document = get_document(db, document_id, tenant_id)
    if not document:
        raise ValueError("Document not found or doesn't belong to this tenant")

    db_tag = db.query(models.DocumentTag).filter(
        models.DocumentTag.document_id == document_id,
        models.DocumentTag.tag_name == tag_name
    ).first()

    if db_tag:
        db.delete(db_tag)
        db.commit()
        return True
    return False

def get_all_document_tags(db: Session, tenant_id: int) -> List[str]:
    """Get all unique tag names across all documents for a tenant"""
    tags = db.query(models.DocumentTag.tag_name).join(models.Document).filter(
        models.Document.tenant_id == tenant_id
    ).distinct().all()
    return [tag[0] for tag in tags]

def get_document_statistics(db: Session, tenant_id: int) -> dict:
    """Get comprehensive document statistics for a tenant"""
    from datetime import timedelta

    # Base query with tenant filter
    base_query = db.query(models.Document).filter(models.Document.tenant_id == tenant_id)

    # Total documents
    total_documents = base_query.count()

    # Documents by category
    category_stats = db.query(
        models.Document.category,
        func.count(models.Document.id)
    ).filter(
        models.Document.tenant_id == tenant_id
    ).group_by(models.Document.category).all()

    by_category = {str(category): count for category, count in category_stats}

    # Documents by status
    status_stats = db.query(
        models.Document.status,
        func.count(models.Document.id)
    ).filter(
        models.Document.tenant_id == tenant_id
    ).group_by(models.Document.status).all()

    by_status = {str(status): count for status, count in status_stats}

    # Recent uploads (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_uploads_count = base_query.filter(
        models.Document.created_date >= thirty_days_ago
    ).count()

    # Total file size
    total_file_size_result = db.query(
        func.sum(models.Document.file_size)
    ).filter(
        models.Document.tenant_id == tenant_id
    ).scalar()

    total_file_size = total_file_size_result or 0

    # Documents by entity
    entity_stats = db.query(
        models.Entity.name,
        func.count(models.Document.id)
    ).join(
        models.Document, models.Document.entity_id == models.Entity.id, isouter=True
    ).filter(
        models.Entity.tenant_id == tenant_id
    ).group_by(models.Entity.name).all()

    by_entity = {entity_name: count for entity_name, count in entity_stats if count > 0}

    # Documents by investment
    investment_stats = db.query(
        models.Investment.name,
        func.count(models.Document.id)
    ).join(
        models.Document, models.Document.investment_id == models.Investment.id, isouter=True
    ).filter(
        models.Investment.tenant_id == tenant_id
    ).group_by(models.Investment.name).all()

    by_investment = {investment_name: count for investment_name, count in investment_stats if count > 0}

    # Pending action count (documents with PENDING_REVIEW or PENDING_APPROVAL status)
    pending_action_count = base_query.filter(
        models.Document.status.in_([models.DocumentStatus.PENDING_REVIEW, models.DocumentStatus.PENDING_APPROVAL])
    ).count()

    # Overdue count (documents with due_date in the past and not completed)
    today = datetime.utcnow().date()
    overdue_count = base_query.filter(
        models.Document.due_date < today,
        models.Document.status != models.DocumentStatus.COMPLETED
    ).count()

    return {
        'total_documents': total_documents,
        'by_category': by_category,
        'by_status': by_status,
        'by_entity': by_entity,
        'by_investment': by_investment,
        'pending_action_count': pending_action_count,
        'overdue_count': overdue_count,
        'recent_uploads_count': recent_uploads_count,
        'total_file_size': total_file_size
    }

def get_documents_by_investment(db: Session, tenant_id: int, investment_id: int, include_archived: bool = False) -> List[models.Document]:
    """Get all documents for a specific investment with tenant isolation"""
    # Verify investment belongs to tenant
    investment = get_investment(db, investment_id, tenant_id)
    if not investment:
        return []

    query = db.query(models.Document).filter(
        models.Document.investment_id == investment_id,
        models.Document.tenant_id == tenant_id
    )

    if not include_archived:
        query = query.filter(models.Document.is_archived == False)

    return query.order_by(models.Document.created_date.desc()).all()

def get_documents_by_entity(db: Session, tenant_id: int, entity_id: int, include_archived: bool = False) -> List[models.Document]:
    """Get all documents for a specific entity with tenant isolation"""
    # Verify entity belongs to tenant
    entity = get_entity(db, entity_id, tenant_id)
    if not entity:
        return []

    query = db.query(models.Document).filter(
        models.Document.entity_id == entity_id,
        models.Document.tenant_id == tenant_id
    )

    if not include_archived:
        query = query.filter(models.Document.is_archived == False)

    return query.order_by(models.Document.created_date.desc()).all()


def delete_entity(db: Session, entity_id: int, tenant_id: int) -> bool:
    """Delete an entity (soft delete by setting is_active to False)"""
    db_entity = db.query(models.Entity).filter(
        models.Entity.id == entity_id,
        models.Entity.tenant_id == tenant_id
    ).first()

    if db_entity:
        db_entity.is_active = False
        db_entity.updated_at = datetime.utcnow()
        db.commit()
        return True
    return False


def search_entities(db: Session, tenant_id: int, search_term: str, skip: int = 0, limit: int = 100) -> List[models.Entity]:
    """Search entities by name within a tenant"""
    query = db.query(models.Entity).filter(
        models.Entity.tenant_id == tenant_id,
        models.Entity.is_active == True,
        models.Entity.name.ilike(f"%{search_term}%")
    )

    return query.offset(skip).limit(limit).all()


# =============================================================================
# Cash Flow CRUD Operations
# =============================================================================

def get_cashflow(db: Session, cashflow_id: Union[int, str, UUID], tenant_id: int) -> Optional[models.CashFlow]:
    """Get a specific cash flow by ID or UUID with tenant isolation"""
    query = db.query(models.CashFlow).join(models.Investment)

    # Handle UUID or int lookup
    if isinstance(cashflow_id, str):
        parsed_id = parse_id_or_uuid(cashflow_id)
        if isinstance(parsed_id, UUID):
            query = query.filter(models.CashFlow.uuid == parsed_id)
        else:
            query = query.filter(models.CashFlow.id == parsed_id)
    elif isinstance(cashflow_id, UUID):
        query = query.filter(models.CashFlow.uuid == cashflow_id)
    else:
        query = query.filter(models.CashFlow.id == cashflow_id)

    return query.filter(models.Investment.tenant_id == tenant_id).first()


def update_cashflow(
    db: Session,
    cashflow_id: int,
    tenant_id: int,
    cashflow_update: schemas.CashFlowUpdate,
    updated_by_user_id: int
) -> Optional[models.CashFlow]:
    """Update a cash flow with tenant isolation"""
    db_cashflow = get_cashflow(db, cashflow_id, tenant_id)

    if not db_cashflow:
        return None

    update_data = cashflow_update.model_dump(exclude_unset=True)

    # Handle amount and cash flow type updates
    if 'amount' in update_data and 'type' in update_data:
        # Both amount and type are being updated - apply sign convention if amount is positive
        if update_data['amount'] > 0:
            update_data['amount'] = _apply_cash_flow_sign_convention(
                update_data['amount'],
                CashFlowType(update_data['type'])
            )
    elif 'amount' in update_data:
        # Only amount is being updated - apply sign convention if amount is positive
        if update_data['amount'] > 0:
            update_data['amount'] = _apply_cash_flow_sign_convention(
                update_data['amount'],
                db_cashflow.type
            )
    elif 'type' in update_data:
        # If only changing the type, re-apply sign convention to existing amount
        update_data['amount'] = _apply_cash_flow_sign_convention(
            abs(db_cashflow.amount),
            CashFlowType(update_data['type'])
        )

    update_data["updated_by_user_id"] = updated_by_user_id
    update_data["updated_date"] = datetime.utcnow()

    for key, value in update_data.items():
        setattr(db_cashflow, key, value)

    db.commit()
    db.refresh(db_cashflow)

    # Update investment summary fields
    update_investment_summary_fields(db, db_cashflow.investment_id, tenant_id)

    return db_cashflow


def delete_cashflow(db: Session, cashflow_id: int, tenant_id: int) -> bool:
    """Delete a cash flow with tenant isolation"""
    db_cashflow = get_cashflow(db, cashflow_id, tenant_id)

    if not db_cashflow:
        return False

    # Store investment_id before deleting the cashflow
    investment_id = db_cashflow.investment_id

    db.delete(db_cashflow)
    db.commit()

    # Update investment summary fields after deletion
    update_investment_summary_fields(db, investment_id, tenant_id)

    return True


# =============================================================================
# Valuation CRUD Operations
# =============================================================================

def get_valuation(db: Session, valuation_id: Union[int, str, UUID], tenant_id: int) -> Optional[models.Valuation]:
    """Get a specific valuation by ID or UUID with tenant isolation"""
    query = db.query(models.Valuation).join(models.Investment)

    # Handle UUID or int lookup
    if isinstance(valuation_id, str):
        parsed_id = parse_id_or_uuid(valuation_id)
        if isinstance(parsed_id, UUID):
            query = query.filter(models.Valuation.uuid == parsed_id)
        else:
            query = query.filter(models.Valuation.id == parsed_id)
    elif isinstance(valuation_id, UUID):
        query = query.filter(models.Valuation.uuid == valuation_id)
    else:
        query = query.filter(models.Valuation.id == valuation_id)

    return query.filter(models.Investment.tenant_id == tenant_id).first()


def update_valuation(
    db: Session,
    valuation_id: int,
    tenant_id: int,
    valuation_update: schemas.ValuationUpdate,
    updated_by_user_id: int
) -> Optional[models.Valuation]:
    """Update a valuation with tenant isolation"""
    db_valuation = get_valuation(db, valuation_id, tenant_id)
    
    if not db_valuation:
        return None
    
    update_data = valuation_update.model_dump(exclude_unset=True)
    update_data["updated_by"] = updated_by_user_id
    update_data["updated_at"] = datetime.utcnow()
    
    for key, value in update_data.items():
        setattr(db_valuation, key, value)
    
    db.commit()
    db.refresh(db_valuation)
    return db_valuation


def delete_valuation(db: Session, valuation_id: int, tenant_id: int) -> bool:
    """Delete a valuation with tenant isolation"""
    db_valuation = get_valuation(db, valuation_id, tenant_id)
    
    if not db_valuation:
        return False
    
    db.delete(db_valuation)
    db.commit()
    return True


# =============================================================================
# Investment CRUD Operations (DELETE missing)
# =============================================================================

def delete_investment(db: Session, investment_id: int, tenant_id: int, user_id: int = None) -> bool:
    """
    Archive an investment (soft delete)

    This hides the investment from normal views but preserves all data.
    The investment can be restored later.
    """
    db_investment = get_investment(db, investment_id, tenant_id)

    if not db_investment:
        return False

    # Set archived flag
    db_investment.is_archived = True
    db_investment.archived_date = datetime.utcnow()
    if user_id:
        db_investment.archived_by_user_id = user_id
    db_investment.updated_date = datetime.utcnow()

    db.commit()
    return True


def restore_investment(db: Session, investment_id: int, tenant_id: int) -> bool:
    """
    Restore an archived investment
    """
    db_investment = get_investment(db, investment_id, tenant_id, include_archived=True)

    if not db_investment:
        return False

    # Clear archived flag
    db_investment.is_archived = False
    db_investment.archived_date = None
    db_investment.archived_by_user_id = None
    db_investment.updated_date = datetime.utcnow()

    db.commit()
    return True

