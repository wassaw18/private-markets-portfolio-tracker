from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, Form, Header
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from app import crud, models, schemas
from app.database import get_db, create_database
from app import dashboard
from app.import_export import import_investments_from_file, export_investments_to_excel, ImportResult
from app.excel_template_service import excel_template_service, BulkUploadProcessor
from app.benchmark_service import get_benchmark_comparison
from app.pacing_model import create_pacing_model_engine, PacingModelEngine
from app.calendar_service import create_calendar_service, CashFlowCalendarService
from app.document_service import get_document_service
from app.models import ForecastScenario, DocumentCategory, DocumentStatus, AdvancedRelationshipType, OwnershipType
from app.entity_relationships import EntityRelationshipService, InvestmentOwnershipService, EntityHierarchyService
from datetime import date, datetime
import io
import os

app = FastAPI(title="Private Markets Portfolio Tracker", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

@app.on_event("startup")
def startup_event():
    create_database()

# Simple user context dependency - can be enhanced later with proper JWT/session handling
def get_current_user(x_user: Optional[str] = Header(None, alias="X-User")) -> str:
    """
    Extract current user from header or default to 'admin'
    This is a basic implementation for the Enhanced Basic Auditing System.
    Can be enhanced later with proper authentication.
    """
    return x_user or "admin"

@app.get("/")
def read_root():
    return {"message": "Private Markets Portfolio Tracker API"}

# Entity Management Endpoints

@app.post("/api/entities", response_model=schemas.Entity)
def create_entity(entity: schemas.EntityCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Create a new entity"""
    return crud.create_entity(db=db, entity=entity, current_user=current_user)

@app.get("/api/entities", response_model=List[schemas.EntityWithMembers])
def read_entities(
    skip: int = 0,
    limit: int = 100,
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    search: Optional[str] = Query(None, description="Search entities by name"),
    include_inactive: bool = Query(False, description="Include inactive entities"),
    db: Session = Depends(get_db)
):
    """Get entities with optional filtering"""
    if search:
        entities = crud.search_entities(db=db, search_term=search, skip=skip, limit=limit)
    elif entity_type:
        entities = crud.get_entities_by_type(db=db, entity_type=entity_type, skip=skip, limit=limit)
    else:
        entities = crud.get_entities(db=db, skip=skip, limit=limit, include_inactive=include_inactive)
    
    # Convert to EntityWithMembers schema with investment stats
    result = []
    for entity in entities:
        investments = crud.get_investments_by_entity(db=db, entity_id=entity.id)
        investment_count = len(investments)
        total_commitment = sum(inv.commitment_amount for inv in investments)
        
        entity_dict = {
            **entity.__dict__,
            "investment_count": investment_count,
            "total_commitment": total_commitment
        }
        result.append(schemas.EntityWithMembers.model_validate(entity_dict))
    
    return result

@app.get("/api/entities/{entity_id}", response_model=schemas.EntityWithMembers)
def read_entity(entity_id: int, db: Session = Depends(get_db)):
    """Get a specific entity with family members"""
    db_entity = crud.get_entity(db, entity_id=entity_id)
    if db_entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    # Add investment statistics
    investments = crud.get_investments_by_entity(db=db, entity_id=entity_id)
    investment_count = len(investments)
    total_commitment = sum(inv.commitment_amount for inv in investments)
    
    entity_dict = {
        **db_entity.__dict__,
        "investment_count": investment_count,
        "total_commitment": total_commitment
    }
    return schemas.EntityWithMembers.model_validate(entity_dict)

@app.put("/api/entities/{entity_id}", response_model=schemas.Entity)
def update_entity(entity_id: int, entity: schemas.EntityUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Update an existing entity"""
    db_entity = crud.update_entity(db, entity_id=entity_id, entity_update=entity, current_user=current_user)
    if db_entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return db_entity

@app.delete("/api/entities/{entity_id}")
def delete_entity(entity_id: int, db: Session = Depends(get_db)):
    """Delete an entity (soft delete)"""
    success = crud.delete_entity(db, entity_id=entity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"message": "Entity deactivated successfully"}

@app.get("/api/entities/{entity_id}/investments", response_model=List[schemas.Investment])
def get_entity_investments(entity_id: int, db: Session = Depends(get_db)):
    """Get all investments for a specific entity"""
    db_entity = crud.get_entity(db, entity_id=entity_id)
    if db_entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return crud.get_investments_by_entity(db=db, entity_id=entity_id)

# Family Member Endpoints

@app.post("/api/entities/{entity_id}/family-members", response_model=schemas.FamilyMember)
def create_family_member(entity_id: int, family_member: schemas.FamilyMemberCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Create a new family member for an entity"""
    # Verify entity exists
    db_entity = crud.get_entity(db, entity_id=entity_id)
    if db_entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    # Set the entity_id
    family_member.entity_id = entity_id
    return crud.create_family_member(db=db, family_member=family_member, current_user=current_user)

@app.get("/api/entities/{entity_id}/family-members", response_model=List[schemas.FamilyMember])
def get_entity_family_members(
    entity_id: int,
    include_inactive: bool = Query(False, description="Include inactive family members"),
    db: Session = Depends(get_db)
):
    """Get all family members for a specific entity"""
    db_entity = crud.get_entity(db, entity_id=entity_id)
    if db_entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return crud.get_entity_family_members(db=db, entity_id=entity_id, include_inactive=include_inactive)

@app.put("/api/family-members/{member_id}", response_model=schemas.FamilyMember)
def update_family_member(member_id: int, family_member: schemas.FamilyMemberUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Update an existing family member"""
    db_member = crud.update_family_member(db, member_id=member_id, member_update=family_member, current_user=current_user)
    if db_member is None:
        raise HTTPException(status_code=404, detail="Family member not found")
    return db_member

@app.delete("/api/family-members/{member_id}")
def delete_family_member(member_id: int, db: Session = Depends(get_db)):
    """Delete a family member (soft delete)"""
    success = crud.delete_family_member(db, member_id=member_id)
    if not success:
        raise HTTPException(status_code=404, detail="Family member not found")
    return {"message": "Family member deactivated successfully"}

@app.post("/api/investments", response_model=schemas.Investment)
def create_investment(investment: schemas.InvestmentCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    return crud.create_investment(db=db, investment=investment, current_user=current_user)

@app.get("/api/investments", response_model=List[schemas.Investment])
def read_investments(
    skip: int = 0, 
    limit: int = 100,
    search: Optional[str] = Query(None, description="Search in investment name, entity name, or strategy"),
    asset_classes: Optional[List[str]] = Query(None, description="Filter by asset classes"),
    min_vintage_year: Optional[int] = Query(None, description="Minimum vintage year"),
    max_vintage_year: Optional[int] = Query(None, description="Maximum vintage year"),
    min_commitment: Optional[float] = Query(None, description="Minimum commitment amount"),
    max_commitment: Optional[float] = Query(None, description="Maximum commitment amount"),
    entity_ids: Optional[List[int]] = Query(None, description="Filter by entity IDs"),
    entity_names: Optional[List[str]] = Query(None, description="Filter by entity names"),
    entity_types: Optional[List[str]] = Query(None, description="Filter by entity types"),
    db: Session = Depends(get_db)
):
    """Get investments with optional filtering"""
    investments = crud.get_investments_filtered(
        db=db, 
        skip=skip, 
        limit=limit,
        search=search,
        asset_classes=asset_classes,
        min_vintage_year=min_vintage_year,
        max_vintage_year=max_vintage_year,
        min_commitment=min_commitment,
        max_commitment=max_commitment,
        entity_ids=entity_ids,
        entity_names=entity_names,
        entity_types=entity_types
    )
    return investments

@app.get("/api/investments/filter-options")
def get_filter_options(db: Session = Depends(get_db)):
    """Get available filter options for investments"""
    
    # Get distinct asset classes
    asset_classes = [asset_class.value for asset_class in models.AssetClass]
    
    # Get entity types
    entity_types = [entity_type.value for entity_type in models.EntityType]
    
    # Get distinct entity names (from entities that have investments)
    entity_names = db.query(models.Entity.name).join(models.Investment).distinct().all()
    entity_names = [name[0] for name in entity_names if name[0]]
    
    # Get vintage year range
    vintage_years = db.query(models.Investment.vintage_year).distinct().all()
    vintage_years = [year[0] for year in vintage_years if year[0]]
    min_vintage = min(vintage_years) if vintage_years else None
    max_vintage = max(vintage_years) if vintage_years else None
    
    # Get commitment amount range
    commitments = db.query(models.Investment.commitment_amount).distinct().all()
    commitments = [amount[0] for amount in commitments if amount[0]]
    min_commitment = min(commitments) if commitments else None
    max_commitment = max(commitments) if commitments else None
    
    return {
        "asset_classes": asset_classes,
        "entity_types": entity_types,
        "entity_names": sorted(entity_names),
        "vintage_year_range": {
            "min": min_vintage,
            "max": max_vintage
        },
        "commitment_range": {
            "min": min_commitment,
            "max": max_commitment
        }
    }

@app.get("/api/investments/{investment_id}", response_model=schemas.Investment)
def read_investment(investment_id: int, db: Session = Depends(get_db)):
    db_investment = crud.get_investment(db, investment_id=investment_id)
    if db_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    return db_investment

@app.put("/api/investments/{investment_id}", response_model=schemas.Investment)
def update_investment(investment_id: int, investment: schemas.InvestmentUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    db_investment = crud.update_investment(db, investment_id=investment_id, investment_update=investment, current_user=current_user)
    if db_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    return db_investment

@app.delete("/api/investments/{investment_id}")
def delete_investment(investment_id: int, db: Session = Depends(get_db)):
    success = crud.delete_investment(db, investment_id=investment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"message": "Investment deleted successfully"}

@app.post("/api/investments/{investment_id}/recalculate-summary")
def recalculate_investment_summary(investment_id: int, db: Session = Depends(get_db)):
    """Recalculate called_amount and fees from cash flows"""
    # Verify investment exists
    db_investment = crud.get_investment(db, investment_id=investment_id)
    if db_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    # Recalculate summary fields
    crud.update_investment_summary_fields(db, investment_id)
    
    # Return updated investment
    updated_investment = crud.get_investment(db, investment_id=investment_id)
    return {
        "message": "Investment summary fields recalculated",
        "called_amount": updated_investment.called_amount,
        "fees": updated_investment.fees
    }

@app.post("/api/investments/recalculate-all-summaries")
def recalculate_all_investment_summaries(db: Session = Depends(get_db)):
    """Recalculate called_amount and fees from cash flows for ALL investments"""
    # Get all investments
    investments = crud.get_investments(db, skip=0, limit=10000)
    
    updated_count = 0
    for investment in investments:
        crud.update_investment_summary_fields(db, investment.id)
        updated_count += 1
    
    return {
        "message": f"Recalculated summary fields for {updated_count} investments",
        "updated_count": updated_count
    }

# CashFlow endpoints
@app.get("/api/investments/{investment_id}/cashflows", response_model=List[schemas.CashFlow])
def get_investment_cashflows(investment_id: int, db: Session = Depends(get_db)):
    # Verify investment exists
    db_investment = crud.get_investment(db, investment_id=investment_id)
    if db_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    return crud.get_investment_cashflows(db, investment_id=investment_id)

@app.post("/api/investments/{investment_id}/cashflows", response_model=schemas.CashFlow)
def create_investment_cashflow(investment_id: int, cashflow: schemas.CashFlowCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # Verify investment exists
    db_investment = crud.get_investment(db, investment_id=investment_id)
    if db_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    return crud.create_cashflow(db, investment_id=investment_id, cashflow=cashflow, current_user=current_user)

@app.delete("/api/investments/{investment_id}/cashflows/{cashflow_id}")
def delete_cashflow(investment_id: int, cashflow_id: int, db: Session = Depends(get_db)):
    # Verify investment exists
    db_investment = crud.get_investment(db, investment_id=investment_id)
    if db_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    # Verify cashflow belongs to investment
    db_cashflow = crud.get_cashflow(db, cashflow_id=cashflow_id)
    if db_cashflow is None or db_cashflow.investment_id != investment_id:
        raise HTTPException(status_code=404, detail="Cash flow not found")
    
    success = crud.delete_cashflow(db, cashflow_id=cashflow_id)
    if not success:
        raise HTTPException(status_code=404, detail="Cash flow not found")
    return {"message": "Cash flow deleted successfully"}

# Valuation endpoints
@app.get("/api/investments/{investment_id}/valuations", response_model=List[schemas.Valuation])
def get_investment_valuations(investment_id: int, db: Session = Depends(get_db)):
    # Verify investment exists
    db_investment = crud.get_investment(db, investment_id=investment_id)
    if db_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    return crud.get_investment_valuations(db, investment_id=investment_id)

@app.post("/api/investments/{investment_id}/valuations", response_model=schemas.Valuation)
def create_investment_valuation(investment_id: int, valuation: schemas.ValuationCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    # Verify investment exists
    db_investment = crud.get_investment(db, investment_id=investment_id)
    if db_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    return crud.create_valuation(db, investment_id=investment_id, valuation=valuation, current_user=current_user)

@app.delete("/api/investments/{investment_id}/valuations/{valuation_id}")
def delete_valuation(investment_id: int, valuation_id: int, db: Session = Depends(get_db)):
    # Verify investment exists
    db_investment = crud.get_investment(db, investment_id=investment_id)
    if db_investment is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    # Verify valuation belongs to investment
    db_valuation = crud.get_valuation(db, valuation_id=valuation_id)
    if db_valuation is None or db_valuation.investment_id != investment_id:
        raise HTTPException(status_code=404, detail="Valuation not found")
    
    success = crud.delete_valuation(db, valuation_id=valuation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Valuation not found")
    return {"message": "Valuation deleted successfully"}

# Performance endpoints
@app.get("/api/investments/{investment_id}/performance", response_model=schemas.InvestmentPerformance)
def get_investment_performance(investment_id: int, db: Session = Depends(get_db)):
    performance = crud.get_investment_performance(db, investment_id=investment_id)
    if performance is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    return performance

@app.get("/api/portfolio/performance", response_model=schemas.PortfolioPerformance)
def get_portfolio_performance(db: Session = Depends(get_db)):
    return crud.get_portfolio_performance(db)

# Benchmark comparison endpoint
@app.get("/api/investments/{investment_id}/benchmark", response_model=schemas.InvestmentBenchmarkComparison)
def get_investment_benchmark_comparison(investment_id: int, db: Session = Depends(get_db)):
    """Get benchmark performance comparison for specific investment"""
    try:
        comparison = get_benchmark_comparison(db, investment_id)
        return comparison
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating benchmark comparison: {str(e)}")

# Dashboard endpoints
@app.get("/api/dashboard/commitment-vs-called", response_model=schemas.CommitmentVsCalledData)
def get_commitment_vs_called_data(db: Session = Depends(get_db)):
    return dashboard.get_commitment_vs_called_data(db)

@app.get("/api/dashboard/allocation-by-asset-class", response_model=List[schemas.AssetAllocationData])
def get_allocation_by_asset_class(db: Session = Depends(get_db)):
    return dashboard.get_allocation_by_asset_class(db)

@app.get("/api/dashboard/allocation-by-vintage", response_model=List[schemas.VintageAllocationData])
def get_allocation_by_vintage(db: Session = Depends(get_db)):
    return dashboard.get_allocation_by_vintage(db)

@app.get("/api/dashboard/portfolio-value-timeline", response_model=List[schemas.TimelineDataPoint])
def get_portfolio_value_timeline(db: Session = Depends(get_db)):
    return dashboard.get_portfolio_value_timeline(db)

@app.get("/api/dashboard/j-curve-data", response_model=List[schemas.JCurveDataPoint])
def get_j_curve_data(db: Session = Depends(get_db)):
    return dashboard.get_j_curve_data(db)

@app.get("/api/dashboard/summary-stats", response_model=schemas.DashboardSummaryStats)
def get_dashboard_summary_stats(db: Session = Depends(get_db)):
    return dashboard.get_dashboard_summary_stats(db)

# Import/Export endpoints
@app.post("/api/investments/import")
async def import_investments(
    file: UploadFile = File(...), 
    force_upload: bool = False,
    db: Session = Depends(get_db)
):
    """Import investments from CSV or Excel file with optional force upload mode"""
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(400, "Only CSV and Excel files are supported")
    
    # Read file content
    content = await file.read()
    
    # Process import
    result = import_investments_from_file(content, file.filename, db, force_upload)
    
    return {
        "filename": file.filename,
        "success_count": result.success_count,
        "error_count": result.error_count,
        "errors": result.errors[:50],  # Limit errors in response
        "warnings": result.warnings[:20],
        "message": f"Successfully imported {result.success_count} investments" + 
                  (f" with {result.error_count} errors" if result.error_count > 0 else "")
    }

@app.get("/api/investments/export")
def export_investments(db: Session = Depends(get_db)):
    """Export all investments to Excel format"""
    investments = crud.get_investments(db, skip=0, limit=10000)  # Get all investments
    
    excel_buffer = export_investments_to_excel(investments)
    
    return StreamingResponse(
        io.BytesIO(excel_buffer.read()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=portfolio_investments.xlsx"}
    )

# Excel Template Generation Endpoints
@app.get("/api/templates/nav-template")
def download_nav_template(db: Session = Depends(get_db)):
    """Download NAV upload template"""
    try:
        excel_buffer = excel_template_service.generate_nav_template(db)
        
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=NAV_Upload_Template.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating NAV template: {str(e)}")

@app.get("/api/templates/cashflow-template")
def download_cashflow_template(db: Session = Depends(get_db)):
    """Download Cash Flow upload template"""
    try:
        excel_buffer = excel_template_service.generate_cashflow_template(db)
        
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=CashFlow_Upload_Template.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating Cash Flow template: {str(e)}")

@app.get("/api/templates/investment-template")
def download_investment_template(db: Session = Depends(get_db)):
    """Download Investment bulk upload template"""
    try:
        excel_buffer = excel_template_service.generate_investment_template(db)
        
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Investment_Upload_Template.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating Investment template: {str(e)}")

# Bulk Upload Endpoints
@app.post("/api/bulk-upload/navs")
async def bulk_upload_navs(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Bulk upload NAV data from Excel template"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "Only Excel files are supported for bulk NAV upload")
    
    try:
        # Read file content
        content = await file.read()
        
        # Process upload
        result = BulkUploadProcessor.process_nav_upload(content, file.filename, db)
        
        return {
            "filename": file.filename,
            "success_count": result.success_count,
            "error_count": result.error_count,
            "warning_count": result.warning_count,
            "errors": result.errors[:20],  # Limit errors in response
            "warnings": result.warnings[:10],  # Limit warnings in response
            "message": result.message,
            "has_more_errors": len(result.errors) > 20,
            "has_more_warnings": len(result.warnings) > 10
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NAV upload failed: {str(e)}")

@app.post("/api/bulk-upload/cashflows")
async def bulk_upload_cashflows(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Bulk upload Cash Flow data from Excel template"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "Only Excel files are supported for bulk Cash Flow upload")
    
    try:
        # Read file content
        content = await file.read()
        
        # Process upload
        result = BulkUploadProcessor.process_cashflow_upload(content, file.filename, db)
        
        return {
            "filename": file.filename,
            "success_count": result.success_count,
            "error_count": result.error_count,
            "warning_count": result.warning_count,
            "errors": result.errors[:20],  # Limit errors in response
            "warnings": result.warnings[:10],  # Limit warnings in response
            "message": result.message,
            "has_more_errors": len(result.errors) > 20,
            "has_more_warnings": len(result.warnings) > 10
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cash Flow upload failed: {str(e)}")

# Cash Flow Forecasting & Pacing Model Endpoints

@app.post("/api/investments/{investment_id}/forecast")
def generate_investment_forecast(
    investment_id: int, 
    scenarios: Optional[List[ForecastScenario]] = None,
    db: Session = Depends(get_db)
):
    """Generate/update cash flow forecast for investment"""
    pacing_engine = create_pacing_model_engine(db)
    
    # Default to all scenarios if none specified
    if scenarios is None:
        scenarios = [ForecastScenario.BASE, ForecastScenario.BULL, ForecastScenario.BEAR]
    
    success = pacing_engine.update_investment_forecast(investment_id, scenarios)
    
    if not success:
        raise HTTPException(
            status_code=404, 
            detail="Investment not found or forecasting is disabled"
        )
    
    return {
        "investment_id": investment_id,
        "scenarios_updated": [s.value for s in scenarios],
        "message": f"Forecast updated for {len(scenarios)} scenarios"
    }

@app.get("/api/investments/{investment_id}/forecast", response_model=schemas.InvestmentForecastSummary)
def get_investment_forecast(investment_id: int, db: Session = Depends(get_db)):
    """Get investment cash flow forecast"""
    # Get investment
    investment = crud.get_investment(db, investment_id=investment_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    # Get forecasts for all scenarios
    base_forecasts = db.query(models.CashFlowForecast).filter(
        models.CashFlowForecast.investment_id == investment_id,
        models.CashFlowForecast.scenario == ForecastScenario.BASE
    ).order_by(models.CashFlowForecast.forecast_year).all()
    
    bull_forecasts = db.query(models.CashFlowForecast).filter(
        models.CashFlowForecast.investment_id == investment_id,
        models.CashFlowForecast.scenario == ForecastScenario.BULL
    ).order_by(models.CashFlowForecast.forecast_year).all()
    
    bear_forecasts = db.query(models.CashFlowForecast).filter(
        models.CashFlowForecast.investment_id == investment_id,
        models.CashFlowForecast.scenario == ForecastScenario.BEAR
    ).order_by(models.CashFlowForecast.forecast_year).all()
    
    if not base_forecasts:
        raise HTTPException(
            status_code=404, 
            detail="No forecast data found. Generate forecast first."
        )
    
    # Calculate summary metrics from base case
    total_calls = sum(f.projected_calls for f in base_forecasts)
    total_distributions = sum(f.projected_distributions for f in base_forecasts)
    expected_net_cf = total_distributions - total_calls
    
    # Calculate expected IRR and MOIC from final forecast values
    final_forecast = base_forecasts[-1]
    expected_moic = final_forecast.cumulative_distributions / max(final_forecast.cumulative_calls, 1)
    
    # Simple IRR approximation (actual calculation would require Newton-Raphson)
    expected_irr = investment.target_irr  # Use target as approximation
    
    return schemas.InvestmentForecastSummary(
        investment_id=investment_id,
        investment_name=investment.name,
        forecast_generated_date=investment.last_forecast_date.date() if investment.last_forecast_date else None,
        total_projected_calls=total_calls,
        total_projected_distributions=total_distributions,
        expected_net_cash_flow=expected_net_cf,
        expected_irr=expected_irr,
        expected_moic=expected_moic,
        forecast_accuracy_score=0.68,  # Default confidence
        base_case=[schemas.CashFlowForecast.model_validate(f) for f in base_forecasts],
        bull_case=[schemas.CashFlowForecast.model_validate(f) for f in bull_forecasts] if bull_forecasts else None,
        bear_case=[schemas.CashFlowForecast.model_validate(f) for f in bear_forecasts] if bear_forecasts else None
    )

@app.get("/api/portfolio/cash-flow-forecast", response_model=schemas.PortfolioCashFlowForecast)
def get_portfolio_cash_flow_forecast(
    scenario: ForecastScenario = ForecastScenario.BASE,
    db: Session = Depends(get_db)
):
    """Get portfolio-level cash flow forecast aggregation"""
    # Get all active investments with forecasts
    investments = db.query(models.Investment).filter(
        models.Investment.forecast_enabled == True
    ).all()
    
    if not investments:
        raise HTTPException(
            status_code=404,
            detail="No investments with forecasting enabled found"
        )
    
    # Get all forecasts for the specified scenario
    all_forecasts = db.query(models.CashFlowForecast).filter(
        models.CashFlowForecast.scenario == scenario,
        models.CashFlowForecast.investment_id.in_([i.id for i in investments])
    ).order_by(
        models.CashFlowForecast.investment_id, 
        models.CashFlowForecast.forecast_year
    ).all()
    
    if not all_forecasts:
        # Generate forecasts for all investments
        pacing_engine = create_pacing_model_engine(db)
        for investment in investments:
            pacing_engine.update_investment_forecast(investment.id, [scenario])
        
        # Retry fetching forecasts
        all_forecasts = db.query(models.CashFlowForecast).filter(
            models.CashFlowForecast.scenario == scenario,
            models.CashFlowForecast.investment_id.in_([i.id for i in investments])
        ).order_by(
            models.CashFlowForecast.investment_id, 
            models.CashFlowForecast.forecast_year
        ).all()
    
    # Aggregate by year
    annual_aggregates = {}
    for forecast in all_forecasts:
        year = forecast.forecast_period_start.year
        if year not in annual_aggregates:
            annual_aggregates[year] = {
                "year": year,
                "calls": 0.0,
                "distributions": 0.0,
                "net": 0.0
            }
        
        annual_aggregates[year]["calls"] += forecast.projected_calls
        annual_aggregates[year]["distributions"] += forecast.projected_distributions
        annual_aggregates[year]["net"] = annual_aggregates[year]["distributions"] - annual_aggregates[year]["calls"]
    
    # Convert to sorted list
    annual_forecasts = sorted(annual_aggregates.values(), key=lambda x: x["year"])
    
    # Calculate key insights
    peak_capital_need_year = min(annual_forecasts, key=lambda x: x["net"])["year"]
    peak_capital_amount = abs(min(f["net"] for f in annual_forecasts))
    
    # Find break-even year (cumulative net turns positive)
    cumulative_net = 0.0
    break_even_year = annual_forecasts[-1]["year"]  # Default to last year
    for forecast in annual_forecasts:
        cumulative_net += forecast["net"]
        if cumulative_net > 0:
            break_even_year = forecast["year"]
            break
    
    total_capital_required = sum(f["calls"] for f in annual_forecasts)
    total_expected_distributions = sum(f["distributions"] for f in annual_forecasts)
    
    # Portfolio-level approximations
    portfolio_expected_moic = total_expected_distributions / max(total_capital_required, 1)
    portfolio_expected_irr = sum(i.target_irr for i in investments) / len(investments)  # Simple average
    
    # Identify liquidity gaps and distribution peaks
    liquidity_gaps = [
        {"year": f["year"], "gap_amount": abs(f["net"])}
        for f in annual_forecasts 
        if f["net"] < -1000000  # $1M+ capital needs
    ]
    
    distribution_peaks = [
        {"year": f["year"], "distribution_amount": f["distributions"]}
        for f in annual_forecasts
        if f["distributions"] > 2000000  # $2M+ distributions
    ]
    
    return schemas.PortfolioCashFlowForecast(
        forecast_date=all_forecasts[0].forecast_date if all_forecasts else None,
        scenario=scenario,
        annual_forecasts=annual_forecasts,
        peak_capital_need_year=peak_capital_need_year,
        peak_capital_amount=peak_capital_amount,
        break_even_year=break_even_year,
        total_capital_required=total_capital_required,
        total_expected_distributions=total_expected_distributions,
        portfolio_expected_irr=portfolio_expected_irr,
        portfolio_expected_moic=portfolio_expected_moic,
        liquidity_gap_periods=liquidity_gaps,
        distribution_peak_periods=distribution_peaks
    )

@app.put("/api/investments/{investment_id}/pacing-inputs")
def update_pacing_inputs(
    investment_id: int,
    pacing_inputs: schemas.PacingModelInputs,
    db: Session = Depends(get_db)
):
    """Update pacing model parameters for investment"""
    # Get investment
    investment = crud.get_investment(db, investment_id=investment_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    # Update pacing model parameters
    investment.target_irr = pacing_inputs.target_irr
    investment.target_moic = pacing_inputs.target_moic
    investment.fund_life = pacing_inputs.fund_life
    investment.investment_period = pacing_inputs.investment_period
    investment.bow_factor = pacing_inputs.bow_factor
    investment.call_schedule = pacing_inputs.call_schedule
    investment.distribution_timing = pacing_inputs.distribution_timing
    investment.forecast_enabled = pacing_inputs.forecast_enabled
    
    db.commit()
    db.refresh(investment)
    
    # Regenerate forecasts with new parameters if forecasting is enabled
    if pacing_inputs.forecast_enabled:
        pacing_engine = create_pacing_model_engine(db)
        success = pacing_engine.update_investment_forecast(investment_id)
        
        return {
            "investment_id": investment_id,
            "message": "Pacing parameters updated and forecast regenerated",
            "forecast_updated": success
        }
    else:
        return {
            "investment_id": investment_id,
            "message": "Pacing parameters updated (forecasting disabled)",
            "forecast_updated": False
        }

# Cash Flow Calendar Endpoints

@app.get("/api/calendar/cash-flows")
def get_calendar_cash_flows(
    start_date: str,
    end_date: str,
    include_forecasts: bool = True,
    db: Session = Depends(get_db)
):
    """Get daily cash flow data for calendar view"""
    try:
        # Parse date strings
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
        
        calendar_service = create_calendar_service(db)
        daily_flows = calendar_service.get_daily_cash_flows(start, end, include_forecasts)
        
        # Convert to API response format
        return {
            "start_date": start_date,
            "end_date": end_date,
            "include_forecasts": include_forecasts,
            "daily_flows": [
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
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving calendar data: {str(e)}")

@app.get("/api/calendar/monthly-summary/{year}/{month}")
def get_monthly_summary(
    year: int,
    month: int,
    include_forecasts: bool = True,
    db: Session = Depends(get_db)
):
    """Get complete monthly calendar with cash flow data"""
    try:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
        
        calendar_service = create_calendar_service(db)
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving monthly summary: {str(e)}")

@app.get("/api/calendar/period-summary")
def get_period_summary(
    start_date: str,
    end_date: str,
    include_forecasts: bool = True,
    db: Session = Depends(get_db)
):
    """Get period summary for custom date range"""
    try:
        # Parse date strings
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
        
        calendar_service = create_calendar_service(db)
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
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving period summary: {str(e)}")

@app.get("/api/calendar/quarterly-summary/{year}/{quarter}")
def get_quarterly_summary(
    year: int,
    quarter: int,
    include_forecasts: bool = True,
    db: Session = Depends(get_db)
):
    """Get quarterly summary (Q1, Q2, Q3, Q4)"""
    try:
        if quarter not in [1, 2, 3, 4]:
            raise HTTPException(status_code=400, detail="Quarter must be 1, 2, 3, or 4")
        
        calendar_service = create_calendar_service(db)
        summary = calendar_service.get_quarterly_summary(year, quarter, include_forecasts)
        
        return {
            "year": year,
            "quarter": quarter,
            "quarter_name": f"Q{quarter} {year}",
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving quarterly summary: {str(e)}")

@app.get("/api/calendar/heatmap/{year}/{month}")
def get_calendar_heatmap(
    year: int,
    month: int,
    include_forecasts: bool = True,
    db: Session = Depends(get_db)
):
    """Get heat map data for calendar visualization"""
    try:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
        
        calendar_service = create_calendar_service(db)
        heatmap_data = calendar_service.get_cash_flow_heatmap_data(year, month, include_forecasts)
        
        return {
            "year": year,
            "month": month,
            "include_forecasts": include_forecasts,
            "max_flow": heatmap_data['max_flow'],
            "min_flow": heatmap_data['min_flow'],
            "daily_intensities": heatmap_data['daily_intensities'],
            "month_summary": {
                "total_inflows": heatmap_data['month_summary'].total_inflows,
                "total_outflows": heatmap_data['month_summary'].total_outflows,
                "net_flow": heatmap_data['month_summary'].net_flow,
                "active_days": heatmap_data['month_summary'].active_days,
                "total_transactions": heatmap_data['month_summary'].total_transactions
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving heatmap data: {str(e)}")

# Document Management Endpoints

@app.post("/api/documents/upload", response_model=schemas.Document)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    category: DocumentCategory = Form(...),
    status: DocumentStatus = Form(DocumentStatus.PENDING_REVIEW),
    document_date: Optional[date] = Form(None),
    due_date: Optional[date] = Form(None),
    investment_id: Optional[int] = Form(None),
    entity_id: Optional[int] = Form(None),
    is_confidential: bool = Form(False),
    uploaded_by: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated tag names
    db: Session = Depends(get_db)
):
    """Upload a new document with metadata"""
    try:
        # Validate that at least one relationship is specified
        if not investment_id and not entity_id:
            raise HTTPException(
                status_code=400, 
                detail="Document must be associated with either an investment or entity"
            )
        
        # Validate relationships exist
        if investment_id:
            investment = crud.get_investment(db, investment_id)
            if not investment:
                raise HTTPException(status_code=404, detail="Investment not found")
        
        if entity_id:
            entity = crud.get_entity(db, entity_id)
            if not entity:
                raise HTTPException(status_code=404, detail="Entity not found")
        
        # Read file content
        content = await file.read()
        
        # Process file upload using document service
        doc_service = get_document_service()
        file_info = doc_service.process_upload(
            filename=file.filename,
            content=content,
            uploaded_by=uploaded_by
        )
        
        # Check for duplicates based on hash
        existing_doc = db.query(models.Document).filter(
            models.Document.file_hash == file_info['file_hash']
        ).first()
        
        if existing_doc:
            raise HTTPException(
                status_code=409,
                detail=f"Document with identical content already exists (ID: {existing_doc.id})"
            )
        
        # Create document record
        document_data = schemas.DocumentCreate(
            title=title,
            description=description,
            category=category,
            status=status,
            document_date=document_date,
            due_date=due_date,
            investment_id=investment_id,
            entity_id=entity_id,
            is_confidential=is_confidential
        )
        
        db_document = crud.create_document(db, document_data, file_info)
        
        # Add tags if provided
        if tags:
            tag_names = [tag.strip() for tag in tags.split(',') if tag.strip()]
            for tag_name in tag_names:
                tag_data = schemas.DocumentTagCreate(tag_name=tag_name)
                crud.create_document_tag(db, db_document.id, tag_data)
        
        # Refresh to get all relationships
        db.refresh(db_document)
        return crud.get_document(db, db_document.id)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

@app.get("/api/documents", response_model=List[schemas.Document])
def get_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    categories: Optional[List[DocumentCategory]] = Query(None),
    statuses: Optional[List[DocumentStatus]] = Query(None),
    investment_ids: Optional[List[int]] = Query(None),
    entity_ids: Optional[List[int]] = Query(None),
    tags: Optional[List[str]] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    due_date_from: Optional[date] = Query(None),
    due_date_to: Optional[date] = Query(None),
    is_confidential: Optional[bool] = Query(None),
    is_archived: Optional[bool] = Query(None),
    uploaded_by: Optional[str] = Query(None),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Get documents with comprehensive filtering"""
    if search or categories or statuses or investment_ids or entity_ids or tags or date_from or date_to or due_date_from or due_date_to or is_confidential is not None or uploaded_by:
        # Use filtered search
        return crud.get_documents_filtered(
            db=db,
            skip=skip,
            limit=limit,
            search=search,
            categories=[cat.value for cat in categories] if categories else None,
            statuses=[status.value for status in statuses] if statuses else None,
            investment_ids=investment_ids,
            entity_ids=entity_ids,
            tags=tags,
            date_from=str(date_from) if date_from else None,
            date_to=str(date_to) if date_to else None,
            due_date_from=str(due_date_from) if due_date_from else None,
            due_date_to=str(due_date_to) if due_date_to else None,
            is_confidential=is_confidential,
            is_archived=is_archived,
            uploaded_by=uploaded_by
        )
    else:
        # Use simple pagination
        return crud.get_documents(db=db, skip=skip, limit=limit, include_archived=include_archived)

@app.get("/api/documents/{document_id}", response_model=schemas.Document)
def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get a specific document with all metadata"""
    document = crud.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@app.put("/api/documents/{document_id}", response_model=schemas.Document)
def update_document(
    document_id: int,
    document_update: schemas.DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Update document metadata"""
    # Validate relationships if being updated
    if document_update.investment_id:
        investment = crud.get_investment(db, document_update.investment_id)
        if not investment:
            raise HTTPException(status_code=404, detail="Investment not found")
    
    if document_update.entity_id:
        entity = crud.get_entity(db, document_update.entity_id)
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
    
    updated_document = crud.update_document(db, document_id, document_update, current_user)
    if not updated_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return crud.get_document(db, document_id)

@app.delete("/api/documents/{document_id}")
def delete_document(
    document_id: int,
    permanent: bool = Query(False, description="Permanently delete the document"),
    db: Session = Depends(get_db)
):
    """Delete a document (soft delete by default, permanent if specified)"""
    # Get document to check if it exists and get file path for permanent deletion
    document = crud.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    success = crud.delete_document(db, document_id, soft_delete=not permanent)
    
    if success and permanent:
        # Also delete the physical file
        doc_service = get_document_service()
        doc_service.delete_file(document.file_path)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete document")
    
    action = "permanently deleted" if permanent else "archived"
    return {"message": f"Document {action} successfully"}

@app.get("/api/documents/{document_id}/download")
async def download_document(document_id: int, db: Session = Depends(get_db)):
    """Download a document file"""
    document = crud.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="Document file not found on disk")
    
    return FileResponse(
        path=document.file_path,
        filename=document.original_filename,
        media_type=document.mime_type
    )

@app.post("/api/documents/{document_id}/tags", response_model=schemas.DocumentTag)
def add_document_tag(
    document_id: int,
    tag: schemas.DocumentTagCreate,
    db: Session = Depends(get_db)
):
    """Add a tag to a document"""
    # Check if document exists
    document = crud.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return crud.create_document_tag(db, document_id, tag)

@app.delete("/api/documents/{document_id}/tags/{tag_name}")
def remove_document_tag(
    document_id: int,
    tag_name: str,
    db: Session = Depends(get_db)
):
    """Remove a tag from a document"""
    success = crud.remove_document_tag(db, document_id, tag_name)
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found on document")
    return {"message": "Tag removed successfully"}

@app.get("/api/documents/search", response_model=List[schemas.DocumentSearchResult])
def search_documents(
    q: str = Query(..., min_length=1, description="Search query"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Advanced document search with relevance scoring"""
    results = crud.search_documents(db, q, skip, limit)
    
    # Convert to schema format
    search_results = []
    for result in results:
        search_result = schemas.DocumentSearchResult(
            document=result['document'],
            relevance_score=result['relevance_score'],
            highlight_snippets=result['highlight_snippets']
        )
        search_results.append(search_result)
    
    return search_results

@app.get("/api/documents/statistics", response_model=schemas.DocumentStatistics)
def get_document_statistics(db: Session = Depends(get_db)):
    """Get comprehensive document management statistics"""
    stats = crud.get_document_statistics(db)
    
    # Add entity and investment names to the statistics
    entity_stats = {}
    for entity_id, count in stats.get('by_entity', {}).items():
        entity = crud.get_entity(db, entity_id)
        entity_name = entity.name if entity else f"Entity {entity_id}"
        entity_stats[entity_name] = count
    
    investment_stats = {}
    for investment_id, count in stats.get('by_investment', {}).items():
        investment = crud.get_investment(db, investment_id)
        investment_name = investment.name if investment else f"Investment {investment_id}"
        investment_stats[investment_name] = count
    
    return schemas.DocumentStatistics(
        total_documents=stats['total_documents'],
        by_category=stats['by_category'],
        by_status=stats['by_status'],
        by_entity=entity_stats,
        by_investment=investment_stats,
        pending_action_count=stats['pending_action_count'],
        overdue_count=stats['overdue_count'],
        recent_uploads_count=stats['recent_uploads_count'],
        total_file_size=stats['total_file_size']
    )

@app.get("/api/documents/tags", response_model=List[str])
def get_all_document_tags(db: Session = Depends(get_db)):
    """Get all unique tag names across documents"""
    return crud.get_all_document_tags(db)

@app.get("/api/investments/{investment_id}/documents", response_model=List[schemas.Document])
def get_investment_documents(
    investment_id: int,
    include_archived: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Get all documents for a specific investment"""
    # Verify investment exists
    investment = crud.get_investment(db, investment_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    return crud.get_documents_by_investment(db, investment_id, include_archived)

@app.get("/api/entities/{entity_id}/documents", response_model=List[schemas.Document])
def get_entity_documents(
    entity_id: int,
    include_archived: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Get all documents for a specific entity"""
    # Verify entity exists
    entity = crud.get_entity(db, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    return crud.get_documents_by_entity(db, entity_id, include_archived)

# Advanced Entity Relationship Management Endpoints

@app.post("/api/entity-relationships", response_model=schemas.EntityRelationship)
def create_entity_relationship(
    relationship: schemas.EntityRelationshipCreate,
    db: Session = Depends(get_db)
):
    """Create a new entity relationship"""
    return EntityRelationshipService.create_relationship(db, relationship)

@app.get("/api/entity-relationships", response_model=List[schemas.EntityRelationshipWithEntities])
def get_entity_relationships(
    entity_id: Optional[int] = Query(None, description="Filter by entity ID (from or to)"),
    relationship_type: Optional[AdvancedRelationshipType] = Query(None, description="Filter by relationship type"),
    include_inactive: bool = Query(False, description="Include inactive relationships"),
    db: Session = Depends(get_db)
):
    """Get entity relationships with filtering options"""
    return EntityRelationshipService.get_relationships(db, entity_id, relationship_type, include_inactive)

@app.put("/api/entity-relationships/{relationship_id}", response_model=schemas.EntityRelationship)
def update_entity_relationship(
    relationship_id: int,
    relationship_update: schemas.EntityRelationshipUpdate,
    db: Session = Depends(get_db)
):
    """Update an entity relationship"""
    return EntityRelationshipService.update_relationship(db, relationship_id, relationship_update)

@app.delete("/api/entity-relationships/{relationship_id}")
def delete_entity_relationship(relationship_id: int, db: Session = Depends(get_db)):
    """Delete an entity relationship"""
    EntityRelationshipService.delete_relationship(db, relationship_id)
    return {"message": "Relationship deleted successfully"}

@app.get("/api/entities/{entity_id}/relationships", response_model=schemas.EntityWithRelationships)
def get_entity_with_relationships(entity_id: int, db: Session = Depends(get_db)):
    """Get entity with all its relationships, investments, and hierarchy position"""
    return EntityHierarchyService.get_entity_with_relationships(db, entity_id)

# Investment Ownership Management Endpoints

@app.post("/api/investment-ownership", response_model=schemas.InvestmentOwnership)
def create_investment_ownership(
    ownership: schemas.InvestmentOwnershipCreate,
    db: Session = Depends(get_db)
):
    """Create investment ownership record"""
    return InvestmentOwnershipService.create_ownership(db, ownership)

@app.get("/api/investments/{investment_id}/ownership", response_model=List[schemas.InvestmentOwnershipWithDetails])
def get_investment_ownership(investment_id: int, db: Session = Depends(get_db)):
    """Get ownership breakdown for an investment"""
    return InvestmentOwnershipService.get_investment_ownership(db, investment_id)

@app.get("/api/entities/{entity_id}/investments", response_model=List[schemas.InvestmentOwnershipWithDetails])
def get_entity_investments(entity_id: int, db: Session = Depends(get_db)):
    """Get all investments owned by an entity"""
    return InvestmentOwnershipService.get_entity_investments(db, entity_id)

@app.put("/api/investment-ownership/{ownership_id}", response_model=schemas.InvestmentOwnership)
def update_investment_ownership(
    ownership_id: int,
    ownership_update: schemas.InvestmentOwnershipUpdate,
    db: Session = Depends(get_db)
):
    """Update investment ownership record"""
    return InvestmentOwnershipService.update_ownership(db, ownership_id, ownership_update)

@app.get("/api/investments/{investment_id}/ownership-visualization", response_model=schemas.OwnershipVisualizationData)
def get_ownership_visualization_data(investment_id: int, db: Session = Depends(get_db)):
    """Get data for ownership visualization charts"""
    return InvestmentOwnershipService.get_ownership_visualization_data(db, investment_id)

@app.get("/api/investments/{investment_id}/with-ownership", response_model=schemas.InvestmentWithOwnership)
def get_investment_with_ownership(investment_id: int, db: Session = Depends(get_db)):
    """Get investment with complete ownership breakdown"""
    investment = crud.get_investment(db, investment_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    ownership_records = InvestmentOwnershipService.get_investment_ownership(db, investment_id)
    
    # Validate ownership percentages
    total_percentage = sum(record.ownership_percentage for record in ownership_records)
    ownership_validated = abs(total_percentage - 100.0) <= 0.01  # Allow small rounding tolerance
    
    investment_dict = investment.__dict__.copy()
    investment_dict.update({
        'ownership_records': ownership_records,
        'ownership_validated': ownership_validated
    })
    
    return schemas.InvestmentWithOwnership(**investment_dict)

# Entity Hierarchy Management Endpoints

@app.post("/api/entity-hierarchy", response_model=schemas.EntityHierarchy)
def create_entity_hierarchy_entry(
    hierarchy: schemas.EntityHierarchyCreate,
    db: Session = Depends(get_db)
):
    """Create entity hierarchy entry"""
    return EntityHierarchyService.create_hierarchy_entry(db, hierarchy)

@app.get("/api/entity-hierarchy/family-tree", response_model=schemas.FamilyTreeResponse)
def get_family_tree(db: Session = Depends(get_db)):
    """Get complete family tree structure"""
    return EntityHierarchyService.get_family_tree(db)

@app.get("/api/entity-hierarchy/{entity_id}", response_model=schemas.EntityHierarchy)
def get_entity_hierarchy(entity_id: int, db: Session = Depends(get_db)):
    """Get hierarchy entry for a specific entity"""
    hierarchy = db.query(models.EntityHierarchy).filter(
        models.EntityHierarchy.entity_id == entity_id
    ).first()
    if not hierarchy:
        raise HTTPException(status_code=404, detail="Hierarchy entry not found")
    
    return schemas.EntityHierarchy.from_orm(hierarchy)

@app.put("/api/entity-hierarchy/{hierarchy_id}", response_model=schemas.EntityHierarchy)
def update_entity_hierarchy(
    hierarchy_id: int,
    hierarchy_update: schemas.EntityHierarchyUpdate,
    db: Session = Depends(get_db)
):
    """Update entity hierarchy entry"""
    hierarchy = db.query(models.EntityHierarchy).filter(models.EntityHierarchy.id == hierarchy_id).first()
    if not hierarchy:
        raise HTTPException(status_code=404, detail="Hierarchy entry not found")
    
    # Update fields
    for field, value in hierarchy_update.dict(exclude_unset=True).items():
        setattr(hierarchy, field, value)
    
    # Recalculate hierarchy level if parent changed
    if hierarchy_update.parent_entity_id is not None:
        if hierarchy.parent_entity_id:
            parent_entry = db.query(models.EntityHierarchy).filter(
                models.EntityHierarchy.entity_id == hierarchy.parent_entity_id
            ).first()
            if parent_entry:
                hierarchy.hierarchy_level = parent_entry.hierarchy_level + 1
        else:
            hierarchy.hierarchy_level = 1
    
    db.commit()
    db.refresh(hierarchy)
    
    return schemas.EntityHierarchy.from_orm(hierarchy)


# ===== ENHANCED BASIC AUDITING ENDPOINTS =====

@app.get("/api/audit/user/{username}")
def get_user_activity(
    username: str, 
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    limit: int = Query(50, ge=1, le=200, description="Limit results per category"),
    db: Session = Depends(get_db)
):
    """Get recent activity for a specific user"""
    return crud.get_recent_changes_by_user(db=db, user=username, days=days, limit=limit)

@app.get("/api/audit/investment/{investment_id}")
def get_investment_audit_trail(
    investment_id: int,
    days: int = Query(90, ge=1, le=365, description="Number of days to look back"),
    db: Session = Depends(get_db)
):
    """Get change history for a specific investment"""
    return crud.get_investment_change_history(db=db, investment_id=investment_id, days=days)

@app.get("/api/audit/system")
def get_system_activity(
    days: int = Query(7, ge=1, le=30, description="Number of days to look back"),
    db: Session = Depends(get_db)
):
    """Get system-wide activity summary"""
    return crud.get_system_activity_summary(db=db, days=days)

@app.get("/api/audit/status")
def get_audit_system_status():
    """Get audit system status and information"""
    return {
        "audit_system": "Enhanced Basic Auditing System",
        "version": "1.0.0",
        "status": "active",
        "features": {
            "user_tracking": "All data modifications tracked by user",
            "timestamp_tracking": "Created and updated timestamps on all major entities",
            "change_history": "Investment-specific change tracking",
            "system_activity": "System-wide activity monitoring"
        },
        "tracked_entities": [
            "Entity",
            "Investment", 
            "CashFlow",
            "Valuation",
            "FamilyMember",
            "EntityRelationship",
            "InvestmentOwnership"
        ],
        "audit_fields": ["created_by", "updated_by", "created_date", "updated_date"],
        "endpoints": {
            "/api/audit/user/{username}": "User activity tracking",
            "/api/audit/investment/{investment_id}": "Investment change history",
            "/api/audit/system": "System-wide activity summary",
            "/api/audit/status": "Audit system status"
        }
    }

# Liquidity Forecast & Cash Flow Management Endpoints

@app.get("/api/liquidity/forecast", response_model=dict)
def get_12_month_liquidity_forecast(
    entity_id: Optional[int] = None,
    include_stress_tests: bool = False,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive 12-month liquidity forecast for portfolio or specific entity"""
    from app.liquidity_forecast_service import create_liquidity_forecast_service
    
    service = create_liquidity_forecast_service(db)
    forecast = service.generate_12_month_forecast(entity_id)
    
    response = {
        "forecast_date": forecast.forecast_date.isoformat(),
        "periods": [
            {
                "month_name": p.month_name,
                "period_start": p.period_start.isoformat(),
                "period_end": p.period_end.isoformat(),
                "projected_calls": p.projected_calls,
                "override_calls": p.override_calls,
                "total_calls": p.total_calls,
                "projected_distributions": p.projected_distributions,
                "override_distributions": p.override_distributions,
                "total_distributions": p.total_distributions,
                "net_cash_flow": p.net_cash_flow,
                "cumulative_net_flow": p.cumulative_net_flow,
                "liquidity_gap": p.liquidity_gap,
                "investment_details": p.investment_details
            } for p in forecast.periods
        ],
        "summary": {
            "total_projected_calls": forecast.total_projected_calls,
            "total_projected_distributions": forecast.total_projected_distributions,
            "total_net_flow": forecast.total_net_flow,
            "max_liquidity_gap": forecast.max_liquidity_gap,
            "months_with_gaps": forecast.months_with_gaps
        }
    }
    
    if include_stress_tests:
        stress_scenarios = service.generate_stress_scenarios(forecast)
        response["stress_scenarios"] = {
            name: {
                "summary": {
                    "total_projected_calls": scenario.total_projected_calls,
                    "total_projected_distributions": scenario.total_projected_distributions,
                    "max_liquidity_gap": scenario.max_liquidity_gap,
                    "months_with_gaps": scenario.months_with_gaps
                }
            } for name, scenario in stress_scenarios.items()
        }
    
    return response

@app.get("/api/liquidity/alerts", response_model=List[dict])
def get_liquidity_alerts(
    entity_id: Optional[int] = None,
    cash_buffer: float = 500000.0,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get liquidity alerts and warnings for upcoming periods"""
    from app.liquidity_forecast_service import create_liquidity_forecast_service
    
    service = create_liquidity_forecast_service(db)
    forecast = service.generate_12_month_forecast(entity_id)
    alerts = service.get_liquidity_alerts(forecast, cash_buffer)
    
    return alerts

@app.get("/api/liquidity/matching", response_model=List[dict])
def get_cash_flow_matching_opportunities(
    entity_id: Optional[int] = None,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get cash flow matching opportunities to optimize liquidity"""
    from app.liquidity_forecast_service import create_liquidity_forecast_service
    
    service = create_liquidity_forecast_service(db)
    forecast = service.generate_12_month_forecast(entity_id)
    matches = service.get_cash_flow_matching_opportunities(forecast)
    
    return matches

@app.post("/api/liquidity/adjustments", response_model=dict)
def add_forecast_adjustment(
    adjustment: schemas.ForecastAdjustmentCreate,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add forecast override for known/confirmed cash flows"""
    from app.liquidity_forecast_service import create_liquidity_forecast_service
    
    # Verify investment exists
    investment = crud.get_investment(db, adjustment.investment_id)
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    service = create_liquidity_forecast_service(db)
    override = service.add_forecast_adjustment(
        investment_id=adjustment.investment_id,
        adjustment_date=adjustment.adjustment_date,
        adjustment_type=adjustment.adjustment_type,
        adjustment_amount=adjustment.adjustment_amount,
        reason=adjustment.reason,
        confidence=adjustment.confidence,
        current_user=current_user
    )
    
    return {
        "id": override.id,
        "message": f"Forecast adjustment added for {adjustment.adjustment_type} on {adjustment.adjustment_date}",
        "amount": adjustment.adjustment_amount
    }

@app.get("/api/liquidity/adjustments/{investment_id}", response_model=List[dict])
def get_forecast_adjustments(
    investment_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all active forecast adjustments for an investment"""
    
    adjustments = db.query(models.ForecastAdjustment).filter(
        and_(
            models.ForecastAdjustment.investment_id == investment_id,
            models.ForecastAdjustment.is_active == True
        )
    ).order_by(models.ForecastAdjustment.adjustment_date).all()
    
    return [
        {
            "id": adj.id,
            "adjustment_date": adj.adjustment_date.isoformat(),
            "adjustment_type": adj.adjustment_type,
            "adjustment_amount": adj.adjustment_amount,
            "reason": adj.reason,
            "confidence": adj.confidence,
            "created_by": adj.created_by,
            "created_date": adj.created_date.isoformat() if adj.created_date else None
        } for adj in adjustments
    ]

@app.delete("/api/liquidity/adjustments/{adjustment_id}")
def deactivate_forecast_adjustment(
    adjustment_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deactivate a forecast adjustment (soft delete)"""
    
    adjustment = db.query(models.ForecastAdjustment).filter(
        models.ForecastAdjustment.id == adjustment_id
    ).first()
    
    if not adjustment:
        raise HTTPException(status_code=404, detail="Forecast adjustment not found")
    
    adjustment.is_active = False
    db.commit()
    
    return {"message": "Forecast adjustment deactivated"}

# Enable running with basic python command
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)