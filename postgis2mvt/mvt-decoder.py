import argparse
import os
import json
from mapbox_vector_tile import decode
import requests
from io import BytesIO


def read_properties_only(file_path):
    """
    Reads the MVT file and extracts only properties (no geometry).
    Returns a list of feature dictionaries.
    Supports both local file paths and URLs.
    """
    if file_path.startswith('http://') or file_path.startswith('https://'):
        response = requests.get(file_path)
        response.raise_for_status()
        data = response.content
    else:
        with open(file_path, "rb") as f:
            data = f.read()
    tile = decode(data)

    all_properties = []

    for layer_name, layer in tile.items():
        print(f"\nLayer: {layer_name}")
        for feature in layer["features"]:
            all_properties.append(
                {"layer": layer_name, "properties": feature.get("properties", {})}
            )

    print(f"\nTotal features: {len(all_properties)}")
    return all_properties


def save_properties_json(properties_list, mvt_path):
    """
    Saves the properties list to a JSON file in the same directory as the script.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    mvt_filename = os.path.basename(mvt_path)
    json_filename = os.path.splitext(mvt_filename)[0] + "_props.json"
    output_path = os.path.join(script_dir, json_filename)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(properties_list, f, indent=2)

    print(f"\nProperties saved to: {output_path}")
    print(f"File size: {os.path.getsize(output_path) / 1024:.2f} KB")


def main():
    parser = argparse.ArgumentParser(description="Extract properties from MVT file")
    parser.add_argument("mvt_file", help="Path to MVT file")
    args = parser.parse_args()

    print(f"\nProcessing MVT: {args.mvt_file}")
    print("=" * 50)

    props = read_properties_only(args.mvt_file)
    save_properties_json(props, args.mvt_file)

    print("\nDone!")
    print("=" * 50)


if __name__ == "__main__":
    main()