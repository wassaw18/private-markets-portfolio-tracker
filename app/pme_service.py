"""
PME (Public Markets Equivalent) Analysis Service

This service calculates the performance comparison between private investments
and public market benchmarks using TVPI-based analysis.
"""

from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from . import models, crud
from .benchmark_service import BenchmarkComparisonService


class PMECalculator:
    """Calculate Public Markets Equivalent analysis for private investments"""
    
    def __init__(self, db: Session):
        self.db = db
        self.benchmark_service = BenchmarkComparisonService(db)
    
    def calculate_investment_pme(
        self, 
        investment_id: int, 
        benchmark_id: int,
        end_date: Optional[date] = None
    ) -> Dict:
        """Calculate PME analysis for a single investment vs benchmark"""
        
        # Get investment data
        investment = crud.get_investment(self.db, investment_id)
        if not investment:
            raise ValueError(f"Investment {investment_id} not found")
        
        cash_flows = crud.get_investment_cashflows(self.db, investment_id)
        valuations = crud.get_investment_valuations(self.db, investment_id)
        
        # Get benchmark returns
        benchmark = self._get_benchmark(benchmark_id)
        
        # Determine date range
        start_date = self._get_start_date(cash_flows, valuations)
        end_date = end_date or date.today()
        
        # Calculate PME series
        pme_series = self._calculate_pme_series(
            cash_flows, valuations, benchmark_id, start_date, end_date
        )
        
        # Calculate summary metrics
        summary_metrics = self._calculate_summary_metrics(pme_series)
        
        return {
            'investment_id': investment_id,
            'investment_name': investment.name,
            'benchmark_id': benchmark_id,
            'benchmark_name': benchmark.name,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'pme_series': pme_series,
            'summary_metrics': summary_metrics
        }
    
    def calculate_portfolio_pme(
        self,
        benchmark_id: int,
        asset_class: Optional[str] = None,
        vintage_years: Optional[List[int]] = None,
        investment_ids: Optional[List[int]] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """Calculate PME analysis for portfolio or subset"""
        
        # Build investment filter
        query = self.db.query(models.Investment)
        
        if asset_class:
            query = query.filter(models.Investment.asset_class == asset_class)
        if vintage_years:
            query = query.filter(models.Investment.vintage_year.in_(vintage_years))
        if investment_ids:
            query = query.filter(models.Investment.id.in_(investment_ids))
        
        investments = query.all()
        
        if not investments:
            raise ValueError("No investments found matching criteria")
        
        # Aggregate cash flows and valuations
        all_cash_flows = []
        all_valuations = []
        
        for investment in investments:
            cash_flows = crud.get_investment_cashflows(self.db, investment.id)
            valuations = crud.get_investment_valuations(self.db, investment.id)
            
            all_cash_flows.extend(cash_flows)
            all_valuations.extend(valuations)
        
        # Sort by date
        all_cash_flows.sort(key=lambda x: x.date)
        all_valuations.sort(key=lambda x: x.date)
        
        # Get benchmark data
        benchmark = self._get_benchmark(benchmark_id)
        
        # Determine date range
        start_date = self._get_start_date(all_cash_flows, all_valuations)
        end_date = end_date or date.today()
        
        # Calculate aggregated PME
        pme_series = self._calculate_pme_series(
            all_cash_flows, all_valuations, benchmark_id, start_date, end_date
        )
        
        # Calculate summary metrics
        summary_metrics = self._calculate_summary_metrics(pme_series)
        
        return {
            'scope': {
                'asset_class': asset_class,
                'vintage_years': vintage_years,
                'investment_count': len(investments)
            },
            'benchmark_id': benchmark_id,
            'benchmark_name': benchmark.name,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'pme_series': pme_series,
            'summary_metrics': summary_metrics,
            'investments': [{'id': i.id, 'name': i.name} for i in investments]
        }
    
    def _calculate_pme_series(
        self,
        cash_flows: List[models.CashFlow],
        valuations: List[models.Valuation],
        benchmark_id: int,
        start_date: date,
        end_date: date
    ) -> List[Dict]:
        """Calculate the time series PME data"""
        
        # Get benchmark returns
        benchmark_returns = self._get_benchmark_returns(benchmark_id, start_date, end_date)
        
        # Generate monthly date series
        dates = self._generate_date_series(start_date, end_date)
        
        pme_series = []
        public_portfolio_value = 0.0
        
        for current_date in dates:
            # Calculate private investment TVPI
            private_tvpi = self._calculate_tvpi_at_date(
                cash_flows, valuations, current_date
            )
            
            # Calculate public equivalent value
            public_value, public_contributions = self._calculate_public_value_at_date(
                cash_flows, benchmark_returns, current_date
            )
            
            # Calculate public TVPI
            public_tvpi = public_value / public_contributions if public_contributions > 0 else 1.0
            
            # Calculate data quality metrics
            data_quality = self._assess_data_quality(valuations, current_date)
            
            pme_series.append({
                'date': current_date.isoformat(),
                'private_tvpi': round(private_tvpi, 3),
                'public_tvpi': round(public_tvpi, 3),
                'illiquidity_premium': round(private_tvpi - public_tvpi, 3),
                'data_quality': data_quality
            })
        
        return pme_series
    
    def _calculate_tvpi_at_date(
        self,
        cash_flows: List[models.CashFlow],
        valuations: List[models.Valuation],
        target_date: date
    ) -> float:
        """Calculate TVPI for private investment at specific date"""
        
        # Get contributions (negative cash flows) up to date
        total_contributions = sum(
            abs(cf.amount) for cf in cash_flows 
            if cf.date <= target_date and cf.amount < 0
        )
        
        # Get distributions (positive cash flows) up to date
        total_distributions = sum(
            cf.amount for cf in cash_flows 
            if cf.date <= target_date and cf.amount > 0
        )
        
        # Get NAV at date (latest valuation before/on date)
        current_nav = 0.0
        for valuation in valuations:
            if valuation.date <= target_date:
                current_nav = valuation.nav_value
            else:
                break
        
        # Calculate TVPI
        if total_contributions == 0:
            return 1.0
        
        total_value = current_nav + total_distributions
        return total_value / total_contributions
    
    def _calculate_public_value_at_date(
        self,
        cash_flows: List[models.CashFlow],
        benchmark_returns: Dict[str, float],
        target_date: date
    ) -> Tuple[float, float]:
        """Calculate equivalent public investment value at date"""
        
        public_value = 0.0
        total_contributions = 0.0
        
        for cf in cash_flows:
            if cf.date > target_date:
                break
                
            if cf.amount < 0:  # Capital call - invest in public market
                contribution = abs(cf.amount)
                total_contributions += contribution
                
                # Apply benchmark returns from call date to target date
                growth_factor = self._calculate_compound_return(
                    benchmark_returns, cf.date, target_date
                )
                public_value += contribution * growth_factor
                
            elif cf.amount > 0:  # Distribution - sell public equivalent
                # For simplicity, reduce public value proportionally
                if public_value > 0:
                    distribution_ratio = cf.amount / public_value
                    public_value *= (1 - min(distribution_ratio, 1.0))
        
        return public_value, total_contributions
    
    def _calculate_compound_return(
        self,
        benchmark_returns: Dict[str, float],
        start_date: date,
        end_date: date
    ) -> float:
        """Calculate compound return between two dates"""
        
        if start_date >= end_date:
            return 1.0
        
        compound_factor = 1.0
        current_date = start_date
        
        while current_date < end_date:
            # Get monthly return (assume monthly data)
            month_key = current_date.strftime('%Y-%m')
            monthly_return = benchmark_returns.get(month_key, 0.0)
            compound_factor *= (1 + monthly_return)
            
            # Move to next month
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        return compound_factor
    
    def _get_benchmark_returns(
        self,
        benchmark_id: int,
        start_date: date,
        end_date: date
    ) -> Dict[str, float]:
        """Get benchmark returns for date range"""
        
        returns = self.db.query(models.BenchmarkReturn).filter(
            and_(
                models.BenchmarkReturn.benchmark_id == benchmark_id,
                models.BenchmarkReturn.period_date >= start_date,
                models.BenchmarkReturn.period_date <= end_date
            )
        ).all()
        
        return {
            r.period_date.strftime('%Y-%m'): r.total_return or 0.0 
            for r in returns
        }
    
    def _assess_data_quality(
        self,
        valuations: List[models.Valuation],
        target_date: date
    ) -> Dict:
        """Assess quality of private investment data at date"""
        
        # Find latest valuation before target date
        latest_valuation = None
        for valuation in valuations:
            if valuation.date <= target_date:
                latest_valuation = valuation
            else:
                break
        
        if not latest_valuation:
            return {
                'nav_age_days': 999,
                'confidence': 'low',
                'warning': 'No NAV data available'
            }
        
        nav_age_days = (target_date - latest_valuation.date).days
        
        if nav_age_days <= 30:
            confidence = 'high'
        elif nav_age_days <= 90:
            confidence = 'medium'
        else:
            confidence = 'low'
        
        return {
            'nav_age_days': nav_age_days,
            'confidence': confidence,
            'latest_nav_date': latest_valuation.date.isoformat()
        }
    
    def _calculate_summary_metrics(self, pme_series: List[Dict]) -> Dict:
        """Calculate summary PME metrics"""
        
        if not pme_series:
            return {}
        
        latest = pme_series[-1]
        
        # Calculate average illiquidity premium
        avg_premium = sum(p['illiquidity_premium'] for p in pme_series) / len(pme_series)
        
        # Calculate PME ratio (final private TVPI / final public TVPI)
        pme_ratio = latest['private_tvpi'] / latest['public_tvpi'] if latest['public_tvpi'] > 0 else 1.0
        
        return {
            'final_private_tvpi': latest['private_tvpi'],
            'final_public_tvpi': latest['public_tvpi'],
            'final_illiquidity_premium': latest['illiquidity_premium'],
            'average_illiquidity_premium': round(avg_premium, 3),
            'pme_ratio': round(pme_ratio, 3),
            'data_quality': latest['data_quality']
        }
    
    def _get_benchmark(self, benchmark_id: int) -> models.MarketBenchmark:
        """Get benchmark by ID"""
        benchmark = self.db.query(models.MarketBenchmark).filter(
            models.MarketBenchmark.id == benchmark_id
        ).first()
        
        if not benchmark:
            raise ValueError(f"Benchmark {benchmark_id} not found")
        
        return benchmark
    
    def _get_start_date(
        self,
        cash_flows: List[models.CashFlow],
        valuations: List[models.Valuation]
    ) -> date:
        """Determine the earliest relevant date"""
        
        dates = []
        
        if cash_flows:
            dates.append(min(cf.date for cf in cash_flows))
        
        if valuations:
            dates.append(min(v.date for v in valuations))
        
        return min(dates) if dates else date.today()
    
    def _generate_date_series(self, start_date: date, end_date: date) -> List[date]:
        """Generate monthly date series"""
        
        dates = []
        current = start_date.replace(day=1)  # Start at beginning of month
        
        while current <= end_date:
            dates.append(current)
            
            # Move to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        
        return dates