from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app import models, schemas
from app.performance import (
    calculate_investment_performance, 
    aggregate_portfolio_performance, 
    calculate_called_amount_from_cashflows,
    calculate_fees_from_cashflows,
    calculate_true_portfolio_performance,
    PerformanceMetrics as PerfMetrics,
    CashFlowEvent
)
from app.models import CashFlowType, MarketBenchmark, BenchmarkReturn
from sqlalchemy.orm import joinedload
from sqlalchemy import desc, and_, or_
from datetime import datetime, timedelta

# Entity CRUD operations

def get_entity(db: Session, entity_id: int) -> Optional[models.Entity]:
    """Get a single entity by ID"""
    return db.query(models.Entity).options(joinedload(models.Entity.family_members)).filter(models.Entity.id == entity_id).first()

def get_entities(db: Session, skip: int = 0, limit: int = 100, include_inactive: bool = False) -> List[models.Entity]:
    """Get entities with optional pagination and filtering"""
    query = db.query(models.Entity).options(joinedload(models.Entity.family_members))
    
    if not include_inactive:
        query = query.filter(models.Entity.is_active == True)
    
    return query.offset(skip).limit(limit).all()

def get_entities_by_type(db: Session, entity_type: str, skip: int = 0, limit: int = 100) -> List[models.Entity]:
    """Get entities filtered by type"""
    return db.query(models.Entity).filter(
        models.Entity.entity_type == entity_type,
        models.Entity.is_active == True
    ).offset(skip).limit(limit).all()

def create_entity(db: Session, entity: schemas.EntityCreate, current_user: str = "admin") -> models.Entity:
    """Create a new entity"""
    entity_data = entity.model_dump()
    entity_data['created_by'] = current_user
    entity_data['updated_by'] = current_user
    db_entity = models.Entity(**entity_data)
    db.add(db_entity)
    db.commit()
    db.refresh(db_entity)
    return db_entity

def update_entity(db: Session, entity_id: int, entity_update: schemas.EntityUpdate, current_user: str = "admin") -> Optional[models.Entity]:
    """Update an existing entity"""
    db_entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if db_entity:
        update_data = entity_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_entity, field, value)
        # Always update the updated_by field
        setattr(db_entity, 'updated_by', current_user)
        db.commit()
        db.refresh(db_entity)
    return db_entity

def delete_entity(db: Session, entity_id: int) -> bool:
    """Delete an entity (soft delete by setting is_active to False)"""
    db_entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if db_entity:
        db_entity.is_active = False
        db.commit()
        return True
    return False

def search_entities(db: Session, search_term: str, skip: int = 0, limit: int = 100) -> List[models.Entity]:
    """Search entities by name"""
    search_filter = f"%{search_term.lower()}%"
    return db.query(models.Entity).filter(
        models.Entity.name.ilike(search_filter),
        models.Entity.is_active == True
    ).offset(skip).limit(limit).all()

# Family Member CRUD operations

def get_family_member(db: Session, member_id: int) -> Optional[models.FamilyMember]:
    """Get a single family member by ID"""
    return db.query(models.FamilyMember).filter(models.FamilyMember.id == member_id).first()

def get_entity_family_members(db: Session, entity_id: int, include_inactive: bool = False) -> List[models.FamilyMember]:
    """Get all family members for a specific entity"""
    query = db.query(models.FamilyMember).filter(models.FamilyMember.entity_id == entity_id)
    
    if not include_inactive:
        query = query.filter(models.FamilyMember.is_active == True)
    
    return query.all()

def create_family_member(db: Session, family_member: schemas.FamilyMemberCreate, current_user: str = "admin") -> models.FamilyMember:
    """Create a new family member"""
    member_data = family_member.model_dump()
    member_data['created_by'] = current_user
    member_data['updated_by'] = current_user
    db_member = models.FamilyMember(**member_data)
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

def update_family_member(db: Session, member_id: int, member_update: schemas.FamilyMemberUpdate, current_user: str = "admin") -> Optional[models.FamilyMember]:
    """Update an existing family member"""
    db_member = db.query(models.FamilyMember).filter(models.FamilyMember.id == member_id).first()
    if db_member:
        update_data = member_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_member, field, value)
        # Always update the updated_by field
        setattr(db_member, 'updated_by', current_user)
        db.commit()
        db.refresh(db_member)
    return db_member

def delete_family_member(db: Session, member_id: int) -> bool:
    """Delete a family member (soft delete by setting is_active to False)"""
    db_member = db.query(models.FamilyMember).filter(models.FamilyMember.id == member_id).first()
    if db_member:
        db_member.is_active = False
        db.commit()
        return True
    return False

# Investment CRUD operations

def get_investment(db: Session, investment_id: int) -> Optional[models.Investment]:
    return db.query(models.Investment).options(joinedload(models.Investment.entity)).filter(models.Investment.id == investment_id).first()

def get_investments(db: Session, skip: int = 0, limit: int = 100) -> List[models.Investment]:
    return db.query(models.Investment).options(joinedload(models.Investment.entity)).offset(skip).limit(limit).all()

