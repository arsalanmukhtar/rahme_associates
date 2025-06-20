# app/api/v1/endpoints/users.py

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional, Dict

# Import schemas for user data
from app.schemas.user import (
    UserInDB,
    TokenData,
    UserMapSettingsUpdate,
)  # Import UserMapSettingsUpdate

# Import database session dependency
from app.database.database import get_db

# Import CRUD operations for users
from app.crud import user as crud_user

# Import security utilities for token decoding
from app.core.security import decode_access_token
from app.core.config import settings  # NEW: Import settings to access MAPBOX_TOKEN

router = APIRouter()


# Dependency to get the current authenticated user by decoding the JWT token
async def get_current_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),  # Get Authorization header
) -> UserInDB:
    """
    Attempts to get the current authenticated user by validating the JWT token
    from the Authorization header.
    Raises HTTPException 401 if token is invalid or user not found.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Expected format: "Bearer <token>"
    token_parts = authorization.split(" ")
    if len(token_parts) != 2 or token_parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = token_parts[1]
    token_data = decode_access_token(token)

    if not token_data or not token_data.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_email = token_data["sub"]
    user = crud_user.get_user_by_email(db, email=user_email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return UserInDB.model_validate(user)  # Use model_validate for Pydantic v2


@router.get("/me", response_model=UserInDB, summary="Get current user's profile")
async def read_users_me(
    current_user: UserInDB = Depends(
        get_current_user
    ),  # Use the new current user dependency
):
    """
    Retrieves the profile of the currently authenticated user.
    This endpoint requires authentication via JWT.
    """
    return current_user


# NEW: Endpoint to update user's map settings
@router.put(
    "/me/map-settings",
    response_model=UserInDB,
    summary="Update current user's map settings",
)
async def update_users_map_settings(
    map_settings: UserMapSettingsUpdate,
    current_user: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates the map zoom level, latitude, and longitude for the currently authenticated user.
    """
    # ✅ Fix: fetch the ORM model instance
    db_user = crud_user.get_user_by_email(db, email=current_user.email)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    updated_user = crud_user.update_user_map_settings(db, db_user, map_settings)
    return UserInDB.model_validate(updated_user)  # Return Pydantic model


# NEW: Endpoint to get Mapbox token (publicly accessible)
@router.get(
    "/mapbox-token",
    response_model=Dict[str, str],
    summary="Get Mapbox public access token",
)
async def get_mapbox_token():
    """
    Returns the Mapbox public access token.
    This endpoint is designed to be publicly accessible for client-side map initialization.
    """
    return {"token": settings.MAPBOX_TOKEN}
