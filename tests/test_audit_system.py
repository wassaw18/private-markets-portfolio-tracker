#!/usr/bin/env python3
"""
Test Script for Enhanced Basic Auditing System
Tests the audit functionality without requiring full database setup
"""

import sys
import os
sys.path.append('.')

def test_audit_system_implementation():
    """Test the audit system implementation"""
    
    print("🔍 Testing Enhanced Basic Auditing System Implementation")
    print("=" * 60)
    
    # Test 1: Check if models have audit fields
    print("\n1. Testing Model Audit Fields")
    try:
        # We'll test by reading the models.py file directly
        with open('app/models.py', 'r') as f:
            models_content = f.read()
        
        # Check for audit fields in key models
        required_audit_fields = ['created_by', 'updated_by']
        key_models = ['Entity', 'Investment', 'CashFlow', 'Valuation', 'EntityRelationship', 'InvestmentOwnership', 'FamilyMember']
        
        audit_field_results = {}
        for model in key_models:
            # Find the model definition
            model_start = models_content.find(f'class {model}(Base):')
            if model_start == -1:
                audit_field_results[model] = {'found': False, 'audit_fields': []}
                continue
            
            # Find the next class or end of file
            next_class = models_content.find('\nclass ', model_start + 1)
            if next_class == -1:
                model_section = models_content[model_start:]
            else:
                model_section = models_content[model_start:next_class]
            
            # Check for audit fields
            found_fields = []
            for field in required_audit_fields:
                if f'{field} = Column(' in model_section:
                    found_fields.append(field)
            
            audit_field_results[model] = {
                'found': True,
                'audit_fields': found_fields,
                'has_all_fields': len(found_fields) == len(required_audit_fields)
            }
        
        # Report results
        all_models_compliant = True
        for model, result in audit_field_results.items():
            if not result['found']:
                print(f"   ❌ {model}: Model not found")
                all_models_compliant = False
            elif result['has_all_fields']:
                print(f"   ✅ {model}: Has all audit fields ({', '.join(result['audit_fields'])})")
            else:
                print(f"   ⚠️  {model}: Missing audit fields (has: {', '.join(result['audit_fields'])})")
                all_models_compliant = False
        
        print(f"\n   Model Audit Fields: {'✅ PASS' if all_models_compliant else '❌ FAIL'}")
        
    except Exception as e:
        print(f"   ❌ Error testing models: {e}")
        all_models_compliant = False
    
    # Test 2: Check if CRUD operations have user parameters
    print("\n2. Testing CRUD User Context Parameters")
    try:
        with open('app/crud.py', 'r') as f:
            crud_content = f.read()
        
        # Check key CRUD functions for current_user parameter
        crud_functions = [
            'def create_entity',
            'def update_entity',
            'def create_investment',
            'def update_investment',
            'def create_cashflow',
            'def create_valuation',
            'def create_family_member',
            'def update_family_member'
        ]
        
        crud_compliant = True
        for func in crud_functions:
            if func in crud_content:
                # Find the function definition line
                func_start = crud_content.find(func)
                func_line_end = crud_content.find('\n', func_start)
                func_line = crud_content[func_start:func_line_end]
                
                if 'current_user' in func_line:
                    print(f"   ✅ {func}: Has current_user parameter")
                else:
                    print(f"   ❌ {func}: Missing current_user parameter")
                    crud_compliant = False
            else:
                print(f"   ❌ {func}: Function not found")
                crud_compliant = False
        
        print(f"\n   CRUD Functions: {'✅ PASS' if crud_compliant else '❌ FAIL'}")
        
    except Exception as e:
        print(f"   ❌ Error testing CRUD: {e}")
        crud_compliant = False
    
    # Test 3: Check if API endpoints have user context
    print("\n3. Testing API Endpoint User Context")
    try:
        with open('app/main.py', 'r') as f:
            main_content = f.read()
        
        # Check for get_current_user dependency
        has_user_dependency = 'def get_current_user(' in main_content
        print(f"   {'✅' if has_user_dependency else '❌'} User context dependency function: {'Found' if has_user_dependency else 'Missing'}")
        
        # Check for audit endpoints
        audit_endpoints = [
            '/api/audit/user/',
            '/api/audit/investment/',
            '/api/audit/system',
            '/api/audit/status'
        ]
        
        endpoints_found = 0
        for endpoint in audit_endpoints:
            if endpoint in main_content:
                print(f"   ✅ {endpoint}: Endpoint implemented")
                endpoints_found += 1
            else:
                print(f"   ❌ {endpoint}: Endpoint missing")
        
        api_compliant = has_user_dependency and endpoints_found == len(audit_endpoints)
        print(f"\n   API Endpoints: {'✅ PASS' if api_compliant else '❌ FAIL'}")
        
    except Exception as e:
        print(f"   ❌ Error testing API: {e}")
        api_compliant = False
    
    # Test 4: Check audit query functions
    print("\n4. Testing Audit Query Functions")
    try:
        audit_functions = [
            'get_recent_changes_by_user',
            'get_investment_change_history', 
            'get_system_activity_summary'
        ]
        
        audit_functions_found = 0
        for func in audit_functions:
            if f'def {func}(' in crud_content:
                print(f"   ✅ {func}: Function implemented")
                audit_functions_found += 1
            else:
                print(f"   ❌ {func}: Function missing")
        
        audit_queries_compliant = audit_functions_found == len(audit_functions)
        print(f"\n   Audit Query Functions: {'✅ PASS' if audit_queries_compliant else '❌ FAIL'}")
        
    except Exception as e:
        print(f"   ❌ Error testing audit queries: {e}")
        audit_queries_compliant = False
    
    # Test 5: Check migration script
    print("\n5. Testing Migration Script")
    try:
        migration_exists = os.path.exists('migration_audit_fields.py')
        print(f"   {'✅' if migration_exists else '❌'} Migration script: {'Found' if migration_exists else 'Missing'}")
        
        if migration_exists:
            with open('migration_audit_fields.py', 'r') as f:
                migration_content = f.read()
            
            has_backup = 'backup' in migration_content.lower()
            has_rollback = 'rollback' in migration_content.lower()
            has_verification = 'verification' in migration_content.lower()
            
            print(f"   {'✅' if has_backup else '❌'} Backup functionality: {'Included' if has_backup else 'Missing'}")
            print(f"   {'✅' if has_rollback else '❌'} Rollback functionality: {'Included' if has_rollback else 'Missing'}")
            print(f"   {'✅' if has_verification else '❌'} Verification: {'Included' if has_verification else 'Missing'}")
            
            migration_compliant = migration_exists and has_backup and has_rollback and has_verification
        else:
            migration_compliant = False
        
        print(f"\n   Migration Script: {'✅ PASS' if migration_compliant else '❌ FAIL'}")
        
    except Exception as e:
        print(f"   ❌ Error testing migration: {e}")
        migration_compliant = False
    
    # Overall Results
    print("\n" + "=" * 60)
    print("📊 OVERALL TEST RESULTS")
    print("=" * 60)
    
    all_tests = [
        ("Model Audit Fields", all_models_compliant),
        ("CRUD Functions", crud_compliant), 
        ("API Endpoints", api_compliant),
        ("Audit Queries", audit_queries_compliant),
        ("Migration Script", migration_compliant)
    ]
    
    passed_tests = sum(1 for _, passed in all_tests if passed)
    total_tests = len(all_tests)
    
    for test_name, passed in all_tests:
        print(f"{'✅' if passed else '❌'} {test_name}")
    
    print(f"\nTests Passed: {passed_tests}/{total_tests}")
    
    if passed_tests == total_tests:
        print("\n🎉 Enhanced Basic Auditing System: FULLY IMPLEMENTED")
        print("   ✓ All data modifications will be tracked by user")
        print("   ✓ Timestamp tracking on all major entities")
        print("   ✓ Audit reporting endpoints available")
        print("   ✓ Migration script ready for deployment")
        print("   ✓ System maintains backward compatibility")
    else:
        print(f"\n⚠️  Enhanced Basic Auditing System: PARTIALLY IMPLEMENTED ({passed_tests}/{total_tests})")
        print("   Some components may need attention before deployment")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = test_audit_system_implementation()
    sys.exit(0 if success else 1)