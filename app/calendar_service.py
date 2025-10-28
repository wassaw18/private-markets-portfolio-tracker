"""
Cash Flow Calendar Data Aggregation Service

Provides calendar-based aggregation of cash flows for visual calendar display
Combines actual historical cash flows with projected future cash flows from pacing model
"""

from typing import List, Dict, Optional, Tuple
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from dataclasses import dataclass
from collections import defaultdict
import calendar

from sqlalchemy.orm import Session
from sqlalchemy import and_, func, extract
from app import models

@dataclass
class DailyCashFlow:
    """Single day cash flow summary"""
    date: date
    total_inflows: float = 0.0
    total_outflows: float = 0.0
    net_flow: float = 0.0
    transaction_count: int = 0
    transactions: List[Dict] = None
    
    def __post_init__(self):
        if self.transactions is None:
            self.transactions = []
        self.net_flow = self.total_inflows - self.total_outflows

@dataclass 
class PeriodSummary:
    """Period aggregation summary"""
    start_date: date
    end_date: date
    total_inflows: float = 0.0
    total_outflows: float = 0.0
    net_flow: float = 0.0
    active_days: int = 0
    total_transactions: int = 0
    largest_single_day: float = 0.0
    largest_single_day_date: Optional[date] = None
    most_active_day: Optional[date] = None
    most_active_day_count: int = 0
    
    def __post_init__(self):
        self.net_flow = self.total_inflows - self.total_outflows

@dataclass
class MonthlyCalendar:
    """Complete monthly calendar with daily cash flows"""
    year: int
    month: int
    month_name: str
    daily_flows: List[DailyCashFlow]
    period_summary: PeriodSummary
    previous_month: Tuple[int, int]  # (year, month)
    next_month: Tuple[int, int]      # (year, month)

