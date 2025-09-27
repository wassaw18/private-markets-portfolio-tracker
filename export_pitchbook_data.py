#!/usr/bin/env python3
"""
Export all PitchBook benchmark data to Excel file
"""
import requests
import pandas as pd
import json
from datetime import datetime

# Base URL for the API
BASE_URL = "http://localhost:8000"

# PitchBook API endpoints
ENDPOINTS = {
    'performance_data': '/api/pitchbook/performance-data',
    'quarterly_returns': '/api/pitchbook/quarterly-returns',
    'asset_classes': '/api/pitchbook/asset-classes'
}

def fetch_data(endpoint):
    """Fetch data from API endpoint"""
    try:
        response = requests.get(f"{BASE_URL}{endpoint}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {endpoint}: {e}")
        return []

def main():
    print("🚀 Starting PitchBook data export...")

    # Create Excel writer
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    excel_file = f"/home/will/Tmux-Orchestrator/private-markets-tracker/pitchbook_benchmark_data_{timestamp}.xlsx"

    with pd.ExcelWriter(excel_file, engine='xlsxwriter') as writer:

        # 1. Performance Data (IRR by vintage)
        print("📊 Fetching performance data...")
        performance_data = fetch_data(ENDPOINTS['performance_data'])
        if performance_data:
            df_performance = pd.DataFrame(performance_data)
            df_performance.to_excel(writer, sheet_name='Performance_Data', index=False)
            print(f"   ✅ Exported {len(performance_data)} performance records")
        else:
            print("   ❌ No performance data found")

        # 2. Quarterly Returns
        print("📈 Fetching quarterly returns...")
        quarterly_data = fetch_data(ENDPOINTS['quarterly_returns'])
        if quarterly_data:
            df_quarterly = pd.DataFrame(quarterly_data)
            df_quarterly.to_excel(writer, sheet_name='Quarterly_Returns', index=False)
            print(f"   ✅ Exported {len(quarterly_data)} quarterly records")
        else:
            print("   ❌ No quarterly returns data found")

        # 3. Asset Classes
        print("🏷️ Fetching asset classes...")
        asset_classes = fetch_data(ENDPOINTS['asset_classes'])
        if asset_classes and isinstance(asset_classes, list):
            df_asset_classes = pd.DataFrame({'asset_class': asset_classes})
            df_asset_classes.to_excel(writer, sheet_name='Asset_Classes', index=False)
            print(f"   ✅ Exported {len(asset_classes)} asset classes")
        else:
            print("   ❌ No asset classes data found")

        # 4. Try to get comprehensive data dump from database tables directly
        print("🗄️ Attempting to get comprehensive database data...")

        # Check what's actually in the database by calling different endpoints
        db_endpoints_to_try = [
            '/api/pitchbook/performance-data?limit=1000',
            '/api/benchmarks',  # Original benchmark data
        ]

        for endpoint in db_endpoints_to_try:
            try:
                data = fetch_data(endpoint)
                if data:
                    sheet_name = endpoint.split('/')[-1].replace('-', '_')[:31]  # Excel sheet name limit
                    df = pd.DataFrame(data)
                    df.to_excel(writer, sheet_name=sheet_name, index=False)
                    print(f"   ✅ Exported {len(data)} records from {endpoint}")
            except Exception as e:
                print(f"   ⚠️ Could not export from {endpoint}: {e}")

        # 5. Create summary sheet
        print("📋 Creating summary sheet...")
        summary_data = {
            'Export_Date': [datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
            'Performance_Records': [len(performance_data) if performance_data else 0],
            'Quarterly_Records': [len(quarterly_data) if quarterly_data else 0],
            'Asset_Classes': [len(asset_classes) if asset_classes else 0],
            'API_Base_URL': [BASE_URL],
        }

        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='Export_Summary', index=False)

    print(f"✅ Excel export completed: {excel_file}")
    print(f"📁 File location: {excel_file}")

    # Also create a detailed data analysis
    print("\n📊 Data Analysis Summary:")
    if performance_data:
        print(f"Performance Data: {len(performance_data)} records")
        asset_classes_in_data = set(item.get('asset_class', 'unknown') for item in performance_data)
        vintage_years = set(item.get('vintage_year', 'unknown') for item in performance_data)
        print(f"  Asset Classes: {sorted(asset_classes_in_data)}")
        print(f"  Vintage Years: {sorted(vintage_years) if all(isinstance(y, int) for y in vintage_years) else vintage_years}")

    if quarterly_data:
        print(f"Quarterly Data: {len(quarterly_data)} records")

if __name__ == "__main__":
    main()
