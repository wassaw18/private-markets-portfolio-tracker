#!/usr/bin/env python3
"""
Add archive columns to investments table

This migration adds:
- is_archived: Boolean flag for soft delete
- archived_date: When was it archived
- archived_by_user_id: Who archived it
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import text
from app.database import engine

def upgrade():
    """Add archive columns to investments table"""

    with engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='investments'
            AND column_name IN ('is_archived', 'archived_date', 'archived_by_user_id')
        """))

        existing_columns = {row[0] for row in result}

        # Add is_archived column if it doesn't exist
        if 'is_archived' not in existing_columns:
            print("Adding is_archived column...")
            conn.execute(text("""
                ALTER TABLE investments
                ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE
            """))
            conn.execute(text("""
                CREATE INDEX ix_investments_archived
                ON investments(tenant_id, is_archived)
            """))
            print("✓ Added is_archived column with index")
        else:
            print("is_archived column already exists")

        # Add archived_date column if it doesn't exist
        if 'archived_date' not in existing_columns:
            print("Adding archived_date column...")
            conn.execute(text("""
                ALTER TABLE investments
                ADD COLUMN archived_date TIMESTAMP
            """))
            print("✓ Added archived_date column")
        else:
            print("archived_date column already exists")

        # Add archived_by_user_id column if it doesn't exist
        if 'archived_by_user_id' not in existing_columns:
            print("Adding archived_by_user_id column...")
            conn.execute(text("""
                ALTER TABLE investments
                ADD COLUMN archived_by_user_id INTEGER
                REFERENCES users(id)
            """))
            print("✓ Added archived_by_user_id column with foreign key")
        else:
            print("archived_by_user_id column already exists")

        conn.commit()
        print("\n✅ Migration completed successfully!")

def downgrade():
    """Remove archive columns from investments table"""

    with engine.connect() as conn:
        print("Removing archive columns...")

        conn.execute(text("""
            ALTER TABLE investments
            DROP COLUMN IF EXISTS archived_by_user_id,
            DROP COLUMN IF EXISTS archived_date,
            DROP COLUMN IF EXISTS is_archived
        """))

        conn.execute(text("""
            DROP INDEX IF EXISTS ix_investments_archived
        """))

        conn.commit()
        print("✓ Migration rolled back successfully!")

if __name__ == "__main__":
    print("=== Add Archive Columns Migration ===\n")

    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--downgrade', action='store_true', help='Rollback the migration')
    args = parser.parse_args()

    if args.downgrade:
        downgrade()
    else:
        upgrade()
