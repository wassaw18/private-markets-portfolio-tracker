import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base

# Load environment variables
load_dotenv()

# Get database URL from environment or fall back to SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./portfolio_tracker.db")

# Configure engine based on database type
if DATABASE_URL.startswith("sqlite"):
    # SQLite specific configuration
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL or other databases
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_database():
    """Create database tables if they don't exist"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created/verified")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()