# This script contains commands to generate vector tiles from a PostGIS database using postgis2mvt.py

# Open terminal and navigate to the directory containing postgis2mvt.py

# Structure of the command:
# python postgis2mvt.py --dbname <database_name> --user <username> --password <password> --schema <schema_name> --table <table_name> --layer <layer_name> --bbox <top_left_long> <top_left_lat> <bottom_right_long> <bottom_right_lat> --zoom <zoom_levels>
# python postgis2mvt.py --dbname <database_name> --user <username> --password <password> --query "<SQL_query>" --layer <layer_name> --bbox <top_left_long> <top_left_lat> <bottom_right_long> <bottom_right_lat> --zoom <zoom_levels>

############## Actual commands for tables ##############

# nsw_addresses
python postgis2mvt.py --dbname nsw --user postgres --password postgres --host localhost --port 5432 --schema public --table nsw_addresses --layer nsw_addresses --bbox 151.16359 -33.86696 151.22493 -33.93055 --zoom 13 14 15 16 17 18
python postgis2mvt.py --dbname nsw --user postgres --password postgres --host localhost --port 5432 --query "SELECT * FROM public.nsw_addresses" --layer nsw_addresses --bbox 151.16359 -33.86696 151.22493 -33.93055 --zoom 13 14 15 16 17 18

# nsw_roads
python postgis2mvt.py --dbname nsw --user postgres --password postgres --host localhost --port 5432 --schema public --table nsw_roads --layer nsw_roads --bbox 151.16359 -33.86696 151.22493 -33.93055 --zoom 10 11 12 13 14 15 16 17 18
python postgis2mvt.py --dbname nsw --user postgres --password postgres --host localhost --port 5432 --query "SELECT * FROM public.nsw_roads" --layer nsw_roads --bbox 151.16359 -33.86696 151.22493 -33.93055 --zoom 10 11 12 13 14 15 16 17 18

# nsw_lots
python postgis2mvt.py --dbname nsw --user postgres --password postgres --host localhost --port 5432 --schema public --table nsw_lots --layer nsw_lots --bbox 151.16359 -33.86696 151.22493 -33.93055 --zoom 13 14 15 16 17 18 
python postgis2mvt.py --dbname nsw --user postgres --password postgres --host localhost --port 5432 --query "SELECT * FROM public.nsw_roads" --layer nsw_lots --bbox 151.16359 -33.86696 151.22493 -33.93055 --zoom 13 14 15 16 17 18

# nsw_landzones
python postgis2mvt.py --dbname nsw --user postgres --password postgres --host localhost --port 5432 --schema public --table nsw_landzones --layer nsw_landzones --bbox 151.16359 -33.86696 151.22493 -33.93055 --zoom 8 9 10 11 12 13 14 15 16 17 18
python postgis2mvt.py --dbname nsw --user postgres --password postgres --host localhost --port 5432 --query "SELECT * FROM public.nsw_landzones" --layer nsw_landzones --bbox 151.16359 -33.86696 151.22493 -33.93055 --zoom 8 9 10 11 12 13 14 15 16 17 18