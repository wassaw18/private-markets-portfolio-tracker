#!/usr/bin/env python3
"""
Import PitchBook IRR data from JSON file to database
"""

import json
import sys
import os
from datetime import datetime
import re

# Add the project root to Python path
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.database import SessionLocal
from app.models import PitchBookPerformanceByVintage
from sqlalchemy import text

def parse_percentage(value_str):
    """Convert percentage string to float (e.g., '14.98%' -> 0.1498)"""
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

def parse_integer(value_str):
    """Convert string to integer"""
    if not value_str or value_str == '' or value_str == '-':
        return None

    try:
        # Remove any commas from numbers
        if isinstance(value_str, str):
            value_str = value_str.replace(',', '')
        return int(float(value_str))
    except (ValueError, TypeError):
        return None

def import_json_data():
    """Import the extracted JSON data to database"""

    # Map pages to asset classes
    page_to_asset_class = {
        12: 'private_equity',
        19: 'venture_capital',
        26: 'real_estate',
        33: 'real_assets',
        40: 'private_debt',
        47: 'funds_of_funds',
        54: 'secondaries'
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
        # Clear existing performance data
        print("🧹 Clearing existing performance data...")
        db.execute(text('DELETE FROM pitchbook_performance_by_vintage'))
        db.commit()

        total_records = 0
        total_data_points = 0

        print("📊 Importing IRR data from JSON...")
        print("=" * 60)

        # Process target pages
        for item in data:
            page_num = item.get('pageNumber')

            if page_num not in page_to_asset_class:
                continue

            asset_class = page_to_asset_class[page_num]
            table_data = item.get('data', [])

            print(f"📄 Processing Page {page_num} - {asset_class.upper()}")

            if len(table_data) < 3:
                print(f"  ⚠️ Insufficient data rows, skipping...")
                continue

            # Get headers from row 1 (0-indexed)
            headers = table_data[1] if len(table_data) > 1 else []
            page_records = 0

            # Process data rows (skip first 2 header rows)
            for row_idx, row in enumerate(table_data[2:], start=2):
                if not row or len(row) == 0:
                    continue

                # Check if this is a vintage year row (first column should be a year)
                vintage_year_str = str(row[0]).strip()
                if not vintage_year_str.isdigit() or len(vintage_year_str) != 4:
                    continue

                vintage_year = int(vintage_year_str)

                # Create new record
                record = PitchBookPerformanceByVintage(
                    asset_class=asset_class,
                    vintage_year=vintage_year,
                    import_date=datetime.now()
                )

                # Map columns based on expected order
                # Expected: ['Vintage year', 'Pooled IRR', 'Equal-weighted pooled IRR', 'Number of funds',
                #           'Top decile', 'Top quartile', 'Median IRR', 'Bottom quartile', 'Bottom decile',
                #           'Standard deviation', 'Number of funds']

                data_points_added = 0

                if len(row) > 1:
                    record.pooled_irr = parse_percentage(row[1])
                    if record.pooled_irr is not None:
                        data_points_added += 1

                if len(row) > 2:
                    record.equal_weighted_pooled_irr = parse_percentage(row[2])
                    if record.equal_weighted_pooled_irr is not None:
                        data_points_added += 1

                # Skip Number of funds at index 3, go to quartiles
                if len(row) > 4:
                    record.top_decile = parse_percentage(row[4])
                    if record.top_decile is not None:
                        data_points_added += 1

                if len(row) > 5:
                    record.top_quartile = parse_percentage(row[5])
                    if record.top_quartile is not None:
                        data_points_added += 1

                if len(row) > 6:
                    record.median_irr = parse_percentage(row[6])
                    if record.median_irr is not None:
                        data_points_added += 1

                if len(row) > 7:
                    record.bottom_quartile = parse_percentage(row[7])
                    if record.bottom_quartile is not None:
                        data_points_added += 1

                if len(row) > 8:
                    record.bottom_decile = parse_percentage(row[8])
                    if record.bottom_decile is not None:
                        data_points_added += 1

                if len(row) > 9:
                    record.standard_deviation = parse_percentage(row[9])
                    if record.standard_deviation is not None:
                        data_points_added += 1

                # Number of funds might be at index 3 or 10
                number_of_funds = None
                if len(row) > 3:
                    number_of_funds = parse_integer(row[3])
                if number_of_funds is None and len(row) > 10:
                    number_of_funds = parse_integer(row[10])

                record.number_of_funds = number_of_funds
                if record.number_of_funds is not None:
                    data_points_added += 1

                # Add to database
                db.add(record)
                page_records += 1
                total_data_points += data_points_added

            print(f"  ✅ Imported {page_records} records")
            total_records += page_records

        # Commit all changes
        db.commit()

        print("=" * 60)
        print(f"🎉 IMPORT COMPLETED SUCCESSFULLY!")
        print(f"📊 Total Records: {total_records}")
        print(f"📈 Total Data Points: {total_data_points}")
        print(f"🎯 Target: ~1,344 IRR data points")
        print(f"✅ Coverage: {(total_data_points/1344)*100:.1f}%")

        # Verify asset class distribution
        print("\n🏢 Asset Class Distribution:")
        from sqlalchemy import func

        asset_distribution = db.query(
            PitchBookPerformanceByVintage.asset_class,
            func.count(PitchBookPerformanceByVintage.id).label('count')
        ).group_by(PitchBookPerformanceByVintage.asset_class).all()

        for asset_class, count in asset_distribution:
            print(f"  ✅ {asset_class}: {count} records")

        return True

    except Exception as e:
        print(f"❌ Error during import: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting JSON data import...")
    success = import_json_data()
    if success:
        print("✅ Import completed successfully!")
    else:
        print("❌ Import failed!")
        sys.exit(1)