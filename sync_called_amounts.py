"""
Sync called_amount field with capital call cash flows
"""
from app import models
from app.database import engine
from sqlalchemy import select
from sqlalchemy.orm import Session

def sync_called_amounts():
    with Session(engine) as session:
        # Get all investments for Tenant 3
        investments = session.execute(
            select(models.Investment)
            .where(models.Investment.tenant_id == 3)
        ).scalars().all()

        print("Syncing called_amount with cash flows for Tenant 3...")
        print("=" * 70)

        updates_made = 0

        for inv in investments:
            # Get all capital call cash flows
            cash_flows = session.execute(
                select(models.CashFlow)
                .where(models.CashFlow.investment_id == inv.id)
            ).scalars().all()

            # Sum up contributions (Capital Call and Contribution types)
            total_contributions = 0
            for cf in cash_flows:
                if cf.type in ['Capital Call', 'Contribution']:
                    total_contributions += abs(cf.amount)

            # Check if update needed
            if total_contributions != inv.called_amount:
                old_amount = inv.called_amount
                inv.called_amount = total_contributions
                updates_made += 1

                print(f"\n{inv.name[:50]}")
                print(f"  Old called_amount: ${old_amount:,.2f}")
                print(f"  New called_amount: ${total_contributions:,.2f}")
                print(f"  Difference: ${total_contributions - old_amount:,.2f}")

        # Commit changes
        session.commit()

        print("\n" + "=" * 70)
        print(f"Sync complete! Updated {updates_made} investments.")

        # Show new totals
        investments = session.execute(
            select(models.Investment)
            .where(models.Investment.tenant_id == 3)
        ).scalars().all()

        total_commitment = sum(inv.commitment_amount for inv in investments)
        total_called = sum(inv.called_amount for inv in investments)

        print(f"\nNew Totals for Tenant 3:")
        print(f"  Total Commitment: ${total_commitment:,.2f}")
        print(f"  Total Called: ${total_called:,.2f}")
        print(f"  Uncalled: ${total_commitment - total_called:,.2f}")

if __name__ == "__main__":
    sync_called_amounts()
