#!/usr/bin/env python3
"""
Backfill missing benchmark returns data (2020-2022) with simulated data.
Returns are between -5% and +5% with 80% probability of being positive.
"""

import os
import sys
import random
from datetime import date, datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import logging

# Add the app directory to the path so we can import models
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.models import MarketBenchmark, BenchmarkReturn

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = "postgresql://portfolio_user:monkeys@localhost:5432/portfolio_tracker_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def generate_monthly_return():
    """Generate a random monthly return between -5% and +5% with 80% positive probability"""
    if random.random() < 0.8:  # 80% chance of positive return
        return random.uniform(0.005, 0.05)  # 0.5% to 5% positive
    else:  # 20% chance of negative return
        return random.uniform(-0.05, -0.005)  # -5% to -0.5% negative

def generate_date_range(start_date: date, end_date: date):
    """Generate list of first-of-month dates between start and end dates"""
    dates = []

    current = date(start_date.year, start_date.month, 1)
    end = date(end_date.year, end_date.month, 1)

    while current <= end:
        dates.append(current)

        # Move to next month
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)

    return dates

def backfill_benchmark_data():
    """Backfill missing benchmark returns for 2020-2022"""
    db = SessionLocal()

    try:
        # Get S&P 500 benchmark (ID=1)
        benchmark = db.query(MarketBenchmark).filter(MarketBenchmark.id == 1).first()
        if not benchmark:
            logger.error("S&P 500 benchmark (ID=1) not found")
            return

        logger.info(f"Backfilling data for benchmark: {benchmark.name}")

        # Generate dates from Jan 2020 to Dec 2022
        start_date = date(2020, 1, 1)
        end_date = date(2022, 12, 1)
        dates = generate_date_range(start_date, end_date)

        # Check existing data to avoid duplicates
        existing_dates = set()
        existing_returns = db.query(BenchmarkReturn).filter(
            BenchmarkReturn.benchmark_id == 1
        ).all()

        for existing in existing_returns:
            existing_dates.add(existing.period_date)

        # Generate and insert new returns
        new_returns = []
        for period_date in dates:
            if period_date not in existing_dates:
                monthly_return = generate_monthly_return()

                new_return = BenchmarkReturn(
                    benchmark_id=1,
                    period_date=period_date,
                    total_return=monthly_return,
                    price_return=monthly_return * 0.9,  # Approximate price return (excluding dividends)
                    dividend_yield=monthly_return * 0.1  # Approximate dividend yield
                )
                new_returns.append(new_return)

                logger.info(f"Generated return for {period_date}: {monthly_return:.4f} ({monthly_return*100:.2f}%)")

        if new_returns:
            db.add_all(new_returns)
            db.commit()
            logger.info(f"Successfully added {len(new_returns)} new benchmark returns")
        else:
            logger.info("No new returns to add - data already exists")

        # Summary of all data
        total_returns = db.query(BenchmarkReturn).filter(
            BenchmarkReturn.benchmark_id == 1
        ).count()
        logger.info(f"Total benchmark returns in database: {total_returns}")

    except Exception as e:
        logger.error(f"Error backfilling benchmark data: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Starting benchmark data backfill...")
    backfill_benchmark_data()
    logger.info("Benchmark data backfill complete!")