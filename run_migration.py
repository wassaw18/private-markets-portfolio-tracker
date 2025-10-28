#!/usr/bin/env python3
"""
Script to run database migrations
"""
import sys
from sqlalchemy import create_engine, text
from app.database import DATABASE_URL

def run_migration():
    """Run the investment-specific parameters migration"""
    engine = create_engine(DATABASE_URL)

    migration_sql = """
    -- Add interest_rate column for loans and credit instruments
    ALTER TABLE investments
    ADD COLUMN IF NOT EXISTS interest_rate FLOAT;

    -- Add maturity_date column for fixed-term instruments
    ALTER TABLE investments
    ADD COLUMN IF NOT EXISTS maturity_date DATE;

    -- Create enum type for payment frequency if it doesn't exist
    DO $$ BEGIN
        CREATE TYPE paymentfrequency AS ENUM ('Monthly', 'Quarterly', 'Semi-annually', 'Annually', 'At Maturity');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;

    -- Add payment_frequency column
    ALTER TABLE investments
    ADD COLUMN IF NOT EXISTS payment_frequency paymentfrequency;
    """

    try:
        with engine.connect() as conn:
            # Execute migration
            conn.execute(text(migration_sql))
            conn.commit()
            print("✓ Migration completed successfully")
            print("  - Added interest_rate column to investments table")
            print("  - Added maturity_date column to investments table")
            print("  - Added payment_frequency column to investments table")
            return True
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
