# app/api/v1/endpoints/auth.py

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request,
)
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Dict
from datetime import datetime, timedelta, timezone
import secrets

# Import your schemas
from app.schemas.user import (
    UserCreate,
    UserLogin,
    Token,
    ForgotPasswordRequest,
    ResetPassword,
    PasswordResetTokenCreate,
)

# Import database session dependency
from app.database.database import get_db

# Import CRUD operations for users and password reset tokens
from app.crud import user as crud_user

# Import security utilities
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings

router = APIRouter()

# Global constant for password reset token expiry (e.g., 1 hour)
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 60


@router.post(
    "/register",
    response_model=Dict,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Handles new user registration.
    - Hashing the password
    - Storing user data in the database (e.g., PostgreSQL)
    - Checking for duplicate emails/usernames
    """
    # Check if email already exists
    db_user = crud_user.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )
    # Check if username already exists (optional, depending on your app's needs)
    db_user = crud_user.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
        )

    try:
        # Create the user in the database (random map defaults are set in crud_user.create_user)
        new_user = crud_user.create_user(db=db, user=user)
        return {"message": "User registered successfully", "user_email": new_user.email}
    except SQLAlchemyError as e:
        print(f"Database error during user creation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user due to a database error.",
        )
    except Exception as e:
        print(f"An unexpected error occurred during user registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user due to an unexpected server error.",
        )


@router.post(
    "/login", response_model=Token, summary="Authenticate user and return access token"
)
async def login_user(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates a user based on email and password.
    - Verifying credentials against hashed passwords in the database
    - Generating a JWT access token
    """
    # Retrieve user by email
    db_user = crud_user.get_user_by_email(db, email=user_credentials.email)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(user_credentials.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post(
    "/forgot-password", response_model=Dict, summary="Request a password reset link"
)
async def forgot_password(
    request_data: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)
):
    """
    Handles forgotten password requests.
    - Checks if the email exists.
    - Generates a unique reset token.
    - Stores the token in the database with an expiration.
    - Prints the reset link to the console (simulates sending email).
    """
    user = crud_user.get_user_by_email(db, email=request_data.email)
    if not user:
        # For security, always return a generic success message even if email not found
        return {
            "message": "If this email is registered, a password reset link has been sent."
        }

    # Generate a secure, URL-safe random token
    token_value = secrets.token_urlsafe(32)

    # Set token expiration time
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )

    # Create token data for the database
    token_data_for_db = PasswordResetTokenCreate(
        token=token_value, user_id=user.id, expires_at=expires_at
    )

    try:
        crud_user.create_password_reset_token(db, token_data=token_data_for_db)
    except SQLAlchemyError as e:
        print(f"Error storing password reset token: {e}")
        return {
            "message": "If this email is registered, a password reset link has been sent."
        }
    except Exception as e:
        print(f"An unexpected error occurred during token creation: {e}")
        return {
            "message": "If this email is registered, a password reset link has been sent."
        }

    # Construct the reset link for the user (frontend URL)
    base_url = str(request.base_url).rstrip("/")
    reset_link = f"{base_url}/templates/reset_password.html?token={token_value}"

    print(f"\n--- PASSWORD RESET LINK FOR {user.email} ---")
    print(f"Link: {reset_link}")
    print(f"--------------------------------------------\n")

    # If you have an email sender configured, uncomment and use it here:
    # from app.utils.email_sender import send_password_reset_email
    # email_sent = await send_password_reset_email(user.email, reset_link)
    # if not email_sent:
    #     print(f"DEBUG: Failed to send email to {user.email}. Check mail server configuration, API Key, and sender verification in SendGrid.")
    #     return {"message": "If this email is registered, a password reset link has been sent. (However, email sending encountered an issue.)"}

    return {
        "message": "If this email is registered, a password reset link has been sent."
    }


@router.post(
    "/reset-password",
    response_model=Dict,
    summary="Reset user's password using a token",
)
async def reset_password(reset_data: ResetPassword, db: Session = Depends(get_db)):
    """
    Resets the user's password using a provided token.
    - Validates the reset token (exists, not used, not expired).
    - Retrieves the user associated with the token.
    - Hashes the new password.
    - Updates the password in the database.
    - Invalidates the used token.
    """
    db_token = crud_user.get_password_reset_token(db, token=reset_data.token)

    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )
    if db_token.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token has already been used.",
        )
    if db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token has expired.",
        )

    user_to_reset = db_token.user  # Access user through the relationship
    if not user_to_reset or not user_to_reset.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with token not found or is inactive.",
        )

    try:
        hashed_new_password = get_password_hash(reset_data.new_password)
        crud_user.update_user_password(db, user_to_reset, hashed_new_password)
        crud_user.invalidate_password_reset_token(db, db_token)
        return {"message": "Your password has been successfully reset."}
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error during password reset: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password due to a server error.",
        )
    except Exception as e:
        print(f"An unexpected error occurred during password reset: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password due to an unexpected server error.",
        )
