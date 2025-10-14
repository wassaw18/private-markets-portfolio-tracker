"""
Service for relative performance comparison between investments and public market benchmarks
"""

from typing import List, Dict, Any, Optional, Union
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app import models, crud
from app.models import Investment, CashFlow, Valuation, MarketBenchmark, BenchmarkReturn
import math

class RelativePerformanceService:
    """Service for comparing investment TVPI progression against public market benchmarks"""

    def __init__(self, db: Session):
        self.db = db

    def get_available_benchmarks(self) -> List[Dict[str, Any]]:
        """Get list of available market benchmarks"""
        benchmarks = self.db.query(MarketBenchmark).filter(
            MarketBenchmark.is_active == True
        ).all()

        return [
            {
                "id": benchmark.id,
                "name": benchmark.name,
                "ticker": benchmark.ticker,
                "category": benchmark.category,
                "description": benchmark.description
            }
            for benchmark in benchmarks
        ]

    def calculate_investment_tvpi_progression(
        self,
        investment_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        include_monthly_interpolation: bool = True
    ) -> List[Dict[str, Any]]:
        """Calculate TVPI progression over time for an investment with optional monthly interpolation"""

        # Get investment
        investment = self.db.query(Investment).filter(Investment.id == investment_id).first()
        if not investment:
            raise ValueError(f"Investment {investment_id} not found")

        # Get cash flows
        cash_flows_query = self.db.query(CashFlow).filter(CashFlow.investment_id == investment_id)
        if start_date:
            cash_flows_query = cash_flows_query.filter(CashFlow.date >= start_date)
        if end_date:
            cash_flows_query = cash_flows_query.filter(CashFlow.date <= end_date)

        cash_flows = cash_flows_query.order_by(CashFlow.date).all()

        # Get valuations
        valuations_query = self.db.query(Valuation).filter(Valuation.investment_id == investment_id)
        if start_date:
            valuations_query = valuations_query.filter(Valuation.date >= start_date)
        if end_date:
            valuations_query = valuations_query.filter(Valuation.date <= end_date)

        valuations = valuations_query.order_by(Valuation.date).all()

        # Calculate TVPI progression at actual data points
        tvpi_progression = []
        cumulative_contributions = 0
        cumulative_distributions = 0
        current_nav = 0

        # Combine and sort all events by date
        all_events = []

        for cf in cash_flows:
            all_events.append({
                'date': cf.date,
                'type': 'cashflow',
                'cf_type': cf.type,
                'amount': cf.amount,
                'nav': None
            })

        for val in valuations:
            all_events.append({
                'date': val.date,
                'type': 'valuation',
                'cf_type': None,
                'amount': None,
                'nav': val.nav_value
            })

        all_events.sort(key=lambda x: x['date'])

        # Process events chronologically to create base progression
        for event in all_events:
            if event['type'] == 'cashflow':
                if event['cf_type'].value in ['Capital Call', 'Contribution']:
                    cumulative_contributions += abs(event['amount'])
                elif event['cf_type'].value in ['Distribution', 'Yield', 'Return of Principal']:
                    cumulative_distributions += abs(event['amount'])
            elif event['type'] == 'valuation':
                current_nav = event['nav']

            # Calculate TVPI if we have contributions
            if cumulative_contributions > 0:
                tvpi = (cumulative_distributions + current_nav) / cumulative_contributions

                tvpi_progression.append({
                    'date': event['date'].isoformat(),
                    'cumulative_contributions': cumulative_contributions,
                    'cumulative_distributions': cumulative_distributions,
                    'current_nav': current_nav,
                    'tvpi': tvpi
                })

        # If interpolation requested and we have data points, add monthly interpolation
        if include_monthly_interpolation and len(tvpi_progression) > 0:
            interpolated_progression = []

            # Determine date range for interpolation
            first_date = datetime.fromisoformat(tvpi_progression[0]['date']).date()
            last_date = datetime.fromisoformat(tvpi_progression[-1]['date']).date()

            # Override with provided dates if they extend the range
            if start_date and start_date < first_date:
                first_date = start_date
            if end_date and end_date > last_date:
                last_date = end_date

            # Generate all months from first to last date
            all_months = []
            current_month = date(first_date.year, first_date.month, 1)
            end_month = date(last_date.year, last_date.month, 1)

            while current_month <= end_month:
                all_months.append(current_month)
                if current_month.month == 12:
                    current_month = date(current_month.year + 1, 1, 1)
                else:
                    current_month = date(current_month.year, current_month.month + 1, 1)

            # Create lookup for actual data points
            actual_data = {datetime.fromisoformat(point['date']).date(): point for point in tvpi_progression}

            # Generate interpolated series
            last_known_values = None

            for month_date in all_months:
                # Check if we have actual data for this month
                month_data = None
                for actual_date, data in actual_data.items():
                    if actual_date.year == month_date.year and actual_date.month == month_date.month:
                        month_data = data.copy()
                        month_data['date'] = month_date.isoformat()
                        last_known_values = month_data
                        break

                if month_data:
                    # Use actual data
                    interpolated_progression.append(month_data)
                elif last_known_values:
                    # Use flat line interpolation (carry forward last known values)
                    interpolated_point = last_known_values.copy()
                    interpolated_point['date'] = month_date.isoformat()
                    interpolated_progression.append(interpolated_point)

            return interpolated_progression

        return tvpi_progression

    def calculate_benchmark_indexed_performance(
        self,
        benchmark_ids: List[int],
        start_date: date,
        end_date: date,
        initial_value: float = 100.0
    ) -> Dict[int, List[Dict[str, Any]]]:
        """Calculate indexed performance for benchmarks starting at initial_value"""

        benchmark_performances = {}

        for benchmark_id in benchmark_ids:
            # Get benchmark returns
            returns = self.db.query(BenchmarkReturn).filter(
                and_(
                    BenchmarkReturn.benchmark_id == benchmark_id,
                    BenchmarkReturn.period_date >= start_date,
                    BenchmarkReturn.period_date <= end_date
                )
            ).order_by(BenchmarkReturn.period_date).all()

            # Calculate indexed performance
            indexed_performance = []
            current_value = initial_value

            # Add inception point at 100 for the start date
            if returns:
                indexed_performance.append({
                    'date': start_date.isoformat(),
                    'indexed_value': initial_value,
                    'monthly_return': 0.0
                })

            # Calculate the first full month after start_date
            if start_date.day == 1:
                # If start_date is already first of month, apply returns normally
                first_full_month = start_date
            else:
                # Move to next month's first day for first full month
                if start_date.month == 12:
                    first_full_month = date(start_date.year + 1, 1, 1)
                else:
                    first_full_month = date(start_date.year, start_date.month + 1, 1)

            for return_record in returns:
                if return_record.period_date >= first_full_month:
                    # Apply monthly return only from first full month onwards
                    if return_record.total_return is not None:
                        current_value = current_value * (1 + return_record.total_return)

                    indexed_performance.append({
                        'date': return_record.period_date.isoformat(),
                        'indexed_value': current_value,
                        'monthly_return': return_record.total_return
                    })

            benchmark_performances[benchmark_id] = indexed_performance

        return benchmark_performances

    def calculate_benchmark_shadow_portfolio(
        self,
        benchmark_ids: List[int],
        investment_performance: List[Dict[str, Any]],
        inception_date: date,
        end_date: date
    ) -> Dict[int, List[Dict[str, Any]]]:
        """Calculate benchmark shadow portfolio with monthly interpolation"""

        shadow_portfolios = {}

        for benchmark_id in benchmark_ids:
            # Get all benchmark returns from inception to end date
            benchmark_returns = self.db.query(BenchmarkReturn).filter(
                and_(
                    BenchmarkReturn.benchmark_id == benchmark_id,
                    BenchmarkReturn.period_date >= inception_date,
                    BenchmarkReturn.period_date <= end_date
                )
            ).order_by(BenchmarkReturn.period_date).all()


            if not benchmark_returns:
                shadow_portfolios[benchmark_id] = []
                continue

            # Create monthly return series
            monthly_returns = {ret.period_date: ret.total_return or 0.0 for ret in benchmark_returns}

            # Generate all months from inception to end_date
            all_months = []
            current_month = date(inception_date.year, inception_date.month, 1)
            end_month = date(end_date.year, end_date.month, 1)

            while current_month <= end_month:
                all_months.append(current_month)
                if current_month.month == 12:
                    current_month = date(current_month.year + 1, 1, 1)
                else:
                    current_month = date(current_month.year, current_month.month + 1, 1)

            # Initialize portfolio state
            shadow_portfolio = []
            cumulative_invested = 0.0
            cumulative_distributions = 0.0
            current_portfolio_value = 0.0

            # Track investment events by date and determine first investment month properly
            investment_events = {}
            first_actual_investment_date = None

            for i, inv_point in enumerate(investment_performance):
                inv_date = datetime.fromisoformat(inv_point['date']).date()

                if i == 0:
                    # First point - initial investment
                    period_investment = inv_point['cumulative_contributions']
                    period_distribution = inv_point['cumulative_distributions']
                else:
                    # Calculate incremental cash flows
                    prev_point = investment_performance[i-1]
                    period_investment = inv_point['cumulative_contributions'] - prev_point['cumulative_contributions']
                    period_distribution = inv_point['cumulative_distributions'] - prev_point['cumulative_distributions']

                # Track the actual first investment date (not the interpolated monthly date)
                if period_investment > 0 and first_actual_investment_date is None:
                    first_actual_investment_date = inv_date

                investment_events[inv_date] = {
                    'investment': period_investment,
                    'distribution': period_distribution,
                    'total_contributions': inv_point['cumulative_contributions'],
                    'total_distributions': inv_point['cumulative_distributions'],
                    'nav': inv_point.get('current_nav', 0),
                    'tvpi': inv_point['tvpi']
                }

            # Process each month to build complete time series
            first_investment_month = None
            inception_month_processed = False

            for month_date in all_months:
                # Apply any investment events that occurred in this month
                month_end = date(month_date.year, month_date.month, 28)  # Approximate month end

                # Find investment events in this month
                had_investment_event = False
                for event_date, event in investment_events.items():
                    if (event_date.year == month_date.year and
                        event_date.month == month_date.month):

                        # Apply investment/distribution
                        if event['investment'] > 0:
                            cumulative_invested += event['investment']
                            current_portfolio_value += event['investment']
                            had_investment_event = True

                        if event['distribution'] > 0:
                            cumulative_distributions += event['distribution']
                            current_portfolio_value -= event['distribution']

                # Track the first month with investment
                if had_investment_event and first_investment_month is None:
                    first_investment_month = month_date

                # Apply monthly returns - but NEVER in the first month with investments
                # This ensures inception month stays at TVPI = 1.0
                is_inception_month = (first_investment_month is not None and
                                     month_date == first_investment_month)

                if current_portfolio_value > 0 and not is_inception_month:
                    monthly_return = monthly_returns.get(month_date, 0.0)
                    current_portfolio_value *= (1 + monthly_return)
                elif is_inception_month:
                    # In inception month, explicitly set monthly_return to 0.0 for reporting
                    monthly_return = 0.0
                else:
                    monthly_return = 0.0

                # Calculate TVPI
                if cumulative_invested > 0:
                    shadow_tvpi = (current_portfolio_value + cumulative_distributions) / cumulative_invested
                else:
                    shadow_tvpi = 0.0

                # Add monthly data point
                shadow_portfolio.append({
                    'date': month_date.isoformat(),
                    'cumulative_contributions': cumulative_invested,
                    'cumulative_distributions': cumulative_distributions,
                    'current_nav': current_portfolio_value,
                    'tvpi': shadow_tvpi,
                    'indexed_value': shadow_tvpi * 100,  # Will be adjusted for baseline
                    'monthly_return': monthly_return  # Use the return that was actually applied
                })

            # Set benchmark indexed values to start at 100 at inception
            if shadow_portfolio:
                # Find the first point with contributions (inception point)
                inception_tvpi = None
                for point in shadow_portfolio:
                    if point['cumulative_contributions'] > 0:
                        inception_tvpi = point['tvpi']
                        break

                # If we found an inception point, index all values relative to it
                if inception_tvpi and inception_tvpi > 0:
                    for point in shadow_portfolio:
                        point['indexed_value'] = (point['tvpi'] / inception_tvpi) * 100
                else:
                    # Fallback: just use TVPI * 100
                    for point in shadow_portfolio:
                        point['indexed_value'] = point['tvpi'] * 100

            shadow_portfolios[benchmark_id] = shadow_portfolio

        return shadow_portfolios

    def calculate_aggregate_performance(
        self,
        selection_type: str,
        selection_value: Union[str, int, None],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """Calculate aggregate performance for portfolio, asset class, or single investment"""

        # Get relevant investments (exclude archived)
        if selection_type == "investment":
            investments = self.db.query(Investment).filter(
                Investment.id == selection_value,
                Investment.is_archived == False
            ).all()
        elif selection_type == "asset_class":
            investments = self.db.query(Investment).filter(
                Investment.asset_class == selection_value,
                Investment.is_archived == False
            ).all()
        elif selection_type == "portfolio":
            investments = self.db.query(Investment).filter(
                Investment.is_archived == False
            ).all()
        else:
            raise ValueError(f"Invalid selection_type: {selection_type}")

        if not investments:
            return []

        # Aggregate all cash flows and valuations
        all_events = []

        for investment in investments:
            # Get cash flows
            cash_flows_query = self.db.query(CashFlow).filter(CashFlow.investment_id == investment.id)
            if start_date:
                cash_flows_query = cash_flows_query.filter(CashFlow.date >= start_date)
            if end_date:
                cash_flows_query = cash_flows_query.filter(CashFlow.date <= end_date)

            cash_flows = cash_flows_query.all()

            for cf in cash_flows:
                all_events.append({
                    'date': cf.date,
                    'type': 'cashflow',
                    'cf_type': cf.type,
                    'amount': cf.amount,
                    'investment_id': investment.id
                })

            # Get latest valuation for each investment
            latest_valuation = self.db.query(Valuation).filter(
                Valuation.investment_id == investment.id
            ).order_by(Valuation.date.desc()).first()

            if latest_valuation:
                valuation_date = latest_valuation.date
                if (not start_date or valuation_date >= start_date) and (not end_date or valuation_date <= end_date):
                    all_events.append({
                        'date': valuation_date,
                        'type': 'valuation',
                        'nav': latest_valuation.nav_value,
                        'investment_id': investment.id
                    })

        # Sort events by date
        all_events.sort(key=lambda x: x['date'])

        # Calculate aggregate TVPI progression
        aggregate_progression = []
        cumulative_contributions = 0
        cumulative_distributions = 0
        investment_navs = {}

        for event in all_events:
            if event['type'] == 'cashflow':
                if event['cf_type'].value in ['Capital Call', 'Contribution']:
                    cumulative_contributions += abs(event['amount'])
                elif event['cf_type'].value in ['Distribution', 'Yield', 'Return of Principal']:
                    cumulative_distributions += abs(event['amount'])
            elif event['type'] == 'valuation':
                investment_navs[event['investment_id']] = event['nav']

            # Calculate total NAV and TVPI
            total_nav = sum(investment_navs.values())

            if cumulative_contributions > 0:
                tvpi = (cumulative_distributions + total_nav) / cumulative_contributions

                aggregate_progression.append({
                    'date': event['date'].isoformat(),
                    'cumulative_contributions': cumulative_contributions,
                    'cumulative_distributions': cumulative_distributions,
                    'total_nav': total_nav,
                    'tvpi': tvpi
                })

        return aggregate_progression

    def compare_performance(
        self,
        selection_type: str,
        selection_value: Union[str, int, None],
        benchmark_ids: List[int],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        view_mode: str = "absolute"
    ) -> Dict[str, Any]:
        """Compare investment/portfolio performance against benchmarks using inception-to-date approach"""

        # Step 1: Calculate full investment performance from inception (ignore start_date)
        if selection_type == "investment":
            # Calculate from inception to end_date (or latest available) with monthly interpolation
            full_investment_performance = self.calculate_investment_tvpi_progression(
                selection_value, None, end_date, include_monthly_interpolation=True
            )
        else:
            full_investment_performance = self.calculate_aggregate_performance(
                selection_type, selection_value, None, end_date  # No start_date filter
            )

        if not full_investment_performance:
            return {
                "error": "No performance data available for selected investment(s)",
                "investment_performance": [],
                "benchmark_performances": {},
                "benchmarks": []
            }

        # Step 2: Determine actual investment inception and end dates
        investment_inception = datetime.fromisoformat(full_investment_performance[0]['date']).date()
        investment_end = datetime.fromisoformat(full_investment_performance[-1]['date']).date()

        # Use provided end_date or default to latest investment data
        actual_end_date = end_date or investment_end

        # Step 3: Calculate benchmark shadow portfolio with same cash flow timing
        benchmark_performances = self.calculate_benchmark_shadow_portfolio(
            benchmark_ids, full_investment_performance, investment_inception, actual_end_date
        )

        # Step 3.5: Fix benchmark indexing - force inception month to start at 100%
        for benchmark_id, benchmark_data in benchmark_performances.items():
            if benchmark_data:
                # Find first month with contributions
                first_contribution_idx = None
                for i, point in enumerate(benchmark_data):
                    if point['cumulative_contributions'] > 0:
                        first_contribution_idx = i
                        break

                if first_contribution_idx is not None:
                    # Get the TVPI of the first contribution month
                    inception_tvpi = benchmark_data[first_contribution_idx]['tvpi']

                    # Reindex all months relative to inception month = 100
                    if inception_tvpi > 0:
                        for point in benchmark_data:
                            point['indexed_value'] = (point['tvpi'] / inception_tvpi) * 100

                    # DEBUG: Force the first month to exactly 100.0
                    benchmark_data[first_contribution_idx]['indexed_value'] = 100.0

        # Step 4: Apply display window filtering if start_date provided
        if start_date:
            # Filter investment performance to display window
            display_investment_performance = [
                point for point in full_investment_performance
                if datetime.fromisoformat(point['date']).date() >= start_date
            ]

            # Filter benchmark performances to display window
            display_benchmark_performances = {}
            for benchmark_id, benchmark_data in benchmark_performances.items():
                display_benchmark_performances[benchmark_id] = [
                    point for point in benchmark_data
                    if datetime.fromisoformat(point['date']).date() >= start_date
                ]
        else:
            # Show full period
            display_investment_performance = full_investment_performance
            display_benchmark_performances = benchmark_performances

        # Step 5: Apply performance indexing based on view_mode
        if view_mode == "rebased" and start_date and display_investment_performance:
            # Rebased view: Index to start_date (first point in display window = 100)
            baseline_investment_tvpi = display_investment_performance[0]['tvpi']

            # Index investment performance
            for point in display_investment_performance:
                if baseline_investment_tvpi > 0:
                    point['indexed_value'] = (point['tvpi'] / baseline_investment_tvpi) * 100
                else:
                    point['indexed_value'] = 100

            # Index benchmark performances using their values at start_date
            for benchmark_id, benchmark_data in display_benchmark_performances.items():
                if benchmark_data:
                    baseline_benchmark_tvpi = benchmark_data[0]['tvpi']
                    for point in benchmark_data:
                        if baseline_benchmark_tvpi > 0:
                            point['indexed_value'] = (point['tvpi'] / baseline_benchmark_tvpi) * 100
                        else:
                            point['indexed_value'] = 100
        else:
            # Absolute view: Index to inception (first point in full series = 100)
            if full_investment_performance[0]['tvpi'] == 0:
                # Find first non-zero TVPI
                baseline_tvpi = 1.0
                for p in full_investment_performance:
                    if p['tvpi'] > 0:
                        baseline_tvpi = p['tvpi']
                        break
            else:
                baseline_tvpi = full_investment_performance[0]['tvpi']

            # Index investment performance
            for point in display_investment_performance:
                if baseline_tvpi > 0:
                    point['indexed_value'] = (point['tvpi'] / baseline_tvpi) * 100
                else:
                    point['indexed_value'] = 100

            # Index benchmark performances - ensure inception month = 100
            for benchmark_id, benchmark_data in display_benchmark_performances.items():
                if benchmark_data:
                    # Find first month with contributions in display window
                    first_contribution_idx = None
                    for i, point in enumerate(benchmark_data):
                        if point['cumulative_contributions'] > 0:
                            first_contribution_idx = i
                            break

                    if first_contribution_idx is not None:
                        # Get the TVPI of first contribution month in display
                        inception_tvpi = benchmark_data[first_contribution_idx]['tvpi']

                        # Reindex all display points relative to inception = 100
                        if inception_tvpi > 0:
                            for point in benchmark_data:
                                point['indexed_value'] = (point['tvpi'] / inception_tvpi) * 100

        # Get benchmark info
        benchmarks = self.db.query(MarketBenchmark).filter(
            MarketBenchmark.id.in_(benchmark_ids)
        ).all()

        benchmark_info = [
            {
                "id": b.id,
                "name": b.name,
                "ticker": b.ticker,
                "category": b.category
            }
            for b in benchmarks
        ]

        return {
            "investment_performance": display_investment_performance,
            "benchmark_performances": display_benchmark_performances,
            "benchmarks": benchmark_info,
            "date_range": {
                "start": (start_date or investment_inception).isoformat(),
                "end": actual_end_date.isoformat()
            }
        }


def get_relative_performance_service(db: Session) -> RelativePerformanceService:
    """Factory function to create RelativePerformanceService"""
    return RelativePerformanceService(db)