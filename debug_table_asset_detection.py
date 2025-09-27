#!/usr/bin/env python3
"""
Debug table-specific asset class detection to see why it's not working
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.pdf_parser import PitchBookPDFParser

def debug_table_asset_detection():
    """Debug table-specific asset class detection"""
    pdf_path = "/tmp/uploaded_pdf_debug.pdf"

    if not os.path.exists(pdf_path):
        print("❌ Debug PDF not found. Please upload a PDF first.")
        return

    print("🔍 Testing table-specific asset class detection...")

    parser = PitchBookPDFParser()

    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            table_count = 0
            asset_class_counts = {}

            # Just check the first 10 pages for debugging
            for page_num, page in enumerate(pdf.pages[:10]):
                page_text = page.extract_text() or ""
                page_tables = page.extract_tables()

                if page_tables:
                    print(f"\n📄 Page {page_num + 1} has {len(page_tables)} tables:")

                    for table_idx, table in enumerate(page_tables):
                        # Clean table
                        cleaned_table = parser._clean_and_fix_table(table)
                        if not cleaned_table:
                            continue

                        table_count += 1

                        # Test table-specific asset class detection
                        table_asset_class = parser._extract_asset_class_from_table(cleaned_table, page_text)
                        table_type = parser._identify_table_type(cleaned_table, page_text)

                        # Count asset classes
                        if table_asset_class:
                            asset_class_counts[table_asset_class] = asset_class_counts.get(table_asset_class, 0) + 1

                        print(f"   Table {table_idx}: type={table_type}, asset_class={table_asset_class}")

                        # Show sample table content for first few tables
                        if table_count <= 5 and cleaned_table:
                            print(f"     Sample content: {cleaned_table[0][:3] if len(cleaned_table) > 0 else 'Empty'}")
                            if len(cleaned_table) > 1:
                                print(f"     Row 2: {cleaned_table[1][:3] if len(cleaned_table) > 1 else 'Empty'}")

            print(f"\n📊 SUMMARY:")
            print(f"   Total tables analyzed: {table_count}")
            print(f"   Asset class distribution:")
            for asset_class, count in sorted(asset_class_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"     {asset_class}: {count} tables")

            if len(asset_class_counts) == 1 and 'private_equity' in asset_class_counts:
                print(f"\n🚨 PROBLEM: Only found private_equity - asset class detection is still broken!")
            elif len(asset_class_counts) > 1:
                print(f"\n✅ SUCCESS: Found multiple asset classes!")
            else:
                print(f"\n❓ UNCLEAR: Found {len(asset_class_counts)} asset classes")

    except Exception as e:
        print(f"❌ Debug failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_table_asset_detection()