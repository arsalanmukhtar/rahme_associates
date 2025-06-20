# app/database/models.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship  # Import relationship for linking tables
from app.database.database import Base


class User(Base):
    __tablename__ = "users"  # Define the table name

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)  # Example: For admin roles
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # New fields for map settings - THESE MUST BE IN YOUR DB TABLE!
    map_zoom_level = Column(Float, default=12.0)  # Default zoom level
    map_latitude = Column(Float, default=51.505)  # Default Latitude (e.g., London)
    map_longitude = Column(Float, default=-0.09)  # Default Longitude (e.g., London)

    # Establish a relationship with PasswordResetToken
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")

    def __repr__(self):
        return f"<User(email='{self.email}', username='{self.username}')>"


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Establish a relationship with User - Corrected back_populates to point to the correct relationship name in User
    user = relationship(
        "User", back_populates="password_reset_tokens"
    )  # Corrected back_populates to match User model

    def __repr__(self):
        return f"<PasswordResetToken(token='{self.token[:10]}...', user_id={self.user_id})>"