class CashFlowCalendarService:
    """Service for calendar-based cash flow aggregation and analysis"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_daily_cash_flows(self, start_date: date, end_date: date, include_forecasts: bool = True) -> List[DailyCashFlow]:
        """Get daily cash flow aggregations for date range"""
        
        # Get actual cash flows
        actual_flows = self.db.query(models.CashFlow).filter(
            models.CashFlow.date >= start_date,
            models.CashFlow.date <= end_date
        ).join(models.Investment).all()
        
        # Group by date
        daily_data = defaultdict(lambda: {
            'inflows': 0.0,
            'outflows': 0.0,
            'transactions': [],
            'count': 0
        })
        
        # Process actual cash flows
        for cf in actual_flows:
            flow_date = cf.date
            transaction = {
                'id': cf.id,
                'investment_id': cf.investment_id,
                'investment_name': cf.investment.name,
                'type': cf.type.value,
                'amount': cf.amount,
                'is_forecast': False
            }
            
            daily_data[flow_date]['transactions'].append(transaction)
            daily_data[flow_date]['count'] += 1
            
            # Categorize cash flows correctly - include ALL relevant types
            if cf.type in [models.CashFlowType.DISTRIBUTION, models.CashFlowType.YIELD, models.CashFlowType.RETURN_OF_PRINCIPAL]:
                daily_data[flow_date]['inflows'] += cf.amount
            elif cf.type in [models.CashFlowType.CAPITAL_CALL, models.CashFlowType.CONTRIBUTION]:
                daily_data[flow_date]['outflows'] += cf.amount
            # Note: FEES are not included in inflow/outflow calculations
        
        # Get forecasted cash flows if requested
        if include_forecasts:
            forecasted_flows = self._get_forecasted_flows(start_date, end_date)
            
            for forecast in forecasted_flows:
                flow_date = forecast['date']
                
                # Add to daily data
                if forecast['calls'] > 0:
                    daily_data[flow_date]['outflows'] += forecast['calls']
                    daily_data[flow_date]['transactions'].append({
                        'id': f"forecast_{forecast['investment_id']}_{flow_date}",
                        'investment_id': forecast['investment_id'],
                        'investment_name': forecast['investment_name'],
                        'type': 'Forecasted Call',
                        'amount': forecast['calls'],
                        'is_forecast': True
                    })
                    daily_data[flow_date]['count'] += 1
                
                if forecast['distributions'] > 0:
                    daily_data[flow_date]['inflows'] += forecast['distributions']
                    daily_data[flow_date]['transactions'].append({
                        'id': f"forecast_{forecast['investment_id']}_{flow_date}_dist",
                        'investment_id': forecast['investment_id'],
                        'investment_name': forecast['investment_name'],
                        'type': 'Forecasted Distribution',
                        'amount': forecast['distributions'],
                        'is_forecast': True
                    })
                    daily_data[flow_date]['count'] += 1
        
        # Convert to DailyCashFlow objects
        daily_flows = []
        current_date = start_date
        
        while current_date <= end_date:
            data = daily_data.get(current_date, {
                'inflows': 0.0,
                'outflows': 0.0,
                'transactions': [],
                'count': 0
            })
            
            daily_flow = DailyCashFlow(
                date=current_date,
                total_inflows=data['inflows'],
                total_outflows=data['outflows'],
                transaction_count=data['count'],
                transactions=data['transactions']
            )
            
            daily_flows.append(daily_flow)
            current_date += timedelta(days=1)
        
        return daily_flows
    
    def _get_forecasted_flows(self, start_date: date, end_date: date) -> List[Dict]:
        """Get forecasted cash flows from pacing model, distributed across months"""
        # Query forecasts that overlap with the requested date range
        forecasts = self.db.query(models.CashFlowForecast).filter(
            models.CashFlowForecast.forecast_period_start <= end_date,
            models.CashFlowForecast.forecast_period_end >= start_date,
            models.CashFlowForecast.scenario == models.ForecastScenario.BASE  # Use base case
        ).join(models.Investment).all()

        forecast_flows = []

        for f in forecasts:
            # Calculate the number of months in the forecast period
            period_start = max(f.forecast_period_start, start_date)
            period_end = min(f.forecast_period_end, end_date)

            # Calculate total months in the forecast period
            total_months_in_forecast = (
                (f.forecast_period_end.year - f.forecast_period_start.year) * 12 +
                (f.forecast_period_end.month - f.forecast_period_start.month) + 1
            )

            # Distribute the forecast amounts evenly across months in the period
            monthly_calls = f.projected_calls / total_months_in_forecast if total_months_in_forecast > 0 else 0
            monthly_distributions = f.projected_distributions / total_months_in_forecast if total_months_in_forecast > 0 else 0

            # Generate monthly entries for each month in the period that overlaps with our date range
            current_month = period_start.replace(day=1)
            while current_month <= period_end:
                # Only include if this month falls within both the forecast period and requested range
                if (current_month >= f.forecast_period_start and
                    current_month <= f.forecast_period_end and
                    current_month >= start_date and
                    current_month <= end_date):

                    # Use the 15th of each month as the representative date for monthly forecasts
                    forecast_date = current_month.replace(day=15)

                    forecast_flows.append({
                        'date': forecast_date,
                        'investment_id': f.investment_id,
                        'investment_name': f.investment.name,
                        'calls': monthly_calls,
                        'distributions': monthly_distributions
                    })

                # Move to next month
                if current_month.month == 12:
                    current_month = current_month.replace(year=current_month.year + 1, month=1)
                else:
                    current_month = current_month.replace(month=current_month.month + 1)

        return forecast_flows
    
    def get_period_summary(self, start_date: date, end_date: date, include_forecasts: bool = True) -> PeriodSummary:
        """Calculate summary statistics for a period"""
        daily_flows = self.get_daily_cash_flows(start_date, end_date, include_forecasts)
        
        total_inflows = sum(df.total_inflows for df in daily_flows)
        total_outflows = sum(df.total_outflows for df in daily_flows)
        active_days = len([df for df in daily_flows if df.transaction_count > 0])
        total_transactions = sum(df.transaction_count for df in daily_flows)
        
        # Find largest single day and most active day
        largest_day = max(daily_flows, key=lambda df: abs(df.net_flow), default=None)
        most_active = max(daily_flows, key=lambda df: df.transaction_count, default=None)
        
        return PeriodSummary(
            start_date=start_date,
            end_date=end_date,
            total_inflows=total_inflows,
            total_outflows=total_outflows,
            active_days=active_days,
            total_transactions=total_transactions,
            largest_single_day=abs(largest_day.net_flow) if largest_day else 0.0,
            largest_single_day_date=largest_day.date if largest_day and largest_day.net_flow != 0 else None,
            most_active_day=most_active.date if most_active and most_active.transaction_count > 0 else None,
            most_active_day_count=most_active.transaction_count if most_active else 0
        )
    
    def get_monthly_calendar(self, year: int, month: int, include_forecasts: bool = True) -> MonthlyCalendar:
        """Get complete monthly calendar with cash flow data"""
        
        # Calculate date range for month
        start_date = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)
        
        # Get daily flows and period summary
        daily_flows = self.get_daily_cash_flows(start_date, end_date, include_forecasts)
        period_summary = self.get_period_summary(start_date, end_date, include_forecasts)
        
        # Calculate previous and next months
        prev_month_date = start_date - relativedelta(months=1)
        next_month_date = start_date + relativedelta(months=1)
        
        return MonthlyCalendar(
            year=year,
            month=month,
            month_name=calendar.month_name[month],
            daily_flows=daily_flows,
            period_summary=period_summary,
            previous_month=(prev_month_date.year, prev_month_date.month),
            next_month=(next_month_date.year, next_month_date.month)
        )
    
    def get_quarterly_summary(self, year: int, quarter: int, include_forecasts: bool = True) -> PeriodSummary:
        """Get quarterly summary (Q1, Q2, Q3, Q4)"""
        if quarter not in [1, 2, 3, 4]:
            raise ValueError("Quarter must be 1, 2, 3, or 4")
        
        # Calculate quarter date range
        start_month = (quarter - 1) * 3 + 1
        start_date = date(year, start_month, 1)
        
        end_month = start_month + 2
        last_day = calendar.monthrange(year, end_month)[1]
        end_date = date(year, end_month, last_day)
        
        return self.get_period_summary(start_date, end_date, include_forecasts)
    
    def get_yearly_summary(self, year: int, include_forecasts: bool = True) -> PeriodSummary:
        """Get yearly summary"""
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        
        return self.get_period_summary(start_date, end_date, include_forecasts)
    
    def get_cash_flow_heatmap_data(self, year: int, month: int, include_forecasts: bool = True) -> Dict:
        """Get heat map data for calendar visualization"""
        monthly_calendar = self.get_monthly_calendar(year, month, include_forecasts)
        
        # Calculate heat map intensity based on net flow amounts
        flows = monthly_calendar.daily_flows
        if not flows:
            return {'max_flow': 0, 'min_flow': 0, 'daily_intensities': {}}
        
        net_flows = [abs(df.net_flow) for df in flows if df.transaction_count > 0]
        max_flow = max(net_flows) if net_flows else 0
        min_flow = min(net_flows) if net_flows else 0
        
        # Calculate intensity (0-1) for each day
        daily_intensities = {}
        for df in flows:
            if df.transaction_count > 0 and max_flow > 0:
                intensity = abs(df.net_flow) / max_flow
                daily_intensities[df.date.day] = {
                    'intensity': intensity,
                    'net_flow': df.net_flow,
                    'is_positive': df.net_flow >= 0,
                    'transaction_count': df.transaction_count
                }
        
        return {
            'max_flow': max_flow,
            'min_flow': min_flow,
            'daily_intensities': daily_intensities,
            'month_summary': monthly_calendar.period_summary
        }

def create_calendar_service(db: Session) -> CashFlowCalendarService:
    """Factory function to create calendar service"""
    return CashFlowCalendarService(db)