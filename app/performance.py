from typing import List, Tuple, Optional, Dict
from datetime import date, datetime, timedelta
from dataclasses import dataclass
import math
import statistics
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
    trailing_yield: Optional[float]  # Trailing 12-month yield
    forward_yield: Optional[float]   # Forward yield projection
    yield_frequency: Optional[str]   # Detected distribution frequency
    trailing_yield_amount: Optional[float]  # Dollar amount of trailing 12-month yield
    latest_yield_amount: Optional[float]    # Dollar amount of most recent single yield
    
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

def get_latest_nav(valuations: List[models.Valuation], max_age_days: Optional[int] = None) -> Optional[float]:
    """
    Get the most recent NAV value from valuations

    Args:
        valuations: List of valuation objects
        max_age_days: Maximum age in days for valuations to be considered current.
                     If None, returns the latest valuation regardless of age.
                     Default is None to show all valuations in holdings table.

    Returns:
        Latest NAV value, or None if no valuations exist or all are too old
    """
    if not valuations:
        return None

    # Apply age filter if specified
    if max_age_days is not None:
        today = date.today()
        cutoff_date = today - timedelta(days=max_age_days)
        current_valuations = [v for v in valuations if v.date >= cutoff_date]

        if not current_valuations:
            return None  # No valuations within the specified age limit

        latest = max(current_valuations, key=lambda v: v.date)
        return latest.nav_value
    else:
        # No age filter - return the most recent valuation regardless of age
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

def detect_yield_frequency(yield_distributions: List[models.CashFlow]) -> Tuple[Optional[float], Optional[str]]:
    """
    Intelligently detect distribution frequency and return annualization factor
    
    Args:
        yield_distributions: List of YIELD cash flows
        
    Returns:
        Tuple of (frequency_multiplier, frequency_description)
    """
    if len(yield_distributions) < 2:
        return None, "Insufficient data"
    
    # Sort by date and analyze gaps between consecutive yield payments
    sorted_yields = sorted(yield_distributions, key=lambda x: x.date)
    gaps = []
    
    for i in range(1, len(sorted_yields)):
        days_gap = (sorted_yields[i].date - sorted_yields[i-1].date).days
        if days_gap > 0:  # Skip zero or negative gaps
            gaps.append(days_gap)
    
    if not gaps:
        return None, "No valid gaps"
    
    # Get median gap to handle irregular payments
    median_gap = statistics.median(gaps)
    
    # Smart frequency detection with tolerance bands
    if 25 <= median_gap <= 35:          # Monthly (28-31 days)
        return 12.0, "Monthly"
    elif 85 <= median_gap <= 95:        # Quarterly (90±5 days)
        return 4.0, "Quarterly"
    elif 175 <= median_gap <= 190:      # Semi-annual (180±10 days)
        return 2.0, "Semi-annual"
    elif 350 <= median_gap <= 380:      # Annual (365±15 days)
        return 1.0, "Annual"
    elif median_gap < 25:               # More frequent than monthly
        return 12.0, "Monthly (estimated)"  # Conservative assumption
    else:                               # Irregular or sparse
        # Fallback: Use actual time span method
        days_span = (sorted_yields[-1].date - sorted_yields[0].date).days
        payments_count = len(sorted_yields) - 1
        if days_span > 0 and payments_count > 0:
            avg_frequency = (payments_count * 365.25) / days_span
            return round(avg_frequency, 1), "Irregular"
        return None, "Cannot determine"

