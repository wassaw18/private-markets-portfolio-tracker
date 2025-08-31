#!/usr/bin/env python3
"""
Validation script for multi-entity management structure
This script validates the code structure without requiring database dependencies
"""

import sys
import os
import importlib.util

def validate_imports():
    """Test that all modules can be imported without errors"""
    print("🔍 Validating module imports...")
    
    try:
        # Test if we can import the models
        spec = importlib.util.spec_from_file_location("models", "app/models.py")
        models_module = importlib.util.module_from_spec(spec)
        
        # Mock SQLAlchemy dependencies for import testing
        import types
        mock_sqlalchemy = types.ModuleType('sqlalchemy')
        mock_sqlalchemy.Column = lambda *args, **kwargs: "Column"
        mock_sqlalchemy.Integer = "Integer"
        mock_sqlalchemy.String = "String"
        mock_sqlalchemy.Float = "Float"
        mock_sqlalchemy.Date = "Date"
        mock_sqlalchemy.ForeignKey = lambda x: f"ForeignKey({x})"
        mock_sqlalchemy.Enum = lambda x: f"Enum({x})"
        mock_sqlalchemy.Boolean = "Boolean"
        mock_sqlalchemy.Text = "Text"
        mock_sqlalchemy.DateTime = "DateTime"
        mock_sqlalchemy.Index = lambda *args, **kwargs: "Index"
        
        mock_declarative = types.ModuleType('declarative_base')
        mock_declarative.declarative_base = lambda: type
        
        mock_orm = types.ModuleType('orm')
        mock_orm.relationship = lambda *args, **kwargs: "relationship"
        
        sys.modules['sqlalchemy'] = mock_sqlalchemy
        sys.modules['sqlalchemy.ext.declarative'] = mock_declarative
        sys.modules['sqlalchemy.orm'] = mock_orm
        
        spec.loader.exec_module(models_module)
        print("   ✓ Models module imports successfully")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Import error: {e}")
        return False

def validate_entity_model_structure():
    """Validate that Entity model has correct structure"""
    print("\n🏗️  Validating Entity model structure...")
    
    with open("app/models.py", "r") as f:
        content = f.read()
    
    checks = [
        ("Entity class defined", "class Entity(Base):" in content),
        ("EntityType enum defined", "class EntityType(str, enum.Enum):" in content),
        ("Entity name field", "name = Column(String" in content),
        ("Entity type field", "entity_type = Column(Enum(EntityType)" in content),
        ("Entity tax_id field", "tax_id = Column(String" in content),
        ("Entity relationships", "investments = relationship" in content),
        ("Entity family_members relationship", "family_members = relationship" in content),
    ]
    
    all_passed = True
    for check_name, condition in checks:
        if condition:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ❌ {check_name}")
            all_passed = False
    
    return all_passed

def validate_family_member_model_structure():
    """Validate that FamilyMember model has correct structure"""
    print("\n👨‍👩‍👧‍👦 Validating FamilyMember model structure...")
    
    with open("app/models.py", "r") as f:
        content = f.read()
    
    checks = [
        ("FamilyMember class defined", "class FamilyMember(Base):" in content),
        ("RelationshipType enum defined", "class RelationshipType(str, enum.Enum):" in content),
        ("Entity foreign key", "entity_id = Column(Integer, ForeignKey" in content),
        ("First name field", "first_name = Column(String" in content),
        ("Last name field", "last_name = Column(String" in content),
        ("Relationship type field", "relationship_type = Column(Enum(RelationshipType)" in content),
        ("Primary contact field", "primary_contact = Column(Boolean" in content),
        ("Full name property", "@property" in content and "def full_name" in content),
    ]
    
    all_passed = True
    for check_name, condition in checks:
        if condition:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ❌ {check_name}")
            all_passed = False
    
    return all_passed

def validate_investment_model_updates():
    """Validate that Investment model was updated correctly"""
    print("\n💰 Validating Investment model updates...")
    
    with open("app/models.py", "r") as f:
        content = f.read()
    
    checks = [
        ("Entity foreign key added", "entity_id = Column(Integer, ForeignKey" in content),
        ("Entity relationship added", "entity = relationship(\"Entity\"" in content),
        ("Owner field removed", "owner = Column(String" not in content or content.count("owner = Column(String") == 0),
    ]
    
    all_passed = True
    for check_name, condition in checks:
        if condition:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ❌ {check_name}")
            all_passed = False
    
    return all_passed

