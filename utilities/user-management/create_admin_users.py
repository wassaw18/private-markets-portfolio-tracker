#!/usr/bin/env python3
"""Create admin users (will and admin) with known passwords"""

import sys
from app.database import SessionLocal
from app.models import User, Tenant, UserRole
from app.auth import get_password_hash
from datetime import datetime

def create_admin_users():
    db = SessionLocal()
    try:
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

        # Users to create/update
        users_to_create = [
            {"username": "will", "email": "will@example.com", "password": "will123", "role": UserRole.ADMIN},
            {"username": "admin", "email": "admin@example.com", "password": "admin123", "role": UserRole.ADMIN}
        ]

        for user_data in users_to_create:
            # Check if user already exists
            existing_user = db.query(User).filter(User.username == user_data["username"]).first()
            if existing_user:
                print(f"User '{user_data['username']}' already exists, updating password...")
                existing_user.hashed_password = get_password_hash(user_data["password"])
                existing_user.role = user_data["role"]  # Ensure they're admin
                db.commit()
                print(f"Updated user '{user_data['username']}' password to '{user_data['password']}' (properly hashed)")
            else:
                # Create new user with properly hashed password
                new_user = User(
                    username=user_data["username"],
                    email=user_data["email"],
                    hashed_password=get_password_hash(user_data["password"]),
                    role=user_data["role"],
                    tenant_id=tenant.id,
                    is_active=True,
                    created_at=datetime.utcnow()
                )

                db.add(new_user)
                db.commit()
                db.refresh(new_user)

                print(f"Created user '{user_data['username']}':")
                print(f"  Username: {user_data['username']}")
                print(f"  Password: {user_data['password']}")
                print(f"  Email: {user_data['email']}")
                print(f"  Role: {new_user.role}")
                print(f"  Tenant ID: {new_user.tenant_id}")

    except Exception as e:
        print(f"Error creating admin users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_users()