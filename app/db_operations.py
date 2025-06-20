# app/db_operations.py

import psycopg2
from psycopg2 import sql
from psycopg2.errors import OperationalError
from app.core.config import settings
import mercantile
from typing import Dict, List, Optional, Tuple, Any


def get_db_connection():
    """
    Establishes a connection to the PostgreSQL database using the DATABASE_URL from settings.
    """
    try:
        # Use settings.DATABASE_URL directly for psycopg2.connect
        return psycopg2.connect(settings.DATABASE_URL)
    except OperationalError as e:
        raise RuntimeError(f"Database connection failed: {str(e)}")


def get_geometry_column(schema: str, table: str) -> Optional[str]:
    """
    Retrieves the name of the geometry column for a given table in a schema
    from the PostGIS geometry_columns view.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT f_geometry_column
                FROM geometry_columns
                WHERE f_table_schema = %s AND f_table_name = %s
            """,
                (schema, table),
            )
            result = cursor.fetchone()
            return result[0] if result else None
    except Exception as e:
        raise RuntimeError(f"Failed to get geometry column: {str(e)}")
    finally:
        if conn:
            conn.close()


def get_schemas_and_tables() -> Dict[str, List[str]]:
    """
    Retrieves all schemas and tables that have PostGIS geometry columns with SRID 4326.
    This function is NOT filtered by user_id, as it's for discovering available layers.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Get schemas
            cursor.execute(
                """
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                ORDER BY schema_name
            """
            )
            schemas = [row[0] for row in cursor.fetchall()]

            schema_data = {}
            for schema in schemas:
                # Get tables with geometry (SRID 4326) within each schema
                cursor.execute(
                    sql.SQL(
                        """
                    SELECT DISTINCT f_table_name
                    FROM public.geometry_columns
                    WHERE f_table_schema = %s AND srid = 4326
                """
                    ),
                    [schema],
                )
                tables = [row[0] for row in cursor.fetchall()]
                if tables:
                    schema_data[schema] = tables
            return schema_data
    except Exception as e:
        raise RuntimeError(f"Failed to retrieve schemas and tables: {str(e)}")
    finally:
        if conn:
            conn.close()


def get_tile_bounds(z: int, x: int, y: int) -> Tuple[float, float, float, float]:
    """
    Calculates the geographic bounds (west, south, east, north) for a given XYZ tile.
    """
    tile = mercantile.Tile(x, y, z)
    bounds = mercantile.bounds(tile)
    return bounds.west, bounds.south, bounds.east, bounds.north


def get_geometry_type_from_db(schema: str, table: str, user_id: int) -> Optional[str]:
    """
    Retrieves the geometry type (e.g., 'ST_MultiPolygon', 'ST_Point') for a table's
    geometry column, filtered by user_id.
    """
    conn = None
    try:
        geom_column = get_geometry_column(schema, table)
        if not geom_column:
            # If no geometry column is found, it's not a spatial table relevant to this function
            return None

        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Query to get the distinct geometry type, filtered by user_id
            query = sql.SQL(
                """
                SELECT DISTINCT ST_GeometryType({geom_column}) AS geom_type
                FROM {schema_name}.{table_name}
                WHERE {geom_column} IS NOT NULL AND user_id = %s
                LIMIT 1
            """
            ).format(
                geom_column=sql.Identifier(geom_column),
                schema_name=sql.Identifier(schema),
                table_name=sql.Identifier(table),
            )
            cursor.execute(query, (user_id,))  # Pass user_id as a parameter
            result = cursor.fetchone()
            return result[0] if result else None
    except Exception as e:
        # Print the error for debugging purposes
        print(
            f"Error getting geometry type for user {user_id} on {schema}.{table}: {e}"
        )
        # Re-raise as RuntimeError to be caught by FastAPI's HTTPException handler
        raise RuntimeError(f"Error getting geometry type: {str(e)}")
    finally:
        if conn:
            conn.close()


def get_mvt_tile_from_db(
    schema: str, table: str, z: int, x: int, y: int, user_id: int
) -> Optional[bytes]:
    """
    Generates a Mapbox Vector Tile (MVT) for a given schema, table, ZXY tile,
    filtered by the provided user_id.
    Includes both 'features' and 'labels' layers in the MVT.
    """
    conn = None
    try:
        geom_column = get_geometry_column(schema, table)
        if not geom_column:
            raise ValueError(f"Geometry column not found for {schema}.{table}.")

        conn = get_db_connection()

        # Get all non-geometry attributes for the table to include in the MVT
        with conn.cursor() as cursor:
            cursor.execute(
                sql.SQL(
                    """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s AND column_name != %s
            """
                ),
                [schema, table, geom_column],
            )
            attributes = [row[0] for row in cursor.fetchall()]

        # Ensure 'id' column is included if it's not the geometry column and it exists
        # This is crucial for Mapbox GL JS to identify features (used for click events, etc.)
        # To check if 'id' exists in the table, we'll re-query
        with conn.cursor() as cursor:
            cursor.execute(
                sql.SQL(
                    """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s AND column_name = 'id'
            """
                ),
                (schema, table),
            )
            if cursor.fetchone() and "id" not in attributes:
                attributes.insert(
                    0, "id"
                )  # Add 'id' to the beginning if it exists and not already added

        # Construct a SQL list of attribute identifiers for the MVT query
        attributes_sql = (
            sql.SQL(", ").join(map(sql.Identifier, attributes))
            if attributes
            else sql.SQL("NULL")
        )

        # MVT generation query with user_id filtering for both features and labels
        query = sql.SQL(
            """
            WITH bounds AS (SELECT ST_TileEnvelope(%s, %s, %s) AS geom),
            features_data AS (
                SELECT
                    ST_AsMVTGeom(
                        ST_Transform(t1.{geom_column}, 3857), -- Transform to Web Mercator for MVT
                        bounds.geom,
                        4096, -- Extent of the tile buffer
                        256, -- Buffer size
                        true
                    ) AS geom,
                    {attributes} -- Include all other attributes
                FROM {schema_name}.{table_name} t1, bounds
                WHERE ST_Intersects(ST_Transform(t1.{geom_column}, 3857), bounds.geom)
                  AND t1.user_id = %s -- Filter by user_id
            ),
            labels_data AS (
                SELECT
                    ST_AsMVTGeom(
                        ST_Transform(
                            (ST_MaximumInscribedCircle(t2.{geom_column})).center, -- Center for polygons/lines as label point
                            3857
                        ),
                        bounds.geom,
                        4096,
                        0, -- No buffer for labels
                        true
                    ) AS geom,
                    {attributes} -- Include all other attributes
                FROM {schema_name}.{table_name} t2, bounds
                WHERE ST_Intersects(ST_Transform(t2.{geom_column}, 3857), bounds.geom)
                  AND t2.user_id = %s -- Filter by user_id
            )
            SELECT
                (SELECT ST_AsMVT(features_data.*, 'features') FROM features_data) || -- MVT for main features layer
                (SELECT ST_AsMVT(labels_data.*, 'labels') FROM labels_data) -- MVT for labels layer
        """
        ).format(
            schema_name=sql.Identifier(schema),
            table_name=sql.Identifier(table),
            geom_column=sql.Identifier(geom_column),
            attributes=attributes_sql,
        )

        with conn.cursor() as cursor:
            # Pass z, x, y, and then user_id for features_data, and again for labels_data
            cursor.execute(query, [z, x, y, user_id, user_id])
            result = cursor.fetchone()
            return result[0] if result else None
    except Exception as e:
        print(f"Error generating MVT tile for user {user_id} on {schema}.{table}: {e}")
        raise  # Re-raise to be caught by FastAPI HTTPException handler
    finally:
        if conn:
            conn.close()


def get_table_extent_from_db(
    schema: str, table: str, user_id: int
) -> Optional[Dict[str, float]]:
    """
    Retrieves the bounding box (extent) of the geometry data for a given table,
    filtered by user_id.
    """
    conn = None
    try:
        geom_column = get_geometry_column(schema, table)
        if not geom_column:
            return None  # No geometry column found, no extent to calculate

        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Query to get the extent of geometries, filtered by user_id
            query = sql.SQL(
                """
                SELECT ST_XMin(ST_Extent({geom_column})) as minx,
                       ST_YMin(ST_Extent({geom_column})) as miny,
                       ST_XMax(ST_Extent({geom_column})) as maxx,
                       ST_YMax(ST_Extent({geom_column})) as maxy
                FROM {schema_name}.{table_name}
                WHERE {geom_column} IS NOT NULL AND user_id = %s
            """
            ).format(
                geom_column=sql.Identifier(geom_column),
                schema_name=sql.Identifier(schema),
                table_name=sql.Identifier(table),
            )
            cursor.execute(query, (user_id,))
            result = cursor.fetchone()
            if not result or None in result:
                return None  # No extent if no geometries or all are NULL
            return {
                "west": float(result[0]),
                "south": float(result[1]),
                "east": float(result[2]),
                "north": float(result[3]),
            }
    except Exception as e:
        print(f"Error getting table extent for user {user_id} on {schema}.{table}: {e}")
        # Re-raise as RuntimeError to be caught by FastAPI's HTTPException handler
        raise RuntimeError(f"Error getting table extent: {str(e)}")
    finally:
        if conn:
            conn.close()


def check_srid_from_db(schema: str, table: str, user_id: int) -> Dict[str, Any]:
    """
    Checks the Spatial Reference ID (SRID) of the geometry column in a table,
    filtered by user_id. Ensures it's 4326 (WGS84).
    """
    conn = None
    try:
        geom_column = get_geometry_column(schema, table)
        if not geom_column:
            return {"valid": False, "error": "No geometry column found."}

        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Query to get the SRID of the geometry, filtered by user_id
            query = sql.SQL(
                """
                SELECT ST_SRID({geom_column}) AS srid
                FROM {schema_name}.{table_name}
                WHERE {geom_column} IS NOT NULL AND user_id = %s
                LIMIT 1
            """
            ).format(
                geom_column=sql.Identifier(geom_column),
                schema_name=sql.Identifier(schema),
                table_name=sql.Identifier(table),
            )
            cursor.execute(query, (user_id,))
            result = cursor.fetchone()
            if not result or result[0] is None:
                return {
                    "valid": False,
                    "error": "SRID not found or no geometries for this user.",
                }
            srid = result[0]
            if srid == 0:
                return {
                    "valid": False,
                    "error": "Invalid SRID (0). Please set a valid SRID.",
                }
            if srid != 4326:
                return {
                    "valid": False,
                    "error": f"Table must use SRID 4326. Found: {srid}",
                }
            return {"valid": True, "srid": srid}
    except Exception as e:
        print(f"SRID check failed for user {user_id} on {schema}.{table}: {e}")
        # Re-raise as RuntimeError to be caught by FastAPI's HTTPException handler
        raise RuntimeError(f"SRID check failed: {str(e)}")
    finally:
        if conn:
            conn.close()


def get_table_fields_from_db(
    schema: str, table: str, user_id: int
) -> List[Dict[str, str]]:
    """
    Retrieves the non-geometry column names and their data types for a given table,
    filtered to ensure there's data for the specified user.
    """
    conn = None
    try:
        geom_column = get_geometry_column(schema, table)
        if not geom_column:
            # If no geometry column, it's likely not a spatial table, return empty list
            return []

        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Subquery to check if any row exists for the given user_id in the table
            # This ensures we only return fields if the user actually has data in the table.
            check_user_data_exists_query = sql.SQL(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM {schema_name}.{table_name}
                    WHERE user_id = %s
                    LIMIT 1
                )
            """
            ).format(
                schema_name=sql.Identifier(schema), table_name=sql.Identifier(table)
            )
            cursor.execute(check_user_data_exists_query, (user_id,))
            user_data_exists = cursor.fetchone()[0]

            if not user_data_exists:
                return []  # No data for this user, so no fields to return

            # Query to get column names and types, excluding the geometry column
            query = sql.SQL(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s AND column_name != %s
                ORDER BY column_name
            """
            )
            cursor.execute(query, (schema, table, geom_column))
            return [{"name": row[0], "type": row[1]} for row in cursor.fetchall()]
    except Exception as e:
        print(
            f"Failed to fetch table fields for user {user_id} on {schema}.{table}: {e}"
        )
        # Re-raise as RuntimeError to be caught by FastAPI's HTTPException handler
        raise RuntimeError(f"Failed to fetch table fields: {str(e)}")
    finally:
        if conn:
            conn.close()
