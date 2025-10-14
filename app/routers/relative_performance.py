"""
FastAPI router for relative performance comparison between investments and benchmarks

This module provides API endpoints for:
- Comparing individual investments against public market benchmarks
- Comparing asset classes against benchmarks
- Comparing entire portfolio against benchmarks
- Getting available benchmarks for comparison
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Union, Dict, Any
from datetime import date, datetime
import logging

from app.database import get_db
from app.auth import get_current_active_user
from app.models import User
from app.relative_performance_service import get_relative_performance_service
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/relative-performance", tags=["Relative Performance"])

# Response models
class PerformanceDataPoint(BaseModel):
    date: str
    cumulative_contributions: Optional[float] = None
    cumulative_distributions: Optional[float] = None
    current_nav: Optional[float] = None
    total_nav: Optional[float] = None
    tvpi: Optional[float] = None
    indexed_value: float
    monthly_return: Optional[float] = None

class BenchmarkInfo(BaseModel):
    id: int
    name: str
    ticker: str
    category: str

class ComparisonResult(BaseModel):
    investment_performance: List[PerformanceDataPoint]
    benchmark_performances: Dict[int, List[PerformanceDataPoint]]
    benchmarks: List[BenchmarkInfo]
    date_range: Dict[str, str]

class BenchmarkResponse(BaseModel):
    id: int
    name: str
    ticker: str
    category: str
    description: Optional[str] = None

@router.get("/benchmarks", response_model=List[BenchmarkResponse])
def get_available_benchmarks(db: Session = Depends(get_db)):
    """Get list of available benchmarks for comparison"""
    try:
        service = get_relative_performance_service(db)
        benchmarks = service.get_available_benchmarks()
        return benchmarks
    except Exception as e:
        logger.error(f"Error fetching benchmarks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching benchmarks: {str(e)}")

@router.get("/compare", response_model=ComparisonResult)
def compare_performance(
    selection_type: str = Query(..., description="Type of selection: 'investment', 'asset_class', or 'portfolio'"),
    benchmark_ids: str = Query(..., description="Comma-separated list of benchmark IDs"),
    selection_value: Optional[str] = Query(None, description="Investment ID or asset class name (not needed for portfolio)"),
    start_date: Optional[date] = Query(None, description="Start date for comparison (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date for comparison (YYYY-MM-DD)"),
    view_mode: str = Query("absolute", description="Performance view mode: 'absolute' or 'rebased'"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Compare investment/portfolio performance against selected benchmarks

    - **selection_type**: 'investment' (single), 'asset_class' (all investments in class), or 'portfolio' (all investments)
    - **selection_value**: Investment ID (for investment) or asset class name (for asset_class). Not needed for portfolio.
    - **benchmark_ids**: Comma-separated list of benchmark IDs to compare against
    - **start_date**: Optional start date for comparison period
    - **end_date**: Optional end date for comparison period
    """
    try:
        # Validate selection_type
        if selection_type not in ['investment', 'asset_class', 'portfolio']:
            raise HTTPException(
                status_code=400,
                detail="selection_type must be 'investment', 'asset_class', or 'portfolio'"
            )

        # Validate selection_value is provided when needed
        if selection_type in ['investment', 'asset_class'] and not selection_value:
            raise HTTPException(
                status_code=400,
                detail=f"selection_value is required when selection_type is '{selection_type}'"
            )

        # Parse benchmark IDs
        try:
            benchmark_id_list = [int(id.strip()) for id in benchmark_ids.split(',')]
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="benchmark_ids must be a comma-separated list of integers"
            )

        if not benchmark_id_list:
            raise HTTPException(
                status_code=400,
                detail="At least one benchmark ID must be provided"
            )

        # Convert selection_value to appropriate type
        parsed_selection_value: Union[str, int, None] = None
        if selection_value:
            if selection_type == 'investment':
                try:
                    parsed_selection_value = int(selection_value)
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail="selection_value must be a valid integer investment ID"
                    )
            else:  # asset_class
                parsed_selection_value = selection_value

        # Validate view_mode
        if view_mode not in ['absolute', 'rebased']:
            raise HTTPException(
                status_code=400,
                detail="view_mode must be 'absolute' or 'rebased'"
            )

        # Get comparison service and perform comparison
        service = get_relative_performance_service(db)

        result = service.compare_performance(
            selection_type=selection_type,
            selection_value=parsed_selection_value,
            benchmark_ids=benchmark_id_list,
            start_date=start_date,
            end_date=end_date,
            view_mode=view_mode
        )

        # Check for errors in the result
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing performance: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error comparing performance: {str(e)}")

@router.get("/investments")
def get_investments_and_asset_classes(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get list of investments and asset classes for selection dropdowns"""
    try:
        from app.models import Investment, CashFlow

        # Get investments filtered by tenant (exclude archived)
        investments = db.query(Investment).filter(
            Investment.tenant_id == current_user.tenant_id,
            Investment.is_archived == False
        ).all()

        # Get unique asset classes filtered by tenant (exclude archived)
        asset_classes = db.query(Investment.asset_class).distinct().filter(
            Investment.asset_class.isnot(None),
            Investment.tenant_id == current_user.tenant_id,
            Investment.is_archived == False
        ).all()
        asset_classes = [ac[0] for ac in asset_classes if ac[0]]

        investment_list = []
        for inv in investments:
            # Use commitment date as inception date, fallback to earliest cash flow if not set
            inception_date = None
            if inv.commitment_date:
                inception_date = inv.commitment_date.isoformat()
            else:
                # Fallback to earliest cash flow date if no commitment date
                earliest_cf = db.query(CashFlow).filter(
                    CashFlow.investment_id == inv.id
                ).order_by(CashFlow.date.asc()).first()
                inception_date = earliest_cf.date.isoformat() if earliest_cf else None

            investment_list.append({
                "id": inv.id,
                "name": inv.name,
                "entity_name": inv.entity.name if inv.entity else None,
                "asset_class": inv.asset_class,
                "inception_date": inception_date
            })

        # Get earliest date across all investments
        earliest_portfolio_date = None
        if investment_list:
            earliest_dates = [inv["inception_date"] for inv in investment_list if inv["inception_date"]]
            if earliest_dates:
                earliest_portfolio_date = min(earliest_dates)

        return {
            "investments": investment_list,
            "asset_classes": asset_classes,
            "earliest_portfolio_date": earliest_portfolio_date
        }

    except Exception as e:
        logger.error(f"Error fetching investments and asset classes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")

@router.get("/investment/{investment_id}/tvpi-progression")
def get_investment_tvpi_progression(
    investment_id: int,
    start_date: Optional[date] = Query(None, description="Start date for progression (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date for progression (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get TVPI progression over time for a specific investment"""
    try:
        service = get_relative_performance_service(db)
        progression = service.calculate_investment_tvpi_progression(
            investment_id=investment_id,
            start_date=start_date,
            end_date=end_date
        )

        if not progression:
            raise HTTPException(
                status_code=404,
                detail=f"No TVPI progression data found for investment {investment_id}"
            )

        return {
            "investment_id": investment_id,
            "tvpi_progression": progression,
            "date_range": {
                "start": progression[0]["date"] if progression else None,
                "end": progression[-1]["date"] if progression else None
            }
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching TVPI progression for investment {investment_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching TVPI progression: {str(e)}"
        )