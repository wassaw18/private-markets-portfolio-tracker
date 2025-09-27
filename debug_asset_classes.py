#!/usr/bin/env python3
"""
Debug asset class detection to understand why we're only getting private_equity
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

def debug_asset_classes():
    """Debug asset class detection across the PDF"""
    pdf_path = "/tmp/uploaded_pdf_debug.pdf"

    if not os.path.exists(pdf_path):
        print("❌ Debug PDF not found. Please upload a PDF first.")
        return

    if pdfplumber is None:
        print("❌ pdfplumber not installed")
        return

    print("🔍 Analyzing asset class patterns in PDF...")

    with pdfplumber.open(pdf_path) as pdf:
        asset_patterns = {
            'private equity': 0,
            'private_equity': 0,
            'venture capital': 0,
            'venture_capital': 0,
            'real estate': 0,
            'real_estate': 0,
            'private debt': 0,
            'private_debt': 0,
            'private credit': 0,
            'secondaries': 0,
            'fund of funds': 0,
            'fund_of_funds': 0,
            'infrastructure': 0,
            'real assets': 0,
            'real_assets': 0
        }

        for page_num, page in enumerate(pdf.pages):
            page_text = page.extract_text() or ""
            page_text_lower = page_text.lower()

            # Count mentions of each asset class
            page_counts = {}
            for pattern in asset_patterns.keys():
                count = page_text_lower.count(pattern)
                if count > 0:
                    asset_patterns[pattern] += count
                    page_counts[pattern] = count

            # Show pages with multiple asset class mentions
            if len(page_counts) > 1:
                print(f"\n📄 Page {page_num + 1} has multiple asset classes:")
                for pattern, count in sorted(page_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"   {pattern}: {count} mentions")

                # Show first few lines to see context
                lines = page_text.split('\n')[:10]
                print(f"   First 10 lines:")
                for i, line in enumerate(lines):
                    if line.strip():
                        print(f"   {i+1}: {line.strip()[:80]}...")

        # Summary
        print(f"\n📊 ASSET CLASS SUMMARY:")
        for pattern, count in sorted(asset_patterns.items(), key=lambda x: x[1], reverse=True):
            if count > 0:
                print(f"   {pattern}: {count} total mentions")

        # Check for table headers specifically
        print(f"\n🔍 Looking for table headers with asset classes...")

        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if tables:
                for table_idx, table in enumerate(tables):
                    if table and len(table) > 0:
                        # Check first few rows for headers
                        for row_idx, row in enumerate(table[:3]):
                            if row:
                                row_text = ' '.join([str(cell) if cell else '' for cell in row]).lower()
                                for pattern in asset_patterns.keys():
                                    if pattern in row_text:
                                        print(f"   Page {page_num + 1}, Table {table_idx}, Row {row_idx}: '{pattern}' in header")
                                        print(f"     Header: {row_text[:100]}...")

if __name__ == "__main__":
    debug_asset_classes()