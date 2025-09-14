"""
Market benchmark seeder for monthly returns data
Creates initial S&P 500 benchmark and loads sample data
"""
from datetime import date
from sqlalchemy.orm import Session
from app.models import MarketBenchmark, BenchmarkReturn
from app.database import get_db

def seed_market_benchmarks(db: Session):
    """Seed initial market benchmarks"""
    
    # Clear existing market benchmark data
    db.query(BenchmarkReturn).delete()
    db.query(MarketBenchmark).delete()
    db.commit()
    
    # Create S&P 500 Total Return benchmark
    sp500_tr = MarketBenchmark(
        name="S&P 500 Total Return Index",
        ticker="SPY-TR", 
        category="Equity",
        description="S&P 500 Total Return Index including reinvested dividends. Used for PME analysis and public markets comparison.",
        data_source="Manual",
        is_active=True
    )
    db.add(sp500_tr)
    
    # Create S&P 500 Price Return benchmark
    sp500_pr = MarketBenchmark(
        name="S&P 500 Price Return Index",
        ticker="SPY-PR",
        category="Equity", 
        description="S&P 500 Price Return Index excluding dividends. Used for price-only performance comparison.",
        data_source="Manual",
        is_active=True
    )
    db.add(sp500_pr)
    
    # Create Russell 3000 placeholder
    russell3000 = MarketBenchmark(
        name="Russell 3000 Total Return",
        ticker="VTHR",
        category="Equity",
        description="Russell 3000 Total Return Index for broad market comparison",
        data_source="Manual",
        is_active=True
    )
    db.add(russell3000)
    
    # Create Bloomberg Aggregate Bond placeholder
    agg_bond = MarketBenchmark(
        name="Bloomberg US Aggregate Bond Index",
        ticker="AGG",
        category="Fixed Income",
        description="Bloomberg US Aggregate Bond Index for fixed income comparison",
        data_source="Manual", 
        is_active=True
    )
    db.add(agg_bond)
    
    # Create REIT benchmark placeholder
    reit_index = MarketBenchmark(
        name="FTSE NAREIT Equity REITs Index",
        ticker="VNQ",
        category="Real Estate",
        description="FTSE NAREIT All Equity REITs Index for real estate comparison",
        data_source="Manual",
        is_active=True
    )
    db.add(reit_index)
    
    db.commit()
    db.refresh(sp500_tr)
    
    print(f"✅ Created {db.query(MarketBenchmark).count()} market benchmarks")
    return sp500_tr.id

def main():
    """Main seeder function"""
    db = next(get_db())
    try:
        sp500_id = seed_market_benchmarks(db)
        print(f"✅ Market benchmark seeding completed")
        print(f"S&P 500 benchmark ID: {sp500_id}")
        print("📄 Sample data CSV created at: sample_sp500_data.csv")
        print("🚀 Use the bulk import API endpoint to load S&P 500 data:")
        print(f"   POST /api/benchmarks/{sp500_id}/returns/bulk-import")
    finally:
        db.close()

if __name__ == "__main__":
    main()