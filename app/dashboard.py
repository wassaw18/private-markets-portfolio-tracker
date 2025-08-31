from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from dataclasses import dataclass
from collections import defaultdict
from app import models
from app.models import CashFlowType
from sqlalchemy.orm import Session
import json

@dataclass
class CommitmentVsCalledData:
    """Data for Commitment vs Called Capital chart"""
    commitment_amount: float
    called_amount: float
    uncalled_amount: float

@dataclass
class AssetAllocationData:
    """Data for Asset Class allocation chart"""
    asset_class: str
    commitment_amount: float
    percentage: float
    count: int

@dataclass
class VintageAllocationData:
    """Data for Vintage Year allocation chart"""
    vintage_year: int
    commitment_amount: float
    percentage: float
    count: int

@dataclass
class TimelineDataPoint:
    """Single point in portfolio value timeline"""
    date: str
    nav_value: float
    cumulative_contributions: float
    cumulative_distributions: float
    net_value: float

@dataclass
class JCurveDataPoint:
    """Single point in J-Curve analysis"""
    date: str
    cumulative_net_cash_flow: float
    cumulative_contributions: float
    cumulative_distributions: float

def get_commitment_vs_called_data(db: Session) -> CommitmentVsCalledData:
    """Calculate total commitment vs called capital across portfolio"""
    
    investments = db.query(models.Investment).all()
    
    total_commitment = sum(inv.commitment_amount for inv in investments)
    total_called = sum(inv.called_amount for inv in investments)
    total_uncalled = total_commitment - total_called
    
    return CommitmentVsCalledData(
        commitment_amount=total_commitment,
        called_amount=total_called,
        uncalled_amount=total_uncalled
    )

def get_allocation_by_asset_class(db: Session) -> List[AssetAllocationData]:
    """Calculate allocation by asset class"""
    
    investments = db.query(models.Investment).all()
    
    if not investments:
        return []
    
    # Group by asset class
    asset_class_data = defaultdict(lambda: {"commitment": 0, "count": 0})
    total_commitment = 0
    
    for inv in investments:
        asset_class_data[inv.asset_class]["commitment"] += inv.commitment_amount
        asset_class_data[inv.asset_class]["count"] += 1
        total_commitment += inv.commitment_amount
    
    # Calculate percentages and create result
    result = []
    for asset_class, data in asset_class_data.items():
        percentage = (data["commitment"] / total_commitment * 100) if total_commitment > 0 else 0
        result.append(AssetAllocationData(
            asset_class=asset_class.value,
            commitment_amount=data["commitment"],
            percentage=percentage,
            count=data["count"]
        ))
    
    # Sort by commitment amount descending
    result.sort(key=lambda x: x.commitment_amount, reverse=True)
    return result

def get_allocation_by_vintage(db: Session) -> List[VintageAllocationData]:
    """Calculate allocation by vintage year"""
    
    investments = db.query(models.Investment).all()
    
    if not investments:
        return []
    
    # Group by vintage year
    vintage_data = defaultdict(lambda: {"commitment": 0, "count": 0})
    total_commitment = 0
    
    for inv in investments:
        vintage_data[inv.vintage_year]["commitment"] += inv.commitment_amount
        vintage_data[inv.vintage_year]["count"] += 1
        total_commitment += inv.commitment_amount
    
    # Calculate percentages and create result
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

