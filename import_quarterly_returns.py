#!/usr/bin/env python3
"""
Import PitchBook Quarterly Returns data from JSON file to database
"""

import json
import sys
import os
from datetime import datetime, date
import re

# Add the project root to Python path
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.database import SessionLocal
from app.models import PitchBookQuarterlyReturns
from sqlalchemy import text

def parse_percentage(value_str):
    """Convert percentage string to float (e.g., '2.93%' -> 0.0293)"""
    if not value_str or value_str == '' or value_str == '-':
        return None

    # Remove % sign and convert to float
    if isinstance(value_str, str) and value_str.endswith('%'):
        try:
            return float(value_str[:-1]) / 100.0
        except ValueError:
            return None

    # Try to convert directly if it's already a number
    try:
        return float(value_str)
    except (ValueError, TypeError):
        return None

def parse_quarter_date(quarter_str):
    """Convert quarter string to date (e.g., 'Q2 2001' -> 2001-06-30)"""
    if not quarter_str:
        return None

    try:
        # Parse format like "Q2 2001"
        parts = quarter_str.strip().split()
        if len(parts) != 2:
            return None

        quarter = parts[0]
        year = int(parts[1])

        # Map quarter to end-of-quarter month and day
        quarter_end_dates = {
            'Q1': (3, 31),   # March 31
            'Q2': (6, 30),   # June 30
            'Q3': (9, 30),   # September 30
            'Q4': (12, 31)   # December 31
        }

        if quarter in quarter_end_dates:
            month, day = quarter_end_dates[quarter]
            return date(year, month, day)

    except (ValueError, IndexError):
        pass

    return None

def import_quarterly_returns_data():
    """Import the extracted quarterly returns JSON data to database"""

    # Map pages to asset classes for quarterly returns
    quarterly_pages = {
        17: 'private_equity',
        24: 'venture_capital',
        31: 'real_estate',
        38: 'real_assets',
        45: 'private_debt',
        52: 'funds_of_funds',
        59: 'secondaries'
    }

    # Load JSON data
    json_file = '/tmp/Pitchbook_extracted_tables.json'
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ JSON file not found: {json_file}")
        return False

    # Initialize database
    db = SessionLocal()

    try:
        # Clear existing quarterly returns data
        print("🧹 Clearing existing quarterly returns data...")
        db.execute(text('DELETE FROM pitchbook_quarterly_returns'))
        db.commit()

        total_records = 0
        total_data_points = 0
        all_quarters = {}  # To collect all unique quarters across all asset classes

        print("📊 Extracting Quarterly Returns data from JSON...")
        print("=" * 60)

        # First pass: Extract all quarterly data from all asset classes
        quarterly_data = {}

        for item in data:
            page_num = item.get('pageNumber')

            if page_num not in quarterly_pages:
                continue

            asset_class = quarterly_pages[page_num]
            table_data = item.get('data', [])

            print(f"📄 Processing Page {page_num} - {asset_class.upper()}")

            if len(table_data) < 2:
                print(f"  ⚠️ Insufficient data rows, skipping...")
                continue

            quarterly_data[asset_class] = {}

            # Skip header row (row 0), process data rows starting from row 1
            for row in table_data[1:]:
                if not row or len(row) == 0:
                    continue

                # Each row has multiple quarter/return pairs
                # Format: [Quarter end, 1-quarter return, Quarter end, 1-quarter return, ...]
                for i in range(0, len(row) - 1, 2):  # Step by 2 to get pairs
                    if i + 1 < len(row):
                        quarter_str = row[i]
                        return_str = row[i + 1]

                        if quarter_str and return_str:
                            quarter_date = parse_quarter_date(quarter_str)
                            return_value = parse_percentage(return_str)

                            if quarter_date and return_value is not None:
                                quarterly_data[asset_class][quarter_date] = return_value
                                all_quarters[quarter_date] = True

            print(f"  ✅ Extracted {len(quarterly_data[asset_class])} quarterly returns")

        # Second pass: Create database records for each quarter and asset class
        print()
        print("💾 Importing to database...")
        print("=" * 40)

        for quarter_date in sorted(all_quarters.keys()):
            for asset_class in quarterly_pages.values():
                if asset_class in quarterly_data and quarter_date in quarterly_data[asset_class]:
                    return_value = quarterly_data[asset_class][quarter_date]

                    # Create database record
                    quarter_number = (quarter_date.month - 1) // 3 + 1
                    time_period = f"{quarter_date.year}-Q{quarter_number}"

                    record = PitchBookQuarterlyReturns(
                        asset_class=asset_class,
                        time_period=time_period,
                        return_value=return_value,
                        quarter_end_date=quarter_date,
                        import_date=datetime.now()
                    )

                    db.add(record)
                    total_records += 1
                    total_data_points += 1

        # Commit all changes
        db.commit()

        print("=" * 60)
        print(f"🎉 QUARTERLY RETURNS IMPORT COMPLETED!")
        print(f"📊 Total Records: {total_records}")
        print(f"📈 Total Data Points: {total_data_points}")
        print(f"📅 Date Range: {min(all_quarters.keys())} to {max(all_quarters.keys())}")

        # Verify asset class distribution
        print("\n🏢 Asset Class Distribution:")
        from sqlalchemy import func

        quarterly_distribution = db.query(
            PitchBookQuarterlyReturns.asset_class,
            func.count(PitchBookQuarterlyReturns.id).label('count'),
            func.min(PitchBookQuarterlyReturns.quarter_end_date).label('start_date'),
            func.max(PitchBookQuarterlyReturns.quarter_end_date).label('end_date')
        ).group_by(PitchBookQuarterlyReturns.asset_class).all()

        for asset_class, count, start_date, end_date in quarterly_distribution:
            print(f"  ✅ {asset_class}: {count} quarters ({start_date} to {end_date})")

        # Sample data quality check
        print("\n🔍 Sample Quarterly Returns:")
        sample_records = db.query(PitchBookQuarterlyReturns).limit(5).all()

        for record in sample_records:
            print(f"  {record.asset_class} {record.time_period}: {record.return_value:.2%}")

        return True

    except Exception as e:
        print(f"❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting Quarterly Returns data import...")
    success = import_quarterly_returns_data()
    if success:
        print("✅ Quarterly Returns import completed successfully!")
    else:
        print("❌ Quarterly Returns import failed!")
        sys.exit(1)