def calculate_yield_metrics(
    cash_flows: List[models.CashFlow], 
    current_nav: Optional[float], 
    total_contributions: float
) -> Tuple[Optional[float], Optional[float], Optional[str], Optional[float], Optional[float]]:
    """
    Calculate trailing 12-month yield and forward yield with frequency detection
    
    Args:
        cash_flows: All cash flows for the investment
        current_nav: Current NAV value
        total_contributions: Total capital contributions
        
    Returns:
        Tuple of (trailing_yield, forward_yield, frequency_description, trailing_yield_amount, latest_yield_amount)
    """
    from app.models import CashFlowType

    today = date.today()

    # Filter for yield distributions only - ONLY ACTUAL YIELDS (date <= today)
    # This excludes future projected yields from trailing and forward calculations
    yield_flows = [cf for cf in cash_flows if cf.type == CashFlowType.YIELD and cf.date <= today]

    if not yield_flows:
        return None, None, None, None, None

    # Calculate trailing 12-month yield
    trailing_yield = None
    trailing_yield_amount = None
    # True trailing 12 months: go back exactly 365 days from today
    # This gives us the most recent 12-month period inclusive of current month
    one_year_ago = today - timedelta(days=365)

    # Only include yields that have actually occurred (already filtered above, but explicit here)
    recent_yields = [cf for cf in yield_flows if cf.date >= one_year_ago and cf.date <= today]
    if recent_yields:
        total_recent_yield = sum(cf.amount for cf in recent_yields)
        trailing_yield_amount = total_recent_yield  # Store the raw dollar amount
        # Use current NAV if available, otherwise use absolute value of contributions
        yield_base = current_nav if current_nav and current_nav > 0 else abs(total_contributions)
        if yield_base > 0:
            trailing_yield = total_recent_yield / yield_base

    # Calculate forward yield with frequency detection
    forward_yield = None
    frequency_description = None
    latest_yield_amount = None

    if len(yield_flows) >= 1:
        # Get most recent ACTUAL yield payment (date <= today)
        # yield_flows is already filtered to only include actual payments
        latest_yield = max(yield_flows, key=lambda x: x.date)
        latest_amount = latest_yield.amount
        latest_yield_amount = latest_amount  # Store the raw dollar amount
        
        if len(yield_flows) >= 2:
            # Detect frequency for annualization
            frequency_multiplier, freq_desc = detect_yield_frequency(yield_flows)
            
            if frequency_multiplier and latest_amount > 0:
                # Calculate remaining yield potential from today through end of 12-month cycle from last payment
                last_payment_date = latest_yield.date
                
                # Calculate the end of the 12-month cycle from last payment
                # For example, if last payment was Dec 31, 2024, cycle ends Dec 31, 2025
                if last_payment_date.month == 12:
                    cycle_end = date(last_payment_date.year + 1, 12, 31)
                else:
                    # Find the same month next year, or end of year if past that month
                    try:
                        cycle_end = date(last_payment_date.year + 1, last_payment_date.month, last_payment_date.day)
                    except ValueError:
                        # Handle leap year edge cases
                        cycle_end = date(last_payment_date.year + 1, 12, 31)
                
                # Calculate remaining time from today to end of cycle
                if today <= cycle_end:
                    remaining_days = (cycle_end - today).days
                    remaining_months = remaining_days / 30.44  # Average days per month
                    
                    # Calculate payment frequency in months (e.g., monthly = every 1 month)
                    payment_interval_months = 12 / frequency_multiplier
                    
                    # Estimate remaining payments based on frequency
                    remaining_payments = remaining_months / payment_interval_months
                    
                    # Calculate projected yield for remaining period
                    projected_yield_amount = latest_amount * remaining_payments
                    
                    yield_base = current_nav if current_nav and current_nav > 0 else abs(total_contributions)
                    if yield_base > 0:
                        forward_yield = projected_yield_amount / yield_base
                        frequency_description = f"{freq_desc} (remaining {remaining_months:.1f} months, ~{remaining_payments:.1f} payments)"
                else:
                    # We're past the cycle end, use standard annualization
                    annualized_yield = latest_amount * frequency_multiplier
                    yield_base = current_nav if current_nav and current_nav > 0 else abs(total_contributions)
                    if yield_base > 0:
                        forward_yield = annualized_yield / yield_base
                        frequency_description = f"{freq_desc} (full year projection)"
        else:
            frequency_description = "Single payment only"
    
    return trailing_yield, forward_yield, frequency_description, trailing_yield_amount, latest_yield_amount

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

    # Calculate totals - ONLY include actual cash flows through today
    # This excludes future projected flows from the capital summary
    today = date.today()
    total_contributions = sum(cf.amount for cf in contributions if cf.date <= today)
    total_distributions = sum(cf.amount for cf in distributions if cf.date <= today)
    current_nav = get_latest_nav(valuations)
    
    # Basic ratios (handle division by zero) - use absolute value since contributions are negative
    abs_contributions = abs(total_contributions)
    dpi = total_distributions / abs_contributions if abs_contributions > 0 else None
    rvpi = current_nav / abs_contributions if abs_contributions > 0 and current_nav is not None else None
    
    # Total Value and TVPI
    total_value = None
    tvpi = None
    if current_nav is not None:
        total_value = current_nav + total_distributions
        tvpi = total_value / abs_contributions if abs_contributions > 0 else None
    
    # IRR Calculation
    irr = None
    if abs_contributions > 0:
        cash_flows = []
        today = date.today()

        # Add contributions as outflows (only those on or before TODAY)
        # This allows users to enter future projected flows that won't be used until those dates pass
        for contrib in contributions:
            if contrib.date <= today:
                cash_flows.append(CashFlowEvent(contrib.date, contrib.amount))

        # Add distributions as positive cash flows (only those on or before TODAY)
        for dist in distributions:
            if dist.date <= today:
                cash_flows.append(CashFlowEvent(dist.date, dist.amount))

        # Add NAV as terminal value at TODAY's date (not the historical NAV date)
        # This captures all actual performance through today, even if cash flows occurred after the NAV date
        if current_nav is not None and current_nav > 0:
            cash_flows.append(CashFlowEvent(today, current_nav))

        # Calculate IRR only if we have meaningful cash flows
        if len(cash_flows) >= 2:
            irr = calculate_irr(cash_flows)
    
    # Calculate yield metrics using all cash flows
    all_cash_flows = contributions + distributions
    trailing_yield, forward_yield, yield_frequency, trailing_yield_amount, latest_yield_amount = calculate_yield_metrics(
        all_cash_flows, current_nav, total_contributions
    )
    
    return PerformanceMetrics(
        irr=irr,
        tvpi=tvpi,
        dpi=dpi,
        rvpi=rvpi,
        total_contributions=total_contributions,
        total_distributions=total_distributions,
        current_nav=current_nav,
        total_value=total_value,
        trailing_yield=trailing_yield,
        forward_yield=forward_yield,
        yield_frequency=yield_frequency,
        trailing_yield_amount=trailing_yield_amount,
        latest_yield_amount=latest_yield_amount
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
    
    # Portfolio-level yield metrics (weighted averages)
    weighted_trailing_yield = None
    weighted_forward_yield = None
    portfolio_yield_frequency = None
    
    if abs(total_contributions) > 0:
        trailing_yield_sum = 0
        forward_yield_sum = 0
        trailing_weight_sum = 0
        forward_weight_sum = 0
        yield_frequencies = []
        
        for m in investments_metrics:
            weight = abs(m.total_contributions)
            
            if m.trailing_yield is not None:
                trailing_yield_sum += m.trailing_yield * weight
                trailing_weight_sum += weight
                
            if m.forward_yield is not None:
                forward_yield_sum += m.forward_yield * weight
                forward_weight_sum += weight
                
            if m.yield_frequency:
                yield_frequencies.append(m.yield_frequency)
        
        weighted_trailing_yield = trailing_yield_sum / trailing_weight_sum if trailing_weight_sum > 0 else None
        weighted_forward_yield = forward_yield_sum / forward_weight_sum if forward_weight_sum > 0 else None
        
        # Most common frequency, or "Mixed" if multiple
        if yield_frequencies:
            from collections import Counter
            freq_counter = Counter(yield_frequencies)
            most_common = freq_counter.most_common(1)[0]
            if most_common[1] == len([f for f in yield_frequencies if f]):  # All same
                portfolio_yield_frequency = most_common[0]
            else:
                portfolio_yield_frequency = "Mixed frequencies"
    
    # Aggregate dollar amounts for portfolio level
    portfolio_trailing_amount = sum(m.trailing_yield_amount or 0 for m in investments_metrics)
    portfolio_latest_amount = sum(m.latest_yield_amount or 0 for m in investments_metrics)
    
    return PerformanceMetrics(
        irr=weighted_irr,
        tvpi=tvpi,
        dpi=dpi,
        rvpi=rvpi,
        total_contributions=total_contributions,
        total_distributions=total_distributions,
        current_nav=current_nav,
        total_value=total_value,
        trailing_yield=weighted_trailing_yield,
        forward_yield=weighted_forward_yield,
        yield_frequency=portfolio_yield_frequency,
        trailing_yield_amount=portfolio_trailing_amount if portfolio_trailing_amount > 0 else None,
        latest_yield_amount=portfolio_latest_amount if portfolio_latest_amount > 0 else None
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


def calculate_true_portfolio_performance(all_cash_flows: List[CashFlowEvent], investment_metrics: List[PerformanceMetrics]) -> PerformanceMetrics:
    """
    Calculate true portfolio performance using aggregated cash flows for accurate IRR
    and summed totals for other metrics
    
    Args:
        all_cash_flows: Combined list of all cash flows from all investments
        investment_metrics: List of individual investment metrics for aggregation
        
    Returns:
        True portfolio-level PerformanceMetrics
    """
    # Calculate true portfolio IRR using all cash flows
    portfolio_irr = calculate_portfolio_irr(all_cash_flows)
    
    # Aggregate totals from individual investments (ensure positive values)
    total_contributions = sum(abs(m.total_contributions) for m in investment_metrics)
    total_distributions = sum(abs(m.total_distributions) for m in investment_metrics)
    
    # Aggregate NAV (sum of all current NAVs)
    current_nav = 0
    nav_count = 0
    for m in investment_metrics:
        if m.current_nav is not None:
            current_nav += m.current_nav
            nav_count += 1
    
    current_nav = current_nav if nav_count > 0 else None
    
    # Portfolio-level ratios using aggregated values
    dpi = total_distributions / total_contributions if total_contributions > 0 else None
    rvpi = current_nav / total_contributions if total_contributions > 0 and current_nav is not None else None
    
    # Total value and TVPI
    total_value = None
    tvpi = None
    if current_nav is not None:
        total_value = current_nav + total_distributions
        tvpi = total_value / total_contributions if total_contributions > 0 else None
    elif total_distributions > 0:
        total_value = total_distributions
        tvpi = total_value / total_contributions if total_contributions > 0 else None
    
    # Aggregate yield metrics (for now, use simple aggregation - could be enhanced later)
    total_trailing_yield = sum(m.trailing_yield_amount for m in investment_metrics if m.trailing_yield_amount)
    total_latest_yield = sum(m.latest_yield_amount for m in investment_metrics if m.latest_yield_amount)
    
    # Calculate portfolio-level yield rates
    trailing_yield = None
    forward_yield = None
    if current_nav and current_nav > 0 and total_trailing_yield > 0:
        trailing_yield = total_trailing_yield / current_nav
        
    return PerformanceMetrics(
        irr=portfolio_irr,  # True portfolio IRR from all cash flows
        tvpi=tvpi,
        dpi=dpi,
        rvpi=rvpi,
        total_contributions=total_contributions,
        total_distributions=total_distributions,
        current_nav=current_nav,
        total_value=total_value,
        trailing_yield=trailing_yield,
        forward_yield=forward_yield,
        yield_frequency=None,  # Portfolio-level frequency is complex to determine
        trailing_yield_amount=total_trailing_yield,
        latest_yield_amount=total_latest_yield
    )