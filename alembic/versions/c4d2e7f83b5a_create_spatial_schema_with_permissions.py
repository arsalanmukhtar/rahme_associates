"""create spatial schema with permissions

Revision ID: c4d2e7f83b5a
Revises: 261551f0f8c1
Create Date: 2025-06-20

"""
from alembic import op
import sqlalchemy as sa
from app.core.config import settings
from urllib.parse import urlparse

# Parse DATABASE_URL to get username
db_url = urlparse(settings.DATABASE_URL)
db_user = db_url.username

# revision identifiers, used by Alembic.
revision = 'c4d2e7f83b5a'
down_revision = '261551f0f8c1'  # This points to the latest migration
branch_labels = None
depends_on = None

def upgrade():    # Create the schema if it doesn't exist
    op.execute('CREATE SCHEMA IF NOT EXISTS spatial')
    
    # Grant ALL privileges on schema to the database user
    op.execute(f'GRANT ALL PRIVILEGES ON SCHEMA spatial TO {db_user}')
    
    # Grant ALL permissions on all current and future tables
    op.execute(f'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA spatial TO {db_user}')
    op.execute(f'ALTER DEFAULT PRIVILEGES IN SCHEMA spatial GRANT ALL ON TABLES TO {db_user}')
    
    # Enable PostGIS for the schema if not already enabled
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    
    # Create a sample table with geometry column (required for the schema to show up in frontend)
    op.execute("""
        CREATE TABLE IF NOT EXISTS spatial.sample_points (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            geom GEOMETRY(Point, 4326),
            user_id INTEGER
        )
    """)

def downgrade():    # Drop the sample table first
    op.execute('DROP TABLE IF EXISTS spatial.sample_points')
    
    # Revoke all permissions
    op.execute(f'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA spatial FROM {db_user}')
    op.execute(f'REVOKE ALL PRIVILEGES ON SCHEMA spatial FROM {db_user}')
    
    # Drop the schema and all its objects
    op.execute('DROP SCHEMA IF EXISTS spatial CASCADE')
