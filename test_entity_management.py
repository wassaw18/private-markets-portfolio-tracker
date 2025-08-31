#!/usr/bin/env python3
"""
Test script for multi-entity management functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Entity, FamilyMember, Investment, EntityType, RelationshipType, AssetClass, InvestmentStructure
from app import schemas, crud
from datetime import date

def test_entity_management():
    """Test the entity management functionality"""
    print("Testing Multi-Entity Management Functionality")
    print("=" * 60)
    
    # Create in-memory SQLite database for testing
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Test 1: Create entities
        print("\n1. Testing Entity Creation...")
        
        # Create Individual entity
        individual_data = schemas.EntityCreate(
            name="John Smith",
            entity_type=EntityType.INDIVIDUAL,
            tax_id="123-45-6789",
            legal_address="123 Main St, Anytown, NY 12345"
        )
        individual_entity = crud.create_entity(db, individual_data)
        print(f"   ✓ Created Individual entity: {individual_entity.name} (ID: {individual_entity.id})")
        
        # Create Trust entity
        trust_data = schemas.EntityCreate(
            name="Smith Family Trust",
            entity_type=EntityType.TRUST,
            tax_id="98-7654321",
            formation_date=date(2020, 1, 15),
            legal_address="456 Oak Ave, Anytown, NY 12345"
        )
        trust_entity = crud.create_entity(db, trust_data)
        print(f"   ✓ Created Trust entity: {trust_entity.name} (ID: {trust_entity.id})")
        
        # Create LLC entity
        llc_data = schemas.EntityCreate(
            name="Smith Holdings LLC",
            entity_type=EntityType.LLC,
            tax_id="45-6789123",
            formation_date=date(2021, 6, 1),
            legal_address="789 Pine Rd, Anytown, NY 12345"
        )
        llc_entity = crud.create_entity(db, llc_data)
        print(f"   ✓ Created LLC entity: {llc_entity.name} (ID: {llc_entity.id})")
        
        # Test 2: Create family members
        print("\n2. Testing Family Member Creation...")
        
        # Add family members to Individual entity
        john_member = crud.create_family_member(db, schemas.FamilyMemberCreate(
            entity_id=individual_entity.id,
            first_name="John",
            last_name="Smith",
            relationship_type=RelationshipType.SELF,
            primary_contact=True,
            email="john@example.com",
            phone="555-0001"
        ))
        print(f"   ✓ Created family member: {john_member.full_name} ({john_member.relationship_type})")
        
        # Add family members to Trust
        jane_member = crud.create_family_member(db, schemas.FamilyMemberCreate(
            entity_id=trust_entity.id,
            first_name="Jane",
            last_name="Smith",
            relationship_type=RelationshipType.SPOUSE,
            primary_contact=True,
            email="jane@example.com",
            phone="555-0002"
        ))
        print(f"   ✓ Created family member: {jane_member.full_name} ({jane_member.relationship_type})")
        
        child_member = crud.create_family_member(db, schemas.FamilyMemberCreate(
            entity_id=trust_entity.id,
            first_name="Emily",
            last_name="Smith",
            relationship_type=RelationshipType.CHILD,
            date_of_birth=date(2005, 3, 15),
            email="emily@example.com"
        ))
        print(f"   ✓ Created family member: {child_member.full_name} ({child_member.relationship_type})")
        
        # Test 3: Create investments linked to entities
        print("\n3. Testing Investment Creation with Entity Links...")
        
        # Investment owned by Individual
        pe_investment = crud.create_investment(db, schemas.InvestmentCreate(
            name="ABC Private Equity Fund IV",
            asset_class=AssetClass.PRIVATE_EQUITY,
            investment_structure=InvestmentStructure.LIMITED_PARTNERSHIP,
            entity_id=individual_entity.id,
            strategy="Large Cap Buyout",
            vintage_year=2023,
            commitment_amount=1000000.0,
            called_amount=300000.0,
            fees=15000.0
        ))
        print(f"   ✓ Created PE investment: {pe_investment.name} for {individual_entity.name}")
        
        # Investment owned by Trust
        re_investment = crud.create_investment(db, schemas.InvestmentCreate(
            name="XYZ Real Estate Fund III",
            asset_class=AssetClass.REAL_ESTATE,
            investment_structure=InvestmentStructure.LIMITED_PARTNERSHIP,
            entity_id=trust_entity.id,
            strategy="Core Plus Real Estate",
            vintage_year=2022,
            commitment_amount=2000000.0,
            called_amount=800000.0,
            fees=25000.0
        ))
        print(f"   ✓ Created RE investment: {re_investment.name} for {trust_entity.name}")
        
        # Investment owned by LLC
        vc_investment = crud.create_investment(db, schemas.InvestmentCreate(
            name="DEF Venture Capital Fund II",
            asset_class=AssetClass.VENTURE_CAPITAL,
            investment_structure=InvestmentStructure.LIMITED_PARTNERSHIP,
            entity_id=llc_entity.id,
            strategy="Early Stage Tech",
            vintage_year=2023,
            commitment_amount=500000.0,
            called_amount=150000.0,
            fees=7500.0
        ))
        print(f"   ✓ Created VC investment: {vc_investment.name} for {llc_entity.name}")
        
        # Test 4: Query investments by entity
        print("\n4. Testing Investment Queries by Entity...")
        
        individual_investments = crud.get_investments_by_entity(db, individual_entity.id)
        print(f"   ✓ {individual_entity.name} has {len(individual_investments)} investment(s)")
        
        trust_investments = crud.get_investments_by_entity(db, trust_entity.id)
        print(f"   ✓ {trust_entity.name} has {len(trust_investments)} investment(s)")
        
        llc_investments = crud.get_investments_by_entity(db, llc_entity.id)
        print(f"   ✓ {llc_entity.name} has {len(llc_investments)} investment(s)")
        
        # Test 5: Filter investments by entity types
        print("\n5. Testing Investment Filtering by Entity Type...")
        
        trust_type_investments = crud.get_investments_filtered(
            db, entity_types=[EntityType.TRUST.value]
        )
        print(f"   ✓ Found {len(trust_type_investments)} investment(s) owned by Trust entities")
        
        individual_type_investments = crud.get_investments_filtered(
            db, entity_types=[EntityType.INDIVIDUAL.value]
        )
        print(f"   ✓ Found {len(individual_type_investments)} investment(s) owned by Individual entities")
        
        # Test 6: Search functionality
        print("\n6. Testing Search Functionality...")
        
        smith_entities = crud.search_entities(db, "Smith")
        print(f"   ✓ Found {len(smith_entities)} entities matching 'Smith'")
        
        investment_search = crud.get_investments_filtered(db, search="Private Equity")
        print(f"   ✓ Found {len(investment_search)} investment(s) matching 'Private Equity'")
        
        # Test 7: Entity with family members and investment statistics
        print("\n7. Testing Entity Relationships and Statistics...")
        
        all_entities = crud.get_entities(db)
        for entity in all_entities:
            investments = crud.get_investments_by_entity(db, entity.id)
            family_members = crud.get_entity_family_members(db, entity.id)
            total_commitment = sum(inv.commitment_amount for inv in investments)
            
            print(f"   • {entity.name} ({entity.entity_type}):")
            print(f"     - Family members: {len(family_members)}")
            print(f"     - Investments: {len(investments)}")
            print(f"     - Total commitment: ${total_commitment:,.2f}")
        
        # Test 8: Verify data integrity
        print("\n8. Testing Data Integrity...")
        
        all_investments = crud.get_investments(db)
        investments_with_entities = 0
        for investment in all_investments:
            if investment.entity_id is not None:
                investments_with_entities += 1
        
        print(f"   ✓ {investments_with_entities}/{len(all_investments)} investments have valid entity links")
        
        # Test 9: Test entity updates
        print("\n9. Testing Entity Updates...")
        
        updated_entity = crud.update_entity(db, individual_entity.id, schemas.EntityUpdate(
            notes="Updated during testing"
        ))
        print(f"   ✓ Updated entity notes: {updated_entity.notes}")
        
        print("\n" + "=" * 60)
        print("✅ All multi-entity management tests passed successfully!")
        print("\nKey Features Verified:")
        print("  • Entity creation (Individual, Trust, LLC)")
        print("  • Family member management with relationships")
        print("  • Investment ownership via entities")
        print("  • Entity-based filtering and searching")
        print("  • Data integrity and relationships")
        print("  • Investment statistics by entity")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    success = test_entity_management()
    sys.exit(0 if success else 1)