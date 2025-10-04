"""
Database Migration Utility for Multi-Tenancy Implementation

This utility handles the migration from a single-tenant database structure
to the new multi-tenant architecture.

Usage:
    python -m app.migration_utility --action create_default_tenant
    python -m app.migration_utility --action migrate_existing_data
    python -m app.migration_utility --action create_admin_user
"""

import argparse
import sys
from datetime import datetime
from typing import Optional
from getpass import getpass

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

from .database import DATABASE_URL
from .models import (
    Base, Tenant, User, Entity, Investment, CashFlow, Valuation,
    Document, FamilyMember, TenantStatus, UserRole
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class MigrationUtility:
    """Handles database migration to multi-tenant architecture"""

    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or DATABASE_URL
        self.engine = create_engine(self.database_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def create_tables(self):
        """Create all database tables"""
        print("Creating database tables...")
        Base.metadata.create_all(bind=self.engine)
        print("✓ Database tables created successfully")

    def create_default_tenant(self, tenant_name: str = "Default Organization") -> int:
        """Create the default tenant for existing data migration"""
        with self.SessionLocal() as db:
            # Check if default tenant already exists
            existing_tenant = db.query(Tenant).filter(
                Tenant.name == tenant_name
            ).first()

            if existing_tenant:
                print(f"✓ Default tenant '{tenant_name}' already exists (ID: {existing_tenant.id})")
                return existing_tenant.id

            # Create default tenant
            default_tenant = Tenant(
                name=tenant_name,
                status=TenantStatus.ACTIVE,
                created_at=datetime.utcnow()
            )

            db.add(default_tenant)
            db.commit()
            db.refresh(default_tenant)

            print(f"✓ Created default tenant '{tenant_name}' (ID: {default_tenant.id})")
            return default_tenant.id

    def create_admin_user(self, tenant_id: int, username: str, email: str, password: str) -> int:
        """Create the initial admin user"""
        with self.SessionLocal() as db:
            # Check if user already exists
            existing_user = db.query(User).filter(
                User.email == email,
                User.tenant_id == tenant_id
            ).first()

            if existing_user:
                print(f"✓ Admin user '{email}' already exists (ID: {existing_user.id})")
                return existing_user.id

            # Hash password
            hashed_password = pwd_context.hash(password)

            # Create admin user
            admin_user = User(
                username=username,
                email=email,
                hashed_password=hashed_password,
                first_name="System",
                last_name="Administrator",
                role=UserRole.ADMIN,
                is_active=True,
                tenant_id=tenant_id,
                created_at=datetime.utcnow()
            )

            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

            print(f"✓ Created admin user '{email}' (ID: {admin_user.id})")
            return admin_user.id

    def migrate_existing_data(self, tenant_id: int, admin_user_id: int):
        """Migrate existing data to use tenant_id and user_id foreign keys"""
        with self.SessionLocal() as db:
            migration_steps = [
                ("entities", self._migrate_entities),
                ("investments", self._migrate_investments),
                ("family_members", self._migrate_family_members),
                ("cashflows", self._migrate_cashflows),
                ("valuations", self._migrate_valuations),
                ("documents", self._migrate_documents),
            ]

            for table_name, migration_func in migration_steps:
                try:
                    count = migration_func(db, tenant_id, admin_user_id)
                    print(f"✓ Migrated {count} records in {table_name}")
                except Exception as e:
                    print(f"✗ Error migrating {table_name}: {e}")
                    db.rollback()
                    raise

            db.commit()
            print("✓ All data migration completed successfully")

    def _migrate_entities(self, db, tenant_id: int, admin_user_id: int) -> int:
        """Migrate entities table"""
        # Check if tenant_id column exists and is nullable
        result = db.execute(text("""
            UPDATE entities
            SET tenant_id = :tenant_id,
                created_by_user_id = :admin_user_id,
                updated_by_user_id = :admin_user_id
            WHERE tenant_id IS NULL
        """), {"tenant_id": tenant_id, "admin_user_id": admin_user_id})

        return result.rowcount

    def _migrate_investments(self, db, tenant_id: int, admin_user_id: int) -> int:
        """Migrate investments table"""
        result = db.execute(text("""
            UPDATE investments
            SET tenant_id = :tenant_id,
                created_by_user_id = :admin_user_id,
                updated_by_user_id = :admin_user_id
            WHERE tenant_id IS NULL
        """), {"tenant_id": tenant_id, "admin_user_id": admin_user_id})

        return result.rowcount

    def _migrate_family_members(self, db, tenant_id: int, admin_user_id: int) -> int:
        """Migrate family_members table"""
        result = db.execute(text("""
            UPDATE family_members
            SET tenant_id = :tenant_id,
                created_by_user_id = :admin_user_id,
                updated_by_user_id = :admin_user_id
            WHERE tenant_id IS NULL
        """), {"tenant_id": tenant_id, "admin_user_id": admin_user_id})

        return result.rowcount

    def _migrate_cashflows(self, db, tenant_id: int, admin_user_id: int) -> int:
        """Migrate cashflows table"""
        result = db.execute(text("""
            UPDATE cashflows
            SET tenant_id = :tenant_id,
                created_by_user_id = :admin_user_id,
                updated_by_user_id = :admin_user_id
            WHERE tenant_id IS NULL
        """), {"tenant_id": tenant_id, "admin_user_id": admin_user_id})

        return result.rowcount

    def _migrate_valuations(self, db, tenant_id: int, admin_user_id: int) -> int:
        """Migrate valuations table"""
        result = db.execute(text("""
            UPDATE valuations
            SET tenant_id = :tenant_id,
                created_by_user_id = :admin_user_id,
                updated_by_user_id = :admin_user_id
            WHERE tenant_id IS NULL
        """), {"tenant_id": tenant_id, "admin_user_id": admin_user_id})

        return result.rowcount

    def _migrate_documents(self, db, tenant_id: int, admin_user_id: int) -> int:
        """Migrate documents table"""
        result = db.execute(text("""
            UPDATE documents
            SET tenant_id = :tenant_id,
                uploaded_by_user_id = :admin_user_id
            WHERE tenant_id IS NULL
        """), {"tenant_id": tenant_id, "admin_user_id": admin_user_id})

        return result.rowcount

    def verify_migration(self, tenant_id: int) -> bool:
        """Verify that migration was successful"""
        with self.SessionLocal() as db:
            checks = [
                ("entities", Entity),
                ("investments", Investment),
                ("family_members", FamilyMember),
                ("cashflows", CashFlow),
                ("valuations", Valuation),
                ("documents", Document),
            ]

            all_good = True

            for table_name, model_class in checks:
                # Count records without tenant_id
                orphaned = db.query(model_class).filter(
                    model_class.tenant_id == None
                ).count()

                if orphaned > 0:
                    print(f"✗ Found {orphaned} records in {table_name} without tenant_id")
                    all_good = False
                else:
                    # Count records with correct tenant_id
                    migrated = db.query(model_class).filter(
                        model_class.tenant_id == tenant_id
                    ).count()
                    print(f"✓ {table_name}: {migrated} records properly migrated")

            return all_good

def main():
    """Main CLI interface for migration utility"""
    parser = argparse.ArgumentParser(description="Database Migration Utility")
    parser.add_argument("--action", required=True,
                       choices=["create_tables", "create_default_tenant", "create_admin_user",
                               "migrate_existing_data", "full_migration", "verify"],
                       help="Migration action to perform")
    parser.add_argument("--tenant-name", default="Default Organization",
                       help="Name for the default tenant")
    parser.add_argument("--admin-username", default="admin",
                       help="Username for admin user")
    parser.add_argument("--admin-email", default="admin@example.com",
                       help="Email for admin user")
    parser.add_argument("--database-url", help="Database URL (optional)")

    args = parser.parse_args()

    migration = MigrationUtility(args.database_url)

    try:
        if args.action == "create_tables":
            migration.create_tables()

        elif args.action == "create_default_tenant":
            tenant_id = migration.create_default_tenant(args.tenant_name)
            print(f"Default tenant ID: {tenant_id}")

        elif args.action == "create_admin_user":
            # Get tenant ID
            with migration.SessionLocal() as db:
                tenant = db.query(Tenant).first()
                if not tenant:
                    print("✗ No tenant found. Create a tenant first.")
                    sys.exit(1)

                tenant_id = tenant.id

            # Get password securely
            password = getpass("Enter password for admin user: ")
            confirm_password = getpass("Confirm password: ")

            if password != confirm_password:
                print("✗ Passwords do not match")
                sys.exit(1)

            admin_user_id = migration.create_admin_user(
                tenant_id, args.admin_username, args.admin_email, password
            )
            print(f"Admin user ID: {admin_user_id}")

        elif args.action == "migrate_existing_data":
            # Get tenant and admin user
            with migration.SessionLocal() as db:
                tenant = db.query(Tenant).first()
                admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()

                if not tenant or not admin_user:
                    print("✗ Tenant and admin user must exist before migrating data")
                    sys.exit(1)

                migration.migrate_existing_data(tenant.id, admin_user.id)

        elif args.action == "full_migration":
            print("🚀 Starting full migration process...")

            # Step 1: Create tables
            migration.create_tables()

            # Step 2: Create default tenant
            tenant_id = migration.create_default_tenant(args.tenant_name)

            # Step 3: Create admin user
            password = getpass("Enter password for admin user: ")
            confirm_password = getpass("Confirm password: ")

            if password != confirm_password:
                print("✗ Passwords do not match")
                sys.exit(1)

            admin_user_id = migration.create_admin_user(
                tenant_id, args.admin_username, args.admin_email, password
            )

            # Step 4: Migrate existing data
            migration.migrate_existing_data(tenant_id, admin_user_id)

            # Step 5: Verify migration
            if migration.verify_migration(tenant_id):
                print("🎉 Full migration completed successfully!")
            else:
                print("⚠️  Migration completed with warnings. Please review the output above.")

        elif args.action == "verify":
            with migration.SessionLocal() as db:
                tenant = db.query(Tenant).first()
                if not tenant:
                    print("✗ No tenant found")
                    sys.exit(1)

                if migration.verify_migration(tenant.id):
                    print("✓ Migration verification passed")
                else:
                    print("✗ Migration verification failed")
                    sys.exit(1)

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()