def get_investments_filtered(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    search: Optional[str] = None,
    asset_classes: Optional[List[str]] = None,
    min_vintage_year: Optional[int] = None,
    max_vintage_year: Optional[int] = None,
    min_commitment: Optional[float] = None,
    max_commitment: Optional[float] = None,
    entity_ids: Optional[List[int]] = None,
    entity_names: Optional[List[str]] = None,
    entity_types: Optional[List[str]] = None
) -> List[models.Investment]:
    """Get investments with filtering capabilities"""
    query = db.query(models.Investment).options(joinedload(models.Investment.entity))
    
    # Text search across name, entity name, and strategy
    if search:
        search_filter = f"%{search.lower()}%"
        query = query.join(models.Entity).filter(
            models.Investment.name.ilike(search_filter) |
            models.Entity.name.ilike(search_filter) |
            models.Investment.strategy.ilike(search_filter)
        )
    
    # Filter by asset classes
    if asset_classes:
        query = query.filter(models.Investment.asset_class.in_(asset_classes))
    
    # Filter by vintage year range
    if min_vintage_year:
        query = query.filter(models.Investment.vintage_year >= min_vintage_year)
    if max_vintage_year:
        query = query.filter(models.Investment.vintage_year <= max_vintage_year)
    
    # Filter by commitment amount range
    if min_commitment:
        query = query.filter(models.Investment.commitment_amount >= min_commitment)
    if max_commitment:
        query = query.filter(models.Investment.commitment_amount <= max_commitment)
    
    # Filter by specific entity IDs
    if entity_ids:
        query = query.filter(models.Investment.entity_id.in_(entity_ids))
    
    # Filter by entity names
    if entity_names:
        if not search:  # Only join if not already joined
            query = query.join(models.Entity)
        query = query.filter(models.Entity.name.in_(entity_names))
    
    # Filter by entity types
    if entity_types:
        if not search and not entity_names:  # Only join if not already joined
            query = query.join(models.Entity)
        query = query.filter(models.Entity.entity_type.in_(entity_types))
    
    return query.offset(skip).limit(limit).all()

def get_investments_by_entity(db: Session, entity_id: int) -> List[models.Investment]:
    """Get all investments for a specific entity"""
    return db.query(models.Investment).filter(models.Investment.entity_id == entity_id).all()

def create_investment(db: Session, investment: schemas.InvestmentCreate, current_user: str = "admin") -> models.Investment:
    investment_data = investment.model_dump()
    investment_data['created_by'] = current_user
    investment_data['updated_by'] = current_user
    db_investment = models.Investment(**investment_data)
    db.add(db_investment)
    db.commit()
    db.refresh(db_investment)
    return db_investment

def update_investment(db: Session, investment_id: int, investment_update: schemas.InvestmentUpdate, current_user: str = "admin") -> Optional[models.Investment]:
    db_investment = db.query(models.Investment).filter(models.Investment.id == investment_id).first()
    if db_investment:
        update_data = investment_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_investment, field, value)
        # Always update the updated_by field
        setattr(db_investment, 'updated_by', current_user)
        db.commit()
        db.refresh(db_investment)
    return db_investment

def update_investment_status(db: Session, investment_id: int, status_update: schemas.InvestmentStatusUpdate, current_user: str = "admin") -> Optional[models.Investment]:
    """Update investment status with audit trail"""
    from datetime import datetime
    
    db_investment = db.query(models.Investment).filter(models.Investment.id == investment_id).first()
    if db_investment:
        # Update status fields
        db_investment.status = status_update.status
        db_investment.status_changed_by = current_user
        db_investment.status_changed_date = datetime.utcnow()
        
        # Update realization fields if provided
        if status_update.realization_date:
            db_investment.realization_date = status_update.realization_date
        if status_update.realization_notes:
            db_investment.realization_notes = status_update.realization_notes
            
        db.commit()
        db.refresh(db_investment)
    return db_investment

def delete_investment(db: Session, investment_id: int) -> bool:
    db_investment = db.query(models.Investment).filter(models.Investment.id == investment_id).first()
    if db_investment:
        db.delete(db_investment)
        db.commit()
        return True
    return False

# Helper function for cash flow sign convention
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
        return -amount  # Make negative for outflows
    elif cash_flow_type in inflow_types:
        return amount   # Keep positive for inflows
    else:
        # Fallback: if unknown type, keep user's input as-is
        return amount

# CashFlow CRUD operations
def get_investment_cashflows(db: Session, investment_id: int) -> List[models.CashFlow]:
    return db.query(models.CashFlow).filter(models.CashFlow.investment_id == investment_id).order_by(models.CashFlow.date.desc()).all()

def create_cashflow(db: Session, investment_id: int, cashflow: schemas.CashFlowCreate, current_user: str = "admin") -> models.CashFlow:
    cashflow_data = cashflow.model_dump()
    
    # Apply sign convention to the amount based on cash flow type
    if 'amount' in cashflow_data and 'type' in cashflow_data:
        cashflow_data['amount'] = _apply_cash_flow_sign_convention(
            cashflow_data['amount'], 
            CashFlowType(cashflow_data['type'])
        )
    
    cashflow_data['created_by'] = current_user
    cashflow_data['updated_by'] = current_user
    db_cashflow = models.CashFlow(**cashflow_data, investment_id=investment_id)
    db.add(db_cashflow)
    db.commit()
    db.refresh(db_cashflow)
    
    # Update investment summary fields
    update_investment_summary_fields(db, investment_id)
    
    return db_cashflow

def get_cashflow(db: Session, cashflow_id: int) -> Optional[models.CashFlow]:
    return db.query(models.CashFlow).filter(models.CashFlow.id == cashflow_id).first()

