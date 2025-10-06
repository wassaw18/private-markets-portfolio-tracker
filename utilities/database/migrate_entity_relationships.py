#!/usr/bin/env python3
"""
Migration script to add relationship_category column to entity_relationships table
and update existing data to use the new categorized relationship system.
"""

import sys
from sqlalchemy import text, create_engine
from app.database import engine, SessionLocal
from app.models import RelationshipCategory, FamilyRelationshipType, BusinessRelationshipType, TrustRelationshipType, ProfessionalRelationshipType, OtherRelationshipType

def migrate_entity_relationships():
    """Add relationship_category column and migrate existing data"""

    print("Starting entity relationships migration...")

    # Connect to database
    session = SessionLocal()

    try:
        # Step 1: Add the relationship_category column
        print("1. Adding relationship_category column...")
        session.execute(text("""
            ALTER TABLE entity_relationships
            ADD COLUMN IF NOT EXISTS relationship_category VARCHAR(20)
        """))
        session.commit()
        print("   ✓ relationship_category column added")

        # Step 2: Check if we have any existing relationships to migrate
        result = session.execute(text("SELECT COUNT(*) FROM entity_relationships"))
        count = result.scalar()
        print(f"   Found {count} existing relationships to migrate")

        if count > 0:
            # Step 3: Update existing relationships with default category and type mapping
            print("2. Updating existing relationships with categories...")

            # Map old relationship types to new categories
            # For now, we'll set everything to "OTHER" category with the original type as relationship_type
            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Other'
                WHERE relationship_category IS NULL
            """))
            session.commit()
            print("   ✓ Set default category for existing relationships")

            # Step 4: Update relationship_type to use string instead of enum
            print("3. Converting relationship_type to string format...")

            # First, let's see what relationship types exist
            existing_types_result = session.execute(text("""
                SELECT DISTINCT relationship_type, COUNT(*)
                FROM entity_relationships
                GROUP BY relationship_type
            """))

            print("   Current relationship types:")
            for row in existing_types_result:
                print(f"     {row[0]}: {row[1]} records")

            # We need to change the column type from enum to text to support our new categorized system
            # First, let's convert the enum column to text
            print("   Converting relationship_type column from enum to text...")

            # Step 1: Add a temporary column
            session.execute(text("""
                ALTER TABLE entity_relationships
                ADD COLUMN relationship_type_new TEXT
            """))

            # Step 2: Copy data from enum to text
            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_type_new = relationship_type::text
            """))

            # Step 3: Drop the old enum column
            session.execute(text("""
                ALTER TABLE entity_relationships
                DROP COLUMN relationship_type
            """))

            # Step 4: Rename the new column
            session.execute(text("""
                ALTER TABLE entity_relationships
                RENAME COLUMN relationship_type_new TO relationship_type
            """))

            # Step 5: Map old enum values to new categorized values
            # Map based on the old enum values to appropriate categories and types
            print("   Mapping old relationship types to new categories...")

            # Trust relationships
            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Trust',
                    relationship_type = 'Beneficiary'
                WHERE relationship_type IN ('PRIMARY_BENEFICIARY', 'CONTINGENT_BENEFICIARY', 'BENEFICIARY')
            """))

            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Trust',
                    relationship_type = 'Grantor'
                WHERE relationship_type = 'GRANTOR'
            """))

            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Trust',
                    relationship_type = 'Trustee'
                WHERE relationship_type IN ('TRUSTEE', 'SUCCESSOR_TRUSTEE')
            """))

            # Business relationships
            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Business',
                    relationship_type = 'Shareholder'
                WHERE relationship_type = 'SHAREHOLDER'
            """))

            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Business',
                    relationship_type = 'Board Member'
                WHERE relationship_type = 'BOARD_MEMBER'
            """))

            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Business',
                    relationship_type = 'Manager'
                WHERE relationship_type IN ('MANAGER', 'MANAGING_MEMBER')
            """))

            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Business',
                    relationship_type = 'Member'
                WHERE relationship_type = 'MEMBER'
            """))

            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Business',
                    relationship_type = 'Partner'
                WHERE relationship_type = 'PARTNER'
            """))

            # Professional relationships
            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Professional',
                    relationship_type = 'Advisor'
                WHERE relationship_type IN ('ADVISOR', 'ACCOUNTANT', 'ATTORNEY')
            """))

            # Family relationships
            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Family',
                    relationship_type = 'Guardian'
                WHERE relationship_type = 'GUARDIAN'
            """))

            # Other/Legacy relationships
            session.execute(text("""
                UPDATE entity_relationships
                SET relationship_category = 'Other',
                    relationship_type = 'Other'
                WHERE relationship_type IN ('OTHER', 'TRUST_RELATIONSHIP', 'CORPORATE_RELATIONSHIP',
                                           'FAMILY_RELATIONSHIP', 'OWNERSHIP_RELATIONSHIP',
                                           'PROFESSIONAL_RELATIONSHIP', 'VOTING_INTEREST',
                                           'NON_VOTING_INTEREST', 'POWER_OF_ATTORNEY', 'REMAINDERMAN', 'OFFICER')
            """))
            session.commit()
            print("   ✓ Updated relationship types to new format")

        # Step 5: Set NOT NULL constraint on relationship_category
        print("4. Setting NOT NULL constraint on relationship_category...")
        session.execute(text("""
            ALTER TABLE entity_relationships
            ALTER COLUMN relationship_category SET NOT NULL
        """))
        session.commit()
        print("   ✓ Added NOT NULL constraint")

        # Step 6: Add default values for any NULL relationship_type
        print("5. Ensuring all relationship_type values are set...")
        session.execute(text("""
            UPDATE entity_relationships
            SET relationship_type = 'Other'
            WHERE relationship_type IS NULL OR relationship_type = ''
        """))
        session.commit()
        print("   ✓ Set default relationship_type values")

        print("\n✅ Migration completed successfully!")
        print(f"   Migrated {count} existing relationships")
        print("   Added relationship_category column")
        print("   Updated relationship types to new categorized system")

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()

def verify_migration():
    """Verify the migration was successful"""
    print("\nVerifying migration...")

    session = SessionLocal()
    try:
        # Check that the column exists and has data
        result = session.execute(text("""
            SELECT
                relationship_category,
                relationship_type,
                COUNT(*) as count
            FROM entity_relationships
            GROUP BY relationship_category, relationship_type
            ORDER BY relationship_category, relationship_type
        """))

        print("Migration verification:")
        print("Category | Type | Count")
        print("-" * 30)
        for row in result:
            print(f"{row[0]} | {row[1]} | {row[2]}")

        # Check for any NULL values
        null_check = session.execute(text("""
            SELECT COUNT(*) FROM entity_relationships
            WHERE relationship_category IS NULL OR relationship_type IS NULL
        """))
        null_count = null_check.scalar()

        if null_count == 0:
            print("\n✅ Verification passed - no NULL values found")
        else:
            print(f"\n⚠️  Warning: {null_count} records have NULL values")

    except Exception as e:
        print(f"\n❌ Verification failed: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    try:
        migrate_entity_relationships()
        verify_migration()
    except Exception as e:
        print(f"Migration script failed: {e}")
        sys.exit(1)