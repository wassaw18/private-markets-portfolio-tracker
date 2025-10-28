"""
Sophisticated Cash Flow Pacing Model Engine
Transforms investment assumptions into realistic cash flow forecasts with J-curve modeling
"""
from typing import List, Tuple, Dict
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
import math
from dataclasses import dataclass

from sqlalchemy.orm import Session
from app import models, schemas
from app.models import CallScheduleType, DistributionTimingType, ForecastScenario, AssetClass, PacingPattern, InvestmentStructure, PaymentFrequency

# Asset class default configurations with MOIC targets
ASSET_CLASS_DEFAULTS = {
    AssetClass.PRIVATE_CREDIT: {
        'target_moic': 1.3,
        'default_pattern': PacingPattern.IMMEDIATE_STEADY_YIELD,
        'fund_life': 5,
        'investment_period': 1,
        'bow_factor': 0.1,
    },
    AssetClass.PRIVATE_EQUITY: {
        'target_moic': 2.0,
        'default_pattern': PacingPattern.TRADITIONAL_PE,
        'fund_life': 10,
        'investment_period': 4,
        'bow_factor': 0.3,
    },
    AssetClass.REAL_ESTATE: {
        'target_moic': 1.8,
        'default_pattern': PacingPattern.REAL_ESTATE_CORE,
        'fund_life': 8,
        'investment_period': 3,
        'bow_factor': 0.2,
    },
    AssetClass.VENTURE_CAPITAL: {
        'target_moic': 2.5,
        'default_pattern': PacingPattern.VENTURE_CAPITAL,
        'fund_life': 12,
        'investment_period': 3,
        'bow_factor': 0.4,
    },
    AssetClass.REAL_ASSETS: {
        'target_moic': 1.8,
        'default_pattern': PacingPattern.REAL_ESTATE_CORE,
        'fund_life': 8,
        'investment_period': 3,
        'bow_factor': 0.25,
    },
}

@dataclass
class ActualsSummary:
    """Summary of actual cash flows that have occurred"""
    total_calls: float
    total_distributions: float
    last_cashflow_date: date
    commitment_amount: float
    percent_called: float

@dataclass
class PacingParameters:
    """Encapsulate all pacing model parameters"""
    target_irr: float
    target_moic: float
    fund_life: int
    investment_period: int
    bow_factor: float
    call_schedule: CallScheduleType
    distribution_timing: DistributionTimingType
    vintage_year: int
    commitment_amount: float

