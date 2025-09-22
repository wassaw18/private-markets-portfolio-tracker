#!/usr/bin/env python3
"""
Data migration script: SQLite → PostgreSQL
Transfers all existing data from SQLite to PostgreSQL database
"""

import os
import json
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models import Base
import sqlite3

def backup_sqlite_data():
    """Export all data from SQLite to JSON files for safe migration"""
    print("📤 Backing up SQLite data...")
    
    # Connect to SQLite database
    sqlite_conn = sqlite3.connect('./portfolio_tracker.db')
    sqlite_conn.row_factory = sqlite3.Row  # This enables column access by name
    cursor = sqlite_conn.cursor()
    
    # Get list of all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [row[0] for row in cursor.fetchall()]
    
    backup_data = {}
    
    for table in tables:
        print(f"  📋 Backing up table: {table}")
        cursor.execute(f"SELECT * FROM {table}")
        
        # Convert rows to dictionaries
        rows = []
        for row in cursor.fetchall():
            row_dict = {}
            for key in row.keys():
                value = row[key]
                # Handle datetime conversion
                if isinstance(value, str) and ('T' in value or '-' in value):
                    # Attempt to preserve datetime strings
                    row_dict[key] = value
                else:
                    row_dict[key] = value
            rows.append(row_dict)
        
        backup_data[table] = rows
        print(f"    ✅ {len(rows)} records backed up")
    
    # Save backup to file
    backup_filename = f"sqlite_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_filename, 'w') as f:
        json.dump(backup_data, f, indent=2, default=str)
    
    print(f"💾 Backup saved to: {backup_filename}")
    sqlite_conn.close()
    
    return backup_filename, backup_data

def test_postgresql_connection():
    """Test PostgreSQL connection and setup"""
    print("🔌 Testing PostgreSQL connection...")
    
    pg_url = "postgresql://portfolio_user:monkeys@localhost:5432/portfolio_tracker_db"
    
    try:
        engine = create_engine(pg_url)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"✅ PostgreSQL connection successful!")
            print(f"   Version: {version[:50]}...")
            return engine
    except Exception as e:
        print(f"❌ PostgreSQL connection failed: {e}")
        print("\n🔧 Make sure you've run the manual PostgreSQL setup commands:")
        print("   sudo apt install postgresql postgresql-contrib")
        print("   sudo -u postgres createuser --interactive --pwprompt portfolio_user")
        print("   sudo -u postgres createdb portfolio_tracker_db -O portfolio_user")
        return None

def create_postgresql_schema(engine):
    """Create tables in PostgreSQL using SQLAlchemy models"""
    print("🏗️ Creating PostgreSQL schema...")
    
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ PostgreSQL schema created successfully!")
        return True
    except Exception as e:
        print(f"❌ Schema creation failed: {e}")
        return False

def migrate_data(engine, backup_data):
    """Migrate data from backup to PostgreSQL"""
    print("📊 Migrating data to PostgreSQL...")
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Define table dependency order (to handle foreign keys)
    table_order = [
        'entities',
        'family_members', 
        'entity_relationships',
        'entity_hierarchy',
        'investments',
        'investment_ownership',
        'cash_flows',
        'valuations',
        'market_benchmarks',
        'benchmark_returns',
        'performance_benchmarks',
        'documents'
    ]
    
    db = SessionLocal()
    
    try:
        # Migrate tables in dependency order
        for table_name in table_order:
            if table_name in backup_data:
                records = backup_data[table_name]
                if records:
                    print(f"  📋 Migrating {table_name}: {len(records)} records")
                    
                    # Build INSERT statement
                    if records:
                        # Convert SQLite integers to PostgreSQL booleans for specific columns
                        boolean_columns = ['is_active', 'forecast_enabled']
                        for record in records:
                            for col in boolean_columns:
                                if col in record and isinstance(record[col], int):
                                    record[col] = bool(record[col])
                        
                        columns = list(records[0].keys())
                        placeholders = ', '.join([f':{col}' for col in columns])
                        query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
                        
                        try:
                            db.execute(text(query), records)
                            db.commit()
                            print(f"    ✅ {len(records)} records migrated")
                        except Exception as e:
                            print(f"    ❌ Migration failed for {table_name}: {e}")
                            db.rollback()
                            # Continue with other tables
        
        # Handle any remaining tables not in the ordered list
        for table_name, records in backup_data.items():
            if table_name not in table_order and records:
                print(f"  📋 Migrating additional table {table_name}: {len(records)} records")
                try:
                    # Convert SQLite integers to PostgreSQL booleans for specific columns
                    boolean_columns = ['is_active', 'forecast_enabled']
                    for record in records:
                        for col in boolean_columns:
                            if col in record and isinstance(record[col], int):
                                record[col] = bool(record[col])
                    
                    columns = list(records[0].keys())
                    placeholders = ', '.join([f':{col}' for col in columns])
                    query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
                    
                    db.execute(text(query), records)
                    db.commit()
                    print(f"    ✅ {len(records)} records migrated")
                except Exception as e:
                    print(f"    ❌ Migration failed for {table_name}: {e}")
                    db.rollback()
        
        print("✅ Data migration completed!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

def verify_migration(sqlite_backup, pg_engine):
    """Verify that migration was successful by comparing record counts"""
    print("🔍 Verifying migration...")
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=pg_engine)
    db = SessionLocal()
    
    try:
        for table_name, records in sqlite_backup.items():
            sqlite_count = len(records)
            
            try:
                result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                pg_count = result.fetchone()[0]
                
                if sqlite_count == pg_count:
                    print(f"  ✅ {table_name}: {sqlite_count} records ✓")
                else:
                    print(f"  ❌ {table_name}: SQLite={sqlite_count}, PostgreSQL={pg_count}")
            except Exception as e:
                print(f"  ⚠️ {table_name}: Could not verify ({e})")
    
    finally:
        db.close()

def main():
    """Main migration process"""
    print("🚀 Starting SQLite to PostgreSQL Migration")
    print("=" * 50)
    
    # Step 1: Backup SQLite data
    backup_file, backup_data = backup_sqlite_data()
    
    # Step 2: Test PostgreSQL connection
    pg_engine = test_postgresql_connection()
    if not pg_engine:
        print("\n❌ Migration aborted - fix PostgreSQL connection first")
        return
    
    # Step 3: Create PostgreSQL schema
    if not create_postgresql_schema(pg_engine):
        print("\n❌ Migration aborted - schema creation failed")
        return
    
    # Step 4: Migrate data
    migrate_data(pg_engine, backup_data)
    
    # Step 5: Verify migration
    verify_migration(backup_data, pg_engine)
    
    print("\n🎉 Migration process completed!")
    print(f"📁 Backup file saved as: {backup_file}")
    print("\n📝 Next steps:")
    print("1. Test your application with PostgreSQL")
    print("2. Update .env file to use PostgreSQL URL")
    print("3. Restart your application")

if __name__ == "__main__":
    main()