#!/usr/bin/env python3
"""
Advanced Entity Relationship Management Migration
Creates tables for complex entity relationships and multi-entity investment ownership
"""

import sqlite3
import os
from datetime import datetime

def run_migration():
    db_path = "portfolio.db"
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Starting Advanced Entity Relationship Migration...")
        
        # 1. Create EntityRelationship table for complex relationships
        print("Creating EntityRelationship table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS entity_relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_entity_id INTEGER NOT NULL,
                to_entity_id INTEGER NOT NULL,
                relationship_type VARCHAR(50) NOT NULL,
                relationship_subtype VARCHAR(50),
                percentage_ownership FLOAT DEFAULT 0.0,
                is_voting_interest BOOLEAN DEFAULT TRUE,
                effective_date DATE,
                end_date DATE,
                notes TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (from_entity_id) REFERENCES entities (id) ON DELETE CASCADE,
                FOREIGN KEY (to_entity_id) REFERENCES entities (id) ON DELETE CASCADE,
                CHECK (percentage_ownership >= 0 AND percentage_ownership <= 100),
                CHECK (from_entity_id != to_entity_id)
            )
        """)
        
        # Add indexes for performance
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_entity_rel_from_entity ON entity_relationships (from_entity_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_entity_rel_to_entity ON entity_relationships (to_entity_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_entity_rel_type ON entity_relationships (relationship_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_entity_rel_active ON entity_relationships (is_active, effective_date)")
        
        # 2. Create InvestmentOwnership table for multi-entity investment ownership
        print("Creating InvestmentOwnership table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS investment_ownership (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                investment_id INTEGER NOT NULL,
                entity_id INTEGER NOT NULL,
                ownership_percentage FLOAT NOT NULL,
                ownership_type VARCHAR(50) DEFAULT 'DIRECT',
                is_beneficial_owner BOOLEAN DEFAULT TRUE,
                effective_date DATE NOT NULL,
                end_date DATE,
                notes TEXT,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (investment_id) REFERENCES investments (id) ON DELETE CASCADE,
                FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE,
                CHECK (ownership_percentage > 0 AND ownership_percentage <= 100)
            )
        """)
        
        # Add indexes for ownership table
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_inv_ownership_investment ON investment_ownership (investment_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_inv_ownership_entity ON investment_ownership (entity_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_inv_ownership_effective ON investment_ownership (effective_date, end_date)")
        
        # 3. Create EntityHierarchy table for family tree / org chart visualization
        print("Creating EntityHierarchy table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS entity_hierarchy (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id INTEGER NOT NULL,
                parent_entity_id INTEGER,
                hierarchy_level INTEGER DEFAULT 1,
                hierarchy_path TEXT,
                sort_order INTEGER DEFAULT 0,
                is_primary_parent BOOLEAN DEFAULT TRUE,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE,
                FOREIGN KEY (parent_entity_id) REFERENCES entities (id) ON DELETE CASCADE
            )
        """)
        
        # Add indexes for hierarchy
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_entity_hierarchy_entity ON entity_hierarchy (entity_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_entity_hierarchy_parent ON entity_hierarchy (parent_entity_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_entity_hierarchy_level ON entity_hierarchy (hierarchy_level)")
        
        # 4. Migrate existing investment ownership to new system
        print("Migrating existing investment ownership...")
        
        # Check if investments table exists first
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='investments'")
        investments_table_exists = cursor.fetchone() is not None
        
        existing_investments = []
        if investments_table_exists:
            # Get all existing investments
            cursor.execute("""
                SELECT id, entity_id, name 
                FROM investments 
                WHERE entity_id IS NOT NULL
            """)
            existing_investments = cursor.fetchall()
        else:
            print("Investments table not found, skipping investment ownership migration")
        
        # Create ownership records for existing investments (100% ownership)
        for investment_id, entity_id, investment_name in existing_investments:
            cursor.execute("""
                INSERT INTO investment_ownership 
                (investment_id, entity_id, ownership_percentage, ownership_type, 
                 effective_date, is_beneficial_owner, notes)
                VALUES (?, ?, 100.0, 'DIRECT', date('now'), TRUE, 
                       'Migrated from single-entity ownership system')
            """, (investment_id, entity_id))
        
        # 5. Add new relationship types to support advanced relationships
        print("Adding extended relationship type support...")
        
        # We'll handle the enum extension in the models.py update since SQLite doesn't support ALTER ENUM
        # This will be handled in the backend models update
        
        # 6. Create trigger to maintain hierarchy paths
        print("Creating hierarchy maintenance trigger...")
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS update_hierarchy_path
            AFTER INSERT ON entity_hierarchy
            BEGIN
                UPDATE entity_hierarchy 
                SET hierarchy_path = CASE
                    WHEN NEW.parent_entity_id IS NULL THEN CAST(NEW.entity_id AS TEXT)
                    ELSE (
                        SELECT hierarchy_path || '.' || CAST(NEW.entity_id AS TEXT)
                        FROM entity_hierarchy 
                        WHERE entity_id = NEW.parent_entity_id
                        LIMIT 1
                    )
                END
                WHERE id = NEW.id;
            END
        """)
        
        # 7. Create investment ownership validation trigger
        print("Creating ownership validation trigger...")
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS validate_ownership_total
            BEFORE INSERT ON investment_ownership
            BEGIN
                SELECT CASE
                    WHEN (
                        SELECT COALESCE(SUM(ownership_percentage), 0) + NEW.ownership_percentage
                        FROM investment_ownership 
                        WHERE investment_id = NEW.investment_id 
                        AND (end_date IS NULL OR end_date > date('now'))
                    ) > 100.01 -- Allow small rounding tolerance
                    THEN RAISE(ABORT, 'Total ownership percentage cannot exceed 100%')
                END;
            END
        """)
        
        # 8. Create views for easy querying
        print("Creating helpful views...")
        
        # View for current investment ownership
        cursor.execute("""
            CREATE VIEW IF NOT EXISTS current_investment_ownership AS
            SELECT 
                io.investment_id,
                i.name as investment_name,
                io.entity_id,
                e.name as entity_name,
                e.entity_type,
                io.ownership_percentage,
                io.ownership_type,
                io.is_beneficial_owner,
                io.effective_date,
                io.notes
            FROM investment_ownership io
            JOIN investments i ON io.investment_id = i.id
            JOIN entities e ON io.entity_id = e.id
            WHERE io.end_date IS NULL OR io.end_date > date('now')
            ORDER BY io.investment_id, io.ownership_percentage DESC
        """)
        
        # View for entity relationships
        cursor.execute("""
            CREATE VIEW IF NOT EXISTS current_entity_relationships AS
            SELECT 
                er.id,
                er.from_entity_id,
                e1.name as from_entity_name,
                e1.entity_type as from_entity_type,
                er.to_entity_id,
                e2.name as to_entity_name,
                e2.entity_type as to_entity_type,
                er.relationship_type,
                er.relationship_subtype,
                er.percentage_ownership,
                er.is_voting_interest,
                er.effective_date,
                er.notes
            FROM entity_relationships er
            JOIN entities e1 ON er.from_entity_id = e1.id
            JOIN entities e2 ON er.to_entity_id = e2.id
            WHERE er.is_active = TRUE 
            AND (er.end_date IS NULL OR er.end_date > date('now'))
            ORDER BY er.from_entity_id, er.relationship_type
        """)
        
        # View for family tree structure
        cursor.execute("""
            CREATE VIEW IF NOT EXISTS family_tree_structure AS
            SELECT 
                eh.entity_id,
                e.name as entity_name,
                e.entity_type,
                eh.parent_entity_id,
                pe.name as parent_entity_name,
                pe.entity_type as parent_entity_type,
                eh.hierarchy_level,
                eh.hierarchy_path,
                eh.sort_order
            FROM entity_hierarchy eh
            JOIN entities e ON eh.entity_id = e.id
            LEFT JOIN entities pe ON eh.parent_entity_id = pe.id
            ORDER BY eh.hierarchy_level, eh.sort_order, e.name
        """)
        
        conn.commit()
        
        # 9. Verify migration
        print("Verifying migration...")
        cursor.execute("SELECT COUNT(*) FROM entity_relationships")
        rel_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM investment_ownership")
        ownership_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM entity_hierarchy")
        hierarchy_count = cursor.fetchone()[0]
        
        print(f"Migration completed successfully!")
        print(f"- Entity relationships: {rel_count} records")
        print(f"- Investment ownership: {ownership_count} records")
        print(f"- Entity hierarchy: {hierarchy_count} records")
        
        # Create sample data for demonstration (if entities exist)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='entities'")
        if cursor.fetchone():
            print("Creating sample relationship data...")
            create_sample_relationships(cursor)
        else:
            print("Entities table not found, skipping sample data creation")
        
        conn.commit()
        print("Sample data created successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    
    finally:
        conn.close()

def create_sample_relationships(cursor):
    """Create sample relationship data to demonstrate the new system"""
    
    # Get some existing entities for sample relationships
    try:
        cursor.execute("SELECT id, name, entity_type FROM entities LIMIT 5")
        entities = cursor.fetchall()
    except Exception as e:
        print(f"Could not load entities for sample data: {e}")
        return
    
    if len(entities) < 2:
        print("Not enough entities for sample relationships")
        return
    
    # Sample trust relationships
    if len(entities) >= 3:
        # Create a sample trust relationship
        cursor.execute("""
            INSERT INTO entity_relationships 
            (from_entity_id, to_entity_id, relationship_type, relationship_subtype, 
             percentage_ownership, is_voting_interest, effective_date, notes)
            VALUES (?, ?, 'TRUST_RELATIONSHIP', 'GRANTOR', 0.0, FALSE, date('now'),
                   'Sample grantor relationship for family trust')
        """, (entities[0][0], entities[1][0]))
        
        cursor.execute("""
            INSERT INTO entity_relationships 
            (from_entity_id, to_entity_id, relationship_type, relationship_subtype, 
             percentage_ownership, is_voting_interest, effective_date, notes)
            VALUES (?, ?, 'TRUST_RELATIONSHIP', 'BENEFICIARY', 0.0, FALSE, date('now'),
                   'Sample beneficiary relationship for family trust')
        """, (entities[1][0], entities[2][0]))
    
    # Sample corporate relationships
    if len(entities) >= 4:
        cursor.execute("""
            INSERT INTO entity_relationships 
            (from_entity_id, to_entity_id, relationship_type, relationship_subtype, 
             percentage_ownership, is_voting_interest, effective_date, notes)
            VALUES (?, ?, 'CORPORATE_RELATIONSHIP', 'SHAREHOLDER', 45.0, TRUE, date('now'),
                   'Sample shareholding in family LLC')
        """, (entities[0][0], entities[3][0]))
        
        cursor.execute("""
            INSERT INTO entity_relationships 
            (from_entity_id, to_entity_id, relationship_type, relationship_subtype, 
             percentage_ownership, is_voting_interest, effective_date, notes)
            VALUES (?, ?, 'CORPORATE_RELATIONSHIP', 'MANAGER', 0.0, TRUE, date('now'),
                   'Sample manager role in family LLC')
        """, (entities[1][0], entities[3][0]))
    
    # Sample hierarchy
    cursor.execute("""
        INSERT INTO entity_hierarchy (entity_id, parent_entity_id, hierarchy_level, sort_order)
        VALUES (?, NULL, 1, 1)
    """, (entities[0][0],))
    
    if len(entities) >= 2:
        cursor.execute("""
            INSERT INTO entity_hierarchy (entity_id, parent_entity_id, hierarchy_level, sort_order)
            VALUES (?, ?, 2, 1)
        """, (entities[1][0], entities[0][0]))
    
    # Sample multi-entity investment ownership (if there are investments)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='investments'")
    if cursor.fetchone():
        cursor.execute("SELECT id FROM investments LIMIT 1")
        investment = cursor.fetchone()
    else:
        investment = None
    
    if investment and len(entities) >= 2:
        # Update existing ownership to 60%
        cursor.execute("""
            UPDATE investment_ownership 
            SET ownership_percentage = 60.0, 
                notes = 'Updated to 60% for multi-entity ownership demo'
            WHERE investment_id = ? AND entity_id = ?
        """, (investment[0], entities[0][0]))
        
        # Add 40% ownership to another entity
        cursor.execute("""
            INSERT INTO investment_ownership 
            (investment_id, entity_id, ownership_percentage, ownership_type, 
             effective_date, is_beneficial_owner, notes)
            VALUES (?, ?, 40.0, 'DIRECT', date('now'), TRUE, 
                   'Sample joint ownership - 40% stake')
        """, (investment[0], entities[1][0]))

if __name__ == "__main__":
    run_migration()