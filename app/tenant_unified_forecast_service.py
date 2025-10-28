"""
Tenant-Aware Unified Cash Flow Forecast Service

Extends the base unified forecast service with tenant filtering.
"""

from typing import List
from datetime import date

from sqlalchemy.orm import Session
from sqlalchemy import and_
from app import models
from app.models import ForecastScenario
from app.unified_forecast_service import UnifiedForecastService, UnifiedCashFlow


class TenantUnifiedForecastService(UnifiedForecastService):
    """Tenant-aware unified forecast service"""

    def __init__(self, db: Session, tenant_id: int):
        super().__init__(db)
        self.tenant_id = tenant_id

    def _get_historical_flows(self, start_date: date, end_date: date) -> List[UnifiedCashFlow]:
        """Get historical actual cash flows (past transactions) with tenant filtering"""
        from app.models import CashFlowType
        today = date.today()

        # Query cash flows with dates in the past or today, filtered by tenant
        historical_cashflows = self.db.query(models.CashFlow).filter(
            models.CashFlow.date >= start_date,
            models.CashFlow.date <= min(end_date, today),
            models.CashFlow.date <= today
        ).join(models.Investment).filter(
            models.Investment.tenant_id == self.tenant_id
        ).all()

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
        """Get user-entered cash flows with dates in the future (tenant-filtered)"""
        today = date.today()

        # Query cash flows with future dates, filtered by tenant
        future_cashflows = self.db.query(models.CashFlow).filter(
            models.CashFlow.date >= max(start_date, today),
            models.CashFlow.date <= end_date,
            models.CashFlow.date > today
        ).join(models.Investment).filter(
            models.Investment.tenant_id == self.tenant_id
        ).all()

        manual_flows = []
        for cf in future_cashflows:
            # Determine if it's a call or distribution
            if cf.type in [models.CashFlowType.CAPITAL_CALL, models.CashFlowType.CONTRIBUTION]:
                cf_type = 'Manual Capital Call'
                amount = cf.amount
            elif cf.type in [models.CashFlowType.DISTRIBUTION, models.CashFlowType.YIELD,
                            models.CashFlowType.RETURN_OF_PRINCIPAL]:
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
        Get pacing model forecasts from database, distributed monthly (tenant-filtered)
        """
        # Query forecasts that overlap with the requested date range, filtered by tenant
        forecasts = self.db.query(models.CashFlowForecast).filter(
            models.CashFlowForecast.forecast_period_start <= end_date,
            models.CashFlowForecast.forecast_period_end >= start_date,
            models.CashFlowForecast.scenario == scenario
        ).join(models.Investment).filter(
            models.Investment.tenant_id == self.tenant_id
        ).all()

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


def create_tenant_unified_forecast_service(db: Session, tenant_id: int) -> TenantUnifiedForecastService:
    """Factory function to create tenant-aware unified forecast service"""
    return TenantUnifiedForecastService(db, tenant_id)
