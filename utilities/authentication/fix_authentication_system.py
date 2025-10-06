#!/usr/bin/env python3
"""
Comprehensive Authentication System Fix

This script:
1. Initializes the database with proper table structure
2. Creates necessary tenants and users
3. Fixes all password hashes to use proper bcrypt format
4. Verifies the authentication system works correctly

Fixes the critical authentication issue where password hashes are corrupted.
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
from app.models import User, Tenant, Base, UserRole
from app.database import create_database, SessionLocal

# Set up bcrypt context with fallback handling
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
except Exception as e:
    print(f"⚠️  Bcrypt setup issue: {e}")
    # Fallback: use bcrypt directly
    import bcrypt

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    try:
        # Ensure password is not too long for bcrypt (72 bytes max)
        if len(password.encode('utf-8')) > 72:
            password = password[:72]

        # Try using passlib first
        if 'pwd_context' in globals():
            return pwd_context.hash(password)
        else:
            # Fallback to direct bcrypt
            import bcrypt
            salt = bcrypt.gensalt()
            return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    except Exception as e:
        print(f"Error hashing password: {e}")
        # Last resort fallback
        import bcrypt
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        # Ensure password is not too long for bcrypt (72 bytes max)
        if len(plain_password.encode('utf-8')) > 72:
            plain_password = plain_password[:72]

        # Try using passlib first
        if 'pwd_context' in globals():
            return pwd_context.verify(plain_password, hashed_password)
        else:
            # Fallback to direct bcrypt
            import bcrypt
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        print(f"Error verifying password: {e}")
        return False

def main():
    """Main function to fix the authentication system"""
    print("🔧 Comprehensive Authentication System Fix")
    print("=" * 60)

    try:
        # Step 1: Initialize database with proper schema
        print("\n📊 Step 1: Initializing database schema...")
        print("-" * 50)

        create_database()
        print("✅ Database schema initialized successfully")

        # Step 2: Check current user state
        print("\n📊 Step 2: Analyzing current user state...")
        print("-" * 50)

        db = SessionLocal()

        # Get all users
        users = db.query(User).all()
        tenants = db.query(Tenant).all()

        print(f"Found {len(tenants)} tenants and {len(users)} users")

        if users:
            print("\nCurrent users:")
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

                print(f"  - {user.username:15} | {user.email:25} | {hash_format:20} | Length: {hash_length}")

        # Step 3: Create default tenant if none exists
        print("\n🏢 Step 3: Ensuring default tenant exists...")
        print("-" * 50)

        default_tenant = db.query(Tenant).first()
        if not default_tenant:
            default_tenant = Tenant(
                name="Default Family Office",
                status="Active"
            )
            db.add(default_tenant)
            db.flush()
            print(f"✅ Created default tenant: {default_tenant.name} (ID: {default_tenant.id})")
        else:
            print(f"✅ Using existing tenant: {default_tenant.name} (ID: {default_tenant.id})")

        # Step 4: Create/fix standard users
        print("\n👤 Step 4: Creating/fixing standard users...")
        print("-" * 50)

        # Define standard users with their passwords
        standard_users = [
            {
                'username': 'admin',
                'email': 'admin@example.com',
                'password': 'admin',
                'role': UserRole.ADMIN,
                'first_name': 'Admin',
                'last_name': 'User'
            },
            {
                'username': 'will',
                'email': 'will@test.com',
                'password': 'will',
                'role': UserRole.MANAGER,
                'first_name': 'Will',
                'last_name': 'Test'
            },
            {
                'username': 'manager',
                'email': 'manager@example.com',
                'password': 'manager',
                'role': UserRole.MANAGER,
                'first_name': 'Manager',
                'last_name': 'User'
            }
        ]

        for user_data in standard_users:
            existing_user = db.query(User).filter(User.username == user_data['username']).first()

            if existing_user:
                # Update existing user with proper bcrypt hash
                old_hash = existing_user.hashed_password
                new_hash = get_password_hash(user_data['password'])

                existing_user.hashed_password = new_hash
                existing_user.email = user_data['email']
                existing_user.role = user_data['role']
                existing_user.first_name = user_data['first_name']
                existing_user.last_name = user_data['last_name']
                existing_user.is_active = True

                print(f"🔄 Updated user '{user_data['username']}': Fixed password hash")
            else:
                # Create new user
                new_hash = get_password_hash(user_data['password'])
                new_user = User(
                    username=user_data['username'],
                    email=user_data['email'],
                    hashed_password=new_hash,
                    role=user_data['role'],
                    first_name=user_data['first_name'],
                    last_name=user_data['last_name'],
                    is_active=True,
                    tenant_id=default_tenant.id
                )
                db.add(new_user)
                print(f"✅ Created user '{user_data['username']}' with bcrypt password hash")

        # Commit all changes
        db.commit()

        # Step 5: Verify the fix
        print("\n🔍 Step 5: Verification - Testing authentication...")
        print("-" * 50)

        # Refresh and test each user (close and reopen session to get fresh data)
        db.close()
        db = SessionLocal()
        users = db.query(User).all()

        all_good = True
        for user in users:
            # Test the standard users
            if user.username in ['admin', 'will', 'manager']:
                expected_password = user.username  # Password same as username

                # Test password verification
                if verify_password(expected_password, user.hashed_password):
                    print(f"✅ {user.username}: Authentication test PASSED")
                else:
                    print(f"❌ {user.username}: Authentication test FAILED")
                    all_good = False

                # Check hash format
                if user.hashed_password.startswith('$2b$'):
                    print(f"✅ {user.username}: Hash format is correct bcrypt")
                else:
                    print(f"❌ {user.username}: Hash format is still incorrect")
                    all_good = False

        if all_good:
            print(f"\n🎉 Authentication system fix completed successfully!")
            print("\n📝 Summary:")
            print(f"  - Database schema: ✅ Initialized")
            print(f"  - Default tenant: ✅ Created/verified")
            print(f"  - Users created/fixed: {len(standard_users)}")
            print(f"  - Password hashes: ✅ All bcrypt format")
            print(f"  - Authentication: ✅ All tests passed")

            print("\n🔑 Login Credentials:")
            for user_data in standard_users:
                print(f"  - Username: {user_data['username']:10} | Password: {user_data['password']:10} | Role: {user_data['role'].value}")
        else:
            print(f"\n❌ Some authentication tests failed! Please check the output above.")

    except Exception as e:
        print(f"❌ Error fixing authentication system: {e}")
        if 'db' in locals():
            db.rollback()
        raise
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    main()