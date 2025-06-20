# app/main.py

from fastapi import FastAPI, Request, HTTPException
from typing import Dict, List
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBearer
from fastapi.openapi.utils import (
    get_openapi,
)
import os
import uvicorn

# Import database setup and models
from app.database.database import engine, Base

# Explicitly import the User model to ensure it's registered with Base for Alembic/table creation
from app.database.models import User, PasswordResetToken

# Import the authentication and user routers
from app.api.v1.endpoints import auth, users, map_data  # NEW: Import map_data router
import app.db_operations as db_ops  # NEW: Import db_operations for schema data

# Define the Bearer security scheme
bearer_scheme = HTTPBearer()

# Initialize FastAPI app
app = FastAPI(
    title="FastAPI Authentication App",
    description="A simple FastAPI application with user authentication features and map data visualization.",
    version="0.1.0",
)


# Override the OpenAPI schema to add the BearerAuth scheme in Swagger UI
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter your JWT token in the format **Bearer <token>**",
        }
    }
    openapi_schema["security"] = [{"BearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


# Apply the custom OpenAPI function
app.openapi = custom_openapi

# Define base directory for easier path management
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mount static files directory (CSS, JS, images)
app.mount(
    "/static", StaticFiles(directory=os.path.join(BASE_DIR, "../static")), name="static"
)

# Configure Jinja2Templates to serve HTML templates
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "../templates"))


# Event handler to create database tables on startup
@app.on_event("startup")
def on_startup():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created (if they didn't exist).")


# Define the root endpoint to serve the new welcome page
@app.get("/", response_class=HTMLResponse, summary="Serve the main welcome page")
async def read_root(request: Request):
    return templates.TemplateResponse("welcome.html", {"request": request})


# Define endpoints to serve the various authentication pages
@app.get(
    "/templates/login.html", response_class=HTMLResponse, summary="Serve the login page"
)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get(
    "/templates/signup.html",
    response_class=HTMLResponse,
    summary="Serve the signup page",
)
async def signup_page(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})


@app.get(
    "/templates/forgot_password.html",
    response_class=HTMLResponse,
    summary="Serve the forgot password page",
)
async def forgot_password_page(request: Request):
    return templates.TemplateResponse("forgot_password.html", {"request": request})


@app.get(
    "/templates/reset_password.html",
    response_class=HTMLResponse,
    summary="Serve the reset password page",
)
async def reset_password_page(request: Request):
    return templates.TemplateResponse("reset_password.html", {"request": request})


# Define the map dashboard endpoint
@app.get(
    "/map-dashboard",
    response_class=HTMLResponse,
    summary="Serve the interactive map dashboard",
)
async def map_dashboard(request: Request):
    return templates.TemplateResponse("map_dashboard.html", {"request": request})

# Include API routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(
    map_data.router, prefix="/api/v1/map-data", tags=["Map Data"]
)  # NEW: Include map_data router

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
