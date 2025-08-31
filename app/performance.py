from typing import List, Tuple, Optional, Dict
from datetime import date, datetime
from dataclasses import dataclass
import math
from app import models

@dataclass
class CashFlowEvent:
    """Represents a cash flow event for IRR calculations"""
    date: date
    amount: float  # Positive for inflows (distributions), negative for outflows (contributions)

@dataclass
class PerformanceMetrics:
    """Container for all performance metrics"""
    irr: Optional[float]  # Internal Rate of Return (annualized)
    tvpi: Optional[float]  # Total Value to Paid-In (MOIC)
    dpi: Optional[float]   # Distributed to Paid-In
    rvpi: Optional[float]  # Residual Value to Paid-In
    total_contributions: float
    total_distributions: float
    current_nav: Optional[float]
    total_value: Optional[float]  # NAV + Distributions
    
def calculate_irr(cash_flows: List[CashFlowEvent], tolerance: float = 1e-6, max_iterations: int = 1000) -> Optional[float]:
    """
    Calculate Internal Rate of Return using Newton-Raphson method
    
    Args:
        cash_flows: List of CashFlowEvent objects
        tolerance: Convergence tolerance for IRR calculation
        max_iterations: Maximum number of iterations
        
    Returns:
        IRR as decimal (0.15 = 15%), None if calculation fails
    """
    if len(cash_flows) < 2:
        return None
    
    # Initial guess - use a reasonable starting point
    guess = 0.1  # 10%
    
    for _ in range(max_iterations):
        npv = 0
        npv_derivative = 0
        
        # Sort cash flows by date for proper time calculation
        sorted_flows = sorted(cash_flows, key=lambda x: x.date)
        base_date = sorted_flows[0].date
        
        for flow in sorted_flows:
            # Calculate time difference in years (decimal)
            days_diff = (flow.date - base_date).days
            years = days_diff / 365.25
            
            # NPV calculation
            discount_factor = (1 + guess) ** years
            npv += flow.amount / discount_factor
            
            # Derivative for Newton-Raphson
            if discount_factor > 0:
                npv_derivative -= (years * flow.amount) / (discount_factor * (1 + guess))
        
        # Check convergence
        if abs(npv) < tolerance:
            return guess
        
        # Newton-Raphson step
        if abs(npv_derivative) < 1e-10:  # Avoid division by zero
            break
            
        guess = guess - (npv / npv_derivative)
        
        # Keep guess within reasonable bounds
        guess = max(-0.99, min(guess, 10.0))  # -99% to 1000%
    
    return None  # Failed to converge

def get_latest_nav(valuations: List[models.Valuation]) -> Optional[float]:
    """Get the most recent NAV value from valuations"""
    if not valuations:
        return None
    
    latest = max(valuations, key=lambda v: v.date)
    return latest.nav_value

def calculate_called_amount_from_cashflows(cash_flows: List[models.CashFlow]) -> float:
    """
    Calculate total called amount from cash flows
    Sums up CAPITAL_CALL and CONTRIBUTION cash flows
    """
    from app.models import CashFlowType
    called_types = [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]
    
    return sum(
        cf.amount for cf in cash_flows 
        if cf.type in called_types
    )

def calculate_fees_from_cashflows(cash_flows: List[models.CashFlow]) -> float:
    """
    Calculate total fees from cash flows
    Sums up FEES cash flows
    """
    from app.models import CashFlowType
    
    return sum(
        cf.amount for cf in cash_flows 
        if cf.type == CashFlowType.FEES
    )

