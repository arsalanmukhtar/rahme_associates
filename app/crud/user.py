# app/crud/user.py

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import secrets
from sqlalchemy.orm import joinedload  # Import joinedload directly
import random  # Import random for initial map values


from app.database.models import User, PasswordResetToken
from app.schemas.user import UserCreate, PasswordResetTokenCreate, UserMapSettingsUpdate
from app.core.security import get_password_hash


def get_user_by_email(db: Session, email: str) -> User | None:
    """
    Retrieves a user by their email address.
    """
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    """
    Retrieves a user by their username.
    """
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, user: UserCreate) -> User:
    """
    Creates a new user in the database.
    Hashes the password before storing.
    Handles potential database errors during creation.
    Populates random initial map values.
    """
    hashed_password = get_password_hash(user.password)

    # Generate random initial map values for new users
    initial_latitude = random.uniform(-85.0, 85.0)
    initial_longitude = random.uniform(-170.0, 170.0)
    initial_zoom = random.uniform(8.0, 14.0)

    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        map_zoom_level=initial_zoom,
        map_latitude=initial_latitude,
        map_longitude=initial_longitude,
    )
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
        return db_user
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error during user creation: {e}")
        raise


def create_password_reset_token(
    db: Session, token_data: PasswordResetTokenCreate
) -> PasswordResetToken:
    """
    Creates a new password reset token in the database.
    """
    db_token = PasswordResetToken(
        token=token_data.token,
        user_id=token_data.user_id,
        expires_at=token_data.expires_at,
        is_used=False,
    )
    db.add(db_token)
    try:
        db.commit()
        db.refresh(db_token)
        return db_token
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error during password reset token creation: {e}")
        raise


def get_password_reset_token(db: Session, token: str) -> PasswordResetToken | None:
    """
    Retrieves a password reset token by its value, also fetching the associated user.
    """
    return (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == token)
        .options(joinedload(PasswordResetToken.user))
        .first()
    )


def invalidate_password_reset_token(db: Session, db_token: PasswordResetToken):
    """
    Marks a password reset token as used.
    """
    db_token.is_used = True
    db.add(db_token)
    db.commit()
    db.refresh(db_token)


def update_user_password(db: Session, user: User, new_hashed_password: str) -> User:
    """
    Updates a user's password.
    """
    user.hashed_password = new_hashed_password
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
        return user
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error during password update for user {user.email}: {e}")
        raise


def update_user_map_settings(
    db: Session, user: User, map_settings: UserMapSettingsUpdate
) -> User:
    """
    Updates a user's map zoom level, latitude, and longitude.
    """
    user.map_zoom_level = map_settings.map_zoom_level
    user.map_latitude = map_settings.map_latitude
    user.map_longitude = map_settings.map_longitude
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
        return user
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error during map settings update for user {user.email}: {e}")
        raise
