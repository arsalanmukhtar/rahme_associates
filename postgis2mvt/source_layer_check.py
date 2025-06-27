import sys
import gzip
import mapbox_vector_tile

tile = sys.argv[1]

with open(tile, "rb") as f:
    data = f.read()
    try:
        # decompress if gzipped
        data = gzip.decompress(data)
    except:
        pass
    tile = mapbox_vector_tile.decode(data)

# Print all top-level layer names
print("Source layers:", list(tile.keys()))