#!/usr/bin/env python3
"""
Test script to validate the bulk upload fix
This tests the complete download -> upload cycle
"""
import sys
import os

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import get_db, create_database
from app.excel_template_service import excel_template_service
from app.import_export import import_investments_from_file
from app import crud, models, schemas
from sqlalchemy.orm import Session
import io

def test_template_generation_and_import():
    """Test that template generation and import are compatible"""
    print("🧪 TESTING BULK UPLOAD FIX")
    print("=" * 50)
    
    # Create database
    create_database()
    
    # Get database session
    db_gen = get_db()
    db = next(db_gen)
    
    try:
        # Ensure we have at least one entity for the template
        entities = crud.get_entities(db, skip=0, limit=10)
        if not entities:
            print("Creating test entity...")
            test_entity = schemas.EntityCreate(
                name="Test Family Trust",
                entity_type=models.EntityType.TRUST,
                tax_id="12-3456789"
            )
            entity = crud.create_entity(db, test_entity, current_user="test")
            print(f"✅ Created test entity: {entity.name} (ID: {entity.id})")
        else:
            entity = entities[0]
            print(f"✅ Using existing entity: {entity.name} (ID: {entity.id})")
        
        # Step 1: Generate Excel template
        print("\n📊 STEP 1: Generating Excel template...")
        excel_buffer = excel_template_service.generate_investment_template(db)
        print("✅ Excel template generated successfully")
        
        # Step 2: Read the template as if a user downloaded and filled it out
        print("\n📋 STEP 2: Reading template structure...")
        import pandas as pd
        
        # Read with the current import logic
        excel_data = excel_buffer.getvalue()
        df = pd.read_excel(io.BytesIO(excel_data), sheet_name='Investment Data', skiprows=[0, 2], header=0)
        
        # Clean column names (remove brackets) - this is what our fix does
        df.columns = [col.strip('[]') if isinstance(col, str) else col for col in df.columns]
        print(f"✅ Column names after cleaning: {list(df.columns)[:10]}...")  # Show first 10
        
        # Step 3: Check that we have the expected required fields
        print("\n🔍 STEP 3: Validating required fields...")
        required_fields = ['name', 'asset_class', 'investment_structure', 'entity_id', 'strategy', 'vintage_year', 'commitment_amount', 'commitment_date']
        
        missing_fields = []
        for field in required_fields:
            if field not in df.columns:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"❌ MISSING FIELDS: {missing_fields}")
            return False
        else:
            print("✅ All required fields present in template")
        
        # Step 4: Create test data that matches the template structure
        print("\n📝 STEP 4: Creating test data row...")
        
        # Simulate user filling out first data row (row 4 in Excel, index 0 in DataFrame)
        # The template already has sample data in the first row
        df.iloc[0] = pd.Series({
            'name': 'Test Fund IV',
            'asset_class': 'PRIVATE_EQUITY',
            'investment_structure': 'LIMITED_PARTNERSHIP', 
            'entity_id': str(entity.id),
            'manager': 'Test Capital Partners',
            'strategy': 'Growth Buyout',
            'vintage_year': '2024',
            'target_raise': '500000000',
            'geography_focus': 'North America',
            'commitment_amount': '5000000',
            'commitment_date': '2024-01-15',
            'management_fee': '2.5',
            'performance_fee': '20.0',
            'hurdle_rate': '8.0',
            'distribution_target': 'Quarterly distributions',
            'currency': 'USD',
            'liquidity_profile': 'ILLIQUID',
            'expected_maturity_date': '2034-01-15',
            'reporting_frequency': 'QUARTERLY',
            'contact_person': 'John Smith',
            'email': 'john@testfund.com',
            'portal_link': 'https://portal.testfund.com',
            'fund_administrator': 'Test Admin Corp',
            'fund_domicile': 'Delaware',
            'tax_classification': 'K-1',
            'activity_classification': 'PASSIVE',
            'due_diligence_date': '2023-12-01',
            'ic_approval_date': '2024-01-10',
            'risk_rating': 'MEDIUM',
            'benchmark_index': 'S&P 500',
            'called_amount': '2500000',
            'fees': '50000'
        })
        
        print("✅ Test data row created")
        
        # Step 5: Save as Excel file and attempt import
        print("\n⬆️  STEP 5: Testing import process...")
        
        # Create a new Excel file with our test data
        test_excel = io.BytesIO()
        with pd.ExcelWriter(test_excel, engine='openpyxl') as writer:
            # We need to recreate the 3-row header structure
            
            # First, get the original template headers
            original_df = pd.read_excel(io.BytesIO(excel_data), sheet_name='Investment Data', header=None, nrows=3)
            
            # Create the full dataframe with headers + data
            full_df = pd.concat([original_df, pd.DataFrame([df.iloc[0]])], ignore_index=True)
            
            full_df.to_excel(writer, sheet_name='Investment Data', index=False, header=False)
        
        test_excel.seek(0)
        
        # Now test the import
        result = import_investments_from_file(test_excel.getvalue(), "test_upload.xlsx", db, force_upload=False)
        
        print(f"✅ Import completed:")
        print(f"   - Success count: {result.success_count}")
        print(f"   - Error count: {result.error_count}")
        
        if result.error_count > 0:
            print("❌ IMPORT ERRORS:")
            for error in result.errors[:5]:
                print(f"   - Row {error['row']}: {error['message']}")
            return False
        
        # Step 6: Verify the investment was created
        print("\n🔍 STEP 6: Verifying investment creation...")
        investments = crud.get_investments(db, skip=0, limit=10)
        test_investment = None
        for inv in investments:
            if inv.name == 'Test Fund IV':
                test_investment = inv
                break
        
        if test_investment:
            print(f"✅ Investment created successfully: {test_investment.name}")
            print(f"   - Asset Class: {test_investment.asset_class}")
            print(f"   - Entity ID: {test_investment.entity_id}")
            print(f"   - Commitment: ${test_investment.commitment_amount:,.2f}")
            print(f"   - Manager: {test_investment.manager}")
        else:
            print("❌ Investment not found in database")
            return False
        
        print("\n🎉 SUCCESS: Bulk upload fix is working correctly!")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    success = test_template_generation_and_import()
    if success:
        print("\n✅ ALL TESTS PASSED - The fix is working!")
    else:
        print("\n❌ TESTS FAILED - More work needed")
        sys.exit(1)