def update_investment_summary_fields(db: Session, investment_id: int) -> None:
    """
    Update investment called_amount and fees from cash flow data
    """
    # Get investment
    investment = db.query(models.Investment).filter(models.Investment.id == investment_id).first()
    if not investment:
        return
    
    # Get all cash flows for this investment
    cash_flows = db.query(models.CashFlow).filter(models.CashFlow.investment_id == investment_id).all()
    
    # Calculate new values
    new_called_amount = calculate_called_amount_from_cashflows(cash_flows)
    new_fees = calculate_fees_from_cashflows(cash_flows)
    
    # Update investment
    investment.called_amount = new_called_amount
    investment.fees = new_fees
    
    db.commit()

def update_cashflow(db: Session, cashflow_id: int, cashflow_update: schemas.CashFlowUpdate, current_user: str = "admin") -> Optional[models.CashFlow]:
    """Update an existing cashflow"""
    db_cashflow = db.query(models.CashFlow).filter(models.CashFlow.id == cashflow_id).first()
    if not db_cashflow:
        return None
    
    # Update only provided fields
    update_data = cashflow_update.model_dump(exclude_unset=True)
    
    # Handle date string conversion
    if 'date' in update_data and isinstance(update_data['date'], str):
        from datetime import datetime
        update_data['date'] = datetime.strptime(update_data['date'], '%Y-%m-%d').date()
    
    # Handle amount and cash flow type updates
    if 'amount' in update_data and 'type' in update_data:
        # Both amount and type are being updated - respect user's signed input
        # Only apply sign convention if amount is positive (user expects it to be auto-signed)
        if update_data['amount'] > 0:
            update_data['amount'] = _apply_cash_flow_sign_convention(
                update_data['amount'], 
                CashFlowType(update_data['type'])
            )
        # If amount is negative, respect user's intention
    elif 'amount' in update_data:
        # Only amount is being updated - respect user's signed input
        # Only apply sign convention if amount is positive (user expects it to be auto-signed)
        if update_data['amount'] > 0:
            cash_flow_type = db_cashflow.type
            update_data['amount'] = _apply_cash_flow_sign_convention(
                update_data['amount'], 
                cash_flow_type
            )
        # If amount is negative, respect user's intention
    elif 'type' in update_data:
        # If only changing the type, re-apply sign convention to existing amount
        update_data['amount'] = _apply_cash_flow_sign_convention(
            abs(db_cashflow.amount),  # Use absolute value of current amount
            CashFlowType(update_data['type'])
        )
    
    update_data['updated_by'] = current_user
    
    for field, value in update_data.items():
        setattr(db_cashflow, field, value)
    
    db.commit()
    db.refresh(db_cashflow)
    
    # Update investment summary fields
    update_investment_summary_fields(db, db_cashflow.investment_id)
    
    return db_cashflow

def delete_cashflow(db: Session, cashflow_id: int) -> bool:
    db_cashflow = db.query(models.CashFlow).filter(models.CashFlow.id == cashflow_id).first()
    if db_cashflow:
        investment_id = db_cashflow.investment_id  # Store before deletion
        db.delete(db_cashflow)
        db.commit()
        
        # Update investment summary fields
        update_investment_summary_fields(db, investment_id)
        
        return True
    return False

# Valuation CRUD operations
def get_investment_valuations(db: Session, investment_id: int) -> List[models.Valuation]:
    return db.query(models.Valuation).filter(models.Valuation.investment_id == investment_id).order_by(models.Valuation.date.desc()).all()

def create_valuation(db: Session, investment_id: int, valuation: schemas.ValuationCreate, current_user: str = "admin") -> models.Valuation:
    valuation_data = valuation.model_dump()
    valuation_data['created_by'] = current_user
    valuation_data['updated_by'] = current_user
    db_valuation = models.Valuation(**valuation_data, investment_id=investment_id)
    db.add(db_valuation)
    db.commit()
    db.refresh(db_valuation)
    return db_valuation

def update_valuation(db: Session, valuation_id: int, valuation_update: schemas.ValuationUpdate, current_user: str = "admin") -> Optional[models.Valuation]:
    db_valuation = db.query(models.Valuation).filter(models.Valuation.id == valuation_id).first()
    if db_valuation:
        update_data = valuation_update.model_dump(exclude_unset=True)
        
        # Handle date string conversion
        if 'date' in update_data and isinstance(update_data['date'], str):
            from datetime import datetime
            update_data['date'] = datetime.strptime(update_data['date'], '%Y-%m-%d').date()
        
        for field, value in update_data.items():
            setattr(db_valuation, field, value)
        # Always update the updated_by field
        setattr(db_valuation, 'updated_by', current_user)
        db.commit()
        db.refresh(db_valuation)
    return db_valuation

def get_valuation(db: Session, valuation_id: int) -> Optional[models.Valuation]:
    return db.query(models.Valuation).filter(models.Valuation.id == valuation_id).first()

def delete_valuation(db: Session, valuation_id: int) -> bool:
    db_valuation = db.query(models.Valuation).filter(models.Valuation.id == valuation_id).first()
    if db_valuation:
        db.delete(db_valuation)
        db.commit()
        return True
    return False

# Performance calculation functions
def get_investment_performance(db: Session, investment_id: int) -> Optional[schemas.InvestmentPerformance]:
    """Calculate and return performance metrics for a specific investment"""
    investment = get_investment(db, investment_id)
    if not investment:
        return None
    
    # Get cash flows separated by type - include ALL relevant types
    # Contributions (outflows): CAPITAL_CALL and CONTRIBUTION
    contributions = [cf for cf in investment.cashflows if cf.type in [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]]
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

