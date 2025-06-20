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

router = APIRouter()


# Pydantic model for receiving layer state updates (for logging/debugging)
class LayerState(BaseModel):
    schema_name: str
    table: str
    z: int
    x: int
    y: int


@router.post("/layer-state", summary="Update and log the current layer state")
async def update_layer_state(state: LayerState):
    """Update and return the current layer state (for backend logging/display)"""
    print(
        f"Backend received layer state: Schema={state.schema_name}, Table={state.table}, Tile={state.z}/{state.x}/{state.y}"
    )
    return {
        "schema": state.schema_name,
        "table": state.table,
        "tile": {
            "z": state.z,
            "x": state.x,
            "y": state.y,
            "url": f"/api/mvt/{state.schema_name}/{state.table}/{state.z}/{state.x}/{state.y}.pbf",
        },
        "message": "Layer state received and logged.",
    }


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
    "/mvt/{schema}/{table}/{z}/{x}/{y}.pbf",
    summary="Get MVT tile for a specific layer and user",
)
async def get_mvt_tile(
    schema: str,
    table: str,
    z: int,
    x: int,
    y: int,
    current_user: UserInDB = Depends(
        get_current_user
    ),  # Secure endpoint for logged-in user
):
    """
    Retrieves a Mapbox Vector Tile (MVT) for a given schema, table, and tile coordinates.
    Filters the data based on the logged-in user's ID.
    """
    try:
        # IMPORTANT: Pass current_user.id to your db_ops function for filtering
        # You need to implement this filtering in get_mvt_tile_from_db
        tile_data = db_ops.get_mvt_tile_from_db(
            schema, table, z, x, y, user_id=current_user.id
        )

        if not tile_data:
            print(
                f"Server debug: No MVT data generated for {schema}.{table} tile {z}/{x}/{y} for user {current_user.id}."
            )
            # Return an empty protobuf response if no data
            return Response(b"", media_type="application/x-protobuf")

        return Response(
            content=bytes(tile_data),
            media_type="application/x-protobuf",
            headers={
                "X-MVT-Layers": "features,labels",  # Adjust as needed based on your MVT generation
                "Cache-Control": "public, max-age=3600",
            },
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate MVT tile: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during tile generation: {str(e)}",
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
    "/extent/{schema}/{table}",
    summary="Get bounding box of a table's geometry for a user",
)
async def get_table_extent(
    schema: str,
    table: str,
    current_user: UserInDB = Depends(get_current_user),  # Secure endpoint
):
    """
    Get the bounding box of a table's geometry, filtered by the logged-in user.
    """
    try:
        # IMPORTANT: Pass current_user.id to your db_ops function for filtering
        bounds = db_ops.get_table_extent_from_db(schema, table, user_id=current_user.id)
        if not bounds:
            raise HTTPException(
                status_code=404,
                detail="No geometry data found or extent is null for this user.",
            )

        return {"bounds": bounds}
    except RuntimeError as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting table extent: {str(e)}"
        )
    except HTTPException:
        raise
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
