"""
12-Month Liquidity Forecast Dashboard Service
Builds on existing pacing model with override capabilities and portfolio-level forecasting
"""

from typing import List, Dict, Tuple, Optional
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app import models, schemas
from app.pacing_model import PacingModelEngine, create_pacing_model_engine

@dataclass
class LiquidityForecastPeriod:
    """Single period in 12-month liquidity forecast"""
    period_start: date
    period_end: date
    month_name: str
    
    # Capital calls (outflows)
    projected_calls: float
    override_calls: float  # Known/confirmed calls
    total_calls: float
    
    # Distributions (inflows)  
    projected_distributions: float
    override_distributions: float  # Known/confirmed distributions
    total_distributions: float
    
    # Net cash flow
    net_cash_flow: float
    cumulative_net_flow: float
    
    # Liquidity metrics
    liquidity_required: float  # Cash needed for calls
    liquidity_available: float  # Expected from distributions
    liquidity_gap: float  # Shortfall or surplus
    
    # Investment breakdown
    investment_details: List[Dict] = None

@dataclass
class PortfolioLiquidityForecast:
    """Complete 12-month portfolio liquidity forecast"""
    forecast_date: date
    periods: List[LiquidityForecastPeriod]
    
    # Portfolio summary metrics
    total_projected_calls: float
    total_projected_distributions: float
    total_net_flow: float
    max_liquidity_gap: float
    months_with_gaps: int
    
    # Risk metrics
    stress_test_results: Dict[str, float] = None
    confidence_level: float = 0.68

