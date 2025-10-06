#!/usr/bin/env python3
"""
Database inspection script to understand the current schema
"""

import sqlite3
import sys
from pathlib import Path

def inspect_database():
    """Inspect the database schema and contents"""
    db_path = "portfolio_tracker.db"

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print(f"🔍 Inspecting database: {db_path}")
        print("=" * 50)

        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        print(f"📋 Found {len(tables)} tables:")
        for table in tables:
            print(f"  - {table[0]}")

        # Check if users table exists
        if any('users' in table[0] for table in tables):
            print("\n👤 Users table found!")

            # Get user data
            cursor.execute("SELECT id, username, email, hashed_password, role FROM users;")
            users = cursor.fetchall()

            print(f"\n📊 Found {len(users)} users:")
            print("-" * 50)

            for user in users:
                user_id, username, email, hashed_password, role = user
                hash_length = len(hashed_password) if hashed_password else 0
                hash_preview = hashed_password[:30] + "..." if hashed_password and len(hashed_password) > 30 else hashed_password

                print(f"ID: {user_id}")
                print(f"Username: {username}")
                print(f"Email: {email}")
                print(f"Role: {role}")
                print(f"Hash Length: {hash_length}")
                print(f"Hash Preview: {hash_preview}")
                print("-" * 30)
        else:
            print("\n❌ Users table not found!")
            print("Available tables:")
            for table in tables:
                print(f"  - {table[0]}")

    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    inspect_database()