def get_portfolio_value_timeline(db: Session) -> List[TimelineDataPoint]:
    """Calculate portfolio value over time based on valuations and cash flows"""
    
    investments = db.query(models.Investment).all()
    
    if not investments:
        return []
    
    # Collect all dates from valuations and cash flows
    all_dates = set()
    
    for inv in investments:
        for val in inv.valuations:
            all_dates.add(val.date)
        for cf in inv.cashflows:
            all_dates.add(cf.date)
    
    if not all_dates:
        return []
    
    # Sort dates
    sorted_dates = sorted(all_dates)
    
    # Calculate values for each date
    timeline_data = []
    
    for current_date in sorted_dates:
        total_nav = 0
        cumulative_contributions = 0
        cumulative_distributions = 0
        
        for inv in investments:
            # Get latest NAV up to current date
            nav_valuations = [v for v in inv.valuations if v.date <= current_date]
            if nav_valuations:
                latest_nav = max(nav_valuations, key=lambda x: x.date)
                total_nav += latest_nav.nav_value
            
            # Get cumulative cash flows up to current date - include ALL relevant types
            contributions = [cf for cf in inv.cashflows 
                           if cf.date <= current_date and cf.type in [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]]
            distributions = [cf for cf in inv.cashflows 
                           if cf.date <= current_date and cf.type in [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL]]
            
            cumulative_contributions += sum(cf.amount for cf in contributions)
            cumulative_distributions += sum(cf.amount for cf in distributions)
        
        net_value = total_nav + cumulative_distributions
        
        timeline_data.append(TimelineDataPoint(
            date=current_date.strftime('%Y-%m-%d'),
            nav_value=total_nav,
            cumulative_contributions=cumulative_contributions,
            cumulative_distributions=cumulative_distributions,
            net_value=net_value
        ))
    
    return timeline_data

def get_j_curve_data(db: Session) -> List[JCurveDataPoint]:
    """Calculate J-Curve data (cumulative net cash flows over time)"""
    
    investments = db.query(models.Investment).all()
    
    if not investments:
        return []
    
    # Collect all cash flow dates
    all_cash_flows = []
    
    for inv in investments:
        for cf in inv.cashflows:
            # Determine if this is a contribution (outflow) or distribution (inflow)
            is_contribution = cf.type in [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]
            is_distribution = cf.type in [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL]
            
            if is_contribution or is_distribution:
                all_cash_flows.append({
                    'date': cf.date,
                    'amount': -cf.amount if is_contribution else cf.amount,
                    'type': cf.type,
                    'is_contribution': is_contribution
                })
    
    if not all_cash_flows:
        return []
    
    # Sort by date
    all_cash_flows.sort(key=lambda x: x['date'])
    
    # Calculate cumulative flows
    j_curve_data = []
    cumulative_net_flow = 0
    cumulative_contributions = 0
    cumulative_distributions = 0
    
    for cf in all_cash_flows:
        if cf['is_contribution']:
            cumulative_contributions += cf['amount'] * -1  # Convert back to positive
        else:
            cumulative_distributions += cf['amount']
        
        cumulative_net_flow += cf['amount']  # Net cash flow (negative for contributions, positive for distributions)
        
        j_curve_data.append(JCurveDataPoint(
            date=cf['date'].strftime('%Y-%m-%d'),
            cumulative_net_cash_flow=cumulative_net_flow,
            cumulative_contributions=cumulative_contributions,
            cumulative_distributions=cumulative_distributions
        ))
    
    return j_curve_data

def get_dashboard_summary_stats(db: Session) -> Dict[str, Any]:
    """Get summary statistics for dashboard overview"""
    
    investments = db.query(models.Investment).all()
    
    if not investments:
        return {
            "total_investments": 0,
            "total_commitment": 0,
            "total_called": 0,
            "total_nav": 0,
            "total_distributions": 0,
            "asset_classes": 0,
            "vintage_years": 0,
            "active_investments": 0
        }
    
    total_commitment = sum(inv.commitment_amount for inv in investments)
    total_called = sum(inv.called_amount for inv in investments)
    
    # Get current NAV values
    total_nav = 0
    active_investments = 0
    
    for inv in investments:
        if inv.valuations:
            latest_val = max(inv.valuations, key=lambda x: x.date)
            total_nav += latest_val.nav_value
            if latest_val.nav_value > 0:
                active_investments += 1
    
    # Get total distributions - include ALL distribution types
    total_distributions = 0
    for inv in investments:
        distributions = [cf for cf in inv.cashflows if cf.type in [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL]]
        total_distributions += sum(cf.amount for cf in distributions)
    
    # Count unique asset classes and vintage years
    asset_classes = len(set(inv.asset_class for inv in investments))
    vintage_years = len(set(inv.vintage_year for inv in investments))
    
    return {
        "total_investments": len(investments),
        "total_commitment": total_commitment,
        "total_called": total_called,
        "total_nav": total_nav,
        "total_distributions": total_distributions,
        "asset_classes": asset_classes,
        "vintage_years": vintage_years,
        "active_investments": active_investments
    }