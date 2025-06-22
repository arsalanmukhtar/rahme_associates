import argparse
import os
import math
import psycopg2
from psycopg2 import sql
import mercantile # Import mercantile for tile calculations
from tqdm import tqdm # Import tqdm for progress bars

def deg2rad(deg):
    """Converts degrees to radians."""
    return deg * math.pi / 180.0

def rad2deg(rad):
    """Converts radians to degrees."""
    return rad * 180.0 / math.pi

def latlon_to_tile(lat_deg, lon_deg, zoom):
    """
    Converts latitude and longitude to a tile's (x, y) coordinates.
    Returns (tile_x, tile_y) for the top-left corner of the tile
    that contains the given lat/lon.
    """
    lat_rad = deg2rad(lat_deg)
    n = 2 ** zoom
    tile_x = int(math.floor((lon_deg + 180.0) / 360.0 * n))
    tile_y = int(math.floor((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n))
    return tile_x, tile_y

def tile_to_latlon(x, y, z):
    """
    Converts tile (x, y, z) coordinates to the (latitude, longitude)
    of the top-left corner of the tile.
    """
    n = 2 ** z
    lon_deg = x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat_deg = rad2deg(lat_rad)
    return lat_deg, lon_deg

def tile_bounds(x, y, z):
    """
    Calculates the WGS84 bounding box (west_lon, south_lat, east_lon, north_lat)
    for a given tile (x, y, z).
    """
    north_lat, west_lon = tile_to_latlon(x, y, z)
    south_lat, east_lon = tile_to_latlon(x + 1, y + 1, z)
    return west_lon, south_lat, east_lon, north_lat

def get_tile_range_for_bbox(min_lat, min_lon, max_lat, max_lon, zoom):
    """
    Calculates the min/max tile x and y indices that cover the given
    WGS84 bounding box at a specific zoom level. (This function is no longer
    used directly for iteration, but kept for clarity if needed elsewhere).
    """
    # Get tile for top-left corner of the bbox
    min_x, min_y = latlon_to_tile(max_lat, min_lon, zoom)
    # Get tile for bottom-right corner of the bbox
    max_x, max_y = latlon_to_tile(min_lat, max_lon, zoom)
    return min_x, min_y, max_x, max_y

def get_table_columns(cursor, schema_name, table_name):
    """
    Fetches all column names for a given table and schema, excluding geometry columns.
    Assumes 'geom' is the geometry column name.
    """
    query = sql.SQL("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = {schema_name}
          AND table_name = {table_name}
          AND data_type NOT IN ('USER-DEFINED', 'geometry'); -- Exclude PostGIS geometry type
    """).format(
        schema_name=sql.Literal(schema_name),
        table_name=sql.Literal(table_name)
    )
    cursor.execute(query)
    columns = [row[0] for row in cursor.fetchall()]
    return columns

def main():
    parser = argparse.ArgumentParser(description="Generate Mapbox Vector Tiles from PostGIS.")
    parser.add_argument("--dbname", required=True, help="Database name")
    parser.add_argument("--user", required=True, help="Database user")
    parser.add_argument("--password", required=True, help="Database password")
    parser.add_argument("--schema", required=True, help="Database schema (e.g., public)")
    parser.add_argument("--table", required=True, help="Table name to extract data from")
    parser.add_argument("--layer", required=True, help="Layer name for the MVT (will be used for folder and MVT layer name)")
    parser.add_argument("--bbox", nargs=4, type=float, required=True,
                        help="Bounding box in WGS84: top_left_long top_left_lat bottom_right_long bottom_right_lat") # Updated help text
    parser.add_argument("--zoom", nargs='+', type=int, required=True,
                        help="Space-separated list of zoom levels to generate (e.g., 4 5 6)")

    args = parser.parse_args()

    # Parse bounding box according to the new convention: top_left_long top_left_lat bottom_right_long bottom_right_lat
    top_left_long, top_left_lat, bottom_right_long, bottom_right_lat = args.bbox

    # mercantile.tiles expects (west, south, east, north)
    # Map the input values to mercantile's expected order
    min_lon_merc = top_left_long     # West is top_left_long
    max_lon_merc = bottom_right_long # East is bottom_right_long
    min_lat_merc = bottom_right_lat  # South is bottom_right_lat
    max_lat_merc = top_left_lat      # North is top_left_lat

    conn = None
    try:
        # Establish database connection
        print("="*50)
        print(f"Connecting to database: {args.dbname} as user: {args.user}...")
        conn = psycopg2.connect(
            dbname=args.dbname,
            user=args.user,
            password=args.password,
            host="localhost" # Assuming local database, can be made configurable
        )
        cur = conn.cursor()
        print("Database connection successful. [✓]")

        # Dynamically get column names from the table
        print(f"Fetching column names for {args.schema}.{args.table}...")
        columns_to_include = get_table_columns(cur, args.schema, args.table)
        
        # Ensure 'id' is selected if it exists, otherwise use a placeholder.
        # If your table has a unique ID column, it's best to use that as the MVT 'id'.
        # Assuming 'id' or 'gid' is commonly used as a primary key.
        # You might need to adjust this logic based on your actual table's ID column name.
        mvt_id_column_select = ""
        id_column_name_for_print = "id" # Default for printing
        if 'id' in columns_to_include:
            mvt_id_column_select = sql.SQL("t.id AS id")
            columns_to_include.remove('id') # Remove to avoid duplicate selection if 'id' is desired as MVT feature ID
        elif 'gid' in columns_to_include: # Common alternative for ID
            mvt_id_column_select = sql.SQL("t.gid AS id")
            columns_to_include.remove('gid')
            id_column_name_for_print = "gid" # Update for printing
        else:
            mvt_id_column_select = sql.SQL("1 AS id") # Fallback to dummy ID if no id/gid found
            id_column_name_for_print = "id (dummy)" # Update for printing dummy id

        # Construct the comma-separated list of columns for the SQL query
        # Using sql.Identifier to safely quote column names
        properties_select_list = sql.SQL(', ').join(
            [sql.SQL("t.{}").format(sql.Identifier(col)) for col in columns_to_include]
        )
        
        # Combine geometry, ID, and other properties
        if properties_select_list.as_string(conn) == '': # Check if properties_select_list is empty
             final_select_list = sql.SQL("""
                ST_AsMVTGeom(
                    t.geom,
                    bounds.geom,
                    4096,
                    256,
                    true
                ) AS geom,
                {}
            """).format(mvt_id_column_select)
        else:
            final_select_list = sql.SQL("""
                ST_AsMVTGeom(
                    t.geom,
                    bounds.geom,
                    4096,
                    256,
                    true
                ) AS geom,
                {},
                {}
            """).format(mvt_id_column_select, properties_select_list)

        # Corrected print statement: construct a list of strings for display
        printable_columns = [id_column_name_for_print] + [col for col in columns_to_include if col != 'geom']
        print(f"Columns to be included in MVT properties: {', '.join(printable_columns)}")
        print("="*50)


        base_tiles_dir = "tiles"
        layer_tiles_dir = os.path.join(base_tiles_dir, args.layer)
        os.makedirs(layer_tiles_dir, exist_ok=True)
        print(f"Output directory ensured: {os.path.abspath(layer_tiles_dir)}")
        print("="*50)

        for zoom in sorted(args.zoom):
            print(f"\n--- Generating tiles for zoom level: {zoom} ---")
            zoom_dir = os.path.join(layer_tiles_dir, str(zoom))
            os.makedirs(zoom_dir, exist_ok=True)
            print(f"  Zoom level directory ensured: {zoom_dir}")

            # Use mercantile.tiles to get all tiles within the bbox for the current zoom
            tiles_to_process = list(mercantile.tiles(min_lon_merc, min_lat_merc, max_lon_merc, max_lat_merc, zoom))
            print(f"  Found {len(tiles_to_process)} tiles to process for zoom {zoom}.")

            tile_count = 0
            # Wrap the tile iteration with tqdm for a progress bar
            for tile in tqdm(tiles_to_process, desc=f"Processing Z{zoom} tiles", unit="tile"):
                x, y, z = tile.x, tile.y, tile.z # mercantile.Tile objects have x, y, z attributes

                x_dir = os.path.join(zoom_dir, str(x))
                os.makedirs(x_dir, exist_ok=True)

                tile_path = os.path.join(x_dir, f"{y}.pbf")

                # Construct the SQL query for ST_AsMVT
                # Using ST_TileEnvelope({z}, {x}, {y}) without explicit margin or SRID
                # This function returns geometry in SRID 3857 (Web Mercator)
                query = sql.SQL("""
                    SELECT ST_AsMVT(tile_data, {layer_name}, 4096, 'geom') FROM (
                        WITH bounds AS (
                            SELECT ST_TileEnvelope({z}, {x}, {y}) AS geom
                        )
                        SELECT
                            {final_select_list}
                        FROM {schema_name}.{table_name} AS t, bounds
                        WHERE ST_Intersects(t.geom, bounds.geom)
                    ) AS tile_data;
                """).format(
                    layer_name=sql.Literal(args.layer),
                    z=sql.Literal(z),
                    x=sql.Literal(x),
                    y=sql.Literal(y),
                    final_select_list=final_select_list,
                    schema_name=sql.Identifier(args.schema),
                    table_name=sql.Identifier(args.table)
                )

                cur.execute(query)
                mvt_data = cur.fetchone()[0] # ST_AsMVT returns bytea

                if mvt_data:
                    with open(tile_path, "wb") as f:
                        f.write(mvt_data)
                    tile_count += 1
                # else:
                    # No data for this tile. The progress bar still advances.

            print(f"--- Completed zoom {zoom}: Generated {tile_count} tiles. ---")

    except psycopg2.Error as e:
        print(f"\n[ERROR] Database error: {e}")
    except Exception as e:
        print(f"\n[ERROR] An unexpected error occurred: {e}")
    finally:
        if conn:
            conn.close()
            print("\nDatabase connection closed. [✓]")
            print("="*50)

if __name__ == "__main__":
    main()