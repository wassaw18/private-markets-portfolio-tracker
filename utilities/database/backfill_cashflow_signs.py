"""
Backfill script to correct cash flow signs based on type

This script ensures all cash flows have the correct sign convention:
- Outflows (Capital Call, Contribution, Fees): negative
- Inflows (Distribution, Yield, Return of Principal): positive

Users should always enter positive amounts, and the system applies the correct sign.
"""

import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models import CashFlow, CashFlowType, Tenant
from app.database import get_db
from datetime import datetime

def _apply_cash_flow_sign_convention(amount: float, cash_flow_type: CashFlowType) -> float:
    """
    Apply proper sign convention for cash flows:
    - Outflows (Capital Call, Contribution, Fees) should be negative
    - Inflows (Distribution, Yield, Return of Principal) should be positive

    Always work with absolute value first, then apply correct sign.
    """
    # Always work with absolute value first
    amount = abs(amount)

    # Outflow types (money going out, should be negative)
    outflow_types = {
        CashFlowType.CAPITAL_CALL,
        CashFlowType.CONTRIBUTION,
        CashFlowType.FEES
    }

    # Inflow types (money coming in, should be positive)
    inflow_types = {
        CashFlowType.DISTRIBUTION,
        CashFlowType.YIELD,
        CashFlowType.RETURN_OF_PRINCIPAL
    }

    if cash_flow_type in outflow_types:
        return -amount  # Make negative for outflows
    elif cash_flow_type in inflow_types:
        return amount   # Keep positive for inflows
    else:
        # Fallback: if unknown type, keep positive
        return amount

def backfill_cashflow_signs():
    """Backfill cash flow signs based on type"""

    # Get database connection
    db = next(get_db())

    try:
        # Get all tenants
        tenants = db.query(Tenant).all()

        total_cashflows = 0
        total_updated = 0

        for tenant in tenants:
            print(f"\nProcessing tenant: {tenant.name} (ID: {tenant.id})")

            # Get all cash flows for this tenant
            cashflows = db.query(CashFlow).filter(
                CashFlow.tenant_id == tenant.id
            ).all()

            print(f"  Found {len(cashflows)} cash flows")

            for cf in cashflows:
                total_cashflows += 1

                # Calculate what the amount should be based on type
                correct_amount = _apply_cash_flow_sign_convention(cf.amount, cf.type)

                # Only update if amount is incorrect
                if cf.amount != correct_amount:
                    old_amount = cf.amount
                    cf.amount = correct_amount
                    cf.updated_date = datetime.utcnow()

                    total_updated += 1
                    investment_name = db.query(CashFlow).filter(CashFlow.id == cf.id).first()
                    print(f"    ✓ {cf.date} {cf.type}: ${old_amount:,.2f} → ${correct_amount:,.2f}")
                else:
                    sign = "✓" if cf.amount < 0 else "✓"
                    print(f"    {sign} {cf.date} {cf.type}: ${cf.amount:,.2f} (already correct)")

        # Commit all changes
        db.commit()

        print(f"\n{'='*60}")
        print(f"Backfill complete!")
        print(f"Total cash flows processed: {total_cashflows}")
        print(f"Total cash flows updated: {total_updated}")
        print(f"{'='*60}\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during backfill: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("="*60)
    print("Backfilling Cash Flow Signs")
    print("="*60)
    backfill_cashflow_signs()