def get_portfolio_performance(db: Session) -> schemas.PortfolioPerformance:
    """Calculate and return aggregate portfolio performance metrics"""
    investments = get_investments(db)
    
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
        for cf in contributions:
            all_cash_flows.append(CashFlowEvent(cf.date, -abs(cf.amount)))  # Contributions are negative
        for cf in distributions:
            all_cash_flows.append(CashFlowEvent(cf.date, abs(cf.amount)))   # Distributions are positive
            
        # Add current NAV as final cash flow if exists
        if perf_metrics.current_nav and perf_metrics.current_nav > 0:
            # Use today's date for NAV valuation
            from datetime import date
            all_cash_flows.append(CashFlowEvent(date.today(), perf_metrics.current_nav))
    
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
    
    # Calculate additional portfolio metrics
    entities = db.query(models.Entity).filter(models.Entity.is_active == True).all()
    entity_count = len(entities)
    
    # Calculate commitment and called amounts
    total_commitment = sum(inv.commitment_amount for inv in investments)
    total_called = sum(inv.called_amount for inv in investments)
    
    # Get unique asset classes and vintage years
    asset_classes = set()
    vintage_years = set()
    active_investments = 0
    
    for investment in investments:
        asset_classes.add(investment.asset_class)
        vintage_years.add(investment.vintage_year)
        # Count as active if it has NAV or recent activity (could refine this logic)
        if investment.valuations or investment.cashflows:
            active_investments += 1
    
    return schemas.PortfolioPerformance(
        portfolio_performance=portfolio_performance_schema,
        investment_count=len(investments),
        investments_with_nav=investments_with_nav,
        entity_count=entity_count,
        asset_class_count=len(asset_classes),
        vintage_year_count=len(vintage_years),
        active_investment_count=active_investments,
        total_commitment=total_commitment,
        total_called=total_called
    )

# Document Management CRUD operations

def get_document(db: Session, document_id: int) -> Optional[models.Document]:
    """Get a single document by ID with all relationships"""
    return db.query(models.Document).options(
        joinedload(models.Document.investment),
        joinedload(models.Document.entity),
        joinedload(models.Document.tags)
    ).filter(models.Document.id == document_id).first()

def get_documents(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    include_archived: bool = False
) -> List[models.Document]:
    """Get documents with optional pagination"""
    query = db.query(models.Document).options(
        joinedload(models.Document.investment),
        joinedload(models.Document.entity),
        joinedload(models.Document.tags)
    )
    
    if not include_archived:
        query = query.filter(models.Document.is_archived == False)
    
    return query.order_by(models.Document.created_date.desc()).offset(skip).limit(limit).all()

def get_documents_filtered(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    categories: Optional[List[str]] = None,
    statuses: Optional[List[str]] = None,
    investment_ids: Optional[List[int]] = None,
    entity_ids: Optional[List[int]] = None,
    tags: Optional[List[str]] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    due_date_from: Optional[str] = None,
    due_date_to: Optional[str] = None,
    is_confidential: Optional[bool] = None,
    is_archived: Optional[bool] = None,
    uploaded_by: Optional[str] = None
) -> List[models.Document]:
    """Get documents with comprehensive filtering"""
    query = db.query(models.Document).options(
        joinedload(models.Document.investment),
        joinedload(models.Document.entity),
        joinedload(models.Document.tags)
    )
    
    # Text search across title, description, and searchable content
    if search:
        search_filter = f"%{search.lower()}%"
        query = query.filter(
            models.Document.title.ilike(search_filter) |
            models.Document.description.ilike(search_filter) |
            models.Document.searchable_content.ilike(search_filter)
        )
    
    # Filter by categories
    if categories:
        query = query.filter(models.Document.category.in_(categories))
    
    # Filter by statuses
    if statuses:
        query = query.filter(models.Document.status.in_(statuses))
    
    # Filter by investment IDs
    if investment_ids:
        query = query.filter(models.Document.investment_id.in_(investment_ids))
    
    # Filter by entity IDs
    if entity_ids:
        query = query.filter(models.Document.entity_id.in_(entity_ids))
    
    # Filter by tags
    if tags:
        query = query.join(models.DocumentTag).filter(models.DocumentTag.tag_name.in_(tags))
    
    # Filter by document date range
    if date_from:
        query = query.filter(models.Document.document_date >= date_from)
    if date_to:
        query = query.filter(models.Document.document_date <= date_to)
    
    # Filter by due date range
    if due_date_from:
        query = query.filter(models.Document.due_date >= due_date_from)
    if due_date_to:
        query = query.filter(models.Document.due_date <= due_date_to)
    
    # Filter by confidential status
    if is_confidential is not None:
        query = query.filter(models.Document.is_confidential == is_confidential)
    
    # Filter by archived status
    if is_archived is not None:
        query = query.filter(models.Document.is_archived == is_archived)
    
    # Filter by uploader
    if uploaded_by:
        query = query.filter(models.Document.uploaded_by.ilike(f"%{uploaded_by}%"))
    
    return query.order_by(models.Document.created_date.desc()).offset(skip).limit(limit).all()

def create_document(db: Session, document: schemas.DocumentCreate, file_info: dict, current_user: str = "admin") -> models.Document:
    """Create a new document with file information"""
    document_data = document.model_dump()
    document_data.update(file_info)
    
    # Set audit fields (uploaded_by is already set in file_info, but ensure consistency)
    if 'uploaded_by' not in document_data:
        document_data['uploaded_by'] = current_user
    
    db_document = models.Document(**document_data)
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document

