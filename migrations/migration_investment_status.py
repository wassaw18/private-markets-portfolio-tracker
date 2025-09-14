"""
Migration script to add investment status management fields
Adds: status, realization_date, realization_notes, status_changed_by, status_changed_date
Run this script: python migrations/migration_investment_status.py
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    """Add investment status management fields to the investments table"""
    
    # Database path
    db_path = "portfolio_tracker.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database file {db_path} not found")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 Starting investment status migration...")
        
        # Check if status column already exists
        cursor.execute("PRAGMA table_info(investments)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'status' in columns:
            print("✅ Investment status fields already exist - migration not needed")
            return True
        
        # Add the new columns with default values
        print("📋 Adding status column...")
        cursor.execute("""
            ALTER TABLE investments 
            ADD COLUMN status TEXT DEFAULT 'active' NOT NULL
        """)
        
        print("📋 Adding realization_date column...")
        cursor.execute("""
            ALTER TABLE investments 
            ADD COLUMN realization_date DATE
        """)
        
        print("📋 Adding realization_notes column...")
        cursor.execute("""
            ALTER TABLE investments 
            ADD COLUMN realization_notes TEXT
        """)
        
        print("📋 Adding status_changed_by column...")
        cursor.execute("""
            ALTER TABLE investments 
            ADD COLUMN status_changed_by TEXT
        """)
        
        print("📋 Adding status_changed_date column...")
        cursor.execute("""
            ALTER TABLE investments 
            ADD COLUMN status_changed_date TIMESTAMP
        """)
        
        # Verify the columns were added
        cursor.execute("PRAGMA table_info(investments)")
        columns = [column[1] for column in cursor.fetchall()]
        
        required_columns = ['status', 'realization_date', 'realization_notes', 'status_changed_by', 'status_changed_date']
        missing_columns = [col for col in required_columns if col not in columns]
        
        if missing_columns:
            print(f"❌ Failed to add columns: {missing_columns}")
            return False
        
        # Commit the changes
        conn.commit()
        conn.close()
        
        print("✅ Investment status migration completed successfully!")
        print("📊 All investments are now set to 'active' status by default")
        print("🎯 Ready to implement status management UI!")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        if conn:
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    print("🚀 Investment Status Management Migration")
    print("=========================================")
    success = run_migration()
    if success:
        print("\n✅ Migration completed successfully!")
        print("Next steps:")
        print("1. Restart your FastAPI server")
        print("2. Check that /api/investments returns investments with status fields")
        print("3. Implement UI components for status management")
    else:
        print("\n❌ Migration failed - please check the error messages above")