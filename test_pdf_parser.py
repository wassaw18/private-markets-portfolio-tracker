#!/usr/bin/env python3
"""
Test script to use the actual PitchBookPDFParser service
"""

import sys
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.services.pdf_parser import PitchBookPDFParser

def test_pdf_parser(pdf_path="/tmp/uploaded_pdf_debug.pdf"):
    """Test the actual PDF parser service"""

    print(f"🔍 Testing PitchBookPDFParser with: {pdf_path}")

    try:
        parser = PitchBookPDFParser()
        extracted_data = parser.extract_data_from_pdf(pdf_path, report_period="Q1-2025")

        print(f"✅ Extraction completed!")
        print(f"📊 Performance data rows: {extracted_data.get('total_performance_rows', 0)}")
        print(f"📈 Quarterly data rows: {extracted_data.get('total_quarterly_rows', 0)}")
        print(f"📅 Report period: {extracted_data.get('report_period', 'N/A')}")

        # Show first few records
        if 'performance_data' in extracted_data and extracted_data['performance_data']:
            print(f"\n🎯 First few performance records:")
            for i, record in enumerate(extracted_data['performance_data'][:3]):
                print(f"  {i+1}: {record}")

        if 'quarterly_data' in extracted_data and extracted_data['quarterly_data']:
            print(f"\n📊 First few quarterly records:")
            for i, record in enumerate(extracted_data['quarterly_data'][:3]):
                print(f"  {i+1}: {record}")

        # Generate CSV to see the format
        csv_content = parser.generate_csv_content(extracted_data)
        print(f"\n📋 CSV content preview (first 500 chars):")
        print(csv_content[:500])

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_pdf_parser()