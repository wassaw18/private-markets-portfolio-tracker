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
from app.models import CallScheduleType, DistributionTimingType, ForecastScenario

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
        """Generate complete cash flow forecast for investment"""
        
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
        
        # Generate pacing curves
        call_pacing = self.get_call_pacing_curve(scenario_params)
        distribution_curve = self.get_distribution_curve(scenario_params)
        
        # Create annual forecasts
        forecasts = []
        forecast_date = date.today()
        cumulative_calls = 0.0
        cumulative_distributions = 0.0
        
        for year in range(scenario_params.fund_life):
            period_start = date(scenario_params.vintage_year + year, 1, 1)
            period_end = date(scenario_params.vintage_year + year, 12, 31)
            
            # Capital calls
            if year < len(call_pacing):
                period_calls = call_pacing[year] * scenario_params.commitment_amount
            else:
                period_calls = 0.0
            
            # Distributions
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