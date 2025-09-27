#!/usr/bin/env python3
"""
Test script to debug cell splitting logic
"""

import sys
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.services.pdf_parser import PitchBookPDFParser

def test_cell_splitting():
    """Test the cell splitting functionality directly"""

    # Test table from our PDF (merged cells format)
    merged_table = [
        ['Strategy Q1 2025* Q4 2024 1-year 3-year 5-year 10-year 15-year 20-year'],
        ['Private capital 0.47% 1.44% 7.50% 4.99% 12.79% 12.12% 12.40% 11.25%'],
        ['Private equity 0.28% 2.02% 9.42% 5.92% 15.89% 15.14% 14.71% 13.56%']
    ]

    parser = PitchBookPDFParser()

    print(f"🔍 Testing cell splitting:")
    print(f"Original table: {len(merged_table)} rows x {len(merged_table[0])} columns")

    for i, row in enumerate(merged_table):
        print(f"  Row {i}: {row}")

    # Test the merged cell detection
    first_row = merged_table[0]
    avg_cell_length = sum(len(str(cell)) for cell in first_row) / len(first_row) if first_row else 0
    print(f"\nMerged cell detection:")
    print(f"  Columns: {len(first_row)}")
    print(f"  Average cell length: {avg_cell_length}")
    print(f"  Should trigger (≤2 cols and >50 avg): {len(first_row) <= 2 and avg_cell_length > 50}")

    # Apply the fix
    fixed_table = parser._fix_merged_cells(merged_table)

    print(f"\nFixed table: {len(fixed_table)} rows x {len(fixed_table[0]) if fixed_table else 0} columns")

    if fixed_table != merged_table:
        print("✅ Table was modified!")
        for i, row in enumerate(fixed_table):
            print(f"  Row {i}: {row}")
    else:
        print("❌ Table was not modified")

    # Test individual cell splitting
    print(f"\n🔧 Testing individual cell splitting:")
    test_cells = [
        'Strategy Q1 2025* Q4 2024 1-year 3-year 5-year 10-year 15-year 20-year',
        'Private capital 0.47% 1.44% 7.50% 4.99% 12.79% 12.12% 12.40% 11.25%',
        'Private equity 0.28% 2.02% 9.42% 5.92% 15.89% 15.14% 14.71% 13.56%'
    ]

    for i, cell in enumerate(test_cells):
        parts = parser._smart_split_cell(cell)
        print(f"  Cell {i}: '{cell}' -> {len(parts)} parts")
        print(f"    Parts: {parts}")

if __name__ == "__main__":
    test_cell_splitting()