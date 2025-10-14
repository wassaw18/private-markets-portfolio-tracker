"""
Backfill script to update investment called_amount and fees from cash flows

This script recalculates called_amount and fees for all investments based on their
associated cash flows, using the same logic as the automatic update function.
"""

import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models import Investment, CashFlow, Tenant
from app.performance import calculate_called_amount_from_cashflows, calculate_fees_from_cashflows
from app.database import get_db
from datetime import datetime

def backfill_investment_summaries():
    """Backfill called_amount and fees for all investments"""

    # Get database connection
    db = next(get_db())

    try:
        # Get all tenants
        tenants = db.query(Tenant).all()

        total_investments = 0
        total_updated = 0

        for tenant in tenants:
            print(f"\nProcessing tenant: {tenant.name} (ID: {tenant.id})")

            # Get all investments for this tenant
            investments = db.query(Investment).filter(
                Investment.tenant_id == tenant.id
            ).all()

            print(f"  Found {len(investments)} investments")

            for investment in investments:
                total_investments += 1

                # Get all cash flows for this investment
                cash_flows = db.query(CashFlow).filter(
                    CashFlow.investment_id == investment.id,
                    CashFlow.tenant_id == tenant.id
                ).all()

                # Calculate new values
                new_called_amount = calculate_called_amount_from_cashflows(cash_flows)
                new_fees = calculate_fees_from_cashflows(cash_flows)

                # Store as positive values
                new_called_amount = abs(new_called_amount)
                new_fees = abs(new_fees)

                # Only update if values changed
                if investment.called_amount != new_called_amount or investment.fees != new_fees:
                    old_called = investment.called_amount
                    old_fees = investment.fees

                    investment.called_amount = new_called_amount
                    investment.fees = new_fees
                    investment.updated_date = datetime.utcnow()

                    total_updated += 1
                    print(f"    ✓ {investment.name}: called_amount ${old_called:,.2f} → ${new_called_amount:,.2f}, fees ${old_fees:,.2f} → ${new_fees:,.2f}")
                else:
                    print(f"    - {investment.name}: already correct (called: ${new_called_amount:,.2f}, fees: ${new_fees:,.2f})")

        # Commit all changes
        db.commit()

        print(f"\n{'='*60}")
        print(f"Backfill complete!")
        print(f"Total investments processed: {total_investments}")
        print(f"Total investments updated: {total_updated}")
        print(f"{'='*60}\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during backfill: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("="*60)
    print("Backfilling Investment Called Amounts and Fees")
    print("="*60)
    backfill_investment_summaries()