class PacingModelEngine:
    """Advanced cash flow forecasting engine with J-curve modeling"""
    
    def __init__(self, db: Session):
        self.db = db
        self.model_version = "2.0"
    
    def get_call_pacing_curve(self, params: PacingParameters) -> List[float]:
        """Generate capital call pacing based on schedule type"""
        
        if params.call_schedule == CallScheduleType.FRONT_LOADED:
            # Front-loaded: 40%, 35%, 20%, 5%
            base_pacing = [0.40, 0.35, 0.20, 0.05]
        elif params.call_schedule == CallScheduleType.BACK_LOADED:
            # Back-loaded: 15%, 25%, 35%, 25%
            base_pacing = [0.15, 0.25, 0.35, 0.25]
        else:  # STEADY
            # Steady: 25%, 30%, 30%, 15%
            base_pacing = [0.25, 0.30, 0.30, 0.15]
        
        # Extend or truncate based on investment period
        if params.investment_period != 4:
            # Redistribute pacing across actual investment period
            if params.investment_period < 4:
                # Compress into fewer years
                compressed_pacing = []
                for i in range(params.investment_period):
                    weight = sum(base_pacing[i:i+2]) if i < 3 else base_pacing[3]
                    compressed_pacing.append(min(weight, 1.0))
                # Normalize to sum to 1.0
                total = sum(compressed_pacing)
                base_pacing = [p/total for p in compressed_pacing]
            else:
                # Extend with gradual decline
                extended_pacing = base_pacing.copy()
                remaining = 1.0 - sum(base_pacing)
                for year in range(4, params.investment_period):
                    declining_rate = remaining * (0.8 ** (year - 3))
                    extended_pacing.append(declining_rate)
                    remaining -= declining_rate
                base_pacing = extended_pacing
        
        # Ensure sum equals 1.0
        total = sum(base_pacing)
        return [p/total for p in base_pacing]
    
    def get_distribution_curve(self, params: PacingParameters) -> List[float]:
        """Generate distribution curve based on timing preference and fund life"""
        
        distributions = [0.0] * params.fund_life
        
        # Distribution start timing
        if params.distribution_timing == DistributionTimingType.EARLY:
            start_year = max(2, params.investment_period - 1)  # Start in year 3 or earlier
            peak_year = 5
        elif params.distribution_timing == DistributionTimingType.STEADY:
            start_year = params.investment_period  # Start after investment period
            peak_year = 6
        else:  # BACKEND
            start_year = params.investment_period + 1  # Start 1 year after investment period
            peak_year = 7
        
        # Distribution curve parameters
        total_to_distribute = params.target_moic * params.commitment_amount
        
        # Use bell curve distribution with skew toward backend
        for year in range(start_year, params.fund_life):
            if year <= peak_year:
                # Rising phase - quadratic growth
                position = (year - start_year) / max(1, peak_year - start_year)
                weight = position ** 1.5
            else:
                # Declining phase - exponential decay
                position = (year - peak_year) / max(1, params.fund_life - peak_year - 1)
                weight = math.exp(-2 * position)
            
            distributions[year] = weight
        
        # Normalize to sum to target MOIC
        total_weight = sum(distributions)
        if total_weight > 0:
            distributions = [(d / total_weight) * total_to_distribute for d in distributions]
        
        return distributions
    
    def calculate_j_curve_nav(self, year: int, cumulative_calls: float, 
                              cumulative_distributions: float, params: PacingParameters) -> float:
        """Calculate NAV using J-curve modeling with bow factor"""
        
        if year == 0 or cumulative_calls == 0:
            return 0.0
        
        # Progress through fund life (0 to 1)
        progress = min(year / params.fund_life, 1.0)
        
        # J-curve effect: initial negative performance that recovers
        bow_depth = params.bow_factor  # How deep the J-curve goes (0.1 to 0.5)
        bow_recovery_point = 0.4  # Point where recovery begins (40% through fund life)
        
        if progress <= bow_recovery_point:
            # In the bow of the J-curve - negative or minimal performance
            bow_multiplier = 1.0 - (bow_depth * (1.0 - (progress / bow_recovery_point) ** 2))
        else:
            # Recovery and growth phase
            recovery_progress = (progress - bow_recovery_point) / (1.0 - bow_recovery_point)
            target_multiple = params.target_moic
            bow_multiplier = 1.0 - bow_depth + (bow_depth + (target_multiple - 1.0)) * (recovery_progress ** 1.5)
        
        # Calculate expected NAV
        expected_total_value = cumulative_calls * bow_multiplier
        nav = max(expected_total_value - cumulative_distributions, 0.0)
        
        return nav
    
    def generate_forecast(self, investment: models.Investment,
                         scenario: ForecastScenario = ForecastScenario.BASE) -> List[models.CashFlowForecast]:
        """Generate complete cash flow forecast for investment using pattern-based approach"""

        # Get actual cash flows to reconcile with forecasts
        actuals = self.get_actuals_summary(investment)

        # Check if this is a loan with contractual terms - use precise calculation instead of patterns
        if (investment.investment_structure == InvestmentStructure.LOAN and
            investment.interest_rate is not None and
            investment.maturity_date is not None and
            investment.payment_frequency is not None):
            return self.generate_loan_forecast(investment, actuals, scenario)

        # Determine which pattern to use
        pattern = investment.pacing_pattern
        if not pattern:
            # Use asset class default if no pattern specified
            asset_class_config = ASSET_CLASS_DEFAULTS.get(investment.asset_class)
            pattern = asset_class_config['default_pattern'] if asset_class_config else PacingPattern.TRADITIONAL_PE

        params = PacingParameters(
            target_irr=investment.target_irr,
            target_moic=investment.target_moic,
            fund_life=investment.fund_life,
            investment_period=investment.investment_period,
            bow_factor=investment.bow_factor,
            call_schedule=investment.call_schedule,
            distribution_timing=investment.distribution_timing,
            vintage_year=investment.vintage_year,
            commitment_amount=investment.commitment_amount
        )

        # Apply scenario adjustments
        scenario_params = self.apply_scenario_adjustments(params, scenario)

        # Generate cash flows based on pattern
        if pattern == PacingPattern.IMMEDIATE_STEADY_YIELD:
            call_curve, distribution_curve = self.pattern_immediate_steady_yield(scenario_params, actuals)
        elif pattern == PacingPattern.IMMEDIATE_BULLET:
            call_curve, distribution_curve = self.pattern_immediate_bullet(scenario_params, actuals)
        elif pattern == PacingPattern.VENTURE_CAPITAL:
            call_curve, distribution_curve = self.pattern_venture_capital(scenario_params, actuals)
        elif pattern == PacingPattern.TRADITIONAL_PE:
            call_curve, distribution_curve = self.pattern_traditional_pe(scenario_params, actuals)
        else:
            # Default to traditional PE pattern for other patterns
            call_curve, distribution_curve = self.pattern_traditional_pe(scenario_params, actuals)

        # Reconcile with actuals (zero out past years, adjust future)
        call_curve, distribution_curve = self.reconcile_with_actuals(
            call_curve, distribution_curve, actuals, scenario_params.vintage_year
        )

        # For backward compatibility, keep old variable names
        call_pacing = call_curve
        distribution_curve = distribution_curve
        
        # Create annual forecasts
        forecasts = []
        forecast_date = date.today()
        cumulative_calls = 0.0
        cumulative_distributions = 0.0

        for year in range(scenario_params.fund_life):
            period_start = date(scenario_params.vintage_year + year, 1, 1)
            period_end = date(scenario_params.vintage_year + year, 12, 31)

            # Capital calls - already in dollar amounts from patterns
            if year < len(call_pacing):
                period_calls = call_pacing[year]
            else:
                period_calls = 0.0

            # Distributions - already in dollar amounts from patterns
            if year < len(distribution_curve):
                period_distributions = distribution_curve[year]
            else:
                period_distributions = 0.0
            
            # Update cumulatives
            cumulative_calls += period_calls
            cumulative_distributions += period_distributions
            cumulative_net_cf = cumulative_distributions - cumulative_calls
            
            # Calculate NAV
            projected_nav = self.calculate_j_curve_nav(year + 1, cumulative_calls, 
                                                     cumulative_distributions, scenario_params)
            
            forecast = models.CashFlowForecast(
                investment_id=investment.id,
                forecast_date=forecast_date,
                scenario=scenario,
                forecast_year=year,
                forecast_period_start=period_start,
                forecast_period_end=period_end,
                projected_calls=period_calls,
                projected_distributions=period_distributions,
                projected_nav=projected_nav,
                cumulative_calls=cumulative_calls,
                cumulative_distributions=cumulative_distributions,
                cumulative_net_cf=cumulative_net_cf,
                model_version=self.model_version,
                confidence_level=0.68 if scenario == ForecastScenario.BASE else 0.50
            )
            
            forecasts.append(forecast)
        
        return forecasts
    
    def apply_scenario_adjustments(self, params: PacingParameters, 
                                 scenario: ForecastScenario) -> PacingParameters:
        """Apply bull/bear scenario adjustments to base parameters"""
        
        if scenario == ForecastScenario.BULL:
            # Bull case: +30% MOIC, +3pp IRR, -10% bow factor
            params.target_moic *= 1.30
            params.target_irr = min(params.target_irr + 0.03, 0.50)  # Cap at 50%
            params.bow_factor *= 0.90  # Shallower J-curve
        elif scenario == ForecastScenario.BEAR:
            # Bear case: -20% MOIC, -2pp IRR, +20% bow factor
            params.target_moic *= 0.80
            params.target_irr = max(params.target_irr - 0.02, 0.01)  # Floor at 1%
            params.bow_factor *= 1.20  # Deeper J-curve
        
        return params

    def get_actuals_summary(self, investment: models.Investment) -> ActualsSummary:
        """Get summary of actual cash flows that have already occurred"""
        from app.models import CashFlowType

        # Query all cash flows for this investment
        cashflows = self.db.query(models.CashFlow).filter(
            models.CashFlow.investment_id == investment.id,
            models.CashFlow.date <= date.today()
        ).all()

        total_calls = sum(
            cf.amount for cf in cashflows
            if cf.type in [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]
        )

        total_distributions = sum(
            cf.amount for cf in cashflows
            if cf.type in [CashFlowType.DISTRIBUTION, CashFlowType.YIELD,
                          CashFlowType.RETURN_OF_PRINCIPAL]
        )

        last_date = max((cf.date for cf in cashflows), default=date.today())
        percent_called = (total_calls / investment.commitment_amount * 100) if investment.commitment_amount > 0 else 0

        return ActualsSummary(
            total_calls=total_calls,
            total_distributions=total_distributions,
            last_cashflow_date=last_date,
            commitment_amount=investment.commitment_amount,
            percent_called=percent_called
        )

    def generate_loan_forecast(self, investment: models.Investment, actuals: ActualsSummary,
                               scenario: ForecastScenario = ForecastScenario.BASE) -> List[models.CashFlowForecast]:
        """
        Generate precise cash flow forecast for loans using contractual terms.
        This bypasses pattern-based modeling and uses actual loan terms:
        - interest_rate: Annual interest rate (as decimal, e.g., 0.05 for 5%)
        - maturity_date: Loan maturity date
        - payment_frequency: How often payments are made
        """
        from dateutil.relativedelta import relativedelta

        # Get loan parameters
        principal = investment.commitment_amount
        annual_rate = investment.interest_rate
        maturity_date = investment.maturity_date
        payment_freq = investment.payment_frequency
        commitment_date = investment.commitment_date or date.today()

        # Determine payment frequency (payments per year)
        if payment_freq == PaymentFrequency.MONTHLY:
            payments_per_year = 12
        elif payment_freq == PaymentFrequency.QUARTERLY:
            payments_per_year = 4
        elif payment_freq == PaymentFrequency.SEMI_ANNUALLY:
            payments_per_year = 2
        elif payment_freq == PaymentFrequency.ANNUALLY:
            payments_per_year = 1
        else:  # AT_MATURITY (bullet)
            payments_per_year = 0

        # Calculate total loan term in years
        loan_term_years = (maturity_date - commitment_date).days / 365.25
        fund_life = math.ceil(loan_term_years) + 1  # Add buffer year

        # Initialize monthly cash flows
        monthly_calls = []
        monthly_distributions = []
        monthly_dates = []

        # Capital call at origination (unless already called)
        current_date = commitment_date
        remaining_principal = principal - actuals.total_calls
        if remaining_principal > 0:
            monthly_calls.append(remaining_principal)
            monthly_distributions.append(0.0)
            monthly_dates.append(current_date)

        # Generate payment schedule
        if payments_per_year > 0:
            # Calculate period interest rate
            period_rate = annual_rate / payments_per_year
            period_months = 12 // payments_per_year

            # Interest-only or amortizing?
            # For simplicity, assume interest-only with principal at maturity
            interest_payment = principal * period_rate

            # Generate periodic payments
            current_date = commitment_date
            while current_date < maturity_date:
                current_date += relativedelta(months=period_months)
                if current_date > date.today():  # Only forecast future payments
                    monthly_calls.append(0.0)

                    if current_date < maturity_date:
                        # Interest payment
                        monthly_distributions.append(interest_payment)
                    else:
                        # Final payment: interest + principal
                        monthly_distributions.append(interest_payment + principal)

                    monthly_dates.append(current_date)
        else:
            # Bullet payment at maturity
            total_interest = principal * annual_rate * loan_term_years
            bullet_payment = principal + total_interest

            monthly_calls.append(0.0)
            monthly_distributions.append(bullet_payment)
            monthly_dates.append(maturity_date)

        # Aggregate monthly cash flows into annual forecasts
        forecasts = []
        forecast_date = date.today()
        vintage_year = commitment_date.year

        for year in range(fund_life):
            year_start = date(vintage_year + year, 1, 1)
            year_end = date(vintage_year + year, 12, 31)

            # Sum all payments in this year
            annual_calls = sum(
                call for call, dt in zip(monthly_calls, monthly_dates)
                if year_start <= dt <= year_end
            )
            annual_distributions = sum(
                dist for dist, dt in zip(monthly_distributions, monthly_dates)
                if year_start <= dt <= year_end
            )

            # Calculate cumulative values
            cumulative_calls = sum(
                call for call, dt in zip(monthly_calls, monthly_dates)
                if dt <= year_end
            )
            cumulative_distributions = sum(
                dist for dist, dt in zip(monthly_distributions, monthly_dates)
                if dt <= year_end
            )
            cumulative_net_cf = cumulative_distributions - cumulative_calls

            # Calculate NAV (outstanding principal for loans)
            if cumulative_distributions >= principal:
                projected_nav = 0.0  # Loan fully repaid
            else:
                projected_nav = principal - (cumulative_distributions - cumulative_calls)
                projected_nav = max(projected_nav, 0.0)

            forecast = models.CashFlowForecast(
                investment_id=investment.id,
                forecast_date=forecast_date,
                scenario=scenario,
                forecast_year=year,
                forecast_period_start=year_start,
                forecast_period_end=year_end,
                projected_calls=annual_calls,
                projected_distributions=annual_distributions,
                projected_nav=projected_nav,
                cumulative_calls=cumulative_calls,
                cumulative_distributions=cumulative_distributions,
                cumulative_net_cf=cumulative_net_cf,
                model_version=self.model_version + "-LOAN",
                confidence_level=0.95  # High confidence for contractual cash flows
            )

            forecasts.append(forecast)

        return forecasts

    def pattern_immediate_steady_yield(self, params: PacingParameters, actuals: ActualsSummary) -> Tuple[List[float], List[float]]:
        """
        Pattern: Immediate Steady Yield (for private debt, loans)
        - 100% capital call upfront (year 0)
        - Steady quarterly yield payments throughout life
        - Principal returned at maturity
        """
        calls = [0.0] * params.fund_life
        distributions = [0.0] * params.fund_life

        # Capital call in year 0 (unless already called)
        remaining_commitment = params.commitment_amount - actuals.total_calls
        if remaining_commitment > 0:
            calls[0] = remaining_commitment

        # Calculate annual yield rate from MOIC
        # MOIC = 1.0 (return of principal) + yield over life
        annual_yield_rate = (params.target_moic - 1.0) / params.fund_life
        annual_yield_amount = params.commitment_amount * annual_yield_rate

        # Distribute yield evenly across fund life
        for year in range(params.fund_life):
            if year < params.fund_life - 1:
                # Regular yield payments
                distributions[year] = annual_yield_amount
            else:
                # Final year: yield + return of principal
                distributions[year] = annual_yield_amount + params.commitment_amount

        return calls, distributions

    def pattern_immediate_bullet(self, params: PacingParameters, actuals: ActualsSummary) -> Tuple[List[float], List[float]]:
        """
        Pattern: Immediate Bullet (for bonds, structured products)
        - 100% capital call upfront (year 0)
        - No interim cash flows
        - Single bullet payment at maturity (principal + gain)
        """
        calls = [0.0] * params.fund_life
        distributions = [0.0] * params.fund_life

        # Capital call in year 0 (unless already called)
        remaining_commitment = params.commitment_amount - actuals.total_calls
        if remaining_commitment > 0:
            calls[0] = remaining_commitment

        # Bullet payment at maturity
        maturity_year = params.fund_life - 1
        distributions[maturity_year] = params.commitment_amount * params.target_moic

        return calls, distributions

    def pattern_traditional_pe(self, params: PacingParameters, actuals: ActualsSummary) -> Tuple[List[float], List[float]]:
        """
        Pattern: Traditional Private Equity
        - Capital calls over investment period (typically 4 years)
        - Distributions start after investment period, peak in years 6-8
        - Uses existing sophisticated curves
        """
        # Use existing methods for traditional PE pattern
        calls_pacing = self.get_call_pacing_curve(params)

        # Adjust for already-called capital
        remaining_commitment = params.commitment_amount - actuals.total_calls
        calls = [pacing * remaining_commitment for pacing in calls_pacing]

        # Pad with zeros if needed
        while len(calls) < params.fund_life:
            calls.append(0.0)

        # Generate distribution curve
        distributions = self.get_distribution_curve(params)

        return calls, distributions

    def pattern_venture_capital(self, params: PacingParameters, actuals: ActualsSummary) -> Tuple[List[float], List[float]]:
        """
        Pattern: Venture Capital
        - Fast capital deployment (3 years)
        - Long tail of distributions (years 5-12)
        - Higher risk, higher potential returns
        """
        calls = [0.0] * params.fund_life
        distributions = [0.0] * params.fund_life

        # Fast call schedule: 40%, 40%, 20% over 3 years
        call_pacing = [0.40, 0.40, 0.20]
        remaining_commitment = params.commitment_amount - actuals.total_calls

        for year, pacing in enumerate(call_pacing):
            if year < params.fund_life:
                calls[year] = pacing * remaining_commitment

        # Long tail distribution pattern (years 5-12)
        total_to_distribute = params.target_moic * params.commitment_amount
        start_year = 4  # Start distributions in year 5

        # Exponential growth then decay pattern
        for year in range(start_year, params.fund_life):
            if year <= 7:
                # Growing phase
                weight = ((year - start_year + 1) / 4) ** 2
            else:
                # Tail phase
                weight = math.exp(-0.3 * (year - 7))
            distributions[year] = weight

        # Normalize distributions
        total_weight = sum(distributions)
        if total_weight > 0:
            distributions = [(d / total_weight) * total_to_distribute for d in distributions]

        return calls, distributions

    def reconcile_with_actuals(self, forecasted_calls: List[float], forecasted_distributions: List[float],
                               actuals: ActualsSummary, vintage_year: int) -> Tuple[List[float], List[float]]:
        """
        Reconcile forecasted cash flows with actual cash flows that have occurred.
        Only forecast future cash flows, don't re-forecast the past.
        """
        current_year = date.today().year
        years_elapsed = current_year - vintage_year

        # For years that have passed, zero out the forecasts (actuals will be shown separately)
        for year in range(min(years_elapsed, len(forecasted_calls))):
            forecasted_calls[year] = 0.0
            forecasted_distributions[year] = 0.0

        # Adjust remaining calls based on how much has been called
        remaining_to_call = actuals.commitment_amount - actuals.total_calls
        total_forecasted_calls = sum(forecasted_calls)

        if total_forecasted_calls > 0 and remaining_to_call != total_forecasted_calls:
            # Scale future calls to match remaining commitment
            scale_factor = remaining_to_call / total_forecasted_calls
            forecasted_calls = [c * scale_factor for c in forecasted_calls]

        return forecasted_calls, forecasted_distributions

    def update_investment_forecast(self, investment_id: int, 
                                 scenarios: List[ForecastScenario] = None) -> bool:
        """Update forecast for specific investment"""
        
        if scenarios is None:
            scenarios = [ForecastScenario.BASE, ForecastScenario.BULL, ForecastScenario.BEAR]
        
        try:
            investment = self.db.query(models.Investment).filter(
                models.Investment.id == investment_id
            ).first()
            
            if not investment or not investment.forecast_enabled:
                return False
            
            # Clear existing forecasts for these scenarios
            self.db.query(models.CashFlowForecast).filter(
                models.CashFlowForecast.investment_id == investment_id,
                models.CashFlowForecast.scenario.in_(scenarios)
            ).delete()
            
            # Generate new forecasts
            for scenario in scenarios:
                forecasts = self.generate_forecast(investment, scenario)
                self.db.add_all(forecasts)
            
            # Update last forecast date
            investment.last_forecast_date = datetime.utcnow()
            
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            print(f"Error updating forecast for investment {investment_id}: {e}")
            return False

def create_pacing_model_engine(db: Session) -> PacingModelEngine:
    """Factory function to create pacing model engine"""
    return PacingModelEngine(db)