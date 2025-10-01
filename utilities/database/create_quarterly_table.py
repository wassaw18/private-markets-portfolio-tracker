#!/usr/bin/env python3
"""
Script to create quarterly_benchmarks table and add sample data
"""

import sqlite3
from datetime import date, datetime

def create_and_populate_quarterly_benchmarks():
    """Create quarterly benchmarks table and populate with sample data"""

    conn = sqlite3.connect('portfolio_tracker.db')
    cursor = conn.cursor()

    try:
        # Create the quarterly_benchmarks table based on the QuarterlyBenchmark model
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS quarterly_benchmarks (
            id INTEGER PRIMARY KEY,
            report_period TEXT NOT NULL,
            asset_class TEXT NOT NULL,
            quarter_year TEXT NOT NULL,
            quarter_date DATE NOT NULL,
            top_quartile_return DECIMAL(10,4),
            median_return DECIMAL(10,4),
            bottom_quartile_return DECIMAL(10,4),
            sample_size INTEGER,
            data_source TEXT DEFAULT 'PitchBook PDF Import',
            methodology_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Create indexes
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS ix_quarterly_unique
        ON quarterly_benchmarks (report_period, asset_class, quarter_year, quarter_date)
        ''')

        print("✅ Quarterly benchmarks table created successfully")

        # Sample quarterly benchmark data
        sample_quarterly_data = [
            # Private Equity Q1-Q3 2024
            ('Q3-2024', 'Private Equity', 'Q1-2024', '2024-01-01', 0.0285, 0.0195, 0.0125, 145, 'PitchBook PDF Import'),
            ('Q3-2024', 'Private Equity', 'Q2-2024', '2024-04-01', 0.0195, 0.0125, 0.0085, 145, 'PitchBook PDF Import'),
            ('Q3-2024', 'Private Equity', 'Q3-2024', '2024-07-01', 0.0125, 0.0085, 0.0045, 145, 'PitchBook PDF Import'),

            # Private Equity time horizons
            ('Q3-2024', 'Private Equity', '1-Year', '2024-07-01', 0.0485, 0.0365, 0.0245, 145, 'PitchBook PDF Import'),
            ('Q3-2024', 'Private Equity', '3-Year', '2024-07-01', 0.0365, 0.0285, 0.0195, 145, 'PitchBook PDF Import'),
            ('Q3-2024', 'Private Equity', '5-Year', '2024-07-01', 0.0425, 0.0325, 0.0225, 145, 'PitchBook PDF Import'),

            # Venture Capital Q1-Q3 2024
            ('Q3-2024', 'Venture Capital', 'Q1-2024', '2024-01-01', 0.0185, 0.0125, 0.0065, 89, 'PitchBook PDF Import'),
            ('Q3-2024', 'Venture Capital', 'Q2-2024', '2024-04-01', 0.0095, 0.0065, 0.0035, 89, 'PitchBook PDF Import'),
            ('Q3-2024', 'Venture Capital', 'Q3-2024', '2024-07-01', 0.0065, 0.0035, 0.0005, 89, 'PitchBook PDF Import'),

            # Venture Capital time horizons
            ('Q3-2024', 'Venture Capital', '1-Year', '2024-07-01', 0.0285, 0.0185, 0.0085, 89, 'PitchBook PDF Import'),
            ('Q3-2024', 'Venture Capital', '3-Year', '2024-07-01', 0.0225, 0.0145, 0.0065, 89, 'PitchBook PDF Import'),

            # Private Credit Q1-Q3 2024
            ('Q3-2024', 'Private Credit', 'Q1-2024', '2024-01-01', 0.0165, 0.0135, 0.0105, 67, 'PitchBook PDF Import'),
            ('Q3-2024', 'Private Credit', 'Q2-2024', '2024-04-01', 0.0145, 0.0115, 0.0085, 67, 'PitchBook PDF Import'),
            ('Q3-2024', 'Private Credit', 'Q3-2024', '2024-07-01', 0.0135, 0.0105, 0.0075, 67, 'PitchBook PDF Import'),

            # Private Credit time horizons
            ('Q3-2024', 'Private Credit', '1-Year', '2024-07-01', 0.0345, 0.0265, 0.0185, 67, 'PitchBook PDF Import'),

            # Real Estate Q1-Q3 2024
            ('Q3-2024', 'Real Estate', 'Q1-2024', '2024-01-01', 0.0125, 0.0095, 0.0065, 54, 'PitchBook PDF Import'),
            ('Q3-2024', 'Real Estate', 'Q2-2024', '2024-04-01', 0.0095, 0.0065, 0.0035, 54, 'PitchBook PDF Import'),
            ('Q3-2024', 'Real Estate', 'Q3-2024', '2024-07-01', 0.0065, 0.0035, 0.0005, 54, 'PitchBook PDF Import'),

            # Real Estate time horizons
            ('Q3-2024', 'Real Estate', '1-Year', '2024-07-01', 0.0285, 0.0195, 0.0105, 54, 'PitchBook PDF Import'),
        ]

        cursor.executemany('''
        INSERT OR REPLACE INTO quarterly_benchmarks
        (report_period, asset_class, quarter_year, quarter_date, top_quartile_return,
         median_return, bottom_quartile_return, sample_size, data_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_quarterly_data)

        conn.commit()
        print("✅ Quarterly benchmark data added successfully")

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

        # Show a few sample records
        cursor.execute("""
        SELECT asset_class, quarter_year, top_quartile_return, median_return, bottom_quartile_return
        FROM quarterly_benchmarks
        WHERE asset_class = 'Private Equity'
        ORDER BY quarter_year
        LIMIT 5
        """)
        samples = cursor.fetchall()

        print(f"\n✅ Sample records (Private Equity):")
        for sample in samples:
            asset_class, quarter_year, top_q, median, bottom_q = sample
            print(f"  {quarter_year}: Top Q {top_q:.1%}, Median {median:.1%}, Bottom Q {bottom_q:.1%}")

    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    create_and_populate_quarterly_benchmarks()