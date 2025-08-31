#!/usr/bin/env python3
"""
Database Migration: Add Basic Auditing Fields
Enhanced Basic Auditing System for Private Markets Portfolio Tracker

This migration adds created_by and updated_by fields to major entities
for tracking who creates and modifies data records.

Author: Enhanced Auditing System Implementation
Date: 2025-08-28
"""

import sqlite3
import os
from pathlib import Path

def run_migration():
    """Run the audit fields migration"""
    
    # Database path
    db_path = Path(__file__).parent / "portfolio.db"
    
    if not db_path.exists():
        print("❌ Database not found. Please run the application first to create the database.")
        return False
    
    print("🔄 Starting Enhanced Basic Auditing Migration...")
    print(f"📁 Database: {db_path}")
    
    # Create backup
    backup_path = Path(__file__).parent / f"portfolio_backup_{int(__import__('time').time())}.db"
    import shutil
    shutil.copy2(db_path, backup_path)
    print(f"💾 Backup created: {backup_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # List of tables and their audit field additions
        audit_updates = [
            {
                'table': 'entities',
                'description': 'Entity records (individuals, trusts, etc.)'
            },
            {
                'table': 'family_members',
                'description': 'Family member records'
            },
            {
                'table': 'investments',
                'description': 'Investment records'
            },
            {
                'table': 'cashflows',
                'description': 'Cash flow transactions'
            },
            {
                'table': 'valuations',
                'description': 'Investment valuations'
            },
            {
                'table': 'entity_relationships',
                'description': 'Entity relationship records'
            },
            {
                'table': 'investment_ownership',
                'description': 'Investment ownership tracking'
            }
        ]
        
        migration_success = True
        
        for update in audit_updates:
            table_name = update['table']
            description = update['description']
            
            print(f"📊 Processing {table_name} - {description}")
            
            try:
                # Check if table exists
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name=?
                """, (table_name,))
                
                if not cursor.fetchone():
                    print(f"⚠️  Table {table_name} not found, skipping...")
                    continue
                
                # Check if audit fields already exist
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = [column[1] for column in cursor.fetchall()]
                
                fields_to_add = []
                if 'created_by' not in columns:
                    fields_to_add.append('created_by')
                if 'updated_by' not in columns:
                    fields_to_add.append('updated_by')
                
                if not fields_to_add:
                    print(f"✅ {table_name}: Audit fields already exist")
                    continue
                
                # Add missing audit fields
                for field in fields_to_add:
                    try:
                        cursor.execute(f"""
                            ALTER TABLE {table_name} 
                            ADD COLUMN {field} TEXT
                        """)
                        print(f"✅ {table_name}: Added {field} field")
                    except sqlite3.OperationalError as e:
                        if "duplicate column name" not in str(e).lower():
                            raise e
                        print(f"✅ {table_name}: {field} already exists")
                
            except Exception as e:
                print(f"❌ Error updating {table_name}: {e}")
                migration_success = False
                continue
        
        if migration_success:
            conn.commit()
            print("\n🎉 Migration completed successfully!")
            
            # Verify the migration
            print("\n🔍 Verification:")
            for update in audit_updates:
                table_name = update['table']
                try:
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    columns = [column[1] for column in cursor.fetchall()]
                    
                    has_created_by = 'created_by' in columns
                    has_updated_by = 'updated_by' in columns
                    
                    status = "✅" if (has_created_by and has_updated_by) else "⚠️"
                    print(f"{status} {table_name}: created_by={has_created_by}, updated_by={has_updated_by}")
                    
                except Exception as e:
                    print(f"❌ Error verifying {table_name}: {e}")
            
            print(f"\n📋 Migration Summary:")
            print(f"   • Added audit tracking to {len(audit_updates)} entity types")
            print(f"   • Fields added: created_by, updated_by")
            print(f"   • All fields are nullable to maintain compatibility")
            print(f"   • Backup saved as: {backup_path.name}")
            
            print(f"\n🔄 Next Steps:")
            print(f"   1. Update CRUD operations to capture user context")
            print(f"   2. Modify API endpoints to pass current user")
            print(f"   3. Test all existing functionality")
            
        else:
            conn.rollback()
            print("\n❌ Migration failed. Database rolled back.")
            return False
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False
    finally:
        conn.close()
    
    return migration_success

def rollback_migration():
    """Rollback the migration if needed"""
    db_path = Path(__file__).parent / "portfolio.db"
    
    # Find the most recent backup
    backup_files = list(Path(__file__).parent.glob("portfolio_backup_*.db"))
    if not backup_files:
        print("❌ No backup files found for rollback")
        return False
    
    latest_backup = max(backup_files, key=lambda p: p.stat().st_mtime)
    
    print(f"🔄 Rolling back to: {latest_backup}")
    import shutil
    shutil.copy2(latest_backup, db_path)
    print("✅ Rollback completed")
    return True

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback_migration()
    else:
        success = run_migration()
        if not success:
            print("\n🚨 Migration failed. You can rollback using:")
            print(f"   python {__file__} rollback")
            sys.exit(1)