def update_document(db: Session, document_id: int, document_update: schemas.DocumentUpdate, current_user: str = "admin") -> Optional[models.Document]:
    """Update an existing document"""
    db_document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if db_document:
        update_data = document_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_document, field, value)
        # Track who updated the document (note: Document model doesn't have updated_by yet, but we can add it)
        db.commit()
        db.refresh(db_document)
    return db_document

def delete_document(db: Session, document_id: int, soft_delete: bool = True) -> bool:
    """Delete a document (soft delete by default, hard delete if specified)"""
    db_document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if db_document:
        if soft_delete:
            db_document.is_archived = True
            db.commit()
        else:
            # Delete associated tags first
            db.query(models.DocumentTag).filter(models.DocumentTag.document_id == document_id).delete()
            db.delete(db_document)
            db.commit()
        return True
    return False

def search_documents(db: Session, search_query: str, skip: int = 0, limit: int = 50) -> List[dict]:
    """Advanced document search with relevance scoring"""
    # This is a basic implementation - in production, consider using a proper search engine like Elasticsearch
    search_terms = search_query.lower().split()
    
    documents = db.query(models.Document).options(
        joinedload(models.Document.investment),
        joinedload(models.Document.entity),
        joinedload(models.Document.tags)
    ).filter(models.Document.is_archived == False).all()
    
    results = []
    for doc in documents:
        score = 0
        highlights = []
        
        # Search in title (highest weight)
        title_lower = doc.title.lower()
        for term in search_terms:
            if term in title_lower:
                score += 3
                highlights.append(f"Title: ...{doc.title}...")
        
        # Search in description
        if doc.description:
            desc_lower = doc.description.lower()
            for term in search_terms:
                if term in desc_lower:
                    score += 2
                    highlights.append(f"Description: ...{doc.description[:100]}...")
        
        # Search in content
        if doc.searchable_content:
            content_lower = doc.searchable_content.lower()
            for term in search_terms:
                if term in content_lower:
                    score += 1
                    # Find snippet around the term
                    start_index = max(0, content_lower.find(term) - 50)
                    end_index = min(len(doc.searchable_content), start_index + 150)
                    snippet = doc.searchable_content[start_index:end_index]
                    highlights.append(f"Content: ...{snippet}...")
        
        # Search in tags
        for tag in doc.tags:
            tag_lower = tag.tag_name.lower()
            for term in search_terms:
                if term in tag_lower:
                    score += 1
                    highlights.append(f"Tag: {tag.tag_name}")
        
        if score > 0:
            results.append({
                'document': doc,
                'relevance_score': min(score / (len(search_terms) * 3), 1.0),  # Normalize to 0-1
                'highlight_snippets': highlights[:3]  # Limit highlights
            })
    
    # Sort by relevance score
    results.sort(key=lambda x: x['relevance_score'], reverse=True)
    
    return results[skip:skip + limit]

# Document Tag CRUD operations

def create_document_tag(db: Session, document_id: int, tag: schemas.DocumentTagCreate) -> models.DocumentTag:
    """Add a tag to a document"""
    # Check if tag already exists for this document
    existing_tag = db.query(models.DocumentTag).filter(
        models.DocumentTag.document_id == document_id,
        models.DocumentTag.tag_name == tag.tag_name
    ).first()
    
    if existing_tag:
        return existing_tag
    
    db_tag = models.DocumentTag(document_id=document_id, **tag.model_dump())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def remove_document_tag(db: Session, document_id: int, tag_name: str) -> bool:
    """Remove a tag from a document"""
    db_tag = db.query(models.DocumentTag).filter(
        models.DocumentTag.document_id == document_id,
        models.DocumentTag.tag_name == tag_name
    ).first()
    
    if db_tag:
        db.delete(db_tag)
        db.commit()
        return True
    return False

def get_all_document_tags(db: Session) -> List[str]:
    """Get all unique tag names across all documents"""
    tags = db.query(models.DocumentTag.tag_name).distinct().all()
    return [tag[0] for tag in tags]

def get_document_statistics(db: Session) -> dict:
    """Get comprehensive document statistics"""
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    # Total documents
    total_docs = db.query(models.Document).filter(models.Document.is_archived == False).count()
    
    # By category
    by_category = db.query(
        models.Document.category,
        func.count(models.Document.id)
    ).filter(models.Document.is_archived == False).group_by(models.Document.category).all()
    
    # By status
    by_status = db.query(
        models.Document.status,
        func.count(models.Document.id)
    ).filter(models.Document.is_archived == False).group_by(models.Document.status).all()
    
    # Pending action count
    pending_count = db.query(models.Document).filter(
        models.Document.status == models.DocumentStatus.ACTION_REQUIRED,
        models.Document.is_archived == False
    ).count()
    
    # Overdue count (documents with past due dates)
    today = datetime.now().date()
    overdue_count = db.query(models.Document).filter(
        models.Document.due_date < today,
        models.Document.status != models.DocumentStatus.ARCHIVED,
        models.Document.is_archived == False
    ).count()
    
    # Recent uploads (last 30 days)
    thirty_days_ago = datetime.now() - timedelta(days=30)
    recent_count = db.query(models.Document).filter(
        models.Document.created_date >= thirty_days_ago,
        models.Document.is_archived == False
    ).count()
    
    # Total file size
    total_size = db.query(func.sum(models.Document.file_size)).filter(
        models.Document.is_archived == False
    ).scalar() or 0
    
    return {
        'total_documents': total_docs,
        'by_category': {category.value: count for category, count in by_category},
        'by_status': {status.value: count for status, count in by_status},
        'pending_action_count': pending_count,
        'overdue_count': overdue_count,
        'recent_uploads_count': recent_count,
        'total_file_size': total_size
    }

