#!/usr/bin/env python3
"""
Migration script to add K-1 tax tracking capabilities to the Private Markets Tracker

This script safely adds new columns to the existing CashFlow table and creates
the new TaxDocument table with proper fallback handling.

Run this script after updating the models.py file.
"""

import os
import sqlite3
from datetime import datetime

def backup_database(db_path):
    """Create a backup of the database before migration"""
    if os.path.exists(db_path):
        backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        import shutil
        shutil.copy2(db_path, backup_path)
        print(f"Database backed up to: {backup_path}")
        return backup_path
    return None

def migrate_cashflow_table(cursor):
    """Add K-1 tax tracking columns to the cashflows table"""
    print("Migrating cashflows table...")
    
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(cashflows)")
    existing_columns = [col[1] for col in cursor.fetchall()]
    
    migrations = [
        ("distribution_type", "TEXT"),
        ("tax_year", "INTEGER"),
        ("k1_reportable", "BOOLEAN DEFAULT 1"),
        ("notes", "TEXT")
    ]
    
    for column_name, column_type in migrations:
        if column_name not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE cashflows ADD COLUMN {column_name} {column_type}")
                print(f"  ✓ Added column: {column_name}")
            except sqlite3.Error as e:
                print(f"  ✗ Error adding column {column_name}: {e}")
        else:
            print(f"  - Column {column_name} already exists")

def create_tax_documents_table(cursor):
    """Create the tax_documents table"""
    print("Creating tax_documents table...")
    
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS tax_documents (
        id INTEGER PRIMARY KEY,
        investment_id INTEGER NOT NULL,
        tax_year INTEGER NOT NULL,
        document_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        date_expected DATE,
        date_received DATE,
        date_processed DATE,
        ordinary_income REAL DEFAULT 0.0,
        guaranteed_payments REAL DEFAULT 0.0,
        interest_income REAL DEFAULT 0.0,
        dividend_income REAL DEFAULT 0.0,
        net_short_term_capital_gain REAL DEFAULT 0.0,
        net_long_term_capital_gain REAL DEFAULT 0.0,
        section_199a_income REAL DEFAULT 0.0,
        foreign_tax_paid REAL DEFAULT 0.0,
        file_path TEXT,
        notes TEXT,
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (investment_id) REFERENCES investments (id)
    )
    """
    
    try:
        cursor.execute(create_table_sql)
        print("  ✓ Created tax_documents table")
        
        # Create indexes
        index_sql = "CREATE INDEX IF NOT EXISTS ix_tax_document_lookup ON tax_documents (investment_id, tax_year, document_type)"
        cursor.execute(index_sql)
        print("  ✓ Created tax_documents index")
        
    except sqlite3.Error as e:
        print(f"  ✗ Error creating tax_documents table: {e}")

def update_existing_cashflows(cursor):
    """Update existing cash flows with default tax year and k1_reportable flag"""
    print("Updating existing cash flows with tax tracking defaults...")
    
    try:
        # Set tax_year based on the year from the date field for distributions
        cursor.execute("""
            UPDATE cashflows 
            SET tax_year = CAST(strftime('%Y', date) AS INTEGER),
                k1_reportable = 1
            WHERE type = 'Distribution' AND tax_year IS NULL
        """)
        
        rows_updated = cursor.rowcount
        print(f"  ✓ Updated {rows_updated} distribution records with tax year")
        
        # Set k1_reportable to True for contributions (but no tax_year needed)
        cursor.execute("""
            UPDATE cashflows 
            SET k1_reportable = 0
            WHERE type = 'Contribution' AND k1_reportable IS NULL
        """)
        
        rows_updated = cursor.rowcount
        print(f"  ✓ Updated {rows_updated} contribution records")
        
    except sqlite3.Error as e:
        print(f"  ✗ Error updating existing cash flows: {e}")

def main():
    """Main migration function"""
    print("Starting K-1 Tax Tracking Migration...")
    print("=" * 50)
    
    # Database path - adjust if needed
    db_path = "portfolio.db"
    
    # Check if database exists
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found. Migration will be applied when database is created.")
        return
    
    # Backup database
    backup_path = backup_database(db_path)
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Run migrations
        migrate_cashflow_table(cursor)
        create_tax_documents_table(cursor)
        update_existing_cashflows(cursor)
        
        # Commit changes
        conn.commit()
        print("\n" + "=" * 50)
        print("✓ Migration completed successfully!")
        
        if backup_path:
            print(f"✓ Original database backed up to: {backup_path}")
            
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        if backup_path:
            print(f"Restore from backup: {backup_path}")
        raise
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()