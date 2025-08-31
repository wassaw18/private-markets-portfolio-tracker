from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base

DATABASE_URL = "sqlite:///./portfolio_tracker.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_database():
    Base.metadata.create_all(bind=engine)
    
    # Seed benchmark data on first run
    from app.benchmark_seeder import seed_benchmark_data
    from app.models import PerformanceBenchmark
    
    db = SessionLocal()
    try:
        # Check if benchmark data already exists
        existing_count = db.query(PerformanceBenchmark).count()
        if existing_count == 0:
            seed_benchmark_data(db)
            print("✅ Benchmark data seeded successfully")
        else:
            print(f"✅ Benchmark data already exists ({existing_count} records)")
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()