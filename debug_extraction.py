#!/usr/bin/env python3
"""
Debug the comprehensive PDF extraction to understand why it's returning so few records
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.pdf_parser import PitchBookPDFParser

def debug_extraction():
    """Debug the comprehensive extraction"""
    pdf_path = "/tmp/uploaded_pdf_debug.pdf"

    if not os.path.exists(pdf_path):
        print("❌ Debug PDF not found. Please upload a PDF first.")
        return

    print("🔍 Starting comprehensive extraction debug...")

    parser = PitchBookPDFParser()

    try:
        # Run comprehensive extraction
        results = parser.extract_comprehensive_data_from_pdf(pdf_path, "Q4-2024")

        print(f"\n📊 EXTRACTION RESULTS:")
        print(f"   Performance By Vintage: {len(results.get('performance_by_vintage', []))}")
        print(f"   Multiples By Vintage: {len(results.get('multiples_by_vintage', []))}")
        print(f"   Multiples Quantiles: {len(results.get('multiples_quantiles', []))}")
        print(f"   Quarterly Returns: {len(results.get('quarterly_returns', []))}")

        total = sum([
            len(results.get('performance_by_vintage', [])),
            len(results.get('multiples_by_vintage', [])),
            len(results.get('multiples_quantiles', [])),
            len(results.get('quarterly_returns', []))
        ])

        print(f"   TOTAL: {total}")

        # Show sample records if any exist
        if results.get('performance_by_vintage'):
            print(f"\n🔎 Sample Performance Record:")
            sample = results['performance_by_vintage'][0]
            print(f"   Asset Class: {sample.get('asset_class')}")
            print(f"   Vintage Year: {sample.get('vintage_year')}")
            print(f"   Pooled IRR: {sample.get('pooled_irr')}")
            print(f"   Median IRR: {sample.get('median_irr')}")

        if results.get('multiples_by_vintage'):
            print(f"\n🔎 Sample Multiples Record:")
            sample = results['multiples_by_vintage'][0]
            print(f"   Asset Class: {sample.get('asset_class')}")
            print(f"   Vintage Year: {sample.get('vintage_year')}")
            print(f"   Pooled TVPI: {sample.get('pooled_tvpi')}")

        # Show metadata
        metadata = results.get('metadata', {})
        print(f"\n📋 Metadata:")
        print(f"   Report Period: {metadata.get('report_period')}")
        print(f"   Total Pages: {metadata.get('total_pages')}")

    except Exception as e:
        print(f"❌ Extraction failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_extraction()