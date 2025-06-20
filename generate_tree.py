import os


def generate_tree(start_path, prefix=""):
    items = sorted([item for item in os.listdir(start_path) if item not in ["__pycache__", "py_env"]])
    output = ""
    for index, item in enumerate(items):
        path = os.path.join(start_path, item)
        connector = "└── " if index == len(items) - 1 else "├── "
        output += prefix + connector + item + "\n"
        if os.path.isdir(path):
            extension = "    " if index == len(items) - 1 else "│   "
            output += generate_tree(path, prefix + extension)
    return output


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate directory structure as text (excludes __pycache__)."
    )
    parser.add_argument("directory", help="Root directory path")
    args = parser.parse_args()

    print(f"Directory structure for: {args.directory}\n")
    print(generate_tree(args.directory))
