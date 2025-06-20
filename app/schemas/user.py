# app/schemas/user.py

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# Schema for creating a new user (for signup)
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


# Schema for user login
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Schema for user data as stored in DB (MUST match the User model in models.py exactly)
# This schema is used when reading data from the database and sending it as a response.
class UserInDB(BaseModel):
    id: int
    username: str
    email: EmailStr
    hashed_password: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: Optional[datetime] = None  # ✅ Fix here
    map_zoom_level: float
    map_latitude: float
    map_longitude: float

    class Config:
        from_attributes = True  # Pydantic v2: equivalent to orm_mode = True in v1


# Schema for the JWT token response
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Schema for token data (payload inside the JWT)
class TokenData(BaseModel):
    email: Optional[EmailStr] = None


# Schema for requesting a password reset link
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


# Schema for resetting the password
class ResetPassword(BaseModel):
    token: str
    new_password: str


# Schema for creating a password reset token (for database creation)
class PasswordResetTokenCreate(BaseModel):
    token: str
    user_id: int
    expires_at: datetime
    is_used: bool = False


# Schema for a password reset token from the DB (for reading)
class PasswordResetTokenInDB(BaseModel):
    id: int
    token: str
    user_id: int
    expires_at: datetime
    is_used: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Schema for updating user map settings (used for PUT /me/map-settings)
class UserMapSettingsUpdate(BaseModel):
    map_zoom_level: float = Field(..., ge=0, le=22, description="Map zoom level (0-22)")
    map_latitude: float = Field(
        ..., ge=-90, le=90, description="Map latitude (-90 to 90)"
    )
    map_longitude: float = Field(
        ..., ge=-180, le=180, description="Map longitude (-180 to 180)"
    )
