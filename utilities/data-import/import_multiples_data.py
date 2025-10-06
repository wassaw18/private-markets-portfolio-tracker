#!/usr/bin/env python3
"""
Import PitchBook Multiples data from JSON file to database
"""

import json
import sys
import os
from datetime import datetime
import re

# Add the project root to Python path
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.database import SessionLocal
from app.models import PitchBookMultiplesByVintage, PitchBookMultiplesQuantiles
from sqlalchemy import text

def parse_multiple(value_str):
    """Convert multiple string to float (e.g., '1.79x' -> 1.79)"""
    if not value_str or value_str == '' or value_str == '-':
        return None

    # Remove 'x' suffix and convert to float
    if isinstance(value_str, str) and value_str.endswith('x'):
        try:
            return float(value_str[:-1])
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

def import_multiples_data():
    """Import the extracted multiples JSON data to database"""

    # Map pages to asset classes and table types
    multiples_pages = {
        # Format: (table_type, asset_class)
        15: ('multiples_by_vintage', 'private_equity'),
        16: ('multiples_quantiles', 'private_equity'),
        22: ('multiples_by_vintage', 'venture_capital'),
        23: ('multiples_quantiles', 'venture_capital'),
        29: ('multiples_by_vintage', 'real_estate'),
        30: ('multiples_quantiles', 'real_estate'),
        36: ('multiples_by_vintage', 'real_assets'),
        37: ('multiples_quantiles', 'real_assets'),
        43: ('multiples_by_vintage', 'private_debt'),
        44: ('multiples_quantiles', 'private_debt'),
        50: ('multiples_by_vintage', 'funds_of_funds'),
        51: ('multiples_quantiles', 'funds_of_funds'),
        57: ('multiples_by_vintage', 'secondaries'),
        58: ('multiples_quantiles', 'secondaries')
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
        # Clear existing multiples data
        print("🧹 Clearing existing multiples data...")
        db.execute(text('DELETE FROM pitchbook_multiples_by_vintage'))
        db.execute(text('DELETE FROM pitchbook_multiples_quantiles'))
        db.commit()

        total_multiples_records = 0
        total_quantiles_records = 0
        total_data_points = 0

        print("📊 Importing Multiples data from JSON...")
        print("=" * 60)

        # Process multiples pages
        for item in data:
            page_num = item.get('pageNumber')

            if page_num not in multiples_pages:
                continue

            table_type, asset_class = multiples_pages[page_num]
            table_data = item.get('data', [])

            print(f"📄 Processing Page {page_num} - {asset_class.upper()} ({table_type})")

            if len(table_data) < 3:
                print(f"  ⚠️ Insufficient data rows, skipping...")
                continue

            page_records = 0

            # Handle different starting rows for real_assets (starts directly with data)
            start_row = 2 if page_num != 36 else 0  # Page 36 (real_assets multiples) starts with data

            # Process data rows
            for row_idx, row in enumerate(table_data[start_row:], start=start_row):
                if not row or len(row) == 0:
                    continue

                # Check if this is a vintage year row (first column should be a year)
                vintage_year_str = str(row[0]).strip()
                if not vintage_year_str.isdigit() or len(vintage_year_str) != 4:
                    continue

                vintage_year = int(vintage_year_str)

                if table_type == 'multiples_by_vintage':
                    # Process Multiples by Vintage
                    record = PitchBookMultiplesByVintage(
                        asset_class=asset_class,
                        vintage_year=vintage_year,
                        import_date=datetime.now()
                    )

                    data_points_added = 0

                    # Expected structure: [Vintage year, TVPI, DPI, RVPI, TVPI, DPI, RVPI, Number of funds]
                    #                     [0,           1,    2,   3,    4,    5,   6,    7]
                    #                     Pooled ------>        Equal-weighted ---->

                    if len(row) > 1:
                        record.pooled_tvpi = parse_multiple(row[1])
                        if record.pooled_tvpi is not None:
                            data_points_added += 1

                    if len(row) > 2:
                        record.pooled_dpi = parse_multiple(row[2])
                        if record.pooled_dpi is not None:
                            data_points_added += 1

                    if len(row) > 3:
                        record.pooled_rvpi = parse_multiple(row[3])
                        if record.pooled_rvpi is not None:
                            data_points_added += 1

                    if len(row) > 4:
                        record.equal_weighted_tvpi = parse_multiple(row[4])
                        if record.equal_weighted_tvpi is not None:
                            data_points_added += 1

                    if len(row) > 5:
                        record.equal_weighted_dpi = parse_multiple(row[5])
                        if record.equal_weighted_dpi is not None:
                            data_points_added += 1

                    if len(row) > 6:
                        record.equal_weighted_rvpi = parse_multiple(row[6])
                        if record.equal_weighted_rvpi is not None:
                            data_points_added += 1

                    if len(row) > 7:
                        record.number_of_funds = parse_integer(row[7])
                        if record.number_of_funds is not None:
                            data_points_added += 1

                    db.add(record)
                    total_multiples_records += 1
                    total_data_points += data_points_added

                elif table_type == 'multiples_quantiles':
                    # Process Multiples Quantiles
                    record = PitchBookMultiplesQuantiles(
                        asset_class=asset_class,
                        vintage_year=vintage_year,
                        import_date=datetime.now()
                    )

                    data_points_added = 0

                    # Expected structure: [Vintage year, Top decile, Top quartile, Median TVPI, Bottom quartile, Bottom decile,
                    #                     Top decile, Top quartile, Median DPI, Bottom quartile, Bottom decile, Number of funds]
                    #                     [0,           1,          2,           3,            4,              5,
                    #                     6,          7,           8,          9,              10,             11]
                    #                     TVPI quartiles ------->                              DPI quartiles ----->

                    # TVPI quartiles
                    if len(row) > 1:
                        record.tvpi_top_decile = parse_multiple(row[1])
                        if record.tvpi_top_decile is not None:
                            data_points_added += 1

                    if len(row) > 2:
                        record.tvpi_top_quartile = parse_multiple(row[2])
                        if record.tvpi_top_quartile is not None:
                            data_points_added += 1

                    if len(row) > 3:
                        record.tvpi_median = parse_multiple(row[3])
                        if record.tvpi_median is not None:
                            data_points_added += 1

                    if len(row) > 4:
                        record.tvpi_bottom_quartile = parse_multiple(row[4])
                        if record.tvpi_bottom_quartile is not None:
                            data_points_added += 1

                    if len(row) > 5:
                        record.tvpi_bottom_decile = parse_multiple(row[5])
                        if record.tvpi_bottom_decile is not None:
                            data_points_added += 1

                    # DPI quartiles
                    if len(row) > 6:
                        record.dpi_top_decile = parse_multiple(row[6])
                        if record.dpi_top_decile is not None:
                            data_points_added += 1

                    if len(row) > 7:
                        record.dpi_top_quartile = parse_multiple(row[7])
                        if record.dpi_top_quartile is not None:
                            data_points_added += 1

                    if len(row) > 8:
                        record.dpi_median = parse_multiple(row[8])
                        if record.dpi_median is not None:
                            data_points_added += 1

                    if len(row) > 9:
                        record.dpi_bottom_quartile = parse_multiple(row[9])
                        if record.dpi_bottom_quartile is not None:
                            data_points_added += 1

                    if len(row) > 10:
                        record.dpi_bottom_decile = parse_multiple(row[10])
                        if record.dpi_bottom_decile is not None:
                            data_points_added += 1

                    if len(row) > 11:
                        record.number_of_funds = parse_integer(row[11])
                        if record.number_of_funds is not None:
                            data_points_added += 1

                    db.add(record)
                    total_quantiles_records += 1
                    total_data_points += data_points_added

                page_records += 1

            print(f"  ✅ Imported {page_records} records")

        # Commit all changes
        db.commit()

        print("=" * 60)
        print(f"🎉 MULTIPLES IMPORT COMPLETED SUCCESSFULLY!")
        print(f"📊 Multiples by Vintage Records: {total_multiples_records}")
        print(f"📊 Multiples Quantiles Records: {total_quantiles_records}")
        print(f"📊 Total Multiples Records: {total_multiples_records + total_quantiles_records}")
        print(f"📈 Total Data Points: {total_data_points}")

        # Verify asset class distribution
        print("\n🏢 Asset Class Distribution:")
        from sqlalchemy import func

        print("Multiples by Vintage:")
        multiples_distribution = db.query(
            PitchBookMultiplesByVintage.asset_class,
            func.count(PitchBookMultiplesByVintage.id).label('count')
        ).group_by(PitchBookMultiplesByVintage.asset_class).all()

        for asset_class, count in multiples_distribution:
            print(f"  ✅ {asset_class}: {count} records")

        print("Multiples Quantiles:")
        quantiles_distribution = db.query(
            PitchBookMultiplesQuantiles.asset_class,
            func.count(PitchBookMultiplesQuantiles.id).label('count')
        ).group_by(PitchBookMultiplesQuantiles.asset_class).all()

        for asset_class, count in quantiles_distribution:
            print(f"  ✅ {asset_class}: {count} records")

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
    print("🚀 Starting Multiples data import...")
    success = import_multiples_data()
    if success:
        print("✅ Multiples import completed successfully!")
    else:
        print("❌ Multiples import failed!")
        sys.exit(1)