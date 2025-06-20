# app/core/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import EmailStr, Field # Import Field for default values

class Settings(BaseSettings):
    # This configuration tells Pydantic to load variables from a .env file
    # and to ignore extra fields found in the .env but not defined in the class.
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    # Security settings
    SECRET_KEY: str = Field(..., description="A strong secret key for JWT and other security needs")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Database settings
    DATABASE_URL: str = Field(..., description="PostgreSQL database connection URL")

    # Email settings for password reset (configured for SendGrid SMTP Relay)
    MAIL_USERNAME: str = Field(..., description="SendGrid SMTP username (usually 'apikey')")
    MAIL_PASSWORD: str = Field(..., description="SendGrid API Key (used as SMTP password)")
    MAIL_FROM: EmailStr = Field(..., description="Your verified sender email address in SendGrid")
    MAIL_PORT: int = Field(..., description="SendGrid SMTP port for TLS connections")
    MAIL_SERVER: str = Field(..., description="SendGrid SMTP server address")
    MAIL_TLS: bool = Field(..., description="Use TLS encryption for SendGrid (True for port 587)")
    MAIL_SSL: bool = Field(..., description="Do not use SSL for SendGrid (False for port 587, True for port 465)")
    USE_CREDENTIALS: bool = Field(..., description="SendGrid requires credentials")
    VALIDATE_CERTS: bool = Field(..., description="Validate SSL/TLS certificates")

    # Mapbox setting
    MAPBOX_TOKEN: str = Field(..., description="Mapbox public access token")

    # Application settings
    APP_NAME: str = Field(..., description="Application name")
    APP_VERSION: str = Field(..., description="Application version")

# Create an instance of the Settings
settings = Settings()