class LiquidityForecastService:
    """Enhanced liquidity forecasting with override capabilities"""
    
    def __init__(self, db: Session):
        self.db = db
        self.pacing_engine = create_pacing_model_engine(db)
    
    def generate_12_month_forecast(self, entity_id: Optional[int] = None) -> PortfolioLiquidityForecast:
        """Generate comprehensive 12-month liquidity forecast"""
        
        forecast_date = date.today()
        
        # Get active investments (filter by entity if specified)
        query = self.db.query(models.Investment).filter(models.Investment.is_active == True)
        if entity_id:
            query = query.filter(models.Investment.entity_id == entity_id)
        
        investments = query.all()
        
        # Generate 12 monthly periods
        periods = []
        cumulative_net_flow = 0.0
        
        for month_offset in range(12):
            period_start = forecast_date.replace(day=1) + relativedelta(months=month_offset)
            period_end = period_start + relativedelta(months=1) - timedelta(days=1)
            month_name = period_start.strftime("%B %Y")
            
            # Calculate period cash flows
            period_data = self._calculate_period_cash_flows(
                investments, period_start, period_end
            )
            
            cumulative_net_flow += period_data['net_cash_flow']
            
            period = LiquidityForecastPeriod(
                period_start=period_start,
                period_end=period_end,
                month_name=month_name,
                projected_calls=period_data['projected_calls'],
                override_calls=period_data['override_calls'],
                total_calls=period_data['total_calls'],
                projected_distributions=period_data['projected_distributions'],
                override_distributions=period_data['override_distributions'],
                total_distributions=period_data['total_distributions'],
                net_cash_flow=period_data['net_cash_flow'],
                cumulative_net_flow=cumulative_net_flow,
                liquidity_required=period_data['total_calls'],
                liquidity_available=period_data['total_distributions'],
                liquidity_gap=period_data['total_distributions'] - period_data['total_calls'],
                investment_details=period_data['investment_details']
            )
            
            periods.append(period)
        
        # Calculate portfolio summary metrics
        total_calls = sum(p.total_calls for p in periods)
        total_distributions = sum(p.total_distributions for p in periods)
        total_net_flow = total_distributions - total_calls
        max_gap = min(p.liquidity_gap for p in periods)
        months_with_gaps = sum(1 for p in periods if p.liquidity_gap < 0)
        
        return PortfolioLiquidityForecast(
            forecast_date=forecast_date,
            periods=periods,
            total_projected_calls=total_calls,
            total_projected_distributions=total_distributions,
            total_net_flow=total_net_flow,
            max_liquidity_gap=max_gap,
            months_with_gaps=months_with_gaps
        )
    
    def _calculate_period_cash_flows(self, investments: List[models.Investment], 
                                   period_start: date, period_end: date) -> Dict:
        """Calculate cash flows for a specific period with overrides"""
        
        projected_calls = 0.0
        override_calls = 0.0
        projected_distributions = 0.0
        override_distributions = 0.0
        investment_details = []
        
        for investment in investments:
            # Get pacing model projections for this period
            pacing_data = self._get_pacing_projection_for_period(
                investment, period_start, period_end
            )
            
            # Get any overrides for this period
            adjustments = self._get_adjustments_for_period(
                investment.id, period_start, period_end
            )
            
            # Calculate final amounts (overrides take precedence)
            calls_override = sum(adj.adjustment_amount for adj in adjustments 
                               if adj.adjustment_type == "capital_call")
            dist_override = sum(adj.adjustment_amount for adj in adjustments 
                              if adj.adjustment_type == "distribution")
            
            final_calls = calls_override if calls_override > 0 else pacing_data['calls']
            final_distributions = dist_override if dist_override > 0 else pacing_data['distributions']
            
            # Accumulate totals
            projected_calls += pacing_data['calls']
            override_calls += calls_override
            projected_distributions += pacing_data['distributions']
            override_distributions += dist_override
            
            # Track investment-level details
            if final_calls > 0 or final_distributions > 0:
                investment_details.append({
                    'investment_name': investment.investment_name,
                    'calls': final_calls,
                    'distributions': final_distributions,
                    'has_override': calls_override > 0 or dist_override > 0,
                    'override_reason': ', '.join(adj.reason for adj in adjustments if adj.reason)
                })
        
        return {
            'projected_calls': projected_calls,
            'override_calls': override_calls,
            'total_calls': override_calls + (projected_calls if override_calls == 0 else 0),
            'projected_distributions': projected_distributions,
            'override_distributions': override_distributions,
            'total_distributions': override_distributions + (projected_distributions if override_distributions == 0 else 0),
            'net_cash_flow': (override_distributions + (projected_distributions if override_distributions == 0 else 0)) - 
                           (override_calls + (projected_calls if override_calls == 0 else 0)),
            'investment_details': investment_details
        }
    
    def _get_pacing_projection_for_period(self, investment: models.Investment, 
                                        period_start: date, period_end: date) -> Dict:
        """Get pacing model projection for specific month"""
        
        if not investment.forecast_enabled:
            return {'calls': 0.0, 'distributions': 0.0}
        
        # Find existing forecast that covers this period
        forecast = self.db.query(models.CashFlowForecast).filter(
            and_(
                models.CashFlowForecast.investment_id == investment.id,
                models.CashFlowForecast.scenario == models.ForecastScenario.BASE,
                models.CashFlowForecast.forecast_period_start <= period_start,
                models.CashFlowForecast.forecast_period_end >= period_end
            )
        ).first()
        
        if forecast:
            # Pro-rate annual forecast to monthly
            days_in_forecast = (forecast.forecast_period_end - forecast.forecast_period_start).days + 1
            days_in_period = (period_end - period_start).days + 1
            proration_factor = days_in_period / days_in_forecast
            
            return {
                'calls': forecast.projected_calls * proration_factor,
                'distributions': forecast.projected_distributions * proration_factor
            }
        
        # If no forecast exists, generate one quickly
        try:
            forecasts = self.pacing_engine.generate_forecast(investment)
            # Find the right year and pro-rate to monthly
            vintage_year = investment.vintage_year
            current_year = period_start.year
            forecast_year = current_year - vintage_year
            
            if 0 <= forecast_year < len(forecasts):
                annual_forecast = forecasts[forecast_year]
                # Simple monthly proration (could be enhanced with seasonality)
                monthly_calls = annual_forecast.projected_calls / 12
                monthly_distributions = annual_forecast.projected_distributions / 12
                return {'calls': monthly_calls, 'distributions': monthly_distributions}
        
        except Exception:
            pass
        
        return {'calls': 0.0, 'distributions': 0.0}
    
    def _get_adjustments_for_period(self, investment_id: int, 
                                  period_start: date, period_end: date) -> List[models.ForecastAdjustment]:
        """Get active forecast adjustments for period"""
        
        return self.db.query(models.ForecastAdjustment).filter(
            and_(
                models.ForecastAdjustment.investment_id == investment_id,
                models.ForecastAdjustment.is_active == True,
                models.ForecastAdjustment.adjustment_date >= period_start,
                models.ForecastAdjustment.adjustment_date <= period_end
            )
        ).all()
    
    def add_forecast_adjustment(self, investment_id: int, adjustment_date: date,
                              adjustment_type: str, adjustment_amount: float,
                              reason: str = None, confidence: str = "confirmed",
                              current_user: str = "admin") -> models.ForecastAdjustment:
        """Add override for specific known cash flow"""
        
        adjustment = models.ForecastAdjustment(
            investment_id=investment_id,
            adjustment_date=adjustment_date,
            adjustment_type=adjustment_type,
            adjustment_amount=adjustment_amount,
            reason=reason,
            confidence=confidence,
            created_by=current_user,
            created_date=datetime.utcnow(),
            is_active=True
        )
        
        self.db.add(adjustment)
        self.db.commit()
        return adjustment
    
    def get_liquidity_alerts(self, forecast: PortfolioLiquidityForecast, 
                           cash_buffer: float = 500000.0) -> List[Dict]:
        """Generate liquidity alerts based on forecast"""
        
        alerts = []
        
        for period in forecast.periods:
            # Check for liquidity gaps
            if period.liquidity_gap < -cash_buffer:
                alerts.append({
                    'type': 'liquidity_shortfall',
                    'severity': 'high' if period.liquidity_gap < -cash_buffer * 2 else 'medium',
                    'period': period.month_name,
                    'amount': abs(period.liquidity_gap),
                    'message': f"Potential ${abs(period.liquidity_gap):,.0f} liquidity shortfall in {period.month_name}"
                })
            
            # Check for large capital calls
            if period.total_calls > cash_buffer * 2:
                alerts.append({
                    'type': 'large_capital_call',
                    'severity': 'medium',
                    'period': period.month_name,
                    'amount': period.total_calls,
                    'message': f"Large capital call of ${period.total_calls:,.0f} expected in {period.month_name}"
                })
        
        # Check cumulative liquidity position
        min_cumulative = min(p.cumulative_net_flow for p in forecast.periods)
        if min_cumulative < -cash_buffer * 3:
            alerts.append({
                'type': 'cumulative_exposure',
                'severity': 'high',
                'period': 'Portfolio',
                'amount': abs(min_cumulative),
                'message': f"Maximum cumulative exposure of ${abs(min_cumulative):,.0f} during 12-month period"
            })
        
        return alerts

    def generate_stress_scenarios(self, base_forecast: PortfolioLiquidityForecast) -> Dict[str, PortfolioLiquidityForecast]:
        """Generate stress test scenarios for liquidity planning"""
        
        scenarios = {}
        
        # Accelerated calls scenario (calls come 25% faster)
        accelerated_periods = []
        for i, period in enumerate(base_forecast.periods):
            if i < 9:  # Move some calls forward from later months
                accel_calls = period.total_calls * 1.25
            else:
                accel_calls = period.total_calls * 0.75
            
            accel_period = LiquidityForecastPeriod(
                period_start=period.period_start,
                period_end=period.period_end,
                month_name=period.month_name,
                projected_calls=period.projected_calls,
                override_calls=period.override_calls,
                total_calls=accel_calls,
                projected_distributions=period.projected_distributions,
                override_distributions=period.override_distributions,
                total_distributions=period.total_distributions,
                net_cash_flow=period.total_distributions - accel_calls,
                cumulative_net_flow=0,  # Will recalculate
                liquidity_required=accel_calls,
                liquidity_available=period.total_distributions,
                liquidity_gap=period.total_distributions - accel_calls
            )
            accelerated_periods.append(accel_period)
        
        # Recalculate cumulative flows
        cumulative = 0.0
        for period in accelerated_periods:
            cumulative += period.net_cash_flow
            period.cumulative_net_flow = cumulative
        
        scenarios['accelerated_calls'] = PortfolioLiquidityForecast(
            forecast_date=base_forecast.forecast_date,
            periods=accelerated_periods,
            total_projected_calls=sum(p.total_calls for p in accelerated_periods),
            total_projected_distributions=base_forecast.total_projected_distributions,
            total_net_flow=sum(p.net_cash_flow for p in accelerated_periods),
            max_liquidity_gap=min(p.liquidity_gap for p in accelerated_periods),
            months_with_gaps=sum(1 for p in accelerated_periods if p.liquidity_gap < 0)
        )
        
        # Delayed distributions scenario (distributions come 25% slower)
        delayed_periods = []
        for i, period in enumerate(base_forecast.periods):
            if i > 2:  # Delay distributions from month 3 onwards
                delayed_distributions = period.total_distributions * 0.75
            else:
                delayed_distributions = period.total_distributions
                
            delayed_period = LiquidityForecastPeriod(
                period_start=period.period_start,
                period_end=period.period_end,
                month_name=period.month_name,
                projected_calls=period.projected_calls,
                override_calls=period.override_calls,
                total_calls=period.total_calls,
                projected_distributions=period.projected_distributions,
                override_distributions=period.override_distributions,
                total_distributions=delayed_distributions,
                net_cash_flow=delayed_distributions - period.total_calls,
                cumulative_net_flow=0,  # Will recalculate
                liquidity_required=period.total_calls,
                liquidity_available=delayed_distributions,
                liquidity_gap=delayed_distributions - period.total_calls
            )
            delayed_periods.append(delayed_period)
        
        # Recalculate cumulative flows
        cumulative = 0.0
        for period in delayed_periods:
            cumulative += period.net_cash_flow
            period.cumulative_net_flow = cumulative
        
        scenarios['delayed_distributions'] = PortfolioLiquidityForecast(
            forecast_date=base_forecast.forecast_date,
            periods=delayed_periods,
            total_projected_calls=base_forecast.total_projected_calls,
            total_projected_distributions=sum(p.total_distributions for p in delayed_periods),
            total_net_flow=sum(p.net_cash_flow for p in delayed_periods),
            max_liquidity_gap=min(p.liquidity_gap for p in delayed_periods),
            months_with_gaps=sum(1 for p in delayed_periods if p.liquidity_gap < 0)
        )
        
        return scenarios
    
    def get_cash_flow_matching_opportunities(self, forecast: PortfolioLiquidityForecast) -> List[Dict]:
        """Identify opportunities to match distributions with capital calls"""
        
        matches = []
        
        # Look for periods where distributions can cover calls within 90 days
        for i, period in enumerate(forecast.periods):
            if period.liquidity_gap < 0:  # Need cash
                # Look ahead for distributions
                for j in range(i + 1, min(i + 4, len(forecast.periods))):  # Next 3 months
                    future_period = forecast.periods[j]
                    if future_period.total_distributions > abs(period.liquidity_gap):
                        matches.append({
                            'shortfall_month': period.month_name,
                            'shortfall_amount': abs(period.liquidity_gap),
                            'source_month': future_period.month_name,
                            'source_amount': future_period.total_distributions,
                            'days_gap': (future_period.period_start - period.period_end).days,
                            'match_feasibility': 'high' if j == i + 1 else 'medium'
                        })
                        break
        
        return matches

def create_liquidity_forecast_service(db: Session) -> LiquidityForecastService:
    """Factory function to create liquidity forecast service"""
    return LiquidityForecastService(db)