def get_documents_by_investment(db: Session, investment_id: int, include_archived: bool = False) -> List[models.Document]:
    """Get all documents for a specific investment"""
    query = db.query(models.Document).filter(models.Document.investment_id == investment_id)
    
    if not include_archived:
        query = query.filter(models.Document.is_archived == False)
    
    return query.order_by(models.Document.created_date.desc()).all()

def get_documents_by_entity(db: Session, entity_id: int, include_archived: bool = False) -> List[models.Document]:
    """Get all documents for a specific entity"""
    query = db.query(models.Document).filter(models.Document.entity_id == entity_id)
    
    if not include_archived:
        query = query.filter(models.Document.is_archived == False)
    
    return query.order_by(models.Document.created_date.desc()).all()


# ===== ENHANCED BASIC AUDITING SYSTEM =====
# Basic audit reporting queries for tracking changes

def get_recent_changes_by_user(db: Session, user: str, days: int = 30, limit: int = 50) -> dict:
    """
    Get recent changes made by a specific user across all entities
    Returns a summary of creates and updates by this user
    """
    since_date = datetime.utcnow() - timedelta(days=days)
    
    # Query entities created by user
    created_entities = db.query(models.Entity).filter(
        and_(
            models.Entity.created_by == user,
            models.Entity.created_date >= since_date
        )
    ).order_by(desc(models.Entity.created_date)).limit(limit).all()
    
    # Query entities updated by user
    updated_entities = db.query(models.Entity).filter(
        and_(
            models.Entity.updated_by == user,
            models.Entity.updated_date >= since_date,
            models.Entity.created_by != user  # Don't double-count newly created ones
        )
    ).order_by(desc(models.Entity.updated_date)).limit(limit).all()
    
    # Query investments created by user
    created_investments = db.query(models.Investment).filter(
        and_(
            models.Investment.created_by == user,
            models.Investment.created_date >= since_date
        )
    ).order_by(desc(models.Investment.created_date)).limit(limit).all()
    
    # Query investments updated by user
    updated_investments = db.query(models.Investment).filter(
        and_(
            models.Investment.updated_by == user,
            models.Investment.updated_date >= since_date,
            models.Investment.created_by != user
        )
    ).order_by(desc(models.Investment.updated_date)).limit(limit).all()
    
    # Query cashflows created by user
    created_cashflows = db.query(models.CashFlow).filter(
        and_(
            models.CashFlow.created_by == user,
            models.CashFlow.created_date >= since_date
        )
    ).order_by(desc(models.CashFlow.created_date)).limit(limit).all()
    
    # Query valuations created by user
    created_valuations = db.query(models.Valuation).filter(
        and_(
            models.Valuation.created_by == user,
            models.Valuation.created_date >= since_date
        )
    ).order_by(desc(models.Valuation.created_date)).limit(limit).all()
    
    return {
        'user': user,
        'period_days': days,
        'summary': {
            'entities_created': len(created_entities),
            'entities_updated': len(updated_entities),
            'investments_created': len(created_investments),
            'investments_updated': len(updated_investments),
            'cashflows_created': len(created_cashflows),
            'valuations_created': len(created_valuations),
            'total_actions': (
                len(created_entities) + len(updated_entities) + 
                len(created_investments) + len(updated_investments) + 
                len(created_cashflows) + len(created_valuations)
            )
        },
        'details': {
            'entities_created': [
                {
                    'id': e.id, 
                    'name': e.name, 
                    'type': e.entity_type, 
                    'created_date': e.created_date.isoformat() if e.created_date else None
                } 
                for e in created_entities
            ],
            'entities_updated': [
                {
                    'id': e.id, 
                    'name': e.name, 
                    'type': e.entity_type, 
                    'updated_date': e.updated_date.isoformat() if e.updated_date else None
                } 
                for e in updated_entities
            ],
            'investments_created': [
                {
                    'id': i.id, 
                    'name': i.name, 
                    'asset_class': i.asset_class, 
                    'created_date': i.created_date.isoformat() if i.created_date else None
                } 
                for i in created_investments
            ],
            'investments_updated': [
                {
                    'id': i.id, 
                    'name': i.name, 
                    'asset_class': i.asset_class, 
                    'updated_date': i.updated_date.isoformat() if i.updated_date else None
                } 
                for i in updated_investments
            ],
            'cashflows_created': [
                {
                    'id': cf.id, 
                    'investment_id': cf.investment_id, 
                    'type': cf.type, 
                    'amount': cf.amount, 
                    'date': cf.date.isoformat() if cf.date else None,
                    'created_date': cf.created_date.isoformat() if cf.created_date else None
                } 
                for cf in created_cashflows
            ],
            'valuations_created': [
                {
                    'id': v.id, 
                    'investment_id': v.investment_id, 
                    'nav_value': v.nav_value, 
                    'date': v.date.isoformat() if v.date else None,
                    'created_date': v.created_date.isoformat() if v.created_date else None
                } 
                for v in created_valuations
            ]
        }
    }


