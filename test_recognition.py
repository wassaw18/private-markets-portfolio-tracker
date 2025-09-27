#!/usr/bin/env python3
"""
Test script to debug table recognition patterns
"""

import sys
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.services.pdf_parser import PitchBookPDFParser
import pdfplumber

def test_table_recognition(pdf_path="/tmp/uploaded_pdf_debug.pdf"):
    """Test table recognition on specific table"""

    print(f"🔍 Testing table recognition with: {pdf_path}")

    # Our test table data from Table 3
    test_table = [
        ['Strategy', 'Q1 2025*', 'Q4 2024', '1-year', '3-year', '5-year', '10-year', '15-year', '20-year'],
        ['Private capital', '0.47%', '1.44%', '7.50%', '4.99%', '12.79%', '12.12%', '12.40%', '11.25%'],
        ['Private equity', '0.28%', '2.02%', '9.42%', '5.92%', '15.89%', '15.14%', '14.71%', '13.56%']
    ]

    parser = PitchBookPDFParser()

    print(f"\n📊 Testing our manually parsed table:")
    print(f"Table dimensions: {len(test_table)} rows x {len(test_table[0])} columns")
    for i, row in enumerate(test_table):
        print(f"  Row {i}: {row}")

    # Test recognition patterns
    print(f"\n🎯 Testing performance table recognition:")
    is_performance = parser._is_performance_table(test_table)
    print(f"  Is performance table: {is_performance}")

    print(f"\n📈 Testing quarterly returns recognition:")
    is_quarterly = parser._is_quarterly_returns_table(test_table)
    print(f"  Is quarterly table: {is_quarterly}")

    # Test header finding
    print(f"\n🔍 Testing quarterly header detection:")
    quarterly_headers = parser._find_quarterly_headers(test_table)
    print(f"  Quarterly headers: {quarterly_headers}")

    if quarterly_headers:
        print(f"\n📋 Testing row parsing:")
        try:
            # Test parsing the data rows
            for i in range(1, len(test_table)):  # Skip header row
                parsed_records = parser._parse_quarterly_row(test_table[i], quarterly_headers['columns'], "Q1-2025")
                print(f"  Row {i} parsed to: {len(parsed_records) if parsed_records else 0} records")
                if parsed_records:
                    for j, record in enumerate(parsed_records[:3]):  # Show first 3
                        print(f"    Record {j+1}: {record}")
        except Exception as e:
            print(f"  ❌ Error parsing rows: {e}")
            import traceback
            traceback.print_exc()

    # Now test with the actual PDF to see what we're getting
    print(f"\n📄 Testing actual PDF extraction (page 8 only):")
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page_8 = pdf.pages[7]  # Page 8 (0-indexed)
            page_tables = page_8.extract_tables()

            print(f"Found {len(page_tables)} tables on page 8")

            for i, table in enumerate(page_tables):
                print(f"\nTable {i} from PDF:")
                print(f"  Dimensions: {len(table)} rows x {len(table[0]) if table and table[0] else 0} columns")

                for j, row in enumerate(table[:3]):  # First 3 rows
                    print(f"    Row {j}: {row}")

                # Test recognition on actual PDF table
                if table:
                    is_perf = parser._is_performance_table(table)
                    is_quart = parser._is_quarterly_returns_table(table)
                    print(f"  Recognition: Performance={is_perf}, Quarterly={is_quart}")

                    if is_quart:
                        headers = parser._find_quarterly_headers(table)
                        print(f"  Headers found: {headers}")

    except Exception as e:
        print(f"❌ Error with PDF: {e}")

if __name__ == "__main__":
    test_table_recognition()