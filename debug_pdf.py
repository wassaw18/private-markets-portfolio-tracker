#!/usr/bin/env python3
"""
Debug script to analyze PDF table content
This script will help us understand what's actually in the PDF tables
"""

import sys
import os
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.services.pdf_parser import PitchBookPDFParser
import json

def debug_pdf_tables(pdf_path="/tmp/uploaded_pdf.pdf"):
    """Analyze PDF tables for debugging"""

    if not os.path.exists(pdf_path):
        print(f"PDF file not found at: {pdf_path}")
        return

    try:
        parser = PitchBookPDFParser()

        # Import pdfplumber directly to get raw table data
        import pdfplumber

        print(f"🔍 Analyzing PDF: {pdf_path}")

        with pdfplumber.open(pdf_path) as pdf:
            print(f"📄 Total pages: {len(pdf.pages)}")

            all_tables = []
            page_count = 0

            for page_num, page in enumerate(pdf.pages):
                page_tables = page.extract_tables()
                if page_tables:
                    print(f"📋 Page {page_num + 1}: Found {len(page_tables)} tables")
                    all_tables.extend([(page_num + 1, i, table) for i, table in enumerate(page_tables)])
                    page_count += 1

                # Only process first few pages to avoid overwhelming output
                if page_count >= 3:
                    break

            print(f"\n🎯 Total tables found: {len(all_tables)}")
            print("\n" + "="*80)

            # Analyze first 10 tables
            for idx, (page_num, table_idx, table) in enumerate(all_tables[:10]):
                print(f"\n📊 TABLE {idx + 1} (Page {page_num}, Table {table_idx + 1})")
                print("-" * 60)

                if not table or len(table) == 0:
                    print("❌ Empty table")
                    continue

                # Show table dimensions
                print(f"📏 Dimensions: {len(table)} rows x {len(table[0]) if table[0] else 0} columns")

                # Show first few rows
                print("\n📋 First 5 rows:")
                for row_idx, row in enumerate(table[:5]):
                    if row:
                        cleaned_row = [str(cell) if cell is not None else 'NULL' for cell in row]
                        print(f"  Row {row_idx + 1}: {cleaned_row}")

                # Analyze text content
                table_text = ' '.join([' '.join([str(cell) for cell in row if cell is not None]) for row in table if row]).lower()
                print(f"\n🔤 Text content sample (first 300 chars):")
                print(f"  {table_text[:300]}...")

                # Check for performance indicators
                performance_indicators = [
                    'vintage', 'irr', 'tvpi', 'dpi', 'rvpi', 'pme',
                    'internal rate', 'total value', 'distributions', 'residual value',
                    'quartile', 'median', 'percentile', '25th', '50th', '75th',
                    'private equity', 'venture capital', 'real estate',
                    'performance', 'return', 'benchmark', 'multiple'
                ]

                found_indicators = [indicator for indicator in performance_indicators if indicator in table_text]
                print(f"\n🎯 Performance indicators found: {found_indicators}")

                print("\n" + "="*60)

        print(f"\n✅ Analysis complete!")

    except Exception as e:
        print(f"❌ Error analyzing PDF: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Check for custom path argument
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/uploaded_pdf.pdf"
    debug_pdf_tables(pdf_path)