def get_investment_change_history(db: Session, investment_id: int, days: int = 90) -> dict:
    """
    Get the change history for a specific investment
    Shows who created it, who has updated it, and related changes
    """
    since_date = datetime.utcnow() - timedelta(days=days)
    
    # Get the investment
    investment = db.query(models.Investment).filter(models.Investment.id == investment_id).first()
    if not investment:
        return {'error': 'Investment not found'}
    
    # Get related cashflow changes
    cashflow_changes = db.query(models.CashFlow).filter(
        and_(
            models.CashFlow.investment_id == investment_id,
            models.CashFlow.created_date >= since_date
        )
    ).order_by(desc(models.CashFlow.created_date)).all()
    
    # Get related valuation changes
    valuation_changes = db.query(models.Valuation).filter(
        and_(
            models.Valuation.investment_id == investment_id,
            models.Valuation.created_date >= since_date
        )
    ).order_by(desc(models.Valuation.created_date)).all()
    
    return {
        'investment_id': investment_id,
        'investment_name': investment.name,
        'period_days': days,
        'investment_audit': {
            'created_by': investment.created_by,
            'created_date': investment.created_date.isoformat() if investment.created_date else None,
            'last_updated_by': investment.updated_by,
            'last_updated_date': investment.updated_date.isoformat() if investment.updated_date else None
        },
        'recent_changes': {
            'cashflows_added': [
                {
                    'id': cf.id,
                    'type': cf.type,
                    'amount': cf.amount,
                    'date': cf.date.isoformat() if cf.date else None,
                    'created_by': cf.created_by,
                    'created_date': cf.created_date.isoformat() if cf.created_date else None
                }
                for cf in cashflow_changes
            ],
            'valuations_added': [
                {
                    'id': v.id,
                    'nav_value': v.nav_value,
                    'date': v.date.isoformat() if v.date else None,
                    'created_by': v.created_by,
                    'created_date': v.created_date.isoformat() if v.created_date else None
                }
                for v in valuation_changes
            ]
        },
        'summary': {
            'total_cashflow_changes': len(cashflow_changes),
            'total_valuation_changes': len(valuation_changes),
            'total_recent_activity': len(cashflow_changes) + len(valuation_changes)
        }
    }


def get_system_activity_summary(db: Session, days: int = 7) -> dict:
    """
    Get a summary of system-wide activity for the specified period
    Useful for family office oversight and compliance
    """
    since_date = datetime.utcnow() - timedelta(days=days)
    
    # Count new entities
    new_entities = db.query(models.Entity).filter(
        models.Entity.created_date >= since_date
    ).count()
    
    # Count new investments
    new_investments = db.query(models.Investment).filter(
        models.Investment.created_date >= since_date
    ).count()
    
    # Count new cashflows
    new_cashflows = db.query(models.CashFlow).filter(
        models.CashFlow.created_date >= since_date
    ).count()
    
    # Count new valuations
    new_valuations = db.query(models.Valuation).filter(
        models.Valuation.created_date >= since_date
    ).count()
    
    # Count entity updates
    entity_updates = db.query(models.Entity).filter(
        and_(
            models.Entity.updated_date >= since_date,
            models.Entity.created_date < since_date  # Don't count newly created ones
        )
    ).count()
    
    # Count investment updates
    investment_updates = db.query(models.Investment).filter(
        and_(
            models.Investment.updated_date >= since_date,
            models.Investment.created_date < since_date
        )
    ).count()
    
    # Get active users (those who have created or updated something)
    active_users_created = db.query(models.Entity.created_by).filter(
        and_(
            models.Entity.created_date >= since_date,
            models.Entity.created_by.isnot(None)
        )
    ).union(
        db.query(models.Investment.created_by).filter(
            and_(
                models.Investment.created_date >= since_date,
                models.Investment.created_by.isnot(None)
            )
        )
    ).union(
        db.query(models.CashFlow.created_by).filter(
            and_(
                models.CashFlow.created_date >= since_date,
                models.CashFlow.created_by.isnot(None)
            )
        )
    ).distinct().all()
    
    active_users_updated = db.query(models.Entity.updated_by).filter(
        and_(
            models.Entity.updated_date >= since_date,
            models.Entity.updated_by.isnot(None)
        )
    ).union(
        db.query(models.Investment.updated_by).filter(
            and_(
                models.Investment.updated_date >= since_date,
                models.Investment.updated_by.isnot(None)
            )
        )
    ).distinct().all()
    
    all_active_users = set()
    for user_tuple in active_users_created:
        if user_tuple[0]:
            all_active_users.add(user_tuple[0])
    for user_tuple in active_users_updated:
        if user_tuple[0]:
            all_active_users.add(user_tuple[0])
    
    return {
        'period_days': days,
        'period_start': since_date.isoformat(),
        'period_end': datetime.utcnow().isoformat(),
        'activity_summary': {
            'new_entities': new_entities,
            'new_investments': new_investments,
            'new_cashflows': new_cashflows,
            'new_valuations': new_valuations,
            'entity_updates': entity_updates,
            'investment_updates': investment_updates,
            'total_new_records': new_entities + new_investments + new_cashflows + new_valuations,
            'total_updates': entity_updates + investment_updates,
            'total_activity': (
                new_entities + new_investments + new_cashflows + new_valuations +
                entity_updates + investment_updates
            )
        },
        'user_activity': {
            'active_users': sorted(list(all_active_users)),
            'active_user_count': len(all_active_users)
        }
    }

# Market Benchmark CRUD operations
def get_market_benchmarks(db: Session, skip: int = 0, limit: int = 100, include_inactive: bool = False) -> List[MarketBenchmark]:
    """Get market benchmarks with optional pagination and filtering"""
    query = db.query(MarketBenchmark)
    
    if not include_inactive:
        query = query.filter(MarketBenchmark.is_active == True)
    
    return query.offset(skip).limit(limit).all()

