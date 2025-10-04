"""
Tenant-aware API routes for core application functionality

This router contains all the main CRUD operations for entities, investments,
cash flows, and valuations with proper tenant isolation.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from ..database import get_db
from ..auth import get_current_active_user, get_tenant_context, require_contributor
from ..models import User
from .. import models
from ..schemas import (
    Entity, EntityCreate, EntityUpdate, EntityWithMembers,
    Investment, InvestmentCreate, InvestmentUpdate,
    CashFlow, CashFlowCreate, Valuation, ValuationCreate,
    PortfolioPerformance, InvestmentPerformance, CommitmentVsCalledData, AssetAllocationData,
    VintageAllocationData, TimelineDataPoint, JCurveDataPoint, DashboardSummaryStats
)
from .. import crud_tenant
from .. import dashboard
from ..tenant_calendar_service import create_tenant_calendar_service

router = APIRouter(prefix="/api", tags=["Tenant API"])

# =============================================================================
# Entity Management Endpoints
# =============================================================================

@router.post("/entities", response_model=Entity)
def create_entity(
    entity: EntityCreate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Create a new entity"""
    return crud_tenant.create_entity(
        db=db,
        entity=entity,
        tenant_id=current_user.tenant_id,
        created_by_user_id=current_user.id
    )

@router.get("/entities", response_model=List[EntityWithMembers])
def read_entities(
    skip: int = 0,
    limit: int = 100,
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    search: Optional[str] = Query(None, description="Search entities by name"),
    include_inactive: bool = Query(False, description="Include inactive entities"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get entities with optional filtering"""
    if search:
        entities = crud_tenant.search_entities(
            db=db,
            tenant_id=current_user.tenant_id,
            search_term=search,
            skip=skip,
            limit=limit
        )
    elif entity_type:
        entities = crud_tenant.get_entities_by_type(
            db=db,
            tenant_id=current_user.tenant_id,
            entity_type=entity_type,
            skip=skip,
            limit=limit
        )
    else:
        entities = crud_tenant.get_entities(
            db=db,
            tenant_id=current_user.tenant_id,
            skip=skip,
            limit=limit,
            include_inactive=include_inactive
        )

    # Convert to EntityWithMembers schema with investment stats
    result = []
    for entity in entities:
        investments = crud_tenant.get_investments_by_entity(
            db=db, entity_id=entity.id, tenant_id=current_user.tenant_id
        )
        investment_count = len(investments)
        total_commitment = sum(inv.commitment_amount for inv in investments)

        entity_dict = {
            **entity.__dict__,
            "investment_count": investment_count,
            "total_commitment": total_commitment
        }
        result.append(EntityWithMembers.model_validate(entity_dict))

    return result

@router.get("/entities/{entity_id}", response_model=EntityWithMembers)
def read_entity(
    entity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific entity"""
    entity = crud_tenant.get_entity(db, entity_id, current_user.tenant_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Add investment stats
    investments = crud_tenant.get_investments_by_entity(
        db=db, entity_id=entity.id, tenant_id=current_user.tenant_id
    )
    investment_count = len(investments)
    total_commitment = sum(inv.commitment_amount for inv in investments)

    entity_dict = {
        **entity.__dict__,
        "investment_count": investment_count,
        "total_commitment": total_commitment
    }

    return EntityWithMembers.model_validate(entity_dict)

@router.put("/entities/{entity_id}", response_model=Entity)
def update_entity(
    entity_id: int,
    entity_update: EntityUpdate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Update an entity"""
    updated_entity = crud_tenant.update_entity(
        db=db,
        entity_id=entity_id,
        tenant_id=current_user.tenant_id,
        entity_update=entity_update,
        updated_by_user_id=current_user.id
    )

    if updated_entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")

    return updated_entity

# =============================================================================
# Investment Management Endpoints
# =============================================================================

@router.post("/investments", response_model=Investment)
def create_investment(
    investment: InvestmentCreate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Create a new investment"""
    # Verify that the entity belongs to the same tenant
    entity = crud_tenant.get_entity(db, investment.entity_id, current_user.tenant_id)
    if not entity:
        raise HTTPException(status_code=400, detail="Entity not found or not accessible")

    return crud_tenant.create_investment(
        db=db,
        investment=investment,
        tenant_id=current_user.tenant_id,
        created_by_user_id=current_user.id
    )

@router.get("/investments", response_model=List[Investment])
def read_investments(
    skip: int = 0,
    limit: int = 1000,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get investments"""
    return crud_tenant.get_investments(
        db=db,
        tenant_id=current_user.tenant_id,
        skip=skip,
        limit=limit
    )

@router.get("/investments/{investment_id}", response_model=Investment)
def read_investment(
    investment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific investment"""
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    return investment

@router.put("/investments/{investment_id}", response_model=Investment)
def update_investment(
    investment_id: int,
    investment_update: InvestmentUpdate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Update an investment"""
    # If entity_id is being updated, verify the new entity belongs to the same tenant
    if hasattr(investment_update, 'entity_id') and investment_update.entity_id:
        entity = crud_tenant.get_entity(db, investment_update.entity_id, current_user.tenant_id)
        if not entity:
            raise HTTPException(status_code=400, detail="Entity not found or not accessible")

    updated_investment = crud_tenant.update_investment(
        db=db,
        investment_id=investment_id,
        tenant_id=current_user.tenant_id,
        investment_update=investment_update,
        updated_by_user_id=current_user.id
    )

    if updated_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")

    return updated_investment

@router.get("/investments/entity/{entity_id}", response_model=List[Investment])
def read_investments_by_entity(
    entity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get investments for a specific entity"""
    # Verify entity belongs to the same tenant
    entity = crud_tenant.get_entity(db, entity_id, current_user.tenant_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    return crud_tenant.get_investments_by_entity(
        db=db, entity_id=entity_id, tenant_id=current_user.tenant_id
    )

@router.get("/investments/{investment_id}/performance", response_model=InvestmentPerformance)
def get_investment_performance(
    investment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get performance metrics for a specific investment"""
    try:
        performance = crud_tenant.get_investment_performance(
            db=db, tenant_id=current_user.tenant_id, investment_id=investment_id
        )
        if performance is None:
            raise HTTPException(status_code=404, detail="Investment not found")
        return performance
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Performance endpoint error: {error_traceback}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving investment performance: {str(e)} | {type(e).__name__}"
        )

@router.get("/investments/{investment_id}/cashflows", response_model=List[CashFlow])
def get_investment_cashflows(
    investment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get cash flows for a specific investment"""
    # First verify the investment exists and belongs to the user's tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    # Get cash flows for this investment
    cashflows = db.query(models.CashFlow).filter(
        models.CashFlow.investment_id == investment_id
    ).all()

    return cashflows

@router.get("/investments/{investment_id}/valuations", response_model=List[Valuation])
def get_investment_valuations(
    investment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get valuations for a specific investment"""
    # First verify the investment exists and belongs to the user's tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    # Get valuations for this investment
    valuations = db.query(models.Valuation).filter(
        models.Valuation.investment_id == investment_id
    ).all()

    return valuations

# =============================================================================
# Cash Flow Management Endpoints
# =============================================================================

@router.post("/cashflows", response_model=CashFlow)
def create_cashflow(
    cashflow: CashFlowCreate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Create a new cash flow"""
    # Verify that the investment belongs to the same tenant
    investment = crud_tenant.get_investment(db, cashflow.investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=400, detail="Investment not found or not accessible")

    return crud_tenant.create_cashflow(
        db=db,
        cashflow=cashflow,
        tenant_id=current_user.tenant_id,
        created_by_user_id=current_user.id
    )

@router.get("/cashflows", response_model=List[CashFlow])
def read_cashflows(
    investment_id: Optional[int] = Query(None, description="Filter by investment"),
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get cash flows with optional filtering"""
    # If investment_id is specified, verify it belongs to the same tenant
    if investment_id:
        investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
        if not investment:
            raise HTTPException(status_code=400, detail="Investment not found or not accessible")

    return crud_tenant.get_cashflows(
        db=db,
        tenant_id=current_user.tenant_id,
        investment_id=investment_id,
        start_date=start_date,
        end_date=end_date
    )

# =============================================================================
# Valuation Management Endpoints
# =============================================================================

@router.post("/valuations", response_model=Valuation)
def create_valuation(
    valuation: ValuationCreate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Create a new valuation"""
    # Verify that the investment belongs to the same tenant
    investment = crud_tenant.get_investment(db, valuation.investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=400, detail="Investment not found or not accessible")

    return crud_tenant.create_valuation(
        db=db,
        valuation=valuation,
        tenant_id=current_user.tenant_id,
        created_by_user_id=current_user.id
    )

@router.get("/valuations", response_model=List[Valuation])
def read_valuations(
    investment_id: Optional[int] = Query(None, description="Filter by investment"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get valuations with optional filtering"""
    # If investment_id is specified, verify it belongs to the same tenant
    if investment_id:
        investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
        if not investment:
            raise HTTPException(status_code=400, detail="Investment not found or not accessible")

    return crud_tenant.get_valuations(
        db=db,
        tenant_id=current_user.tenant_id,
        investment_id=investment_id
    )

# =============================================================================
# Dashboard Endpoints
# =============================================================================

@router.get("/dashboard/summary")
def get_dashboard_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get dashboard summary for the current tenant"""
    from .. import dashboard

    # Get all investments for the tenant
    investments = crud_tenant.get_investments(db, current_user.tenant_id)

    # Calculate portfolio summary using existing dashboard logic
    # This will automatically be filtered to the tenant's investments
    try:
        summary = dashboard.calculate_portfolio_summary(investments)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating portfolio summary: {str(e)}")

@router.get("/dashboard/asset-class-breakdown")
def get_asset_class_breakdown(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get asset class breakdown for the current tenant"""
    from .. import dashboard

    investments = crud_tenant.get_investments(db, current_user.tenant_id)

    try:
        breakdown = dashboard.calculate_asset_class_breakdown(investments)
        return breakdown
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating asset class breakdown: {str(e)}")

@router.get("/dashboard/entity-breakdown")
def get_entity_breakdown(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get entity breakdown for the current tenant"""
    from .. import dashboard

    investments = crud_tenant.get_investments(db, current_user.tenant_id)

    try:
        breakdown = dashboard.calculate_entity_breakdown(investments)
        return breakdown
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating entity breakdown: {str(e)}")

# =============================================================================
# Utility Endpoints
# =============================================================================

@router.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "tenant_isolation": "enabled"}

@router.get("/tenant/stats")
def get_tenant_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get statistics for the current tenant"""
    return crud_tenant.get_tenant_stats(db, current_user.tenant_id)

@router.get("/portfolio/performance", response_model=PortfolioPerformance)
def get_portfolio_performance(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get portfolio performance metrics for the current tenant"""
    return crud_tenant.get_portfolio_performance(db, current_user.tenant_id)

# =============================================================================
# Dashboard Endpoints (Tenant-Aware)
# =============================================================================

@router.get("/dashboard/commitment-vs-called", response_model=CommitmentVsCalledData)
def get_commitment_vs_called_data(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get commitment vs called data for the current tenant"""
    # Get tenant investments and calculate manually to ensure tenant isolation
    investments = crud_tenant.get_investments(db, current_user.tenant_id)

    total_commitment = sum(inv.commitment_amount for inv in investments)
    total_called = sum(inv.called_amount for inv in investments)
    total_uncalled = total_commitment - total_called

    return CommitmentVsCalledData(
        commitment_amount=total_commitment,
        called_amount=total_called,
        uncalled_amount=total_uncalled
    )

@router.get("/dashboard/allocation-by-asset-class", response_model=List[AssetAllocationData])
def get_allocation_by_asset_class(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get asset class allocation for the current tenant"""
    from collections import defaultdict

    investments = crud_tenant.get_investments(db, current_user.tenant_id)

    if not investments:
        return []

    # Group by asset class
    asset_class_data = defaultdict(lambda: {"commitment": 0, "count": 0})
    total_commitment = 0

    for inv in investments:
        asset_class_data[inv.asset_class]["commitment"] += inv.commitment_amount
        asset_class_data[inv.asset_class]["count"] += 1
        total_commitment += inv.commitment_amount

    # Convert to list with percentages
    result = []
    for asset_class, data in asset_class_data.items():
        percentage = (data["commitment"] / total_commitment * 100) if total_commitment > 0 else 0
        result.append(AssetAllocationData(
            asset_class=asset_class,
            commitment_amount=data["commitment"],
            percentage=percentage,
            count=data["count"]
        ))

    # Sort by commitment amount (largest first)
    result.sort(key=lambda x: x.commitment_amount, reverse=True)
    return result

@router.get("/dashboard/allocation-by-vintage", response_model=List[VintageAllocationData])
def get_allocation_by_vintage(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get vintage year allocation for the current tenant"""
    from collections import defaultdict

    investments = crud_tenant.get_investments(db, current_user.tenant_id)

    if not investments:
        return []

    # Group by vintage year
    vintage_data = defaultdict(lambda: {"commitment": 0, "count": 0})
    total_commitment = 0

    for inv in investments:
        vintage_data[inv.vintage_year]["commitment"] += inv.commitment_amount
        vintage_data[inv.vintage_year]["count"] += 1
        total_commitment += inv.commitment_amount

    # Convert to list with percentages
    result = []
    for vintage_year, data in vintage_data.items():
        percentage = (data["commitment"] / total_commitment * 100) if total_commitment > 0 else 0
        result.append(VintageAllocationData(
            vintage_year=vintage_year,
            commitment_amount=data["commitment"],
            percentage=percentage,
            count=data["count"]
        ))

    # Sort by vintage year
    result.sort(key=lambda x: x.vintage_year)
    return result

@router.get("/dashboard/portfolio-value-timeline", response_model=List[TimelineDataPoint])
def get_portfolio_value_timeline(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get portfolio value timeline for the current tenant"""
    # For now, return empty list - this is a complex calculation
    # TODO: Implement tenant-aware timeline calculation
    return []

@router.get("/dashboard/j-curve-data", response_model=List[JCurveDataPoint])
def get_j_curve_data(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get J-curve data for the current tenant"""
    # For now, return empty list - this is a complex calculation
    # TODO: Implement tenant-aware J-curve calculation
    return []

@router.get("/dashboard/summary-stats", response_model=DashboardSummaryStats)
def get_dashboard_summary_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get dashboard summary statistics for the current tenant"""
    investments = crud_tenant.get_investments(db, current_user.tenant_id)

    # Calculate NAV and distributions from valuations and cash flows
    total_nav = 0.0
    total_distributions = 0.0
    active_investments = 0
    asset_classes = set()
    vintage_years = set()

    for investment in investments:
        # Get latest valuation for NAV
        if investment.valuations:
            latest_valuation = max(investment.valuations, key=lambda v: v.date)
            total_nav += latest_valuation.nav_value

        # Count distributions from cash flows
        distributions = [cf for cf in investment.cashflows
                        if cf.type in [models.CashFlowType.DISTRIBUTION,
                                     models.CashFlowType.YIELD,
                                     models.CashFlowType.RETURN_OF_PRINCIPAL]]
        total_distributions += sum(cf.amount for cf in distributions)

        # Track asset classes and vintage years
        asset_classes.add(investment.asset_class)
        vintage_years.add(investment.vintage_year)

        # Count as active if it has valuations or cash flows
        if investment.valuations or investment.cashflows:
            active_investments += 1

    return DashboardSummaryStats(
        total_investments=len(investments),
        total_commitment=sum(inv.commitment_amount for inv in investments),
        total_called=sum(inv.called_amount for inv in investments),
        total_nav=total_nav,
        total_distributions=total_distributions,
        asset_classes=len(asset_classes),
        vintage_years=len(vintage_years),
        active_investments=active_investments
    )

# =============================================================================
# Calendar Endpoints (Tenant-Aware)
# =============================================================================

@router.get("/calendar/cash-flows")
def get_calendar_cash_flows(
    start: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end: date = Query(..., description="End date (YYYY-MM-DD)"),
    include_forecasts: bool = Query(True, description="Include forecast cash flows"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get daily cash flow data for calendar view with tenant filtering"""
    try:
        calendar_service = create_tenant_calendar_service(db, current_user.tenant_id)
        daily_flows = calendar_service.get_daily_cash_flows(start, end, include_forecasts)

        # Convert to JSON-serializable format
        return [
            {
                "date": df.date.isoformat(),
                "total_inflows": df.total_inflows,
                "total_outflows": df.total_outflows,
                "net_flow": df.net_flow,
                "transaction_count": df.transaction_count,
                "transactions": df.transactions
            }
            for df in daily_flows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving calendar data: {str(e)}")

@router.get("/calendar/monthly-summary/{year}/{month}")
def get_calendar_monthly_summary(
    year: int,
    month: int,
    include_forecasts: bool = Query(True, description="Include forecast cash flows"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get complete monthly calendar with cash flow data"""
    try:
        if not (1 <= month <= 12):
            raise HTTPException(status_code=400, detail="Month must be between 1 and 12")

        calendar_service = create_tenant_calendar_service(db, current_user.tenant_id)
        monthly_calendar = calendar_service.get_monthly_calendar(year, month, include_forecasts)

        return {
            "year": monthly_calendar.year,
            "month": monthly_calendar.month,
            "month_name": monthly_calendar.month_name,
            "previous_month": {
                "year": monthly_calendar.previous_month[0],
                "month": monthly_calendar.previous_month[1]
            },
            "next_month": {
                "year": monthly_calendar.next_month[0],
                "month": monthly_calendar.next_month[1]
            },
            "period_summary": {
                "start_date": monthly_calendar.period_summary.start_date.isoformat(),
                "end_date": monthly_calendar.period_summary.end_date.isoformat(),
                "total_inflows": monthly_calendar.period_summary.total_inflows,
                "total_outflows": monthly_calendar.period_summary.total_outflows,
                "net_flow": monthly_calendar.period_summary.net_flow,
                "active_days": monthly_calendar.period_summary.active_days,
                "total_transactions": monthly_calendar.period_summary.total_transactions,
                "largest_single_day": monthly_calendar.period_summary.largest_single_day,
                "largest_single_day_date": monthly_calendar.period_summary.largest_single_day_date.isoformat() if monthly_calendar.period_summary.largest_single_day_date else None,
                "most_active_day": monthly_calendar.period_summary.most_active_day.isoformat() if monthly_calendar.period_summary.most_active_day else None,
                "most_active_day_count": monthly_calendar.period_summary.most_active_day_count
            },
            "daily_flows": [
                {
                    "date": df.date.isoformat(),
                    "day": df.date.day,
                    "total_inflows": df.total_inflows,
                    "total_outflows": df.total_outflows,
                    "net_flow": df.net_flow,
                    "transaction_count": df.transaction_count,
                    "transactions": df.transactions
                }
                for df in monthly_calendar.daily_flows
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving monthly calendar: {str(e)}")

@router.get("/calendar/period-summary")
def get_calendar_period_summary(
    start: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end: date = Query(..., description="End date (YYYY-MM-DD)"),
    include_forecasts: bool = Query(True, description="Include forecast cash flows"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get period summary for specified date range"""
    try:
        if start > end:
            raise HTTPException(status_code=400, detail="Start date must be before or equal to end date")

        calendar_service = create_tenant_calendar_service(db, current_user.tenant_id)
        summary = calendar_service.get_period_summary(start, end, include_forecasts)

        return {
            "start_date": summary.start_date.isoformat(),
            "end_date": summary.end_date.isoformat(),
            "total_inflows": summary.total_inflows,
            "total_outflows": summary.total_outflows,
            "net_flow": summary.net_flow,
            "active_days": summary.active_days,
            "total_transactions": summary.total_transactions,
            "largest_single_day": summary.largest_single_day,
            "largest_single_day_date": summary.largest_single_day_date.isoformat() if summary.largest_single_day_date else None,
            "most_active_day": summary.most_active_day.isoformat() if summary.most_active_day else None,
            "most_active_day_count": summary.most_active_day_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving period summary: {str(e)}")

@router.get("/calendar/quarterly-summary/{year}/{quarter}")
def get_calendar_quarterly_summary(
    year: int,
    quarter: int,
    include_forecasts: bool = Query(True, description="Include forecast cash flows"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get quarterly summary for specified quarter"""
    try:
        if not (1 <= quarter <= 4):
            raise HTTPException(status_code=400, detail="Quarter must be between 1 and 4")

        calendar_service = create_tenant_calendar_service(db, current_user.tenant_id)
        summary = calendar_service.get_quarterly_summary(year, quarter, include_forecasts)

        return {
            "year": year,
            "quarter": quarter,
            "start_date": summary.start_date.isoformat(),
            "end_date": summary.end_date.isoformat(),
            "total_inflows": summary.total_inflows,
            "total_outflows": summary.total_outflows,
            "net_flow": summary.net_flow,
            "active_days": summary.active_days,
            "total_transactions": summary.total_transactions,
            "largest_single_day": summary.largest_single_day,
            "largest_single_day_date": summary.largest_single_day_date.isoformat() if summary.largest_single_day_date else None,
            "most_active_day": summary.most_active_day.isoformat() if summary.most_active_day else None,
            "most_active_day_count": summary.most_active_day_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving quarterly summary: {str(e)}")

@router.get("/calendar/heatmap/{year}/{month}")
def get_calendar_heatmap(
    year: int,
    month: int,
    include_forecasts: bool = Query(True, description="Include forecast cash flows"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get heat map data for calendar visualization"""
    try:
        if not (1 <= month <= 12):
            raise HTTPException(status_code=400, detail="Month must be between 1 and 12")

        calendar_service = create_tenant_calendar_service(db, current_user.tenant_id)
        heatmap_data = calendar_service.get_cash_flow_heatmap_data(year, month, include_forecasts)

        return heatmap_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving heatmap data: {str(e)}")