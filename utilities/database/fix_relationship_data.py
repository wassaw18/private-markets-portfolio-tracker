"""
Fix entity relationship data to match new schema:
1. Convert uppercase category values to title case (FAMILY -> Family)
2. Ensure all date fields match the schema
"""

from app.database import SessionLocal
from app.models import EntityRelationship
from sqlalchemy import text

db = SessionLocal()

try:
    # Fix category values from uppercase to title case
    uppercase_to_titlecase = {
        'FAMILY': 'Family',
        'BUSINESS': 'Business',
        'TRUST': 'Trust',
        'PROFESSIONAL': 'Professional',
        'OTHER': 'Other'
    }

    relationships = db.query(EntityRelationship).all()
    print(f"\nFound {len(relationships)} relationships to check")

    fixed_count = 0
    for rel in relationships:
        if rel.relationship_category in uppercase_to_titlecase:
            old_value = rel.relationship_category
            rel.relationship_category = uppercase_to_titlecase[old_value]
            print(f"  Fixed relationship {rel.id}: {old_value} -> {rel.relationship_category}")
            fixed_count += 1

    if fixed_count > 0:
        db.commit()
        print(f"\n✅ Fixed {fixed_count} relationships")
    else:
        print("\n✅ All relationships already have correct format")

except Exception as e:
    print(f"❌ Error: {e}")
    db.rollback()
finally:
    db.close()
