# app/api/v1/endpoints/map_data.py

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from pydantic import BaseModel
from typing import Dict, List, Optional, Tuple

# Assuming db_operations is in app/db_operations.py
import app.db_operations as db_ops

# Import the get_current_user dependency and UserInDB schema
from app.api.v1.endpoints.users import get_current_user
from app.schemas.user import UserInDB

# You might need to import settings for mapbox_token, but it's handled in map_dashboard.js directly
# from app.core.config import settings

import httpx
from fastapi.responses import StreamingResponse

router = APIRouter()


# Pydantic model for receiving layer state updates (for logging/debugging)
class LayerState(BaseModel):
    schema_name: str
    table: str
    z: int
    x: int
    y: int

# NEW: Endpoint to get schemas and tables for map layers
@router.get(
    "/api/schemas-and-tables",
    summary="Get available schemas and tables with geometry",
    response_model=Dict[str, List[str]],
)
async def get_available_schemas_and_tables():
    """
    Retrieves a dictionary of schema names mapping to a list of table names
    that contain PostGIS geometry (SRID 4326).
    This endpoint is public for populating the layer selection UI.
    """
    try:
        schema_data = db_ops.get_schemas_and_tables()
        return schema_data
    except RuntimeError as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve schemas and tables: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred while fetching schemas and tables: {str(e)}",
        )

@router.get(
    "/geometry-type/{schema}/{table}", summary="Get geometry type for a table and user"
)
async def get_table_geometry_type(
    schema: str,
    table: str,
    current_user: UserInDB = Depends(get_current_user),  # Secure endpoint
):
    """
    Get the geometry type for a table, filtered by the logged-in user.
    """
    try:
        # IMPORTANT: Pass current_user.id to your db_ops function for filtering
        geom_type = db_ops.get_geometry_type_from_db(
            schema, table, user_id=current_user.id
        )

        if not geom_type:
            raise HTTPException(
                status_code=400,
                detail="No valid geometry found for this user or table is empty",
            )

        return {"geometryType": geom_type}
    except RuntimeError as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting geometry type: {str(e)}"
        )
    except HTTPException:
        raise  # Re-raise explicit HTTPException
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get(
    "/check-srid/{schema}/{table}",
    summary="Check SRID for a table's geometry for a user",
)
async def check_srid(
    schema: str,
    table: str,
    current_user: UserInDB = Depends(get_current_user),  # Secure endpoint
):
    """
    Check if the geometry column has a valid SRID and is 4326, filtered by the logged-in user.
    """
    try:
        # IMPORTANT: Pass current_user.id to your db_ops function for filtering
        srid_check_result = db_ops.check_srid_from_db(
            schema, table, user_id=current_user.id
        )
        return srid_check_result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"SRID check failed: {str(e)}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@router.get(
    "/fields/{schema}/{table}", summary="Retrieve column names from a table for a user"
)
async def get_table_fields(
    schema: str,
    table: str,
    current_user: UserInDB = Depends(get_current_user),  # Secure endpoint
):
    """
    Retrieve all non-geometry column names from a specific table in a schema,
    filtered by the logged-in user.
    Returns a list of field names suitable for labeling.
    """
    try:
        # IMPORTANT: Pass current_user.id to your db_ops function for filtering
        fields = db_ops.get_table_fields_from_db(schema, table, user_id=current_user.id)
        if not fields:
            raise HTTPException(
                status_code=404,
                detail="No non-geometry fields found in table for this user.",
            )
        return {"fields": fields}
    except RuntimeError as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch table fields: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {str(e)}"
        )


@router.get("/offers-summary", summary="Get offers summary for current user")
async def get_offers_summary(
    current_user: UserInDB = Depends(get_current_user),
):
    try:
        # Use psycopg2 directly to query the offers_summary view/table filtered by user_id
        conn = db_ops.get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM public.offers_summary WHERE user_id = %s", (current_user.id,)
            )
            columns = [desc[0] for desc in cursor.description]
            offers = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()
        return offers
    except Exception as e:
        print("Error fetching offers summary:", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch offers summary")

@router.api_route("/proxy/tiles/{layer}/{z}/{x}/{y}.pbf", methods=["GET"])
async def proxy_tile(layer: str, z: int, x: int, y: int):
    """
    Reverse proxy for tile requests to localhost:3000 to avoid CORS issues.
    """
    tile_url = f"http://localhost:3000/tiles/{layer}/{z}/{x}/{y}.pbf"
    async with httpx.AsyncClient() as client:
        proxied_response = await client.get(tile_url)
        headers = dict(proxied_response.headers)
        # Set CORS header
        headers["Access-Control-Allow-Origin"] = "*"
        # Remove hop-by-hop headers if present
        headers.pop("content-encoding", None)
        headers.pop("transfer-encoding", None)
        return Response(content=proxied_response.content, status_code=proxied_response.status_code, headers=headers, media_type="application/x-protobuf")
