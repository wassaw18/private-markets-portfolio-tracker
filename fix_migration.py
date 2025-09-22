#!/usr/bin/env python3
"""
Fix PostgreSQL migration data type issues
"""

import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def fix_migration():
    """Fix the migration data type issues"""
    print("🔧 Fixing PostgreSQL migration issues...")

    # Load the backup data
    with open('sqlite_backup_20250922_101700.json', 'r') as f:
        backup_data = json.load(f)

    # Connect to PostgreSQL
    pg_url = 'postgresql://portfolio_user:monkeys@localhost:5432/portfolio_tracker_db'
    engine = create_engine(pg_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Fix cashflows - clear table first
        print("🧹 Clearing cashflows table...")
        db.execute(text('DELETE FROM cashflows'))

        # Fix boolean values
        cashflows_data = backup_data['cashflows']
        print(f"🔄 Processing {len(cashflows_data)} cashflow records...")

        for record in cashflows_data:
            if 'k1_reportable' in record and isinstance(record['k1_reportable'], int):
                record['k1_reportable'] = bool(record['k1_reportable'])

        # Insert cashflows with boolean fix
        if cashflows_data:
            columns = list(cashflows_data[0].keys())
            placeholders = ', '.join([f':{col}' for col in columns])
            column_names = ', '.join(columns)
            query = f'INSERT INTO cashflows ({column_names}) VALUES ({placeholders})'
            db.execute(text(query), cashflows_data)

        db.commit()
        print('✅ Fixed cashflows migration successfully')

        # Verify record counts
        result = db.execute(text('SELECT COUNT(*) FROM cashflows'))
        count = result.fetchone()[0]
        print(f'✅ Cashflows in PostgreSQL: {count} records')

        # Check other tables
        tables_to_check = ['entities', 'investments', 'valuations', 'performance_benchmarks']
        for table in tables_to_check:
            result = db.execute(text(f'SELECT COUNT(*) FROM {table}'))
            count = result.fetchone()[0]
            print(f'✅ {table}: {count} records')

    except Exception as e:
        print(f'❌ Fix failed: {e}')
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    fix_migration()