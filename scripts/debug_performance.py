#!/usr/bin/env python3
"""
Debug script to investigate performance calculation issues
"""
import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.database import get_db
from app.models import Investment, CashFlow, Valuation, CashFlowType
from app.performance import calculate_investment_performance
from app import crud
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import json

def debug_investment_performance():
    """Debug performance calculation for all investments"""
    
    # Create database connection
    SQLALCHEMY_DATABASE_URL = "sqlite:///./portfolio.db"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        # Get all investments
        investments = db.query(Investment).all()
        print(f"Found {len(investments)} investments")
        print("=" * 60)
        
        for investment in investments:
            print(f"\nInvestment: {investment.name}")
            print(f"ID: {investment.id}")
            print(f"Asset Class: {investment.asset_class}")
            print(f"Commitment: ${investment.commitment_amount:,.2f}")
            print(f"Called Amount: ${investment.called_amount:,.2f}")
            
            # Get all cash flows
            cashflows = db.query(CashFlow).filter(CashFlow.investment_id == investment.id).all()
            print(f"Total Cash Flows: {len(cashflows)}")
            
            # Group by type
            cashflow_types = {}
            for cf in cashflows:
                cf_type = cf.type.value if hasattr(cf.type, 'value') else str(cf.type)
                if cf_type not in cashflow_types:
                    cashflow_types[cf_type] = []
                cashflow_types[cf_type].append(cf.amount)
            
            print("Cash Flow Types:")
            for cf_type, amounts in cashflow_types.items():
                total = sum(amounts)
                count = len(amounts)
                print(f"  {cf_type}: {count} transactions, Total: ${total:,.2f}")
            
            # Get valuations
            valuations = db.query(Valuation).filter(Valuation.investment_id == investment.id).all()
            print(f"Valuations: {len(valuations)}")
            if valuations:
                latest_nav = max(valuations, key=lambda v: v.date)
                print(f"  Latest NAV: ${latest_nav.nav_value:,.2f} ({latest_nav.date})")
            
            # Current performance calculation logic
            print("\nCURRENT LOGIC RESULTS:")
            contributions_current = [cf for cf in cashflows if cf.type == CashFlowType.CONTRIBUTION]
            distributions_current = [cf for cf in cashflows if cf.type == CashFlowType.DISTRIBUTION]
            print(f"  Contributions found: {len(contributions_current)}")
            print(f"  Distributions found: {len(distributions_current)}")
            
            if contributions_current or distributions_current or valuations:
                perf_metrics = calculate_investment_performance(contributions_current, distributions_current, valuations)
                print(f"  IRR: {perf_metrics.irr}")
                print(f"  TVPI: {perf_metrics.tvpi}")
                print(f"  Total Contributions: ${perf_metrics.total_contributions:,.2f}")
                print(f"  Current NAV: {perf_metrics.current_nav}")
            
            # IMPROVED LOGIC - include CAPITAL_CALL and other types
            print("\nIMPROVED LOGIC RESULTS:")
            # Include CAPITAL_CALL and CONTRIBUTION as contributions (outflows)
            contributions_improved = [cf for cf in cashflows if cf.type in [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION]]
            # Include all distribution types as distributions (inflows)
            distributions_improved = [cf for cf in cashflows if cf.type in [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL]]
            
            print(f"  Contributions found: {len(contributions_improved)} (includes CAPITAL_CALL)")
            print(f"  Distributions found: {len(distributions_improved)} (includes YIELD, RETURN_OF_PRINCIPAL)")
            
            if contributions_improved or distributions_improved or valuations:
                perf_metrics = calculate_investment_performance(contributions_improved, distributions_improved, valuations)
                print(f"  IRR: {perf_metrics.irr}")
                print(f"  TVPI: {perf_metrics.tvpi}")
                print(f"  Total Contributions: ${perf_metrics.total_contributions:,.2f}")
                print(f"  Current NAV: {perf_metrics.current_nav}")
            
            print("-" * 40)
        
        print(f"\nSUMMARY")
        print("=" * 60)
        print("The issue is likely that performance calculation only looks for 'CONTRIBUTION'")
        print("cash flows, but the user may have 'CAPITAL_CALL' cash flows instead.")
        print("We need to update the CRUD logic to include all relevant cash flow types.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    debug_investment_performance()