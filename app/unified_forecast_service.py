"""
Unified Cash Flow Forecast Service

Merges multiple forecast sources into a single, coherent view:
1. Manual future cash flows (highest priority)
2. Backend pacing model forecasts (medium priority)

Provides toggleable forecast sources for different use cases.
"""

from typing import List, Dict, Optional, Set
from datetime import date, datetime, timedelta
from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy.orm import Session
from sqlalchemy import and_
from app import models
from app.models import CashFlowType, ForecastScenario


@dataclass
class UnifiedCashFlow:
    """Single cash flow entry with source tracking"""
    date: date
    investment_id: int
    investment_name: str
    type: str
    amount: float
    source: str  # 'manual' or 'pacing_model'
    confidence: str  # 'high' (manual) or 'medium' (pacing_model)
    is_forecast: bool
    id: Optional[str] = None  # For manual CFs, use actual ID; for forecasts, use generated ID


class UnifiedForecastService:
    """Service for combining manual and pacing model forecasts"""

    def __init__(self, db: Session):
        self.db = db

    def get_unified_forecasts(
        self,
        start_date: date,
        end_date: date,
        include_manual: bool = True,
        include_pacing_model: bool = True,
        scenario: ForecastScenario = ForecastScenario.BASE
    ) -> List[UnifiedCashFlow]:
        """
        Get unified forecasts combining multiple sources

        Args:
            start_date: Start of date range
            end_date: End of date range
            include_manual: Include manual future cash flows
            include_pacing_model: Include pacing model forecasts
            scenario: Which forecast scenario to use (BASE, BULL, BEAR)

        Returns:
            List of unified cash flows with source tracking
        """
        unified_flows = []

        # Step 0: ALWAYS include historical actual cash flows (past transactions)
        # These are facts, not forecasts, and should always be shown
        historical_flows = self._get_historical_flows(start_date, end_date)
        unified_flows.extend(historical_flows)

        # Step 1: Get manual future cash flows (highest priority)
        if include_manual:
            manual_flows = self._get_manual_future_flows(start_date, end_date)
            unified_flows.extend(manual_flows)

        # Step 2: Get pacing model forecasts
        if include_pacing_model:
            pacing_flows = self._get_pacing_model_forecasts(start_date, end_date, scenario)
            unified_flows.extend(pacing_flows)

        # Sort by date, then by investment name for consistency
        unified_flows.sort(key=lambda x: (x.date, x.investment_name))

        return unified_flows

    def _get_historical_flows(self, start_date: date, end_date: date) -> List[UnifiedCashFlow]:
        """Get historical actual cash flows (past transactions that actually occurred)"""
        today = date.today()

        # Query cash flows with dates in the past or today
        historical_cashflows = self.db.query(models.CashFlow).filter(
            models.CashFlow.date >= start_date,
            models.CashFlow.date <= min(end_date, today),
            models.CashFlow.date <= today
        ).join(models.Investment).all()

        historical_flows = []
        for cf in historical_cashflows:
            # Determine if it's a call or distribution
            if cf.type in [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]:
                cf_type = 'Capital Call'
                amount = cf.amount
            elif cf.type in [CashFlowType.DISTRIBUTION, CashFlowType.YIELD,
                            CashFlowType.RETURN_OF_PRINCIPAL]:
                cf_type = cf.type.value  # Use the actual type name
                amount = cf.amount
            elif cf.type == CashFlowType.MANAGEMENT_FEE:
                cf_type = 'Management Fee'
                amount = cf.amount
            else:
                # Include other types as well
                cf_type = cf.type.value
                amount = cf.amount

            historical_flows.append(UnifiedCashFlow(
                date=cf.date,
                investment_id=cf.investment_id,
                investment_name=cf.investment.name,
                type=cf_type,
                amount=amount,
                source='actual',  # Mark as actual historical data
                confidence='actual',  # These are facts, not forecasts
                is_forecast=False,
                id=str(cf.id)
            ))

        return historical_flows

    def _get_manual_future_flows(self, start_date: date, end_date: date) -> List[UnifiedCashFlow]:
        """Get user-entered cash flows with dates in the future"""
        today = date.today()

        # Query cash flows with future dates
        future_cashflows = self.db.query(models.CashFlow).filter(
            models.CashFlow.date >= max(start_date, today),
            models.CashFlow.date <= end_date,
            models.CashFlow.date > today
        ).join(models.Investment).all()

        manual_flows = []
        for cf in future_cashflows:
            # Determine if it's a call or distribution
            if cf.type in [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]:
                cf_type = 'Manual Capital Call'
                amount = cf.amount
            elif cf.type in [CashFlowType.DISTRIBUTION, CashFlowType.YIELD,
                            CashFlowType.RETURN_OF_PRINCIPAL]:
                # Use "Manual" prefix with the actual type name to preserve specificity
                cf_type = f'Manual {cf.type.value}'
                amount = cf.amount
            else:
                # Skip fees and other types for forecasting
                continue

            manual_flows.append(UnifiedCashFlow(
                date=cf.date,
                investment_id=cf.investment_id,
                investment_name=cf.investment.name,
                type=cf_type,
                amount=amount,
                source='manual',
                confidence='high',
                is_forecast=False,  # It's manually entered, not a forecast
                id=str(cf.id)
            ))

        return manual_flows

    def _get_pacing_model_forecasts(
        self,
        start_date: date,
        end_date: date,
        scenario: ForecastScenario
    ) -> List[UnifiedCashFlow]:
        """
        Get pacing model forecasts from database, distributed monthly

        This uses the sophisticated backend pacing model forecasts that were
        generated and stored in the cash_flow_forecasts table.
        """
        # Query forecasts that overlap with the requested date range
        forecasts = self.db.query(models.CashFlowForecast).filter(
            models.CashFlowForecast.forecast_period_start <= end_date,
            models.CashFlowForecast.forecast_period_end >= start_date,
            models.CashFlowForecast.scenario == scenario
        ).join(models.Investment).all()

        pacing_flows = []

        for f in forecasts:
            # Calculate the overlap between forecast period and requested range
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

                    # Add capital calls if non-zero
                    if monthly_calls > 100:  # Minimum threshold to avoid tiny amounts
                        pacing_flows.append(UnifiedCashFlow(
                            date=forecast_date,
                            investment_id=f.investment_id,
                            investment_name=f.investment.name,
                            type='Forecasted Call',
                            amount=monthly_calls,
                            source='pacing_model',
                            confidence='medium',
                            is_forecast=True,
                            id=f"pacing_{f.id}_{forecast_date}_call"
                        ))

                    # Add distributions if non-zero
                    if monthly_distributions > 100:  # Minimum threshold
                        pacing_flows.append(UnifiedCashFlow(
                            date=forecast_date,
                            investment_id=f.investment_id,
                            investment_name=f.investment.name,
                            type='Forecasted Distribution',
                            amount=monthly_distributions,
                            source='pacing_model',
                            confidence='medium',
                            is_forecast=True,
                            id=f"pacing_{f.id}_{forecast_date}_dist"
                        ))

                # Move to next month
                if current_month.month == 12:
                    current_month = current_month.replace(year=current_month.year + 1, month=1)
                else:
                    current_month = current_month.replace(month=current_month.month + 1)

        return pacing_flows

    def get_daily_aggregates(
        self,
        start_date: date,
        end_date: date,
        include_manual: bool = True,
        include_pacing_model: bool = True,
        scenario: ForecastScenario = ForecastScenario.BASE
    ) -> List[Dict]:
        """
        Get daily aggregated cash flows (for calendar display)

        Returns:
            List of daily aggregates with separate totals for manual and pacing model sources
        """
        # Get all unified flows
        unified_flows = self.get_unified_forecasts(
            start_date, end_date, include_manual, include_pacing_model, scenario
        )

        # Group by date
        daily_data = defaultdict(lambda: {
            'date': None,
            'inflows': 0.0,
            'outflows': 0.0,
            'transactions': [],
            'count': 0
        })

        for flow in unified_flows:
            flow_date = flow.date
            daily_data[flow_date]['date'] = flow_date

            transaction = {
                'id': flow.id,
                'investment_id': flow.investment_id,
                'investment_name': flow.investment_name,
                'type': flow.type,
                'amount': flow.amount,
                'is_forecast': flow.is_forecast,
                'source': flow.source,
                'confidence': flow.confidence
            }

            daily_data[flow_date]['transactions'].append(transaction)
            daily_data[flow_date]['count'] += 1

            # Categorize as inflow or outflow
            if 'Distribution' in flow.type or 'Yield' in flow.type or 'Return of Principal' in flow.type:
                daily_data[flow_date]['inflows'] += flow.amount
            elif 'Call' in flow.type or 'Contribution' in flow.type:
                daily_data[flow_date]['outflows'] += flow.amount

        # Convert to list format
        daily_flows = []
        current_date = start_date

        while current_date <= end_date:
            data = daily_data.get(current_date, {
                'date': current_date,
                'inflows': 0.0,
                'outflows': 0.0,
                'transactions': [],
                'count': 0
            })

            daily_flows.append({
                'date': current_date.isoformat(),
                'total_inflows': data['inflows'],
                'total_outflows': data['outflows'],
                'net_flow': data['inflows'] - data['outflows'],
                'transaction_count': data['count'],
                'transactions': data['transactions']
            })

            current_date += timedelta(days=1)

        return daily_flows


def create_unified_forecast_service(db: Session) -> UnifiedForecastService:
    """Factory function to create unified forecast service"""
    return UnifiedForecastService(db)
