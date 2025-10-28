"""
Tenant-aware API routes for core application functionality

This router contains all the main CRUD operations for entities, investments,
cash flows, and valuations with proper tenant isolation.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta
from uuid import UUID

from ..database import get_db
from ..auth import get_current_active_user, get_tenant_context, require_contributor
from ..models import User
from .. import models
from ..schemas import (
    Entity, EntityCreate, EntityUpdate, EntityWithMembers,
    Investment, InvestmentCreate, InvestmentUpdate,
    CashFlow, CashFlowCreate, CashFlowUpdate, Valuation, ValuationCreate, ValuationUpdate,
    PortfolioPerformance, InvestmentPerformance, CommitmentVsCalledData, AssetAllocationData,
    VintageAllocationData, TimelineDataPoint, JCurveDataPoint, DashboardSummaryStats,
    EntityRelationship, EntityRelationshipCreate, EntityRelationshipUpdate, EntityRelationshipWithEntities
)
from .. import crud_tenant
from .. import dashboard
from ..tenant_calendar_service import create_tenant_calendar_service
from ..tenant_unified_forecast_service import create_tenant_unified_forecast_service
from ..models import ForecastScenario

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
    entity_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific entity by ID or UUID"""
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
    entity_id: str,
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
    """Get investments with LP data isolation"""
    # For LP_CLIENT users, only return investments for their associated entity
    if current_user.role == models.UserRole.LP_CLIENT:
        if not current_user.entity_id:
            # LP user with no entity association sees nothing
            return []
        return crud_tenant.get_investments_by_entity(
            db=db,
            entity_id=current_user.entity_id,
            tenant_id=current_user.tenant_id
        )

    # For all other users, return all tenant investments
    return crud_tenant.get_investments(
        db=db,
        tenant_id=current_user.tenant_id,
        skip=skip,
        limit=limit
    )

