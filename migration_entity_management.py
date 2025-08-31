#!/usr/bin/env python3
"""
Migration script to add multi-entity management capabilities to the Private Markets Tracker

This script:
1. Creates entities and family_members tables
2. Migrates existing investment owner data to entities
3. Updates investments table to use entity_id foreign key
4. Preserves all existing investment data

Run this script after updating the models.py file with Entity and FamilyMember models.
"""

import os
import sqlite3
from datetime import datetime

def backup_database(db_path):
    """Create a backup of the database before migration"""
    if os.path.exists(db_path):
        backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        import shutil
        shutil.copy2(db_path, backup_path)
        print(f"Database backed up to: {backup_path}")
        return backup_path
    return None

def create_entities_table(cursor):
    """Create the entities table"""
    print("Creating entities table...")
    
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        tax_id TEXT UNIQUE,
        legal_address TEXT,
        formation_date DATE,
        is_active BOOLEAN DEFAULT 1,
        notes TEXT,
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """
    
    try:
        cursor.execute(create_table_sql)
        print("  ✓ Created entities table")
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_entity_name_type ON entities (name, entity_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_entities_name ON entities (name)")
        print("  ✓ Created entities indexes")
        
    except sqlite3.Error as e:
        print(f"  ✗ Error creating entities table: {e}")

def create_family_members_table(cursor):
    """Create the family_members table"""
    print("Creating family_members table...")
    
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY,
        entity_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE,
        relationship_type TEXT NOT NULL,
        primary_contact BOOLEAN DEFAULT 0,
        email TEXT,
        phone TEXT,
        address TEXT,
        is_active BOOLEAN DEFAULT 1,
        notes TEXT,
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_id) REFERENCES entities (id)
    )
    """
    
    try:
        cursor.execute(create_table_sql)
        print("  ✓ Created family_members table")
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_family_member_name ON family_members (last_name, first_name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_family_member_entity ON family_members (entity_id, relationship_type)")
        print("  ✓ Created family_members indexes")
        
    except sqlite3.Error as e:
        print(f"  ✗ Error creating family_members table: {e}")

def migrate_existing_owners_to_entities(cursor):
    """Convert existing owner strings to entities and update investments"""
    print("Migrating existing investment owners to entities...")
    
    try:
        # Get all unique owner names from investments
        cursor.execute("SELECT DISTINCT owner FROM investments WHERE owner IS NOT NULL")
        existing_owners = cursor.fetchall()
        
        if not existing_owners:
            print("  - No existing owners to migrate")
            return
        
        # Create entities for each unique owner
        owner_to_entity_id = {}
        for (owner_name,) in existing_owners:
            # Insert new entity (assuming Individual type for existing owners)
            cursor.execute("""
                INSERT INTO entities (name, entity_type, is_active, created_date, updated_date)
                VALUES (?, 'Individual', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (owner_name,))
            
            entity_id = cursor.lastrowid
            owner_to_entity_id[owner_name] = entity_id
            print(f"  ✓ Created entity for '{owner_name}' (ID: {entity_id})")
        
        print(f"  ✓ Created {len(owner_to_entity_id)} entities from existing owners")
        return owner_to_entity_id
        
    except sqlite3.Error as e:
        print(f"  ✗ Error migrating owners to entities: {e}")
        return {}

def add_entity_id_column_to_investments(cursor):
    """Add entity_id column to investments table"""
    print("Adding entity_id column to investments table...")
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(investments)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        
        if "entity_id" not in existing_columns:
            cursor.execute("ALTER TABLE investments ADD COLUMN entity_id INTEGER")
            print("  ✓ Added entity_id column to investments table")
            
            # Create index for the new foreign key
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_investments_entity_id ON investments (entity_id)")
            print("  ✓ Created index on entity_id")
        else:
            print("  - entity_id column already exists")
            
    except sqlite3.Error as e:
        print(f"  ✗ Error adding entity_id column: {e}")

def update_investments_with_entity_ids(cursor, owner_to_entity_id):
    """Update investments to use entity_id instead of owner"""
    print("Updating investments with entity_id references...")
    
    try:
        updated_count = 0
        for owner_name, entity_id in owner_to_entity_id.items():
            cursor.execute("""
                UPDATE investments 
                SET entity_id = ? 
                WHERE owner = ? AND entity_id IS NULL
            """, (entity_id, owner_name))
            updated_count += cursor.rowcount
        
        print(f"  ✓ Updated {updated_count} investment records with entity_id")
        
        # Verify all investments now have entity_id
        cursor.execute("SELECT COUNT(*) FROM investments WHERE entity_id IS NULL")
        null_count = cursor.fetchone()[0]
        if null_count > 0:
            print(f"  ⚠ Warning: {null_count} investments still have NULL entity_id")
        
    except sqlite3.Error as e:
        print(f"  ✗ Error updating investments with entity_ids: {e}")

def remove_owner_column_from_investments(cursor):
    """Remove the owner column from investments table (SQLite limitation workaround)"""
    print("Removing owner column from investments table...")
    
    try:
        # SQLite doesn't support DROP COLUMN, so we need to recreate the table
        # First, get the current table schema without the owner column
        cursor.execute("PRAGMA table_info(investments)")
        columns = cursor.fetchall()
        
        # Create new columns list without 'owner'
        new_columns = []
        column_definitions = []
        for col in columns:
            col_name = col[1]
            if col_name != 'owner':
                new_columns.append(col_name)
                col_type = col[2]
                nullable = "NOT NULL" if col[3] else ""
                default = f"DEFAULT {col[4]}" if col[4] is not None else ""
                pk = "PRIMARY KEY" if col[5] else ""
                column_definitions.append(f"{col_name} {col_type} {nullable} {default} {pk}".strip())
        
        # Create temporary table with new schema
        temp_table_sql = f"""
        CREATE TABLE investments_temp (
            {', '.join(column_definitions)}
        )
        """
        cursor.execute(temp_table_sql)
        
        # Copy data to temporary table
        columns_str = ', '.join(new_columns)
        cursor.execute(f"""
            INSERT INTO investments_temp ({columns_str})
            SELECT {columns_str} FROM investments
        """)
        
        # Drop original table and rename temp table
        cursor.execute("DROP TABLE investments")
        cursor.execute("ALTER TABLE investments_temp RENAME TO investments")
        
        # Recreate indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_investments_name ON investments (name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_investments_id ON investments (id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_investments_entity_id ON investments (entity_id)")
        
        print("  ✓ Removed owner column from investments table")
        
    except sqlite3.Error as e:
        print(f"  ✗ Error removing owner column: {e}")
        print("  ℹ Note: This step is optional - the owner column can remain for backward compatibility")

def main():
    """Main migration function"""
    print("Starting Multi-Entity Management Migration...")
    print("=" * 60)
    
    # Database path - check both possible names
    db_paths = ["portfolio_tracker.db", "portfolio.db"]
    db_path = None
    
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print(f"Database not found. Checked: {', '.join(db_paths)}")
        print("Migration will be applied when database is created.")
        return
    
    print(f"Using database: {db_path}")
    
    # Backup database
    backup_path = backup_database(db_path)
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Run migrations
        create_entities_table(cursor)
        create_family_members_table(cursor)
        
        # Migrate existing data
        owner_to_entity_id = migrate_existing_owners_to_entities(cursor)
        
        if owner_to_entity_id:
            add_entity_id_column_to_investments(cursor)
            update_investments_with_entity_ids(cursor, owner_to_entity_id)
            
            # Optionally remove owner column (commented out for safety)
            # remove_owner_column_from_investments(cursor)
        
        # Commit changes
        conn.commit()
        print("\n" + "=" * 60)
        print("✓ Multi-Entity Management Migration completed successfully!")
        print("\nNew features enabled:")
        print("  • Entity management (Individuals, Trusts, LLCs, etc.)")
        print("  • Family member tracking with relationships")
        print("  • Investment ownership via entities")
        
        if backup_path:
            print(f"\n✓ Original database backed up to: {backup_path}")
            
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        if backup_path:
            print(f"Restore from backup: {backup_path}")
        raise
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()