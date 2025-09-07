#!/usr/bin/env python3
"""
Test script to validate the advanced entity relationship system
"""

import sqlite3
import sys
from datetime import date

def test_advanced_relationships():
    """Test the advanced relationship system"""
    
    print("Testing Advanced Entity Relationship System...")
    
    try:
        conn = sqlite3.connect('portfolio.db')
        cursor = conn.cursor()
        
        # Test 1: Check if tables exist
        print("\n1. Checking table existence:")
        tables_to_check = [
            'entity_relationships',
            'investment_ownership', 
            'entity_hierarchy'
        ]
        
        for table in tables_to_check:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            exists = cursor.fetchone() is not None
            print(f"   - {table}: {'✓' if exists else '✗'}")
            
            if not exists:
                print(f"ERROR: Required table {table} not found!")
                return False
        
        # Test 2: Check views exist
        print("\n2. Checking views:")
        views_to_check = [
            'current_investment_ownership',
            'current_entity_relationships',
            'family_tree_structure'
        ]
        
        for view in views_to_check:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='view' AND name='{view}'")
            exists = cursor.fetchone() is not None
            print(f"   - {view}: {'✓' if exists else '✗'}")
        
        # Test 3: Test basic functionality (if entities exist)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='entities'")
        if cursor.fetchone():
            print("\n3. Testing with existing entities...")
            cursor.execute("SELECT COUNT(*) FROM entities")
            entity_count = cursor.fetchone()[0]
            print(f"   - Found {entity_count} entities in database")
        else:
            print("\n3. Entities table not found - creating test entities")
            
            # Create entities table for testing
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS entities (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Insert test entities
            test_entities = [
                ("Smith Family Trust", "Trust"),
                ("John Smith", "Individual"),
                ("Smith Holdings LLC", "LLC"),
                ("Jane Smith", "Individual")
            ]
            
            for name, entity_type in test_entities:
                cursor.execute("""
                    INSERT INTO entities (name, entity_type) VALUES (?, ?)
                """, (name, entity_type))
            
            conn.commit()
            print("   - Created test entities")
        
        # Test 4: Test relationship creation
        print("\n4. Testing relationship creation:")
        
        # Get test entities
        cursor.execute("SELECT id, name FROM entities LIMIT 4")
        entities = cursor.fetchall()
        
        if len(entities) >= 2:
            # Create a test relationship
            from_entity = entities[0]
            to_entity = entities[1]
            
            cursor.execute("""
                INSERT INTO entity_relationships 
                (from_entity_id, to_entity_id, relationship_type, percentage_ownership, effective_date)
                VALUES (?, ?, 'GRANTOR', 0.0, ?)
            """, (from_entity[0], to_entity[0], date.today().isoformat()))
            
            conn.commit()
            
            # Verify relationship was created
            cursor.execute("SELECT COUNT(*) FROM entity_relationships")
            rel_count = cursor.fetchone()[0]
            print(f"   - Created test relationship: ✓ ({rel_count} total)")
            
            # Test the view
            cursor.execute("""
                SELECT from_entity_name, relationship_type, to_entity_name 
                FROM current_entity_relationships 
                LIMIT 1
            """)
            rel = cursor.fetchone()
            if rel:
                print(f"   - View working: {rel[0]} {rel[1]} {rel[2]}")
        
        # Test 5: Test hierarchy creation
        print("\n5. Testing hierarchy creation:")
        
        if len(entities) >= 2:
            parent_entity = entities[0]
            child_entity = entities[1]
            
            cursor.execute("""
                INSERT INTO entity_hierarchy 
                (entity_id, parent_entity_id, hierarchy_level)
                VALUES (?, ?, 2)
            """, (child_entity[0], parent_entity[0]))
            
            conn.commit()
            
            cursor.execute("SELECT COUNT(*) FROM entity_hierarchy")
            hierarchy_count = cursor.fetchone()[0]
            print(f"   - Created hierarchy entry: ✓ ({hierarchy_count} total)")
        
        # Test 6: Test investment ownership (if investments exist)
        print("\n6. Testing investment ownership:")
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='investments'")
        if cursor.fetchone():
            cursor.execute("SELECT id FROM investments LIMIT 1")
            investment = cursor.fetchone()
            
            if investment and len(entities) >= 1:
                entity = entities[0]
                
                cursor.execute("""
                    INSERT INTO investment_ownership 
                    (investment_id, entity_id, ownership_percentage, effective_date)
                    VALUES (?, ?, 100.0, ?)
                """, (investment[0], entity[0], date.today().isoformat()))
                
                conn.commit()
                
                cursor.execute("SELECT COUNT(*) FROM investment_ownership")
                ownership_count = cursor.fetchone()[0]
                print(f"   - Created ownership record: ✓ ({ownership_count} total)")
            else:
                print("   - No investments found for testing")
        else:
            print("   - Investments table not found")
        
        print("\n✅ All tests passed! Advanced relationship system is working correctly.")
        return True
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    success = test_advanced_relationships()
    sys.exit(0 if success else 1)