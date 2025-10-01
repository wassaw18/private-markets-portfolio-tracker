#!/usr/bin/env python3
"""
Script to create PitchBook tables and add sample reference data
"""

import sqlite3
from datetime import date

def create_pitchbook_tables():
    """Create PitchBook tables and add sample data"""

    conn = sqlite3.connect('portfolio_tracker.db')
    cursor = conn.cursor()

    try:
        # Create PitchBook performance by vintage table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS pitchbook_performance_by_vintage (
            id INTEGER PRIMARY KEY,
            asset_class TEXT NOT NULL,
            vintage_year INTEGER NOT NULL,
            pooled_irr DECIMAL(10,4),
            equal_weighted_pooled_irr DECIMAL(10,4),
            top_decile DECIMAL(10,4),
            top_quartile DECIMAL(10,4),
            median_irr DECIMAL(10,4),
            bottom_quartile DECIMAL(10,4),
            bottom_decile DECIMAL(10,4),
            standard_deviation DECIMAL(10,4),
            number_of_funds INTEGER,
            import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            quarter_end_date DATE,
            UNIQUE(asset_class, vintage_year, quarter_end_date)
        )
        ''')

        # Create PitchBook multiples by vintage table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS pitchbook_multiples_by_vintage (
            id INTEGER PRIMARY KEY,
            asset_class TEXT NOT NULL,
            vintage_year INTEGER NOT NULL,
            pooled_tvpi DECIMAL(10,4),
            pooled_dpi DECIMAL(10,4),
            pooled_rvpi DECIMAL(10,4),
            equal_weighted_tvpi DECIMAL(10,4),
            equal_weighted_dpi DECIMAL(10,4),
            equal_weighted_rvpi DECIMAL(10,4),
            number_of_funds INTEGER,
            import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            quarter_end_date DATE,
            UNIQUE(asset_class, vintage_year, quarter_end_date)
        )
        ''')

        # Create PitchBook multiples quantiles table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS pitchbook_multiples_quantiles (
            id INTEGER PRIMARY KEY,
            asset_class TEXT NOT NULL,
            vintage_year INTEGER NOT NULL,
            tvpi_top_decile DECIMAL(10,4),
            tvpi_top_quartile DECIMAL(10,4),
            tvpi_median DECIMAL(10,4),
            tvpi_bottom_quartile DECIMAL(10,4),
            tvpi_bottom_decile DECIMAL(10,4),
            dpi_top_decile DECIMAL(10,4),
            dpi_top_quartile DECIMAL(10,4),
            dpi_median DECIMAL(10,4),
            dpi_bottom_quartile DECIMAL(10,4),
            dpi_bottom_decile DECIMAL(10,4),
            number_of_funds INTEGER,
            import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            quarter_end_date DATE,
            UNIQUE(asset_class, vintage_year, quarter_end_date)
        )
        ''')

        # Create PitchBook quarterly returns table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS pitchbook_quarterly_returns (
            id INTEGER PRIMARY KEY,
            asset_class TEXT NOT NULL,
            time_period TEXT NOT NULL,
            return_value DECIMAL(10,4) NOT NULL,
            import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            quarter_end_date DATE,
            UNIQUE(asset_class, time_period, quarter_end_date)
        )
        ''')

        print("✅ PitchBook tables created successfully")

        # Add sample data for performance by vintage (IRRs)
        sample_performance_data = [
            # Private Equity
            ('Private Equity', 2015, 0.1250, 0.1180, 0.2350, 0.1650, 0.1250, 0.0850, 0.0450, 0.0680, 145, '2024-12-31'),
            ('Private Equity', 2016, 0.1420, 0.1380, 0.2480, 0.1780, 0.1420, 0.1020, 0.0620, 0.0720, 158, '2024-12-31'),
            ('Private Equity', 2017, 0.1340, 0.1290, 0.2280, 0.1650, 0.1340, 0.0980, 0.0580, 0.0690, 172, '2024-12-31'),
            ('Private Equity', 2018, 0.1190, 0.1150, 0.2150, 0.1520, 0.1190, 0.0890, 0.0490, 0.0650, 168, '2024-12-31'),
            ('Private Equity', 2019, 0.1080, 0.1020, 0.1890, 0.1380, 0.1080, 0.0780, 0.0420, 0.0590, 145, '2024-12-31'),
            ('Private Equity', 2020, 0.0920, 0.0890, 0.1650, 0.1180, 0.0920, 0.0650, 0.0280, 0.0520, 132, '2024-12-31'),

            # Venture Capital
            ('Venture Capital', 2015, 0.1850, 0.1720, 0.3650, 0.2280, 0.1850, 0.1420, 0.0850, 0.1120, 89, '2024-12-31'),
            ('Venture Capital', 2016, 0.1680, 0.1590, 0.3280, 0.2050, 0.1680, 0.1280, 0.0720, 0.1050, 96, '2024-12-31'),
            ('Venture Capital', 2017, 0.1520, 0.1450, 0.2950, 0.1890, 0.1520, 0.1150, 0.0680, 0.0980, 108, '2024-12-31'),
            ('Venture Capital', 2018, 0.1380, 0.1320, 0.2650, 0.1720, 0.1380, 0.1020, 0.0590, 0.0890, 112, '2024-12-31'),
            ('Venture Capital', 2019, 0.1250, 0.1180, 0.2380, 0.1580, 0.1250, 0.0920, 0.0520, 0.0820, 98, '2024-12-31'),

            # Private Credit
            ('Private Credit', 2015, 0.0980, 0.0920, 0.1450, 0.1180, 0.0980, 0.0780, 0.0580, 0.0380, 67, '2024-12-31'),
            ('Private Credit', 2016, 0.1020, 0.0980, 0.1520, 0.1220, 0.1020, 0.0820, 0.0620, 0.0420, 73, '2024-12-31'),
            ('Private Credit', 2017, 0.0950, 0.0920, 0.1380, 0.1150, 0.0950, 0.0750, 0.0550, 0.0390, 78, '2024-12-31'),
            ('Private Credit', 2018, 0.0890, 0.0850, 0.1320, 0.1080, 0.0890, 0.0690, 0.0490, 0.0350, 81, '2024-12-31'),

            # Real Estate
            ('Real Estate', 2015, 0.0850, 0.0820, 0.1380, 0.1050, 0.0850, 0.0650, 0.0450, 0.0320, 54, '2024-12-31'),
            ('Real Estate', 2016, 0.0920, 0.0890, 0.1450, 0.1120, 0.0920, 0.0720, 0.0520, 0.0350, 59, '2024-12-31'),
            ('Real Estate', 2017, 0.0780, 0.0750, 0.1250, 0.0980, 0.0780, 0.0580, 0.0380, 0.0290, 62, '2024-12-31'),
        ]

        cursor.executemany('''
        INSERT OR REPLACE INTO pitchbook_performance_by_vintage
        (asset_class, vintage_year, pooled_irr, equal_weighted_pooled_irr, top_decile,
         top_quartile, median_irr, bottom_quartile, bottom_decile, standard_deviation,
         number_of_funds, quarter_end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_performance_data)

        # Add sample multiples data (TVPI/DPI)
        sample_multiples_data = [
            # Private Equity - pooled and equal weighted multiples
            ('Private Equity', 2015, 2.45, 1.85, 0.60, 2.38, 1.79, 0.59, 145, '2024-12-31'),
            ('Private Equity', 2016, 2.28, 1.62, 0.66, 2.21, 1.58, 0.63, 158, '2024-12-31'),
            ('Private Equity', 2017, 2.12, 1.38, 0.74, 2.05, 1.35, 0.70, 172, '2024-12-31'),
            ('Private Equity', 2018, 1.95, 1.15, 0.80, 1.88, 1.12, 0.76, 168, '2024-12-31'),
            ('Private Equity', 2019, 1.78, 0.92, 0.86, 1.71, 0.89, 0.82, 145, '2024-12-31'),
            ('Private Equity', 2020, 1.62, 0.68, 0.94, 1.56, 0.65, 0.91, 132, '2024-12-31'),

            # Venture Capital
            ('Venture Capital', 2015, 3.85, 2.95, 0.90, 3.72, 2.88, 0.84, 89, '2024-12-31'),
            ('Venture Capital', 2016, 3.45, 2.58, 0.87, 3.32, 2.51, 0.81, 96, '2024-12-31'),
            ('Venture Capital', 2017, 3.12, 2.18, 0.94, 2.98, 2.12, 0.86, 108, '2024-12-31'),
            ('Venture Capital', 2018, 2.78, 1.85, 0.93, 2.65, 1.79, 0.86, 112, '2024-12-31'),

            # Private Credit
            ('Private Credit', 2015, 1.45, 1.38, 0.07, 1.42, 1.35, 0.07, 67, '2024-12-31'),
            ('Private Credit', 2016, 1.38, 1.32, 0.06, 1.35, 1.29, 0.06, 73, '2024-12-31'),
            ('Private Credit', 2017, 1.32, 1.26, 0.06, 1.29, 1.23, 0.06, 78, '2024-12-31'),
        ]

        cursor.executemany('''
        INSERT OR REPLACE INTO pitchbook_multiples_by_vintage
        (asset_class, vintage_year, pooled_tvpi, pooled_dpi, pooled_rvpi,
         equal_weighted_tvpi, equal_weighted_dpi, equal_weighted_rvpi,
         number_of_funds, quarter_end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_multiples_data)

        # Add sample quantiles data
        sample_quantiles_data = [
            # Private Equity 2015 - TVPI and DPI quartiles/deciles
            ('Private Equity', 2015, 4.85, 3.25, 2.45, 1.85, 1.25, 3.85, 2.65, 1.85, 1.25, 0.85, 145, '2024-12-31'),
            ('Private Equity', 2016, 4.25, 2.98, 2.28, 1.72, 1.18, 3.45, 2.38, 1.62, 1.12, 0.78, 158, '2024-12-31'),
            ('Private Equity', 2017, 3.85, 2.75, 2.12, 1.58, 1.12, 3.12, 2.18, 1.38, 0.98, 0.72, 172, '2024-12-31'),

            # Venture Capital
            ('Venture Capital', 2015, 8.95, 5.85, 3.85, 2.45, 1.45, 7.25, 4.85, 2.95, 1.85, 1.15, 89, '2024-12-31'),
            ('Venture Capital', 2016, 7.85, 5.25, 3.45, 2.18, 1.28, 6.45, 4.25, 2.58, 1.65, 1.05, 96, '2024-12-31'),
        ]

        cursor.executemany('''
        INSERT OR REPLACE INTO pitchbook_multiples_quantiles
        (asset_class, vintage_year, tvpi_top_decile, tvpi_top_quartile, tvpi_median,
         tvpi_bottom_quartile, tvpi_bottom_decile, dpi_top_decile, dpi_top_quartile,
         dpi_median, dpi_bottom_quartile, dpi_bottom_decile, number_of_funds, quarter_end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_quantiles_data)

        # Add sample quarterly returns
        sample_quarterly_data = [
            ('Private Equity', 'Q1 2024', 0.0285, '2024-03-31'),
            ('Private Equity', 'Q2 2024', 0.0195, '2024-06-30'),
            ('Private Equity', 'Q3 2024', 0.0125, '2024-09-30'),
            ('Private Equity', '1-Year', 0.0485, '2024-12-31'),
            ('Private Equity', '3-Year', 0.0365, '2024-12-31'),
            ('Private Equity', '5-Year', 0.0425, '2024-12-31'),

            ('Venture Capital', 'Q1 2024', 0.0185, '2024-03-31'),
            ('Venture Capital', 'Q2 2024', 0.0095, '2024-06-30'),
            ('Venture Capital', 'Q3 2024', 0.0065, '2024-09-30'),
            ('Venture Capital', '1-Year', 0.0285, '2024-12-31'),
            ('Venture Capital', '3-Year', 0.0225, '2024-12-31'),

            ('Private Credit', 'Q1 2024', 0.0165, '2024-03-31'),
            ('Private Credit', 'Q2 2024', 0.0145, '2024-06-30'),
            ('Private Credit', 'Q3 2024', 0.0135, '2024-09-30'),
            ('Private Credit', '1-Year', 0.0345, '2024-12-31'),
        ]

        cursor.executemany('''
        INSERT OR REPLACE INTO pitchbook_quarterly_returns
        (asset_class, time_period, return_value, quarter_end_date)
        VALUES (?, ?, ?, ?)
        ''', sample_quarterly_data)

        conn.commit()
        print("✅ Sample PitchBook data added successfully")

        # Verify data
        cursor.execute("SELECT COUNT(*) FROM pitchbook_performance_by_vintage")
        perf_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM pitchbook_multiples_by_vintage")
        mult_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM pitchbook_multiples_quantiles")
        quant_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM pitchbook_quarterly_returns")
        qtrly_count = cursor.fetchone()[0]

        print(f"✅ Data verification:")
        print(f"  Performance by vintage: {perf_count} records")
        print(f"  Multiples by vintage: {mult_count} records")
        print(f"  Multiples quantiles: {quant_count} records")
        print(f"  Quarterly returns: {qtrly_count} records")

    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    create_pitchbook_tables()