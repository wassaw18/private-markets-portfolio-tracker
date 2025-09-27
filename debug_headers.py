#!/usr/bin/env python3
"""
Debug script to test header recognition on the exact table from PDF
"""

import sys
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.services.pdf_parser import PitchBookPDFParser
import pdfplumber
import re

def debug_header_recognition():
    """Debug header recognition step by step"""

    # The actual extracted table from our PDF (AFTER cell splitting)
    split_table = [
        ['Strategy', 'Q1 2025*', 'Q4 2024', '1-year', '3-year', '5-year', '10-year', '15-year', '20-year'],
        ['Private capital', '0.47%', '1.44%', '7.50%', '4.99%', '12.79%', '12.12%', '12.40%', '11.25%'],
        ['Private equity', '0.28%', '2.02%', '9.42%', '5.92%', '15.89%', '15.14%', '14.71%', '13.56%']
    ]

    # The actual extracted table from our PDF (BEFORE cell splitting - what's failing)
    merged_table = [
        ['Strategy Q1 2025* Q4 2024 1-year 3-year 5-year 10-year 15-year 20-year'],
        ['Private capital 0.47% 1.44% 7.50% 4.99% 12.79% 12.12% 12.40% 11.25%'],
        ['Private equity 0.28% 2.02% 9.42% 5.92% 15.89% 15.14% 14.71% 13.56%']
    ]

    parser = PitchBookPDFParser()

    print("🔍 Testing header recognition on split table (should work):")
    print(f"Table: {split_table[0]}")
    headers_split = parser._find_quarterly_headers(split_table)
    print(f"Result: {headers_split}")

    print("\n🔍 Testing header recognition on merged table (currently failing):")
    print(f"Table: {merged_table[0]}")
    headers_merged = parser._find_quarterly_headers(merged_table)
    print(f"Result: {headers_merged}")

    print("\n🔧 Testing if cell splitting is actually being applied:")
    fixed_table = parser._fix_merged_cells(merged_table)
    print(f"Before: {len(merged_table[0])} columns")
    print(f"After: {len(fixed_table[0])} columns")
    print(f"Fixed table[0]: {fixed_table[0]}")

    print("\n🎯 Testing header recognition on the fixed table:")
    headers_fixed = parser._find_quarterly_headers(fixed_table)
    print(f"Result: {headers_fixed}")

    # Now test the full pipeline step by step using the real PDF
    print("\n📄 Testing full extraction pipeline with actual PDF:")
    pdf_path = "/tmp/uploaded_pdf_debug.pdf"

    try:
        with pdfplumber.open(pdf_path) as pdf:
            page_8 = pdf.pages[7]  # Page 8 (0-indexed)
            page_tables = page_8.extract_tables()

            if page_tables:
                table = page_tables[0]  # First table
                print(f"\n📊 Raw PDF table:")
                print(f"Dimensions: {len(table)} rows x {len(table[0]) if table else 0} columns")
                print(f"Row 0: {table[0]}")

                # Clean the table
                cleaned_table = []
                for row in table:
                    if row:
                        cleaned_row = [cell if cell is not None else '' for cell in row]
                        cleaned_table.append(cleaned_row)

                print(f"\n🧹 Cleaned table:")
                print(f"Row 0: {cleaned_table[0]}")

                # Apply cell splitting
                fixed_table = parser._fix_merged_cells(cleaned_table)
                print(f"\n🔧 After cell splitting:")
                print(f"Dimensions: {len(fixed_table)} rows x {len(fixed_table[0]) if fixed_table else 0} columns")
                print(f"Row 0: {fixed_table[0]}")

                # Test recognition
                print(f"\n🎯 Recognition tests:")
                is_performance = parser._is_performance_table(fixed_table)
                is_quarterly = parser._is_quarterly_returns_table(fixed_table)
                print(f"Is performance table: {is_performance}")
                print(f"Is quarterly table: {is_quarterly}")

                if is_quarterly:
                    headers = parser._find_quarterly_headers(fixed_table)
                    print(f"Headers found: {headers}")

                    if headers:
                        print("✅ SUCCESS! Headers detected properly!")
                    else:
                        print("❌ FAILED! Headers not detected even after cell splitting!")

                        # Debug step by step through the header logic
                        print("\n🐛 Debugging header detection logic:")
                        for i, row in enumerate(fixed_table):
                            if not row:
                                continue

                            print(f"\nRow {i}: {row}")
                            row_lower = [cell.lower() if cell else '' for cell in row]
                            print(f"Lowercase: {row_lower}")

                            col_indices = {}
                            time_period_columns = []

                            for j, cell in enumerate(row_lower):
                                print(f"  Cell {j}: '{cell}'")

                                # Asset class check
                                if any(pattern in cell for pattern in ['asset', 'class', 'strategy']) or j == 0:
                                    print(f"    → Asset class column: {j}")
                                    col_indices['asset_class'] = j

                                # Quarter check
                                if re.search(r'q[1-4]\s*20\d{2}', cell):
                                    print(f"    → Quarter column: {j}")
                                    time_period_columns.append(j)

                                # Time horizon check
                                elif re.search(r'\d+-year', cell):
                                    print(f"    → Time horizon column: {j}")
                                    time_period_columns.append(j)

                            print(f"  Final col_indices: {col_indices}")
                            print(f"  Final time_period_columns: {time_period_columns}")

                            # Check return conditions
                            if 'asset_class' in col_indices and time_period_columns:
                                print(f"  ✅ Would return: header_row={i}, columns={col_indices | {'time_period_columns': time_period_columns}}")
                                break
                            else:
                                print(f"  ❌ Not returning: asset_class={col_indices.get('asset_class')}, time_periods={len(time_period_columns)}")

    except Exception as e:
        print(f"Error processing PDF: {e}")

if __name__ == "__main__":
    debug_header_recognition()