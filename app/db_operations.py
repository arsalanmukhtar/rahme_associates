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
    Retrieves all schemas and tables that have PostGIS geometry columns (any SRID).
    This function is NOT filtered by user_id, as it's for discovering available layers.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Get schemas that the current user has access to and contain geometry columns
            cursor.execute(
                """
                SELECT DISTINCT f_table_schema
                FROM geometry_columns gc
                WHERE f_table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                ORDER BY f_table_schema;
                """
            )
            schemas = [row[0] for row in cursor.fetchall()]

            schema_data = {}
            # For each schema, get its tables with geometry columns (any SRID)
            for schema in schemas:
                cursor.execute(
                    """
                    SELECT DISTINCT f_table_name
                    FROM geometry_columns
                    WHERE f_table_schema = %s
                    ORDER BY f_table_name;
                    """,
                    (schema,)
                )
                tables = [row[0] for row in cursor.fetchall()]
                if tables:  # Only include schemas that have tables
                    schema_data[schema] = tables
            return schema_data
    except Exception as e:
        raise RuntimeError(f"Failed to retrieve schemas and tables: {str(e)}")
    finally:
        if conn:
            conn.close()

def get_geometry_type_from_db(schema: str, table: str, user_id: int) -> Optional[str]:
    """
    Retrieves the geometry type (e.g., 'ST_MultiPolygon', 'ST_Point') for a table's
    geometry column. If the table has a user_id column, filter by user_id. Otherwise, do not filter.
    """
    conn = None
    try:
        geom_column = get_geometry_column(schema, table)
        if not geom_column:
            # If no geometry column is found, it's not a spatial table relevant to this function
            return None

        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if user_id column exists
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s AND column_name = 'user_id'
                LIMIT 1
                """,
                (schema, table)
            )
            has_user_id = cursor.fetchone() is not None

            if has_user_id:
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
                cursor.execute(query, (user_id,))
            else:
                query = sql.SQL(
                    """
                    SELECT DISTINCT ST_GeometryType({geom_column}) AS geom_type
                    FROM {schema_name}.{table_name}
                    WHERE {geom_column} IS NOT NULL
                    LIMIT 1
                    """
                ).format(
                    geom_column=sql.Identifier(geom_column),
                    schema_name=sql.Identifier(schema),
                    table_name=sql.Identifier(table),
                )
                cursor.execute(query)
            result = cursor.fetchone()
            return result[0] if result else None
    except Exception as e:
        print(
            f"Error getting geometry type for user {user_id} on {schema}.{table}: {e}"
        )
        raise RuntimeError(f"Error getting geometry type: {str(e)}")
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
    Retrieves the non-geometry column names and their data types for a given table.
    If the table has a user_id column, only returns fields if the user has data in the table.
    If not, returns all non-geometry fields.
    """
    conn = None
    try:
        geom_column = get_geometry_column(schema, table)
        if not geom_column:
            # If no geometry column, it's likely not a spatial table, return empty list
            return []

        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if user_id column exists
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s AND column_name = 'user_id'
                LIMIT 1
                """,
                (schema, table)
            )
            has_user_id = cursor.fetchone() is not None

            if has_user_id:
                # Subquery to check if any row exists for the given user_id in the table
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
            else:
                # No user_id column, just return all non-geometry fields
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
