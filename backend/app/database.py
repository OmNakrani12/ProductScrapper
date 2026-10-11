from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from app.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgres://", 1)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

connect_args = {}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True
    )
else:
    # Supabase Transaction Pooler (Port 6543) / Cloud Postgres Optimization
    connect_args = {"connect_timeout": 10}
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        poolclass=NullPool,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
