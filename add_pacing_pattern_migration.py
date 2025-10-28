"""
Migration script to add pacing_pattern column to investments table
"""
from sqlalchemy import create_engine, text
from app.database import DATABASE_URL
from app.models import PacingPattern

def add_pacing_pattern_column():
    """Add pacing_pattern column to investments table"""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='investments' AND column_name='pacing_pattern'
        """))

        if result.fetchone():
            print("✅ pacing_pattern column already exists")
            return

        # Create ENUM type if it doesn't exist
        print("Creating PacingPattern ENUM type...")
        conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE pacingpattern AS ENUM (
                    'Traditional PE',
                    'Venture Capital',
                    'Immediate Steady Yield',
                    'Immediate Bullet',
                    'Real Estate Core',
                    'Real Estate Opportunistic',
                    'Credit Fund',
                    'Custom'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        conn.commit()

        # Add column
        print("Adding pacing_pattern column to investments table...")
        conn.execute(text("""
            ALTER TABLE investments
            ADD COLUMN pacing_pattern pacingpattern
        """))
        conn.commit()

        print("✅ Successfully added pacing_pattern column")

if __name__ == "__main__":
    add_pacing_pattern_column()
