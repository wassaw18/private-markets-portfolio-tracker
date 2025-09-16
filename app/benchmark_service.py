"""
Benchmark comparison service for investment performance analysis
"""
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app import models, schemas, crud
from app.performance import calculate_investment_performance

class BenchmarkComparisonService:
    """Service for comparing investment performance against industry benchmarks"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_benchmark_data(self, asset_class: models.AssetClass, vintage_year: int, metric_type: str) -> Optional[models.PerformanceBenchmark]:
        """Get benchmark data for specific asset class, vintage year, and metric"""
        return self.db.query(models.PerformanceBenchmark).filter(
            models.PerformanceBenchmark.asset_class == asset_class,
            models.PerformanceBenchmark.vintage_year == vintage_year,
            models.PerformanceBenchmark.metric_type == metric_type
        ).first()
    
    def calculate_quartile_rank(self, performance_value: float, benchmark: models.PerformanceBenchmark) -> int:
        """Calculate quartile rank (1=top quartile, 4=bottom quartile)"""
        if performance_value >= benchmark.q1_performance:
            return 1  # Top quartile
        elif performance_value >= benchmark.median_performance:
            return 2  # Above median
        elif performance_value >= benchmark.q3_performance:
            return 3  # Below median, above bottom quartile
        else:
            return 4  # Bottom quartile
    
    def calculate_percentile_estimate(self, performance_value: float, benchmark: models.PerformanceBenchmark) -> float:
        """Estimate percentile ranking based on quartile data"""
        if performance_value >= benchmark.q1_performance:
            # Top quartile: 75-100th percentile
            excess_ratio = (performance_value - benchmark.q1_performance) / max(benchmark.q1_performance * 0.5, 0.01)
            return min(75 + (excess_ratio * 25), 100)
        elif performance_value >= benchmark.median_performance:
            # Second quartile: 50-75th percentile
            position_ratio = (performance_value - benchmark.median_performance) / max(benchmark.q1_performance - benchmark.median_performance, 0.01)
            return 50 + (position_ratio * 25)
        elif performance_value >= benchmark.q3_performance:
            # Third quartile: 25-50th percentile
            position_ratio = (performance_value - benchmark.q3_performance) / max(benchmark.median_performance - benchmark.q3_performance, 0.01)
            return 25 + (position_ratio * 25)
        else:
            # Bottom quartile: 0-25th percentile
            if benchmark.q3_performance > 0:
                position_ratio = performance_value / benchmark.q3_performance
                return max(position_ratio * 25, 0)
            else:
                return max(25 - abs(performance_value - benchmark.q3_performance) * 10, 0)
    
    def generate_performance_summary(self, investment_name: str, asset_class: str, 
                                   irr_rank: Optional[int], tvpi_rank: Optional[int]) -> str:
        """Generate overall performance summary"""
        if not irr_rank and not tvpi_rank:
            return "No benchmark data available for comparison"
        
        # Determine overall assessment
        ranks = [r for r in [irr_rank, tvpi_rank] if r is not None]
        avg_rank = sum(ranks) / len(ranks)
        
        if avg_rank <= 1.5:
            performance_tier = "Exceptional"
            performance_desc = "Top Quartile"
        elif avg_rank <= 2.5:
            performance_tier = "Strong"  
            performance_desc = "Above Median"
        elif avg_rank <= 3.5:
            performance_tier = "Mixed"
            performance_desc = "Below Median"
        else:
            performance_tier = "Underperforming"
            performance_desc = "Bottom Quartile"
            
        return f"{performance_tier} performance - {performance_desc} vs {asset_class} peers"
    
    def compare_investment_performance(self, investment_id: int) -> schemas.InvestmentBenchmarkComparison:
        """Compare investment performance against benchmarks"""
        
        # Get investment details
        investment = crud.get_investment(self.db, investment_id)
        if not investment:
            raise ValueError(f"Investment {investment_id} not found")
        
        # Get investment performance
        performance_metrics = crud.get_investment_performance(self.db, investment_id)
        
        investment_irr = performance_metrics.performance.irr if performance_metrics else None
        investment_tvpi = performance_metrics.performance.tvpi if performance_metrics else None
        
        # Get benchmark data
        irr_benchmark = self.get_benchmark_data(investment.asset_class, investment.vintage_year, "IRR")
        tvpi_benchmark = self.get_benchmark_data(investment.asset_class, investment.vintage_year, "TVPI")
        
        # Initialize comparison results
        irr_quartile_rank = None
        irr_vs_median = None  
        irr_percentile = None
        tvpi_quartile_rank = None
        tvpi_vs_median = None
        tvpi_percentile = None
        
        # Compare IRR if data available
        if investment_irr and irr_benchmark:
            irr_quartile_rank = self.calculate_quartile_rank(investment_irr, irr_benchmark)
            irr_vs_median = (investment_irr - irr_benchmark.median_performance) * 100  # Convert to percentage points
            irr_percentile = self.calculate_percentile_estimate(investment_irr, irr_benchmark)
        
        # Compare TVPI if data available
        if investment_tvpi and tvpi_benchmark:
            tvpi_quartile_rank = self.calculate_quartile_rank(investment_tvpi, tvpi_benchmark)
            tvpi_vs_median = investment_tvpi - tvpi_benchmark.median_performance  # Difference in multiple
            tvpi_percentile = self.calculate_percentile_estimate(investment_tvpi, tvpi_benchmark)
        
        # Generate overall assessment
        performance_summary = self.generate_performance_summary(
            investment.name, 
            investment.asset_class.value,
            irr_quartile_rank, 
            tvpi_quartile_rank
        )
        
        # Determine data availability
        if irr_benchmark and tvpi_benchmark:
            data_availability = "Full benchmark data available"
        elif irr_benchmark or tvpi_benchmark:
            data_availability = "Partial benchmark data available"
        else:
            data_availability = "No benchmark data available for this asset class/vintage"
        
        return schemas.InvestmentBenchmarkComparison(
            investment_id=investment.id,
            investment_name=investment.name,
            asset_class=investment.asset_class.value,
            vintage_year=investment.vintage_year,
            
            investment_irr=investment_irr,
            investment_tvpi=investment_tvpi,
            
            irr_benchmark=schemas.BenchmarkData.from_orm(irr_benchmark) if irr_benchmark else None,
            irr_quartile_rank=irr_quartile_rank,
            irr_vs_median=irr_vs_median,
            irr_percentile=irr_percentile,
            
            tvpi_benchmark=schemas.BenchmarkData.from_orm(tvpi_benchmark) if tvpi_benchmark else None,
            tvpi_quartile_rank=tvpi_quartile_rank,
            tvpi_vs_median=tvpi_vs_median,
            tvpi_percentile=tvpi_percentile,
            
            overall_performance_summary=performance_summary,
            data_availability=data_availability
        )

def get_benchmark_comparison(db: Session, investment_id: int) -> schemas.InvestmentBenchmarkComparison:
    """Helper function to get benchmark comparison for an investment"""
    service = BenchmarkComparisonService(db)
    return service.compare_investment_performance(investment_id)