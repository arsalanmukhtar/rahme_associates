# app/database/database.py

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Import settings for database URL
from app.core.config import settings

# Create the SQLAlchemy engine
# connect_args={"check_same_thread": False} is needed for SQLite, not typically for PostgreSQL
# but can be left for local testing if you switch DBs temporarily.
# For production PostgreSQL, it's not necessary and should be removed if it causes issues.
engine = create_engine(
    settings.DATABASE_URL
    # , connect_args={"check_same_thread": False} # Uncomment if using SQLite for local dev
)

# Create a SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for your declarative models
Base = declarative_base()


# Dependency to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
