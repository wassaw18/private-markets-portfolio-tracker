#!/usr/bin/env python3
"""
Migration script to fix investment status values in the database
Updates lowercase 'active' to uppercase 'ACTIVE' to match enum
Run this script: python migrations/fix_investment_status_values.py
"""

import sqlite3
import os

def run_migration():
    """Fix investment status values to match enum case"""
    
    # Database path
    db_path = "portfolio_tracker.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database file {db_path} not found")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 Starting investment status value fix...")
        
        # Check current status values
        cursor.execute("SELECT DISTINCT status FROM investments WHERE status IS NOT NULL")
        current_values = [row[0] for row in cursor.fetchall()]
        print(f"📊 Current status values: {current_values}")
        
        # Update lowercase values to uppercase
        print("📝 Updating status values to match enum case...")
        
        # Fix active -> ACTIVE
        cursor.execute("UPDATE investments SET status = 'ACTIVE' WHERE status = 'active'")
        active_updates = cursor.rowcount
        print(f"   - Updated {active_updates} records from 'active' to 'ACTIVE'")
        
        # Fix dormant -> DORMANT
        cursor.execute("UPDATE investments SET status = 'DORMANT' WHERE status = 'dormant'")
        dormant_updates = cursor.rowcount
        print(f"   - Updated {dormant_updates} records from 'dormant' to 'DORMANT'")
        
        # Fix realized -> REALIZED
        cursor.execute("UPDATE investments SET status = 'REALIZED' WHERE status = 'realized'")
        realized_updates = cursor.rowcount
        print(f"   - Updated {realized_updates} records from 'realized' to 'REALIZED'")
        
        # Verify the updated values
        cursor.execute("SELECT DISTINCT status FROM investments WHERE status IS NOT NULL")
        updated_values = [row[0] for row in cursor.fetchall()]
        print(f"📊 Updated status values: {updated_values}")
        
        # Check for any invalid values
        valid_values = {'ACTIVE', 'DORMANT', 'REALIZED'}
        invalid_values = set(updated_values) - valid_values
        
        if invalid_values:
            print(f"⚠️  Found invalid status values: {invalid_values}")
            print("   Setting invalid values to 'ACTIVE'...")
            for invalid_value in invalid_values:
                cursor.execute("UPDATE investments SET status = 'ACTIVE' WHERE status = ?", (invalid_value,))
                invalid_updates = cursor.rowcount
                print(f"   - Updated {invalid_updates} records from '{invalid_value}' to 'ACTIVE'")
        
        # Commit the changes
        conn.commit()
        conn.close()
        
        total_updates = active_updates + dormant_updates + realized_updates
        print(f"✅ Investment status fix completed successfully!")
        print(f"📊 Total records updated: {total_updates}")
        print("🎯 All status values now match enum case!")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    print("🚀 Investment Status Value Fix Migration")
    print("========================================")
    success = run_migration()
    if success:
        print("\n✅ Migration completed successfully!")
        print("Next steps:")
        print("1. Restart your FastAPI server")
        print("2. Test that investment endpoints work correctly")
    else:
        print("\n❌ Migration failed - please check the error messages above")