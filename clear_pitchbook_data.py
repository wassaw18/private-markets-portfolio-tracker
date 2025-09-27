#!/usr/bin/env python3
"""
Clear all PitchBook benchmark data from the database for fresh testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import (
    PitchBookPerformanceByVintage,
    PitchBookMultiplesByVintage,
    PitchBookMultiplesQuantiles,
    PitchBookQuarterlyReturns
)

def clear_pitchbook_data():
    """Clear all PitchBook benchmark data from the database"""
    print("🗑️  Clearing PitchBook benchmark data...")

    try:
        session = SessionLocal()
        try:
            # Count existing records before deletion
            perf_count = session.query(PitchBookPerformanceByVintage).count()
            mult_count = session.query(PitchBookMultiplesByVintage).count()
            quant_count = session.query(PitchBookMultiplesQuantiles).count()
            quarterly_count = session.query(PitchBookQuarterlyReturns).count()

            total_before = perf_count + mult_count + quant_count + quarterly_count

            print(f"📊 Records before deletion:")
            print(f"   Performance By Vintage: {perf_count}")
            print(f"   Multiples By Vintage: {mult_count}")
            print(f"   Multiples Quantiles: {quant_count}")
            print(f"   Quarterly Returns: {quarterly_count}")
            print(f"   Total: {total_before}")

            if total_before == 0:
                print("✅ No records to delete - database is already clean")
                return

            # Delete all records from each table
            print(f"\n🔄 Deleting records...")

            # Delete in reverse dependency order
            session.query(PitchBookQuarterlyReturns).delete()
            session.query(PitchBookMultiplesQuantiles).delete()
            session.query(PitchBookMultiplesByVintage).delete()
            session.query(PitchBookPerformanceByVintage).delete()

            # Commit the deletions
            session.commit()

            # Verify deletion
            perf_after = session.query(PitchBookPerformanceByVintage).count()
            mult_after = session.query(PitchBookMultiplesByVintage).count()
            quant_after = session.query(PitchBookMultiplesQuantiles).count()
            quarterly_after = session.query(PitchBookQuarterlyReturns).count()

            total_after = perf_after + mult_after + quant_after + quarterly_after

            print(f"✅ Deletion complete!")
            print(f"📊 Records after deletion:")
            print(f"   Performance By Vintage: {perf_after}")
            print(f"   Multiples By Vintage: {mult_after}")
            print(f"   Multiples Quantiles: {quant_after}")
            print(f"   Quarterly Returns: {quarterly_after}")
            print(f"   Total: {total_after}")

            print(f"\n🎯 Successfully deleted {total_before} records")
            print(f"🧪 Database is now clean and ready for fresh testing!")

        finally:
            session.close()

    except Exception as e:
        print(f"❌ Error clearing data: {str(e)}")
        raise

if __name__ == "__main__":
    clear_pitchbook_data()