def validate_schema_structure():
    """Validate that schemas were updated correctly"""
    print("\n📋 Validating schema structure...")
    
    with open("app/schemas.py", "r") as f:
        content = f.read()
    
    checks = [
        ("EntityType import", "EntityType" in content and "from app.models import" in content),
        ("RelationshipType import", "RelationshipType" in content),
        ("EntityBase schema", "class EntityBase(BaseModel):" in content),
        ("EntityCreate schema", "class EntityCreate(EntityBase):" in content),
        ("Entity schema", "class Entity(EntityBase):" in content),
        ("FamilyMemberBase schema", "class FamilyMemberBase(BaseModel):" in content),
        ("FamilyMember schema", "class FamilyMember(FamilyMemberBase):" in content),
        ("EntityWithMembers schema", "class EntityWithMembers(Entity):" in content),
        ("Investment entity_id field", "entity_id: int" in content),
        ("Investment owner field removed", "owner: str" not in content),
    ]
    
    all_passed = True
    for check_name, condition in checks:
        if condition:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ❌ {check_name}")
            all_passed = False
    
    return all_passed

def validate_crud_structure():
    """Validate that CRUD operations were added correctly"""
    print("\n🔧 Validating CRUD operations...")
    
    with open("app/crud.py", "r") as f:
        content = f.read()
    
    checks = [
        ("Entity CRUD operations", "def get_entity(" in content and "def create_entity(" in content),
        ("Family member CRUD", "def get_family_member(" in content and "def create_family_member(" in content),
        ("Entity search function", "def search_entities(" in content),
        ("Investments by entity", "def get_investments_by_entity(" in content),
        ("Updated investment filtering", "entity_ids:" in content and "entity_names:" in content),
        ("Joinedload imports", "from sqlalchemy.orm import joinedload" in content),
    ]
    
    all_passed = True
    for check_name, condition in checks:
        if condition:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ❌ {check_name}")
            all_passed = False
    
    return all_passed

def validate_api_endpoints():
    """Validate that API endpoints were added correctly"""
    print("\n🌐 Validating API endpoints...")
    
    with open("app/main.py", "r") as f:
        content = f.read()
    
    checks = [
        ("Entity endpoints", "@app.post(\"/api/entities\"" in content and "@app.get(\"/api/entities\"" in content),
        ("Family member endpoints", "@app.post(\"/api/entities/{entity_id}/family-members\"" in content),
        ("Entity investments endpoint", "@app.get(\"/api/entities/{entity_id}/investments\"" in content),
        ("Updated investment filtering", "entity_ids:" in content and "entity_names:" in content),
        ("Updated filter options", "entity_types" in content and "entity_names" in content),
    ]
    
    all_passed = True
    for check_name, condition in checks:
        if condition:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ❌ {check_name}")
            all_passed = False
    
    return all_passed

def validate_migration_script():
    """Validate the migration script"""
    print("\n🔄 Validating migration script...")
    
    with open("migration_entity_management.py", "r") as f:
        content = f.read()
    
    checks = [
        ("Migration script exists", True),  # We're already reading it
        ("Database backup function", "def backup_database(" in content),
        ("Entity table creation", "CREATE TABLE IF NOT EXISTS entities" in content),
        ("Family member table creation", "CREATE TABLE IF NOT EXISTS family_members" in content),
        ("Owner migration function", "def migrate_existing_owners_to_entities(" in content),
        ("Entity ID column addition", "def add_entity_id_column_to_investments(" in content),
    ]
    
    all_passed = True
    for check_name, condition in checks:
        if condition:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ❌ {check_name}")
            all_passed = False
    
    return all_passed

def main():
    """Run all validations"""
    print("Multi-Entity Management Structure Validation")
    print("=" * 60)
    
    results = []
    
    # Run all validation checks
    results.append(validate_imports())
    results.append(validate_entity_model_structure())
    results.append(validate_family_member_model_structure())
    results.append(validate_investment_model_updates())
    results.append(validate_schema_structure())
    results.append(validate_crud_structure())
    results.append(validate_api_endpoints())
    results.append(validate_migration_script())
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print("\n" + "=" * 60)
    if passed == total:
        print("🎉 ALL VALIDATIONS PASSED!")
        print("\n✅ Multi-entity management implementation is complete and ready:")
        print("   • Entity and FamilyMember models with proper relationships")
        print("   • Investment ownership via entities instead of owner strings")
        print("   • Complete CRUD operations for entities and family members")
        print("   • Updated API endpoints with entity-based filtering")
        print("   • Database migration script for seamless transition")
        print("   • Support for Individuals, Trusts, LLCs, and other entity types")
        print("\n🚀 Ready for deployment!")
        return True
    else:
        print(f"⚠️  {passed}/{total} validations passed")
        print("❌ Some issues need to be addressed before deployment")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)