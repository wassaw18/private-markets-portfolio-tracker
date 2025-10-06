#!/usr/bin/env python3
"""Create a test user with a known password"""

import sys
from app.database import SessionLocal
from app.models import User, Tenant, UserRole
from app.auth import get_password_hash
from datetime import datetime

def create_test_user():
    db = SessionLocal()
    try:
        # Check if test user already exists
        existing_user = db.query(User).filter(User.username == "testuser").first()
        if existing_user:
            print("Test user already exists, updating password...")
            existing_user.hashed_password = get_password_hash("plaintext123")  # Properly hash the password
            db.commit()
            print("Updated test user password to 'plaintext123' (properly hashed)")
            return

        # Get the tenant (assuming tenant ID 1 exists)
        tenant = db.query(Tenant).first()
        if not tenant:
            print("No tenant found! Creating one...")
            tenant = Tenant(
                name="Test Tenant",
                subdomain="test",
                created_at=datetime.utcnow()
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        # Create test user with properly hashed password
        test_user = User(
            username="testuser",
            email="testuser@example.com",
            hashed_password=get_password_hash("plaintext123"),  # Properly hash the password
            role=UserRole.CONTRIBUTOR,
            tenant_id=tenant.id,
            is_active=True,
            created_at=datetime.utcnow()
        )

        db.add(test_user)
        db.commit()
        db.refresh(test_user)

        print(f"Created test user:")
        print(f"  Username: testuser")
        print(f"  Password: plaintext123")
        print(f"  Email: testuser@example.com")
        print(f"  Role: {test_user.role}")
        print(f"  Tenant ID: {test_user.tenant_id}")

    except Exception as e:
        print(f"Error creating test user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()
