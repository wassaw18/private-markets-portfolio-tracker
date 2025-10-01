#!/usr/bin/env python3
"""
Script to add sample benchmark return data for SPY-TR and VTHR from January 2023 onwards
"""

import random
import sqlite3
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

def generate_monthly_returns(start_date, end_date):
    """Generate random monthly returns between -5% and +5%"""
    returns = []
    current_date = start_date

    while current_date <= end_date:
        # Generate random return between -5% and +5%
        monthly_return = random.uniform(-0.05, 0.05)
        returns.append((current_date, monthly_return))

        # Move to next month
        current_date = current_date + relativedelta(months=1)

    return returns

def add_benchmark_data():
    """Add sample benchmark return data to the database"""

    # Connect to the database
    conn = sqlite3.connect('portfolio_tracker.db')
    cursor = conn.cursor()

    # Define date range: January 2023 to present
    start_date = date(2023, 1, 1)
    end_date = date(2024, 12, 1)  # Through December 2024

    # Benchmark IDs (SPY-TR = 1, VTHR = 3)
    benchmarks = [
        (1, "SPY-TR"),  # S&P 500 Total Return Index
        (3, "VTHR")     # Russell 3000 Total Return
    ]

    for benchmark_id, ticker in benchmarks:
        print(f"Adding sample data for {ticker} (ID: {benchmark_id})")

        # Generate monthly returns
        returns = generate_monthly_returns(start_date, end_date)

        for period_date, total_return in returns:
            # Check if data already exists for this period
            cursor.execute(
                "SELECT id FROM benchmark_returns WHERE benchmark_id = ? AND period_date = ?",
                (benchmark_id, period_date)
            )

            if cursor.fetchone() is None:
                # Insert new return data
                cursor.execute("""
                    INSERT INTO benchmark_returns (
                        benchmark_id,
                        period_date,
                        total_return,
                        price_return,
                        dividend_yield,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    benchmark_id,
                    period_date,
                    total_return,
                    total_return * 0.9,  # Price return slightly lower than total return
                    abs(total_return * 0.1),   # Dividend yield (small positive component)
                    datetime.now(),
                    datetime.now()
                ))

                print(f"  Added {period_date}: {total_return:.4f} ({total_return*100:.2f}%)")
            else:
                print(f"  Skipped {period_date}: data already exists")

    # Commit changes
    conn.commit()
    conn.close()

    print("\nSample benchmark data added successfully!")
    print("Data range: January 2023 - December 2024")
    print("Benchmarks: SPY-TR (ID: 1) and VTHR (ID: 3)")

if __name__ == "__main__":
    # Set random seed for reproducible results
    random.seed(42)
    add_benchmark_data()