#!/usr/bin/env python3
"""
Comprehensive export of all PitchBook data from database tables
"""
import sys
import os
import pandas as pd
from datetime import datetime

# Add the app directory to the Python path
sys.path.append('/home/will/Tmux-Orchestrator/private-markets-tracker')

from app.database import get_db
from app.models import (
    PitchBookPerformanceByVintage, 
    PitchBookMultiplesByVintage, 
    PitchBookMultiplesQuantiles,
    PitchBookQuarterlyReturns
)

def export_table_to_dataframe(session, model, table_name):
    """Export a database table to pandas DataFrame"""
    try:
        query = session.query(model).all()
        if not query:
            print(f"   ❌ No data found in {table_name}")
            return None
        
        # Convert to list of dictionaries
        data = []
        for record in query:
            record_dict = {}
            for column in model.__table__.columns:
                value = getattr(record, column.name)
                record_dict[column.name] = value
            data.append(record_dict)
        
        df = pd.DataFrame(data)
        print(f"   ✅ Exported {len(data)} records from {table_name}")
        return df
    except Exception as e:
        print(f"   ❌ Error exporting {table_name}: {e}")
        return None

def main():
    print("🚀 Starting comprehensive PitchBook database export...")
    
    # Create database session
    db = next(get_db())
    
    # Define the tables to export
    tables_to_export = [
        (PitchBookPerformanceByVintage, 'Performance_By_Vintage'),
        (PitchBookMultiplesByVintage, 'Multiples_By_Vintage'),
        (PitchBookMultiplesQuantiles, 'Multiples_Quantiles'),
        (PitchBookQuarterlyReturns, 'Quarterly_Returns')
    ]
    
    # Create Excel writer
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    excel_file = f"/home/will/Tmux-Orchestrator/private-markets-tracker/pitchbook_complete_export_{timestamp}.xlsx"
    
    with pd.ExcelWriter(excel_file, engine='xlsxwriter') as writer:
        total_records = 0
        exported_sheets = []
        
        # Export each table
        for model, sheet_name in tables_to_export:
            print(f"📊 Exporting {sheet_name}...")
            df = export_table_to_dataframe(db, model, sheet_name)
            
            if df is not None and not df.empty:
                df.to_excel(writer, sheet_name=sheet_name, index=False)
                total_records += len(df)
                exported_sheets.append({
                    'Sheet_Name': sheet_name,
                    'Record_Count': len(df),
                    'Columns': list(df.columns)
                })
                
                # Print sample of data
                print(f"   📋 Columns: {list(df.columns)}")
                if 'asset_class' in df.columns:
                    asset_classes = df['asset_class'].unique()
                    print(f"   🏷️ Asset Classes: {sorted(asset_classes)}")
                if 'vintage_year' in df.columns:
                    vintage_years = sorted(df['vintage_year'].unique())
                    print(f"   📅 Vintage Years: {vintage_years}")
        
        # Create summary sheet
        if exported_sheets:
            print("📋 Creating export summary...")
            summary_df = pd.DataFrame(exported_sheets)
            summary_df.to_excel(writer, sheet_name='Export_Summary', index=False)
            
            # Create metadata sheet
            metadata = {
                'Export_Date': [datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
                'Total_Records': [total_records],
                'Total_Sheets': [len(exported_sheets)],
                'Database_Tables': [', '.join([sheet['Sheet_Name'] for sheet in exported_sheets])]
            }
            metadata_df = pd.DataFrame(metadata)
            metadata_df.to_excel(writer, sheet_name='Metadata', index=False)
    
    db.close()
    
    print(f"\n✅ Complete export finished!")
    print(f"📁 File: {excel_file}")
    print(f"📊 Total records exported: {total_records}")
    print(f"📑 Sheets created: {len(exported_sheets) + 2}")  # +2 for summary and metadata
    
    return excel_file

if __name__ == "__main__":
    main()