def calculate_investment_performance(
    contributions: List[models.CashFlow], 
    distributions: List[models.CashFlow],
    valuations: List[models.Valuation]
) -> PerformanceMetrics:
    """
    Calculate comprehensive performance metrics for an investment
    
    Args:
        contributions: List of contribution cash flows
        distributions: List of distribution cash flows  
        valuations: List of NAV valuations
        
    Returns:
        PerformanceMetrics object with all calculated metrics
    """
    
    # Calculate totals
    total_contributions = sum(cf.amount for cf in contributions)
    total_distributions = sum(cf.amount for cf in distributions)
    current_nav = get_latest_nav(valuations)
    
    # Basic ratios (handle division by zero)
    dpi = total_distributions / total_contributions if total_contributions > 0 else None
    rvpi = current_nav / total_contributions if total_contributions > 0 and current_nav is not None else None
    
    # Total Value and TVPI
    total_value = None
    tvpi = None
    if current_nav is not None:
        total_value = current_nav + total_distributions
        tvpi = total_value / total_contributions if total_contributions > 0 else None
    
    # IRR Calculation
    irr = None
    if total_contributions > 0:
        cash_flows = []
        
        # Add contributions as negative cash flows (outflows)
        for contrib in contributions:
            cash_flows.append(CashFlowEvent(contrib.date, -contrib.amount))
        
        # Add distributions as positive cash flows (inflows)  
        for dist in distributions:
            cash_flows.append(CashFlowEvent(dist.date, dist.amount))
        
        # Add current NAV as final positive cash flow if available
        if current_nav is not None and current_nav > 0:
            # Use the latest valuation date, or today if no valuations
            nav_date = valuations[-1].date if valuations else date.today()
            cash_flows.append(CashFlowEvent(nav_date, current_nav))
        
        # Calculate IRR only if we have meaningful cash flows
        if len(cash_flows) >= 2:
            irr = calculate_irr(cash_flows)
    
    return PerformanceMetrics(
        irr=irr,
        tvpi=tvpi,
        dpi=dpi,
        rvpi=rvpi,
        total_contributions=total_contributions,
        total_distributions=total_distributions,
        current_nav=current_nav,
        total_value=total_value
    )

def aggregate_portfolio_performance(investments_metrics: List[PerformanceMetrics]) -> PerformanceMetrics:
    """
    Aggregate individual investment metrics into portfolio-level metrics
    
    Args:
        investments_metrics: List of PerformanceMetrics for each investment
        
    Returns:
        Aggregated PerformanceMetrics for the entire portfolio
    """
    
    # Aggregate totals
    total_contributions = sum(m.total_contributions for m in investments_metrics)
    total_distributions = sum(m.total_distributions for m in investments_metrics)
    
    # Aggregate NAV (sum of all current NAVs)
    current_nav = 0
    nav_count = 0
    for m in investments_metrics:
        if m.current_nav is not None:
            current_nav += m.current_nav
            nav_count += 1
    
    current_nav = current_nav if nav_count > 0 else None
    
    # Portfolio-level ratios
    dpi = total_distributions / total_contributions if total_contributions > 0 else None
    rvpi = current_nav / total_contributions if total_contributions > 0 and current_nav is not None else None
    
    # Total value and TVPI
    total_value = None
    tvpi = None
    if current_nav is not None:
        total_value = current_nav + total_distributions
        tvpi = total_value / total_contributions if total_contributions > 0 else None
    
    # Portfolio IRR calculation would require all individual cash flows
    # For now, we'll calculate a weighted average IRR based on contribution amounts
    weighted_irr = None
    if total_contributions > 0:
        irr_sum = 0
        weight_sum = 0
        
        for m in investments_metrics:
            if m.irr is not None and m.total_contributions > 0:
                weight = m.total_contributions
                irr_sum += m.irr * weight
                weight_sum += weight
        
        weighted_irr = irr_sum / weight_sum if weight_sum > 0 else None
    
    return PerformanceMetrics(
        irr=weighted_irr,
        tvpi=tvpi,
        dpi=dpi,
        rvpi=rvpi,
        total_contributions=total_contributions,
        total_distributions=total_distributions,
        current_nav=current_nav,
        total_value=total_value
    )

def calculate_portfolio_irr(all_cash_flows: List[CashFlowEvent]) -> Optional[float]:
    """
    Calculate true portfolio-level IRR using all cash flows across investments
    
    Args:
        all_cash_flows: Combined list of all cash flows from all investments
        
    Returns:
        Portfolio IRR as decimal, None if calculation fails
    """
    return calculate_irr(all_cash_flows)