#!/usr/bin/env python3
"""
Password Hash Fix Script

This script fixes corrupted password hashes in the database by converting them to proper bcrypt format.
It handles:
1. Old SHA256 format hashes (sha256:...)
2. Plaintext passwords stored as hashes
3. Any other malformed hashes

The script will:
- Examine current password hashes
- Fix known users with proper bcrypt hashes
- Provide a report of changes made
"""

import sys
import os
from pathlib import Path

# Add the current directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Import required modules
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

# Import from app module
from app.models import User, Base

# Set up bcrypt context directly to avoid import issues
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)

# Database configuration
DATABASE_URL = "sqlite:///portfolio_tracker.db"

def main():
    """Main function to fix password hashes"""
    print("🔧 Password Hash Fix Script")
    print("=" * 50)

    # Create database engine and session
    engine = create_engine(DATABASE_URL, echo=False)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # First, examine current state
        print("\n📊 Current Password Hash Analysis:")
        print("-" * 50)

        users = db.query(User).all()
        if not users:
            print("❌ No users found in database!")
            return

        corrupted_users = []

        for user in users:
            hash_length = len(user.hashed_password) if user.hashed_password else 0
            hash_format = "Unknown"

            if user.hashed_password:
                if user.hashed_password.startswith('sha256:'):
                    hash_format = "SHA256 (Legacy)"
                elif user.hashed_password.startswith('$2b$'):
                    hash_format = "bcrypt (Correct)"
                elif len(user.hashed_password) < 20:
                    hash_format = "Plaintext (INSECURE)"
                else:
                    hash_format = "Unknown format"

            print(f"User: {user.username:15} | Email: {user.email:25} | Format: {hash_format:20} | Length: {hash_length}")

            # Mark as corrupted if not bcrypt
            if not user.hashed_password or not user.hashed_password.startswith('$2b$'):
                corrupted_users.append(user)

        if not corrupted_users:
            print("\n✅ All password hashes are already in correct bcrypt format!")
            return

        print(f"\n⚠️  Found {len(corrupted_users)} users with corrupted password hashes")

        # Ask for confirmation
        print("\n🔨 Password Fix Plan:")
        print("-" * 50)
        print("The following users will have their passwords reset:")

        # Define password mapping for known users
        password_mapping = {
            'admin': 'admin',
            'will': 'will',
            'manager': 'manager'
        }

        for user in corrupted_users:
            if user.username in password_mapping:
                print(f"✅ {user.username} -> Password will be set to '{password_mapping[user.username]}'")
            else:
                print(f"❓ {user.username} -> Will be set to default password 'password123' (PLEASE CHANGE!)")

        confirm = input(f"\nProceed with fixing {len(corrupted_users)} password hashes? (y/N): ").strip().lower()

        if confirm != 'y':
            print("❌ Operation cancelled by user")
            return

        # Fix the passwords
        print("\n🔧 Fixing password hashes...")
        print("-" * 50)

        fixed_count = 0

        for user in corrupted_users:
            old_hash = user.hashed_password

            # Determine new password
            if user.username in password_mapping:
                new_password = password_mapping[user.username]
            else:
                new_password = "password123"  # Default for unknown users

            # Generate bcrypt hash
            new_hash = get_password_hash(new_password)

            # Update the user
            user.hashed_password = new_hash

            print(f"✅ Fixed {user.username}: {old_hash[:30]}... -> {new_hash[:30]}...")
            fixed_count += 1

        # Commit changes
        db.commit()

        print(f"\n🎉 Successfully fixed {fixed_count} password hashes!")

        # Verify the fix
        print("\n🔍 Verification - Updated Password Hash Analysis:")
        print("-" * 50)

        db.refresh_all()  # Refresh all objects
        users = db.query(User).all()

        for user in users:
            hash_length = len(user.hashed_password) if user.hashed_password else 0
            hash_format = "bcrypt (Correct)" if user.hashed_password.startswith('$2b$') else "STILL CORRUPTED"
            print(f"User: {user.username:15} | Email: {user.email:25} | Format: {hash_format:20} | Length: {hash_length}")

        print("\n✅ Password hash fix completed successfully!")
        print("\n📝 Important Notes:")
        print("- All users can now log in with their assigned passwords")
        print("- Users with default passwords should change them immediately")
        print("- The authentication system now uses proper bcrypt hashing")

    except Exception as e:
        print(f"❌ Error fixing password hashes: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()