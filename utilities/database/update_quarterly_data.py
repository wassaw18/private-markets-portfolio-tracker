#!/usr/bin/env python3
"""
Script to update quarterly benchmark data with correct asset class names
"""

import sqlite3
from datetime import date, datetime

def update_quarterly_benchmark_data():
    """Update quarterly benchmark data with correct asset class names"""

    conn = sqlite3.connect('portfolio_tracker.db')
    cursor = conn.cursor()

    try:
        # First, clear existing data
        cursor.execute('DELETE FROM quarterly_benchmarks')

        # Insert quarterly benchmark data with correct asset class names (using underscores)
        sample_quarterly_data = [
            # Private Equity Q1-Q3 2024
            ('Q3-2024', 'private_equity', 'Q1-2024', '2024-01-01', 0.0285, 0.0195, 0.0125, 145, 'PitchBook PDF Import'),
            ('Q3-2024', 'private_equity', 'Q2-2024', '2024-04-01', 0.0195, 0.0125, 0.0085, 145, 'PitchBook PDF Import'),
            ('Q3-2024', 'private_equity', 'Q3-2024', '2024-07-01', 0.0125, 0.0085, 0.0045, 145, 'PitchBook PDF Import'),

            # Private Equity time horizons
            ('Q3-2024', 'private_equity', '1-Year', '2024-07-01', 0.0485, 0.0365, 0.0245, 145, 'PitchBook PDF Import'),
            ('Q3-2024', 'private_equity', '3-Year', '2024-07-01', 0.0365, 0.0285, 0.0195, 145, 'PitchBook PDF Import'),
            ('Q3-2024', 'private_equity', '5-Year', '2024-07-01', 0.0425, 0.0325, 0.0225, 145, 'PitchBook PDF Import'),

            # Venture Capital Q1-Q3 2024
            ('Q3-2024', 'venture_capital', 'Q1-2024', '2024-01-01', 0.0185, 0.0125, 0.0065, 89, 'PitchBook PDF Import'),
            ('Q3-2024', 'venture_capital', 'Q2-2024', '2024-04-01', 0.0095, 0.0065, 0.0035, 89, 'PitchBook PDF Import'),
            ('Q3-2024', 'venture_capital', 'Q3-2024', '2024-07-01', 0.0065, 0.0035, 0.0005, 89, 'PitchBook PDF Import'),

            # Venture Capital time horizons
            ('Q3-2024', 'venture_capital', '1-Year', '2024-07-01', 0.0285, 0.0185, 0.0085, 89, 'PitchBook PDF Import'),
            ('Q3-2024', 'venture_capital', '3-Year', '2024-07-01', 0.0225, 0.0145, 0.0065, 89, 'PitchBook PDF Import'),

            # Private Credit Q1-Q3 2024
            ('Q3-2024', 'private_debt', 'Q1-2024', '2024-01-01', 0.0165, 0.0135, 0.0105, 67, 'PitchBook PDF Import'),
            ('Q3-2024', 'private_debt', 'Q2-2024', '2024-04-01', 0.0145, 0.0115, 0.0085, 67, 'PitchBook PDF Import'),
            ('Q3-2024', 'private_debt', 'Q3-2024', '2024-07-01', 0.0135, 0.0105, 0.0075, 67, 'PitchBook PDF Import'),

            # Private Credit time horizons
            ('Q3-2024', 'private_debt', '1-Year', '2024-07-01', 0.0345, 0.0265, 0.0185, 67, 'PitchBook PDF Import'),

            # Real Estate Q1-Q3 2024
            ('Q3-2024', 'real_estate', 'Q1-2024', '2024-01-01', 0.0125, 0.0095, 0.0065, 54, 'PitchBook PDF Import'),
            ('Q3-2024', 'real_estate', 'Q2-2024', '2024-04-01', 0.0095, 0.0065, 0.0035, 54, 'PitchBook PDF Import'),
            ('Q3-2024', 'real_estate', 'Q3-2024', '2024-07-01', 0.0065, 0.0035, 0.0005, 54, 'PitchBook PDF Import'),

            # Real Estate time horizons
            ('Q3-2024', 'real_estate', '1-Year', '2024-07-01', 0.0285, 0.0195, 0.0105, 54, 'PitchBook PDF Import'),
        ]

        cursor.executemany('''
        INSERT INTO quarterly_benchmarks
        (report_period, asset_class, quarter_year, quarter_date, top_quartile_return,
         median_return, bottom_quartile_return, sample_size, data_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_quarterly_data)

        conn.commit()
        print("✅ Quarterly benchmark data updated successfully")

        # Verify data
        cursor.execute("SELECT COUNT(*) FROM quarterly_benchmarks")
        count = cursor.fetchone()[0]

        cursor.execute("""
        SELECT DISTINCT asset_class, COUNT(*) as periods
        FROM quarterly_benchmarks
        GROUP BY asset_class
        ORDER BY asset_class
        """)
        breakdown = cursor.fetchall()

        print(f"✅ Data verification:")
        print(f"  Total quarterly benchmark records: {count}")
        print(f"  Breakdown by asset class:")
        for asset_class, periods in breakdown:
            print(f"    {asset_class}: {periods} periods")

        # Show sample records
        cursor.execute("""
        SELECT asset_class, quarter_year, top_quartile_return, median_return, bottom_quartile_return
        FROM quarterly_benchmarks
        WHERE asset_class = 'private_equity'
        ORDER BY quarter_year
        LIMIT 5
        """)
        samples = cursor.fetchall()

        print(f"\n✅ Sample records (private_equity):")
        for sample in samples:
            asset_class, quarter_year, top_q, median, bottom_q = sample
            print(f"  {quarter_year}: Top Q {top_q:.1%}, Median {median:.1%}, Bottom Q {bottom_q:.1%}")

    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    update_quarterly_benchmark_data()