def get_market_benchmark(db: Session, benchmark_id: int) -> Optional[MarketBenchmark]:
    """Get a single market benchmark by ID"""
    return db.query(MarketBenchmark).filter(MarketBenchmark.id == benchmark_id).first()

def get_market_benchmark_by_ticker(db: Session, ticker: str) -> Optional[MarketBenchmark]:
    """Get a market benchmark by ticker symbol"""
    return db.query(MarketBenchmark).filter(MarketBenchmark.ticker == ticker).first()

def create_market_benchmark(db: Session, benchmark: schemas.MarketBenchmarkCreate, current_user: str = "admin") -> MarketBenchmark:
    """Create a new market benchmark"""
    benchmark_data = benchmark.model_dump()
    db_benchmark = MarketBenchmark(**benchmark_data)
    db.add(db_benchmark)
    db.commit()
    db.refresh(db_benchmark)
    return db_benchmark

def update_market_benchmark(db: Session, benchmark_id: int, benchmark_update: schemas.MarketBenchmarkUpdate, current_user: str = "admin") -> Optional[MarketBenchmark]:
    """Update an existing market benchmark"""
    db_benchmark = db.query(MarketBenchmark).filter(MarketBenchmark.id == benchmark_id).first()
    if not db_benchmark:
        return None
    
    update_data = benchmark_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_benchmark, field, value)
    
    db.commit()
    db.refresh(db_benchmark)
    return db_benchmark

def delete_market_benchmark(db: Session, benchmark_id: int) -> bool:
    """Delete a market benchmark and all its returns"""
    db_benchmark = db.query(MarketBenchmark).filter(MarketBenchmark.id == benchmark_id).first()
    if db_benchmark:
        db.delete(db_benchmark)
        db.commit()
        return True
    return False

# Benchmark Return CRUD operations
def get_benchmark_returns(db: Session, benchmark_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[BenchmarkReturn]:
    """Get benchmark returns for a specific benchmark with optional date filtering"""
    query = db.query(BenchmarkReturn).filter(BenchmarkReturn.benchmark_id == benchmark_id)
    
    if start_date:
        query = query.filter(BenchmarkReturn.period_date >= start_date)
    if end_date:
        query = query.filter(BenchmarkReturn.period_date <= end_date)
    
    return query.order_by(BenchmarkReturn.period_date.desc()).all()

def get_benchmark_return(db: Session, return_id: int) -> Optional[BenchmarkReturn]:
    """Get a single benchmark return by ID"""
    return db.query(BenchmarkReturn).filter(BenchmarkReturn.id == return_id).first()

def create_benchmark_return(db: Session, return_data: schemas.BenchmarkReturnCreate, current_user: str = "admin") -> BenchmarkReturn:
    """Create a new benchmark return"""
    return_dict = return_data.model_dump()
    db_return = BenchmarkReturn(**return_dict)
    db.add(db_return)
    db.commit()
    db.refresh(db_return)
    return db_return

def update_benchmark_return(db: Session, return_id: int, return_update: schemas.BenchmarkReturnUpdate, current_user: str = "admin") -> Optional[BenchmarkReturn]:
    """Update an existing benchmark return"""
    db_return = db.query(BenchmarkReturn).filter(BenchmarkReturn.id == return_id).first()
    if not db_return:
        return None
    
    update_data = return_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_return, field, value)
    
    db.commit()
    db.refresh(db_return)
    return db_return

def delete_benchmark_return(db: Session, return_id: int) -> bool:
    """Delete a benchmark return"""
    db_return = db.query(BenchmarkReturn).filter(BenchmarkReturn.id == return_id).first()
    if db_return:
        db.delete(db_return)
        db.commit()
        return True
    return False

def bulk_create_benchmark_returns(db: Session, benchmark_id: int, returns_data: List[schemas.BenchmarkReturnImport], current_user: str = "admin") -> dict:
    """Bulk import benchmark returns from CSV data"""
    created_count = 0
    updated_count = 0
    error_count = 0
    errors = []
    
    for return_item in returns_data:
        try:
            # Check if return already exists for this period
            existing_return = db.query(BenchmarkReturn).filter(
                BenchmarkReturn.benchmark_id == benchmark_id,
                BenchmarkReturn.period_date == return_item.period_date
            ).first()
            
            if existing_return:
                # Update existing return
                existing_return.total_return = return_item.total_return / 100 if return_item.total_return else None  # Convert percentage to decimal
                existing_return.price_return = return_item.price_return / 100 if return_item.price_return else None
                existing_return.dividend_yield = return_item.dividend_yield / 100 if return_item.dividend_yield else None
                existing_return.notes = return_item.notes
                updated_count += 1
            else:
                # Create new return
                new_return = BenchmarkReturn(
                    benchmark_id=benchmark_id,
                    period_date=return_item.period_date,
                    total_return=return_item.total_return / 100 if return_item.total_return else None,  # Convert percentage to decimal
                    price_return=return_item.price_return / 100 if return_item.price_return else None,
                    dividend_yield=return_item.dividend_yield / 100 if return_item.dividend_yield else None,
                    notes=return_item.notes
                )
                db.add(new_return)
                created_count += 1
                
        except Exception as e:
            error_count += 1
            errors.append(f"Period {return_item.period_date}: {str(e)}")
    
    db.commit()
    
    return {
        'created_count': created_count,
        'updated_count': updated_count,
        'error_count': error_count,
        'errors': errors[:10]  # Return first 10 errors
    }