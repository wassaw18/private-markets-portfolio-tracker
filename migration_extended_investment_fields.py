#!/usr/bin/env python3
"""
Migration script to add extended investment fields to the database schema.
This script adds comprehensive private markets investment fields for professional tracking.

Run this script to update existing database with new investment fields:
python migration_extended_investment_fields.py

New fields added:
- Basic Information: manager, target_raise, geography_focus
- Financial Terms: commitment_date, management_fee, performance_fee, hurdle_rate, distribution_target, currency, liquidity_profile
- Operational Details: expected_maturity_date, reporting_frequency, contact_person, email, portal_link, fund_administrator
- Legal & Risk: fund_domicile, tax_classification, due_diligence_date, ic_approval_date, risk_rating, benchmark_index
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text, Column, String, Float, Date, Enum
from app.database import SQLALCHEMY_DATABASE_URL, engine
from app.models import LiquidityProfile, ReportingFrequency, RiskRating
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_column_exists(engine, table_name, column_name):
    """Check if a column exists in the table"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text(f"PRAGMA table_info({table_name})"))
            columns = [row[1] for row in result.fetchall()]  # row[1] is column name
            return column_name in columns
    except Exception as e:
        logger.error(f"Error checking column {column_name}: {e}")
        return False

def add_columns_to_investments(engine):
    """Add new columns to the investments table"""
    
    columns_to_add = [
        # Basic Information
        ("manager", "TEXT"),
        ("target_raise", "FLOAT"),
        ("geography_focus", "TEXT"),
        
        # Financial Terms
        ("commitment_date", "DATE"),
        ("management_fee", "FLOAT"),
        ("performance_fee", "FLOAT"),
        ("hurdle_rate", "FLOAT"),
        ("distribution_target", "TEXT"),
        ("currency", "TEXT DEFAULT 'USD'"),
        ("liquidity_profile", "TEXT DEFAULT 'Illiquid' NOT NULL"),
        
        # Operational Details
        ("expected_maturity_date", "DATE"),
        ("reporting_frequency", "TEXT"),
        ("contact_person", "TEXT"),
        ("email", "TEXT"),
        ("portal_link", "TEXT"),
        ("fund_administrator", "TEXT"),
        
        # Legal & Risk
        ("fund_domicile", "TEXT"),
        ("tax_classification", "TEXT"),
        ("due_diligence_date", "DATE"),
        ("ic_approval_date", "DATE"),
        ("risk_rating", "TEXT"),
        ("benchmark_index", "TEXT")
    ]
    
    added_columns = []
    skipped_columns = []
    
    with engine.connect() as conn:
        for column_name, column_definition in columns_to_add:
            if check_column_exists(engine, "investments", column_name):
                logger.info(f"Column '{column_name}' already exists, skipping")
                skipped_columns.append(column_name)
                continue
            
            try:
                # SQLite ADD COLUMN syntax
                alter_sql = f"ALTER TABLE investments ADD COLUMN {column_name} {column_definition}"
                logger.info(f"Adding column: {alter_sql}")
                conn.execute(text(alter_sql))
                conn.commit()
                added_columns.append(column_name)
                logger.info(f"✓ Successfully added column '{column_name}'")
            except Exception as e:
                logger.error(f"✗ Failed to add column '{column_name}': {e}")
                raise
    
    return added_columns, skipped_columns

def validate_migration(engine):
    """Validate that the migration was successful"""
    logger.info("Validating migration...")
    
    required_columns = [
        "manager", "target_raise", "geography_focus",
        "commitment_date", "management_fee", "performance_fee", "hurdle_rate",
        "distribution_target", "currency", "liquidity_profile",
        "expected_maturity_date", "reporting_frequency", "contact_person",
        "email", "portal_link", "fund_administrator",
        "fund_domicile", "tax_classification", "due_diligence_date",
        "ic_approval_date", "risk_rating", "benchmark_index"
    ]
    
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(investments)"))
        existing_columns = [row[1] for row in result.fetchall()]
        
        missing_columns = []
        for column in required_columns:
            if column not in existing_columns:
                missing_columns.append(column)
        
        if missing_columns:
            logger.error(f"Migration validation failed! Missing columns: {missing_columns}")
            return False
        else:
            logger.info("✓ Migration validation successful - all required columns present")
            return True

def update_existing_records(engine):
    """Update existing records with sensible defaults where needed"""
    logger.info("Updating existing records with defaults...")
    
    with engine.connect() as conn:
        # Set default currency for existing records if NULL
        conn.execute(text("UPDATE investments SET currency = 'USD' WHERE currency IS NULL"))
        
        # Set default liquidity profile for existing records if NULL
        conn.execute(text("UPDATE investments SET liquidity_profile = 'Illiquid' WHERE liquidity_profile IS NULL"))
        
        conn.commit()
        logger.info("✓ Updated existing records with default values")

def run_migration():
    """Execute the complete migration"""
    logger.info("Starting migration: Extended Investment Fields")
    logger.info(f"Database URL: {SQLALCHEMY_DATABASE_URL}")
    
    try:
        # Check database connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='investments'"))
            if not result.fetchone():
                logger.error("Error: 'investments' table not found. Make sure the database is initialized.")
                return False
        
        # Add new columns
        added_columns, skipped_columns = add_columns_to_investments(engine)
        
        # Update existing records
        if added_columns:
            update_existing_records(engine)
        
        # Validate migration
        if not validate_migration(engine):
            return False
        
        # Migration summary
        logger.info("=" * 60)
        logger.info("MIGRATION COMPLETED SUCCESSFULLY")
        logger.info("=" * 60)
        logger.info(f"Added columns: {len(added_columns)}")
        for col in added_columns:
            logger.info(f"  ✓ {col}")
        
        if skipped_columns:
            logger.info(f"Skipped columns (already exist): {len(skipped_columns)}")
            for col in skipped_columns:
                logger.info(f"  - {col}")
        
        logger.info("")
        logger.info("New investment fields available:")
        logger.info("  • Enhanced financial terms tracking (fees, hurdle rates)")
        logger.info("  • Operational contact and portal management")
        logger.info("  • Legal and risk assessment fields")
        logger.info("  • Geographic and strategy categorization")
        logger.info("")
        logger.info("The frontend modal form is ready to use these new fields!")
        
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = run_migration()
    if not success:
        sys.exit(1)
    else:
        logger.info("Migration completed successfully!")