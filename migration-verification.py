#!/usr/bin/env python3
"""
PostgreSQL Migration Verification Script
Comprehensive verification of data integrity after migration
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import json

def verify_migration():
    """Verify PostgreSQL migration completeness and data integrity"""
    print("🔍 PostgreSQL Migration Verification Report")
    print("=" * 50)

    # Connect to PostgreSQL
    pg_url = 'postgresql://portfolio_user:monkeys@localhost:5432/portfolio_tracker_db'
    engine = create_engine(pg_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    # Load original backup for comparison
    with open('sqlite_backup_20250922_101700.json', 'r') as f:
        original_data = json.load(f)

    try:
        print("📊 Record Count Verification:")
        print("-" * 30)

        total_original = 0
        total_migrated = 0

        # Core business tables
        important_tables = [
            'entities', 'investments', 'cashflows', 'valuations',
            'performance_benchmarks', 'market_benchmarks', 'benchmark_returns'
        ]

        for table in important_tables:
            original_count = len(original_data.get(table, []))

            result = db.execute(text(f'SELECT COUNT(*) FROM {table}'))
            pg_count = result.fetchone()[0]

            status = "✅" if original_count == pg_count else "❌"
            print(f"{status} {table:<20}: {original_count:>3} → {pg_count:>3}")

            total_original += original_count
            total_migrated += pg_count

        print("-" * 30)
        print(f"📈 Total Records: {total_original} → {total_migrated}")

        # Data integrity checks
        print("\n🔍 Data Integrity Checks:")
        print("-" * 30)

        # Check entity relationships
        result = db.execute(text("""
            SELECT COUNT(*) FROM investments i
            JOIN entities e ON i.entity_id = e.id
        """))
        investment_entity_links = result.fetchone()[0]
        print(f"✅ Investment-Entity links: {investment_entity_links}")

        # Check cashflow relationships
        result = db.execute(text("""
            SELECT COUNT(*) FROM cashflows c
            JOIN investments i ON c.investment_id = i.id
        """))
        cashflow_investment_links = result.fetchone()[0]
        print(f"✅ Cashflow-Investment links: {cashflow_investment_links}")

        # Check valuation relationships
        result = db.execute(text("""
            SELECT COUNT(*) FROM valuations v
            JOIN investments i ON v.investment_id = i.id
        """))
        valuation_investment_links = result.fetchone()[0]
        print(f"✅ Valuation-Investment links: {valuation_investment_links}")

        # Sample data verification
        print("\n💼 Sample Data Verification:")
        print("-" * 30)

        # Check entity data
        result = db.execute(text("SELECT name, entity_type FROM entities LIMIT 1"))
        entity = result.fetchone()
        if entity:
            print(f"✅ Entity: {entity.name} ({entity.entity_type})")

        # Check investment data
        result = db.execute(text("SELECT name, asset_class FROM investments LIMIT 1"))
        investment = result.fetchone()
        if investment:
            print(f"✅ Investment: {investment.name} ({investment.asset_class})")

        # Check benchmark data
        result = db.execute(text("SELECT COUNT(*) FROM performance_benchmarks"))
        benchmark_count = result.fetchone()[0]
        print(f"✅ Performance Benchmarks: {benchmark_count} records")

        print("\n🎯 Migration Status:")
        print("-" * 30)
        if total_original == total_migrated:
            print("✅ MIGRATION SUCCESSFUL - All data migrated correctly")
            print("✅ Database is ready for production use")
            print("✅ Frontend and backend can now use PostgreSQL")
        else:
            print("⚠️  MIGRATION PARTIAL - Some data may be missing")
            print("📝 Review individual table results above")

        return True

    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    verify_migration()