@router.get("/investments/{investment_id}", response_model=Investment)
def read_investment(
    investment_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific investment by ID or UUID with LP data isolation"""
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")

    # LP data isolation: verify LP user can only access their entity's investments
    if current_user.role == models.UserRole.LP_CLIENT:
        if not current_user.entity_id or investment.entity_id != current_user.entity_id:
            raise HTTPException(status_code=404, detail="Investment not found")

    return investment

@router.put("/investments/{investment_id}", response_model=Investment)
def update_investment(
    investment_id: str,
    investment_update: InvestmentUpdate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Update an investment by ID or UUID"""
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
    entity_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get investments for a specific entity by ID or UUID with LP data isolation"""
    # Verify entity belongs to the same tenant
    entity = crud_tenant.get_entity(db, entity_id, current_user.tenant_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # LP data isolation: LP users can only access their own entity
    if current_user.role == models.UserRole.LP_CLIENT:
        if not current_user.entity_id or str(entity.id) != str(entity_id):
            raise HTTPException(status_code=404, detail="Entity not found")

    return crud_tenant.get_investments_by_entity(
        db=db, entity_id=entity_id, tenant_id=current_user.tenant_id
    )

@router.put("/investments/{investment_id}/pacing-inputs", response_model=Investment)
def update_pacing_inputs(
    investment_id: str,
    pacing_inputs: dict,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """
    Update pacing model parameters for an investment.

    Accepts a dict with any of these fields:
    - pacing_pattern: PacingPattern enum value
    - target_irr: float (0.0 to 1.0)
    - target_moic: float
    - fund_life: int (years)
    - investment_period: int (years)
    - bow_factor: float (0.1 to 0.5)
    - call_schedule: 'Front Loaded' | 'Steady' | 'Back Loaded'
    - distribution_timing: 'Early' | 'Backend' | 'Steady'
    - forecast_enabled: bool
    """
    # Verify investment belongs to tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    # Create InvestmentUpdate with the pacing inputs
    update_data = InvestmentUpdate(**pacing_inputs)

    updated_investment = crud_tenant.update_investment(
        db=db,
        investment_id=investment_id,
        tenant_id=current_user.tenant_id,
        investment_update=update_data,
        updated_by_user_id=current_user.id
    )

    if updated_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")

    return updated_investment

@router.post("/investments/{investment_id}/forecast")
def generate_forecast(
    investment_id: str,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """
    Generate cash flow forecasts for an investment using the pacing model.

    Generates BASE, BULL, and BEAR scenario forecasts based on the investment's
    pacing model parameters (pattern, MOIC, IRR, fund life, etc.)
    """
    # Verify investment belongs to tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    try:
        from ..pacing_model import create_pacing_model_engine

        # Create pacing model engine
        engine = create_pacing_model_engine(db)

        # Update forecasts for all scenarios
        success = engine.update_investment_forecast(investment.id)

        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate forecast. Ensure forecast is enabled and all required parameters are set."
            )

        return {
            "message": "Forecast generated successfully",
            "investment_id": investment_id,
            "last_forecast_date": datetime.utcnow().isoformat()
        }

    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Forecast generation error: {error_traceback}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating forecast: {str(e)}"
        )

@router.get("/investments/{investment_id}/forecast")
def get_forecast(
    investment_id: str,
    scenario: str = Query("BASE", description="Forecast scenario (BASE, BULL, BEAR)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get generated forecasts for an investment.

    Returns the most recent forecast data for the specified scenario.
    """
    # Verify investment belongs to tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    # LP data isolation: verify LP user can only access their entity's investments
    if current_user.role == models.UserRole.LP_CLIENT:
        if not current_user.entity_id or investment.entity_id != current_user.entity_id:
            raise HTTPException(status_code=404, detail="Investment not found")

    try:
        # Validate and convert scenario string to enum
        try:
            forecast_scenario = ForecastScenario[scenario.upper()]
        except KeyError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid scenario: {scenario}. Valid options: BASE, BULL, BEAR"
            )

        # Query forecasts
        forecasts = db.query(models.CashFlowForecast).filter(
            models.CashFlowForecast.investment_id == investment.id,
            models.CashFlowForecast.scenario == forecast_scenario
        ).order_by(models.CashFlowForecast.forecast_year).all()

        if not forecasts:
            raise HTTPException(
                status_code=404,
                detail="No forecasts found for this investment. Generate forecasts first."
            )

        # Format response
        return {
            "investment_id": investment_id,
            "investment_name": investment.name,
            "scenario": scenario,
            "last_forecast_date": investment.last_forecast_date.isoformat() if investment.last_forecast_date else None,
            "forecasts": [
                {
                    "forecast_year": f.forecast_year,
                    "period_start": f.forecast_period_start.isoformat(),
                    "period_end": f.forecast_period_end.isoformat(),
                    "projected_calls": f.projected_calls,
                    "projected_distributions": f.projected_distributions,
                    "projected_nav": f.projected_nav,
                    "cumulative_calls": f.cumulative_calls,
                    "cumulative_distributions": f.cumulative_distributions,
                    "cumulative_net_cf": f.cumulative_net_cf,
                    "confidence_level": f.confidence_level
                }
                for f in forecasts
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Forecast retrieval error: {error_traceback}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving forecast: {str(e)}"
        )

@router.get("/investments/{investment_id}/performance", response_model=InvestmentPerformance)
def get_investment_performance(
    investment_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get performance metrics for a specific investment by ID or UUID with LP data isolation"""
    try:
        # First get the investment to check ownership
        investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
        if investment is None:
            raise HTTPException(status_code=404, detail="Investment not found")

        # LP data isolation: verify LP user can only access their entity's investments
        if current_user.role == models.UserRole.LP_CLIENT:
            if not current_user.entity_id or investment.entity_id != current_user.entity_id:
                raise HTTPException(status_code=404, detail="Investment not found")

        performance = crud_tenant.get_investment_performance(
            db=db, tenant_id=current_user.tenant_id, investment_id=investment_id
        )
        if performance is None:
            raise HTTPException(status_code=404, detail="Investment not found")
        return performance
    except HTTPException:
        raise
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
    investment_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get cash flows for a specific investment by ID or UUID with LP data isolation"""
    # First verify the investment exists and belongs to the user's tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    # LP data isolation: verify LP user can only access their entity's investments
    if current_user.role == models.UserRole.LP_CLIENT:
        if not current_user.entity_id or investment.entity_id != current_user.entity_id:
            raise HTTPException(status_code=404, detail="Investment not found")

    # Get cash flows for this investment
    cashflows = db.query(models.CashFlow).filter(
        models.CashFlow.investment_id == investment_id
    ).all()

    return cashflows

@router.post("/investments/{investment_id}/cashflows", response_model=CashFlow)
def create_investment_cashflow(
    investment_id: str,
    cashflow: CashFlowCreate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Create a new cash flow for a specific investment by ID or UUID"""
    # Verify investment belongs to tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    # Create cashflow data dict and add investment_id (use integer ID from resolved investment)
    cashflow_data = cashflow.model_dump()
    cashflow_data.update({
        "investment_id": investment.id,
        "tenant_id": current_user.tenant_id,
        "created_by_user_id": current_user.id,
        "updated_by_user_id": current_user.id,
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow()
    })

    db_cashflow = models.CashFlow(**cashflow_data)
    db.add(db_cashflow)
    db.commit()
    db.refresh(db_cashflow)

    # Update investment summary fields (called_amount, fees) after adding cash flow
    crud_tenant.update_investment_summary_fields(db, investment.id, current_user.tenant_id)

    return db_cashflow

@router.put("/investments/{investment_id}/cashflows/{cashflow_id}", response_model=CashFlow)
def update_investment_cashflow(
    investment_id: str,
    cashflow_id: str,
    cashflow_update: CashFlowUpdate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Update a cash flow for a specific investment by ID or UUID"""
    # Verify investment belongs to tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    updated_cashflow = crud_tenant.update_cashflow(
        db=db,
        cashflow_id=cashflow_id,
        tenant_id=current_user.tenant_id,
        cashflow_update=cashflow_update,
        updated_by_user_id=current_user.id
    )

    if not updated_cashflow:
        raise HTTPException(status_code=404, detail="Cash flow not found")

    return updated_cashflow

@router.delete("/investments/{investment_id}/cashflows/{cashflow_id}")
def delete_investment_cashflow(
    investment_id: str,
    cashflow_id: str,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Delete a cash flow for a specific investment by ID or UUID"""
    # Verify investment belongs to tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    success = crud_tenant.delete_cashflow(
        db=db,
        cashflow_id=cashflow_id,
        tenant_id=current_user.tenant_id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Cash flow not found")

    return {"message": "Cash flow deleted successfully"}

@router.get("/investments/{investment_id}/valuations", response_model=List[Valuation])
def get_investment_valuations(
    investment_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get valuations for a specific investment by ID or UUID with LP data isolation"""
    # First verify the investment exists and belongs to the user's tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    # LP data isolation: verify LP user can only access their entity's investments
    if current_user.role == models.UserRole.LP_CLIENT:
        if not current_user.entity_id or investment.entity_id != current_user.entity_id:
            raise HTTPException(status_code=404, detail="Investment not found")

    # Get valuations for this investment
    valuations = db.query(models.Valuation).filter(
        models.Valuation.investment_id == investment_id
    ).all()

    return valuations

@router.post("/investments/{investment_id}/valuations", response_model=Valuation)
def create_investment_valuation(
    investment_id: str,
    valuation: ValuationCreate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Create a new valuation for a specific investment by ID or UUID"""
    # Verify investment belongs to tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    # Create valuation data dict and add investment_id (use integer ID from resolved investment)
    valuation_data = valuation.model_dump()
    valuation_data.update({
        "investment_id": investment.id,
        "tenant_id": current_user.tenant_id,
        "created_by_user_id": current_user.id,
        "updated_by_user_id": current_user.id,
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow()
    })

    db_valuation = models.Valuation(**valuation_data)
    db.add(db_valuation)
    db.commit()
    db.refresh(db_valuation)
    return db_valuation

@router.put("/investments/{investment_id}/valuations/{valuation_id}", response_model=Valuation)
def update_investment_valuation(
    investment_id: str,
    valuation_id: str,
    valuation_update: ValuationUpdate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Update a valuation for a specific investment by ID or UUID"""
    # Verify investment belongs to tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    updated_valuation = crud_tenant.update_valuation(
        db=db,
        valuation_id=valuation_id,
        tenant_id=current_user.tenant_id,
        valuation_update=valuation_update,
        updated_by_user_id=current_user.id
    )

    if not updated_valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")

    return updated_valuation

@router.delete("/investments/{investment_id}/valuations/{valuation_id}")
def delete_investment_valuation(
    investment_id: str,
    valuation_id: str,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Delete a valuation for a specific investment by ID or UUID"""
    # Verify investment belongs to tenant
    investment = crud_tenant.get_investment(db, investment_id, current_user.tenant_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    success = crud_tenant.delete_valuation(
        db=db,
        valuation_id=valuation_id,
        tenant_id=current_user.tenant_id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Valuation not found")

    return {"message": "Valuation deleted successfully"}

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

def _get_user_investments(db: Session, current_user: User):
    """Helper function to get investments with LP data isolation"""
    if current_user.role == models.UserRole.LP_CLIENT:
        if not current_user.entity_id:
            return []
        return crud_tenant.get_investments_by_entity(
            db=db,
            entity_id=current_user.entity_id,
            tenant_id=current_user.tenant_id
        )
    return crud_tenant.get_investments(db, current_user.tenant_id)

@router.get("/dashboard/summary")
def get_dashboard_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get dashboard summary for the current tenant with LP data isolation"""
    from .. import dashboard

    # Get investments with LP data isolation
    investments = _get_user_investments(db, current_user)

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
    """Get asset class breakdown for the current tenant with LP data isolation"""
    from .. import dashboard

    investments = _get_user_investments(db, current_user)

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
    """Get entity breakdown for the current tenant with LP data isolation"""
    from .. import dashboard

    investments = _get_user_investments(db, current_user)

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
    """Get commitment vs called data for the current tenant with LP data isolation"""
    # Get investments with LP data isolation
    investments = _get_user_investments(db, current_user)

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
    """Get asset class allocation for the current tenant with LP data isolation"""
    from collections import defaultdict

    investments = _get_user_investments(db, current_user)

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
    """Get vintage year allocation for the current tenant with LP data isolation"""
    from collections import defaultdict

    investments = _get_user_investments(db, current_user)

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
    """Get portfolio value timeline for the current tenant with LP data isolation"""
    from datetime import date, timedelta
    from collections import defaultdict

    investments = _get_user_investments(db, current_user)

    if not investments:
        return []

    # Collect all dates where we have data points (valuations and cash flows)
    date_points = set()
    today = date.today()

    for investment in investments:
        # Add valuation dates
        for val in investment.valuations:
            if val.date <= today:
                date_points.add(val.date)

        # Add cash flow dates
        for cf in investment.cashflows:
            if cf.date <= today:
                date_points.add(cf.date)

    if not date_points:
        return []

    # Sort dates
    sorted_dates = sorted(date_points)

    # Calculate cumulative values for each date
    timeline_data = []

    for current_date in sorted_dates:
        cumulative_contributions = 0
        cumulative_distributions = 0
        nav_value = 0

        for investment in investments:
            # Sum all contributions up to this date
            for cf in investment.cashflows:
                if cf.date <= current_date:
                    if cf.type in ['Capital Call', 'Contribution']:
                        cumulative_contributions += abs(cf.amount)
                    elif cf.type in [models.CashFlowType.DISTRIBUTION,
                                   models.CashFlowType.YIELD,
                                   models.CashFlowType.RETURN_OF_PRINCIPAL]:
                        cumulative_distributions += cf.amount

            # Get NAV as of this date (use most recent valuation up to this date)
            relevant_valuations = [v for v in investment.valuations if v.date <= current_date]
            if relevant_valuations:
                latest_val = max(relevant_valuations, key=lambda v: v.date)
                nav_value += latest_val.nav_value

        # Calculate net value (NAV + cumulative distributions)
        net_value = nav_value + cumulative_distributions

        timeline_data.append(TimelineDataPoint(
            date=current_date.isoformat(),
            nav_value=nav_value,
            cumulative_contributions=cumulative_contributions,
            cumulative_distributions=cumulative_distributions,
            net_value=net_value
        ))

    return timeline_data

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
    """Get dashboard summary statistics for the current tenant with LP data isolation"""
    investments = _get_user_investments(db, current_user)

    # Calculate NAV and distributions from valuations and cash flows
    from datetime import date
    today = date.today()

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

        # Count distributions from cash flows - ONLY actual distributions through today
        distributions = [cf for cf in investment.cashflows
                        if cf.type in [models.CashFlowType.DISTRIBUTION,
                                     models.CashFlowType.YIELD,
                                     models.CashFlowType.RETURN_OF_PRINCIPAL]
                        and cf.date <= today]
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

# =============================================================================
# Unified Forecast Endpoints (Combining Manual + Pacing Model)
# =============================================================================

@router.get("/forecasts/unified")
def get_unified_forecasts(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    include_manual: bool = Query(True, description="Include manual future cash flows"),
    include_pacing_model: bool = Query(True, description="Include pacing model forecasts"),
    scenario: str = Query("BASE", description="Forecast scenario (BASE, BULL, BEAR)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get unified forecasts combining manual entries and pacing model forecasts

    This endpoint merges:
    1. Manual future cash flows (user-entered cash flows with date > today)
    2. Backend pacing model forecasts (sophisticated J-curve based estimates)

    Returns daily aggregated cash flows with source tracking and confidence levels.
    """
    try:
        # Validate and convert scenario string to enum
        try:
            forecast_scenario = ForecastScenario[scenario.upper()]
        except KeyError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid scenario: {scenario}. Valid options: BASE, BULL, BEAR"
            )

        # Validate date range
        if start_date > end_date:
            raise HTTPException(
                status_code=400,
                detail="Start date must be before or equal to end date"
            )

        # Create unified forecast service
        forecast_service = create_tenant_unified_forecast_service(db, current_user.tenant_id)

        # Get daily aggregates
        daily_flows = forecast_service.get_daily_aggregates(
            start_date, end_date, include_manual, include_pacing_model, forecast_scenario
        )

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "include_manual": include_manual,
            "include_pacing_model": include_pacing_model,
            "scenario": scenario,
            "daily_flows": daily_flows
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Unified forecast error: {error_traceback}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving unified forecasts: {str(e)}"
        )

# =============================================================================
# Additional CRUD Endpoints for Cash Flows and Valuations
# =============================================================================

@router.get("/cashflows/{cashflow_id}", response_model=CashFlow)
def get_cashflow(
    cashflow_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific cash flow by ID or UUID with tenant isolation"""
    cashflow = crud_tenant.get_cashflow(db, cashflow_id, current_user.tenant_id)
    if not cashflow:
        raise HTTPException(status_code=404, detail="Cash flow not found")
    return cashflow


@router.put("/cashflows/{cashflow_id}", response_model=CashFlow)
def update_cashflow(
    cashflow_id: str,
    cashflow_update: CashFlowUpdate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Update a cash flow by ID or UUID with tenant isolation (Contributor+ required)"""
    updated_cashflow = crud_tenant.update_cashflow(
        db=db,
        cashflow_id=cashflow_id,
        tenant_id=current_user.tenant_id,
        cashflow_update=cashflow_update,
        updated_by_user_id=current_user.id
    )
    
    if not updated_cashflow:
        raise HTTPException(status_code=404, detail="Cash flow not found")
    
    return updated_cashflow


@router.delete("/cashflows/{cashflow_id}")
def delete_cashflow(
    cashflow_id: str,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Delete a cash flow by ID or UUID with tenant isolation (Contributor+ required)"""
    success = crud_tenant.delete_cashflow(
        db=db,
        cashflow_id=cashflow_id,
        tenant_id=current_user.tenant_id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Cash flow not found")
    
    return {"message": "Cash flow deleted successfully"}


@router.get("/valuations/{valuation_id}", response_model=Valuation)
def get_valuation(
    valuation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific valuation by ID or UUID with tenant isolation"""
    valuation = crud_tenant.get_valuation(db, valuation_id, current_user.tenant_id)
    if not valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")
    return valuation


@router.put("/valuations/{valuation_id}", response_model=Valuation)
def update_valuation(
    valuation_id: str,
    valuation_update: ValuationUpdate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Update a valuation by ID or UUID with tenant isolation (Contributor+ required)"""
    updated_valuation = crud_tenant.update_valuation(
        db=db,
        valuation_id=valuation_id,
        tenant_id=current_user.tenant_id,
        valuation_update=valuation_update,
        updated_by_user_id=current_user.id
    )
    
    if not updated_valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")
    
    return updated_valuation


@router.delete("/valuations/{valuation_id}")
def delete_valuation(
    valuation_id: str,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Delete a valuation by ID or UUID with tenant isolation (Contributor+ required)"""
    success = crud_tenant.delete_valuation(
        db=db,
        valuation_id=valuation_id,
        tenant_id=current_user.tenant_id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Valuation not found")
    
    return {"message": "Valuation deleted successfully"}


@router.delete("/investments/{investment_id}")
def delete_investment(
    investment_id: str,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """
    Archive an investment (soft delete) with tenant isolation (Contributor+ required)

    The investment will be hidden from normal views but can be restored.
    All related data (cash flows, valuations) is preserved.
    """
    success = crud_tenant.delete_investment(
        db=db,
        investment_id=investment_id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Investment not found")

    return {"message": "Investment archived successfully"}

@router.post("/investments/{investment_id}/restore")
def restore_investment(
    investment_id: str,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """
    Restore an archived investment with tenant isolation (Contributor+ required)
    """
    success = crud_tenant.restore_investment(
        db=db,
        investment_id=investment_id,
        tenant_id=current_user.tenant_id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Investment not found")

    return {"message": "Investment restored successfully"}

@router.get("/investments/archived", response_model=List[Investment])
def get_archived_investments(
    skip: int = 0,
    limit: int = 1000,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get archived investments for the current tenant"""
    return crud_tenant.get_investments(
        db=db,
        tenant_id=current_user.tenant_id,
        skip=skip,
        limit=limit,
        include_archived=True
    )

# =============================================================================
# Entity Relationship Management Endpoints
# =============================================================================

@router.post("/entity-relationships", response_model=EntityRelationship)
def create_entity_relationship(
    relationship: EntityRelationshipCreate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Create a new entity relationship"""
    # Validate that both entities belong to the user's tenant
    from_entity = db.query(models.Entity).filter(
        models.Entity.id == relationship.from_entity_id,
        models.Entity.tenant_id == current_user.tenant_id
    ).first()

    to_entity = db.query(models.Entity).filter(
        models.Entity.id == relationship.to_entity_id,
        models.Entity.tenant_id == current_user.tenant_id
    ).first()

    if not from_entity:
        raise HTTPException(status_code=404, detail="From entity not found")
    if not to_entity:
        raise HTTPException(status_code=404, detail="To entity not found")

    # Prevent self-relationships
    if relationship.from_entity_id == relationship.to_entity_id:
        raise HTTPException(status_code=400, detail="Entity cannot have relationship with itself")

    # Check for duplicate active relationships of the same type
    existing = db.query(models.EntityRelationship).filter(
        models.EntityRelationship.from_entity_id == relationship.from_entity_id,
        models.EntityRelationship.to_entity_id == relationship.to_entity_id,
        models.EntityRelationship.relationship_category == relationship.relationship_category,
        models.EntityRelationship.relationship_type == relationship.relationship_type,
        models.EntityRelationship.is_active == True
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Active relationship of this type already exists between these entities"
        )

    # Create the relationship
    db_relationship = models.EntityRelationship(
        from_entity_id=relationship.from_entity_id,
        to_entity_id=relationship.to_entity_id,
        relationship_category=relationship.relationship_category,
        relationship_type=relationship.relationship_type,
        relationship_subtype=relationship.relationship_subtype,
        percentage_ownership=relationship.percentage_ownership or 0,
        is_voting_interest=relationship.is_voting_interest,
        effective_date=relationship.effective_date,
        end_date=relationship.end_date,
        is_active=relationship.is_active,
        notes=relationship.notes,
        created_by=current_user.username
    )

    db.add(db_relationship)
    db.commit()
    db.refresh(db_relationship)

    return db_relationship

@router.get("/entity-relationships", response_model=List[EntityRelationshipWithEntities])
def get_entity_relationships(
    entity_id: Optional[int] = Query(None, description="Filter by entity ID (from or to)"),
    include_inactive: bool = Query(False, description="Include inactive relationships"),
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Get entity relationships with filtering options and tenant isolation"""
    query = db.query(models.EntityRelationship).join(
        models.Entity, models.EntityRelationship.from_entity_id == models.Entity.id
    ).filter(
        models.Entity.tenant_id == current_user.tenant_id
    )

    # Filter by entity ID if provided
    if entity_id:
        # Verify the entity belongs to the user's tenant
        entity = db.query(models.Entity).filter(
            models.Entity.id == entity_id,
            models.Entity.tenant_id == current_user.tenant_id
        ).first()

        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")

        query = query.filter(
            (models.EntityRelationship.from_entity_id == entity_id) |
            (models.EntityRelationship.to_entity_id == entity_id)
        )

    # Filter by active status
    if not include_inactive:
        query = query.filter(models.EntityRelationship.is_active == True)

    relationships = query.all()

    # Convert to response format with entity names
    result = []
    for rel in relationships:
        # Get entity details
        from_entity = db.query(models.Entity).filter(models.Entity.id == rel.from_entity_id).first()
        to_entity = db.query(models.Entity).filter(models.Entity.id == rel.to_entity_id).first()

        # Manually build response dict with correct field names
        rel_with_entities = {
            "id": rel.id,
            "uuid": rel.uuid,
            "from_entity_id": rel.from_entity_id,
            "to_entity_id": rel.to_entity_id,
            "relationship_category": rel.relationship_category,
            "relationship_type": rel.relationship_type,
            "relationship_subtype": rel.relationship_subtype,
            "percentage_ownership": rel.percentage_ownership,
            "is_voting_interest": rel.is_voting_interest,
            "effective_date": rel.effective_date,
            "end_date": rel.end_date,
            "is_active": rel.is_active,
            "notes": rel.notes,
            "created_date": rel.created_date,
            "updated_date": rel.updated_date,
            "from_entity_name": from_entity.name if from_entity else "",
            "to_entity_name": to_entity.name if to_entity else "",
            "from_entity_type": from_entity.entity_type if from_entity else "",
            "to_entity_type": to_entity.entity_type if to_entity else ""
        }
        result.append(rel_with_entities)

    return result

@router.put("/entity-relationships/{relationship_id}", response_model=EntityRelationship)
def update_entity_relationship(
    relationship_id: str,
    relationship_update: EntityRelationshipUpdate,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Update an entity relationship by ID or UUID"""
    # Parse the relationship_id to support both int and UUID
    from app.crud_tenant import parse_id_or_uuid
    parsed_id = parse_id_or_uuid(relationship_id)

    # Get the relationship and verify tenant access
    query = db.query(models.EntityRelationship).join(
        models.Entity, models.EntityRelationship.from_entity_id == models.Entity.id
    )

    if isinstance(parsed_id, UUID):
        query = query.filter(models.EntityRelationship.uuid == parsed_id)
    else:
        query = query.filter(models.EntityRelationship.id == parsed_id)

    relationship = query.filter(
        models.Entity.tenant_id == current_user.tenant_id
    ).first()

    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")

    # Update fields
    update_data = relationship_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(relationship, field, value)

    db.commit()
    db.refresh(relationship)

    return relationship

@router.delete("/entity-relationships/{relationship_id}")
def delete_entity_relationship(
    relationship_id: str,
    current_user: User = Depends(require_contributor),
    db: Session = Depends(get_db)
):
    """Delete an entity relationship by ID or UUID"""
    # Parse the relationship_id to support both int and UUID
    from app.crud_tenant import parse_id_or_uuid
    parsed_id = parse_id_or_uuid(relationship_id)

    # Get the relationship and verify tenant access
    query = db.query(models.EntityRelationship).join(
        models.Entity, models.EntityRelationship.from_entity_id == models.Entity.id
    )

    if isinstance(parsed_id, UUID):
        query = query.filter(models.EntityRelationship.uuid == parsed_id)
    else:
        query = query.filter(models.EntityRelationship.id == parsed_id)

    relationship = query.filter(
        models.Entity.tenant_id == current_user.tenant_id
    ).first()

    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")

    db.delete(relationship)
    db.commit()

    return {"message": "Relationship deleted successfully"}


# ============================================================================
# FUND MANAGER ENDPOINTS
# ============================================================================

@router.get("/fund/overview")
def get_fund_overview(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get fund-level overview for portfolio managers
    Aggregates all investments to show total commitments, AUM, unfunded obligations, etc.
    """
    try:
        from sqlalchemy import func
        from ..models import Investment, CashFlow, Valuation, CashFlowType
        from collections import defaultdict

        # Get all active investments for this tenant
        investments = db.query(Investment).filter(
            Investment.tenant_id == current_user.tenant_id,
            Investment.is_archived == False
        ).all()

        # Initialize aggregates
        total_commitments = 0
        total_called = 0
        total_distributed = 0
        total_nav = 0
        investment_count = len(investments)

        # Track by vintage year
        vintage_data = defaultdict(lambda: {
            'vintage': 0,
            'count': 0,
            'commitments': 0,
            'called': 0,
            'distributed': 0,
            'nav': 0
        })

        # Track by GP
        gp_data = defaultdict(lambda: {
            'name': '',
            'commitments': 0,
            'count': 0
        })

        # Recent capital calls (last 30 days)
        thirty_days_ago = datetime.now().date() - timedelta(days=30)
        recent_calls = []

        for inv in investments:
            # Aggregate totals
            commitment = inv.commitment_amount or 0
            called = inv.called_amount or 0

            total_commitments += commitment
            total_called += called

            # Get distributions from cash flows
            distributions = db.query(func.sum(CashFlow.amount)).filter(
                CashFlow.investment_id == inv.id,
                CashFlow.type.in_([
                    CashFlowType.DISTRIBUTION,
                    CashFlowType.YIELD,
                    CashFlowType.RETURN_OF_PRINCIPAL
                ])
            ).scalar() or 0

            total_distributed += abs(distributions)

            # Get latest NAV
            latest_val = db.query(Valuation).filter(
                Valuation.investment_id == inv.id
            ).order_by(Valuation.date.desc()).first()

            nav = latest_val.nav_value if latest_val else 0
            total_nav += nav

            # Aggregate by vintage year
            vintage = inv.vintage_year
            vintage_data[vintage]['vintage'] = vintage
            vintage_data[vintage]['count'] += 1
            vintage_data[vintage]['commitments'] += commitment
            vintage_data[vintage]['called'] += called
            vintage_data[vintage]['distributed'] += abs(distributions)
            vintage_data[vintage]['nav'] += nav

            # Aggregate by GP
            gp_name = inv.manager or 'Unknown'
            gp_data[gp_name]['name'] = gp_name
            gp_data[gp_name]['commitments'] += commitment
            gp_data[gp_name]['count'] += 1

            # Get recent capital calls
            recent_cf = db.query(CashFlow).filter(
                CashFlow.investment_id == inv.id,
                CashFlow.type.in_([CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]),
                CashFlow.date >= thirty_days_ago
            ).order_by(CashFlow.date.desc()).all()

            for cf in recent_cf:
                recent_calls.append({
                    'investment_name': inv.name,
                    'date': cf.date.isoformat(),
                    'amount': abs(cf.amount)
                })

        # Calculate unfunded obligations
        unfunded = total_commitments - total_called

        # Calculate deployment rate
        deployment_rate = (total_called / total_commitments * 100) if total_commitments > 0 else 0

        # Calculate performance metrics
        tvpi = ((total_nav + total_distributed) / total_called) if total_called > 0 else 0
        dpi = (total_distributed / total_called) if total_called > 0 else 0
        rvpi = (total_nav / total_called) if total_called > 0 else 0

        # Sort and format vintage data
        vintage_list = sorted(vintage_data.values(), key=lambda x: x['vintage'], reverse=True)
        for v in vintage_list:
            v['tvpi'] = ((v['nav'] + v['distributed']) / v['called']) if v['called'] > 0 else 0
            v['dpi'] = (v['distributed'] / v['called']) if v['called'] > 0 else 0

        # Sort GPs by commitment size
        gp_list = sorted(gp_data.values(), key=lambda x: x['commitments'], reverse=True)
        top_gps = gp_list[:5]

        # Calculate GP concentration
        for gp in top_gps:
            gp['percentage'] = (gp['commitments'] / total_commitments * 100) if total_commitments > 0 else 0

        # Sort recent calls by date
        recent_calls_sorted = sorted(recent_calls, key=lambda x: x['date'], reverse=True)[:10]

        # Calculate total recent calls amount
        total_recent_calls = sum(call['amount'] for call in recent_calls_sorted)

        return {
            'overview': {
                'total_aum': total_nav,
                'total_commitments': total_commitments,
                'total_called': total_called,
                'total_distributed': total_distributed,
                'unfunded_obligations': unfunded,
                'deployment_rate': deployment_rate,
                'investment_count': investment_count,
                'tvpi': tvpi,
                'dpi': dpi,
                'rvpi': rvpi
            },
            'vintage_performance': vintage_list,
            'top_gps': top_gps,
            'recent_activity': {
                'capital_calls': recent_calls_sorted,
                'total_recent_calls': total_recent_calls
            }
        }

    except Exception as e:
        import traceback
        print(f"Error generating fund overview: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating fund overview: {str(e)}")
