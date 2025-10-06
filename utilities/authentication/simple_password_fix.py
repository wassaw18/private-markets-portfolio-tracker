#!/usr/bin/env python3
"""
Simple Password Fix Script

This script fixes password hashes using pure bcrypt to avoid passlib compatibility issues.
"""

import sys
import os
from pathlib import Path
import bcrypt
import sqlite3

# Add the current directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.models import User, Tenant, Base, UserRole
from app.database import create_database, SessionLocal

def hash_password(password: str) -> str:
    """Hash a password using bcrypt directly"""
    # Convert to bytes and hash
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash using bcrypt directly"""
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        print(f"Verification error: {e}")
        return False

def main():
    """Main function to fix passwords using pure bcrypt"""
    print("🔧 Simple Password Fix Script (Pure bcrypt)")
    print("=" * 50)

    try:
        # Initialize database
        print("\n📊 Step 1: Initializing database...")
        create_database()
        print("✅ Database initialized")

        db = SessionLocal()

        # Get all users
        users = db.query(User).all()
        print(f"\n📊 Found {len(users)} users")

        # Standard passwords for users
        user_passwords = {
            'admin': 'admin',
            'will': 'will',
            'manager': 'manager'
        }

        print(f"\n🔧 Fixing password hashes...")
        print("-" * 50)

        for user in users:
            if user.username in user_passwords:
                password = user_passwords[user.username]

                # Create new bcrypt hash
                new_hash = hash_password(password)

                # Update user
                old_hash = user.hashed_password
                user.hashed_password = new_hash

                print(f"✅ Updated {user.username}: {len(old_hash)} chars -> {len(new_hash)} chars")

        # Commit changes
        db.commit()
        print("\n💾 Changes committed to database")

        # Test authentication
        print(f"\n🔍 Testing authentication...")
        print("-" * 50)

        all_good = True
        for user in users:
            if user.username in user_passwords:
                expected_password = user_passwords[user.username]

                if verify_password(expected_password, user.hashed_password):
                    print(f"✅ {user.username}: Login test PASSED")
                else:
                    print(f"❌ {user.username}: Login test FAILED")
                    all_good = False

        if all_good:
            print(f"\n🎉 All password hashes fixed successfully!")
            print(f"\n🔑 Login credentials:")
            for username, password in user_passwords.items():
                print(f"  - Username: {username}, Password: {password}")
        else:
            print(f"\n❌ Some authentication tests failed")

    except Exception as e:
        print(f"❌ Error: {e}")
        if 'db' in locals():
            db.rollback()
        raise
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    main()