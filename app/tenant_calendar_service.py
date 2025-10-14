"""
Tenant-Aware Cash Flow Calendar Service

Provides calendar-based aggregation of cash flows with proper tenant isolation.
This is a clean implementation designed from the ground up for multi-tenancy.
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
    """Complete monthly calendar structure"""
    year: int
    month: int
    month_name: str
    daily_flows: List[DailyCashFlow]
    period_summary: PeriodSummary
    previous_month: Tuple[int, int]  # (year, month)
    next_month: Tuple[int, int]      # (year, month)

class TenantAwareCalendarService:
    """Tenant-aware service for calendar-based cash flow aggregation and analysis"""

    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id

    def get_daily_cash_flows(self, start_date: date, end_date: date, include_forecasts: bool = True) -> List[DailyCashFlow]:
        """Get daily cash flow aggregations for date range with tenant filtering"""

        # Get actual cash flows for this tenant
        actual_flows = self.db.query(models.CashFlow).filter(
            models.CashFlow.date >= start_date,
            models.CashFlow.date <= end_date,
            models.Investment.tenant_id == self.tenant_id
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
                'description': cf.notes or '',
                'is_forecast': False
            }

            daily_data[flow_date]['transactions'].append(transaction)
            daily_data[flow_date]['count'] += 1

            # Categorize inflows vs outflows
            if cf.type in [models.CashFlowType.DISTRIBUTION, models.CashFlowType.YIELD,
                          models.CashFlowType.RETURN_OF_PRINCIPAL]:
                daily_data[flow_date]['inflows'] += cf.amount
            else:  # Capital calls, contributions, fees
                daily_data[flow_date]['outflows'] += abs(cf.amount)

        # TODO: Add forecast cash flows if include_forecasts is True
        # This would require implementing tenant-aware pacing model integration

        # Convert to list of DailyCashFlow objects
        result = []
        current_date = start_date
        while current_date <= end_date:
            data = daily_data[current_date]
            daily_flow = DailyCashFlow(
                date=current_date,
                total_inflows=data['inflows'],
                total_outflows=data['outflows'],
                transaction_count=data['count'],
                transactions=data['transactions']
            )
            result.append(daily_flow)
            current_date += timedelta(days=1)

        return result

    def get_period_summary(self, start_date: date, end_date: date, include_forecasts: bool = True) -> PeriodSummary:
        """Get period summary for specified date range"""
        daily_flows = self.get_daily_cash_flows(start_date, end_date, include_forecasts)

        total_inflows = 0.0
        total_outflows = 0.0
        active_days = 0
        total_transactions = 0
        largest_single_day = 0.0
        largest_single_day_date = None
        most_active_day = None
        most_active_day_count = 0

        for daily_flow in daily_flows:
            total_inflows += daily_flow.total_inflows
            total_outflows += daily_flow.total_outflows
            total_transactions += daily_flow.transaction_count

            if daily_flow.transaction_count > 0:
                active_days += 1

            # Track largest single day by net flow
            daily_net = abs(daily_flow.net_flow)
            if daily_net > largest_single_day:
                largest_single_day = daily_net
                largest_single_day_date = daily_flow.date

            # Track most active day by transaction count
            if daily_flow.transaction_count > most_active_day_count:
                most_active_day_count = daily_flow.transaction_count
                most_active_day = daily_flow.date

        return PeriodSummary(
            start_date=start_date,
            end_date=end_date,
            total_inflows=total_inflows,
            total_outflows=total_outflows,
            active_days=active_days,
            total_transactions=total_transactions,
            largest_single_day=largest_single_day,
            largest_single_day_date=largest_single_day_date,
            most_active_day=most_active_day,
            most_active_day_count=most_active_day_count
        )

    def get_monthly_calendar(self, year: int, month: int, include_forecasts: bool = True) -> MonthlyCalendar:
        """Get complete monthly calendar with cash flow data"""
        # Calculate month boundaries
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)

        # Get daily flows and period summary
        daily_flows = self.get_daily_cash_flows(start_date, end_date, include_forecasts)
        period_summary = self.get_period_summary(start_date, end_date, include_forecasts)

        # Calculate previous and next month
        if month == 1:
            prev_month = (year - 1, 12)
        else:
            prev_month = (year, month - 1)

        if month == 12:
            next_month = (year + 1, 1)
        else:
            next_month = (year, month + 1)

        return MonthlyCalendar(
            year=year,
            month=month,
            month_name=calendar.month_name[month],
            daily_flows=daily_flows,
            period_summary=period_summary,
            previous_month=prev_month,
            next_month=next_month
        )

    def get_quarterly_summary(self, year: int, quarter: int, include_forecasts: bool = True) -> PeriodSummary:
        """Get quarterly summary for specified quarter"""
        # Calculate quarter boundaries
        if quarter == 1:
            start_date = date(year, 1, 1)
            end_date = date(year, 3, 31)
        elif quarter == 2:
            start_date = date(year, 4, 1)
            end_date = date(year, 6, 30)
        elif quarter == 3:
            start_date = date(year, 7, 1)
            end_date = date(year, 9, 30)
        else:  # quarter == 4
            start_date = date(year, 10, 1)
            end_date = date(year, 12, 31)

        return self.get_period_summary(start_date, end_date, include_forecasts)

    def get_cash_flow_heatmap_data(self, year: int, month: int, include_forecasts: bool = True) -> Dict:
        """Get heat map data for calendar visualization"""
        monthly_calendar = self.get_monthly_calendar(year, month, include_forecasts)

        # Create heatmap data structure
        heatmap_data = {
            'year': year,
            'month': month,
            'month_name': monthly_calendar.month_name,
            'days': []
        }

        for daily_flow in monthly_calendar.daily_flows:
            day_data = {
                'day': daily_flow.date.day,
                'date': daily_flow.date.isoformat(),
                'net_flow': daily_flow.net_flow,
                'inflows': daily_flow.total_inflows,
                'outflows': daily_flow.total_outflows,
                'transaction_count': daily_flow.transaction_count,
                'intensity': self._calculate_intensity(daily_flow.net_flow, monthly_calendar.period_summary.largest_single_day)
            }
            heatmap_data['days'].append(day_data)

        return heatmap_data

    def _calculate_intensity(self, net_flow: float, max_flow: float) -> float:
        """Calculate intensity for heatmap visualization (0.0 to 1.0)"""
        if max_flow == 0:
            return 0.0
        return min(abs(net_flow) / max_flow, 1.0)

def create_tenant_calendar_service(db: Session, tenant_id: int) -> TenantAwareCalendarService:
    """Factory function to create tenant-aware calendar service"""
    return TenantAwareCalendarService(db, tenant_id)