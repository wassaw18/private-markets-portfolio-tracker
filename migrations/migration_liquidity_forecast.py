#!/usr/bin/env python3
"""
Migration Script: 12-Month Liquidity Forecast Dashboard
Adds ForecastAdjustment table for cash flow overrides

Features:
- Safe migration with automatic backup
- Rollback capability
- Verification system
- Non-breaking changes
"""

import sqlite3
import shutil
import sys
import time
from datetime import datetime

def create_backup():
    """Create database backup before migration"""
    timestamp = int(time.time())
    backup_path = f"portfolio_backup_liquidity_{timestamp}.db"
    
    print(f"📦 Creating backup: {backup_path}")
    shutil.copy2("portfolio.db", backup_path)
    print(f"✅ Backup created successfully")
    return backup_path

def migrate_database():
    """Add forecast adjustments table"""
    
    print("🔄 Adding ForecastAdjustment table...")
    
    conn = sqlite3.connect("portfolio.db")
    cursor = conn.cursor()
    
    try:
        # Create forecast_adjustments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS forecast_adjustments (
                id INTEGER PRIMARY KEY,
                investment_id INTEGER NOT NULL,
                adjustment_date DATE NOT NULL,
                adjustment_type VARCHAR(50) NOT NULL,
                adjustment_amount FLOAT NOT NULL,
                reason TEXT,
                confidence VARCHAR(20) DEFAULT 'confirmed',
                created_by VARCHAR(255),
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1 NOT NULL,
                
                FOREIGN KEY (investment_id) REFERENCES investments (id)
            )
        """)
        
        # Create indexes for performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_adjustment_lookup 
            ON forecast_adjustments (investment_id, adjustment_date, is_active)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_adjustment_investment 
            ON forecast_adjustments (investment_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_adjustment_date 
            ON forecast_adjustments (adjustment_date)
        """)
        
        conn.commit()
        print("✅ ForecastAdjustment table created successfully")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

def verify_migration():
    """Verify migration completed successfully"""
    
    print("🔍 Verifying migration...")
    
    conn = sqlite3.connect("portfolio.db")
    cursor = conn.cursor()
    
    try:
        # Check if table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='forecast_adjustments'
        """)
        table_exists = cursor.fetchone() is not None
        
        if not table_exists:
            raise Exception("forecast_adjustments table not found")
        
        # Check table structure
        cursor.execute("PRAGMA table_info(forecast_adjustments)")
        columns = cursor.fetchall()
        
        expected_columns = {
            'id', 'investment_id', 'adjustment_date', 'adjustment_type',
            'adjustment_amount', 'reason', 'confidence', 'created_by',
            'created_date', 'is_active'
        }
        actual_columns = {col[1] for col in columns}
        
        if not expected_columns.issubset(actual_columns):
            missing = expected_columns - actual_columns
            raise Exception(f"Missing columns: {missing}")
        
        # Check indexes
        cursor.execute("PRAGMA index_list(forecast_adjustments)")
        indexes = cursor.fetchall()
        index_names = {idx[1] for idx in indexes}
        
        expected_indexes = {'ix_adjustment_lookup', 'ix_adjustment_investment', 'ix_adjustment_date'}
        if not expected_indexes.issubset(index_names):
            missing_indexes = expected_indexes - index_names
            print(f"⚠️  Some indexes missing: {missing_indexes}")
        
        print("✅ Migration verification passed")
        return True
        
    except Exception as e:
        print(f"❌ Migration verification failed: {e}")
        return False
    finally:
        conn.close()

def rollback_migration(backup_path: str):
    """Rollback migration by restoring backup"""
    
    print(f"⏪ Rolling back migration...")
    print(f"Restoring from backup: {backup_path}")
    
    try:
        shutil.copy2(backup_path, "portfolio.db")
        print("✅ Rollback completed successfully")
        return True
    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        return False

def main():
    """Execute liquidity forecast migration"""
    
    print("🚀 Liquidity Forecast Dashboard Migration")
    print("=" * 50)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    backup_path = None
    
    try:
        # Step 1: Create backup
        backup_path = create_backup()
        
        # Step 2: Run migration
        migrate_database()
        
        # Step 3: Verify migration
        if verify_migration():
            print()
            print("🎉 Liquidity Forecast Migration Completed Successfully!")
            print("=" * 50)
            print("✅ ForecastAdjustment table created")
            print("✅ Indexes created for performance")
            print("✅ Migration verified")
            print(f"✅ Backup available: {backup_path}")
            print()
            print("📋 New Features Available:")
            print("• Forecast overrides for known cash flows")
            print("• 12-month liquidity forecasting")
            print("• Cash flow matching opportunities")
            print("• Liquidity alerts and warnings")
            print("• Stress testing scenarios")
            
        else:
            print("\n⚠️  Migration verification failed")
            response = input("Do you want to rollback? (y/n): ")
            if response.lower().startswith('y'):
                if backup_path:
                    rollback_migration(backup_path)
            return 1
    
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        if backup_path:
            print("Attempting automatic rollback...")
            rollback_migration(backup_path)
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())