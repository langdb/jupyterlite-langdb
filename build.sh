#!/bin/sh

# Remove the dist folder
rm -rf dist

# Remove the .jupyterlite.doit.db file
rm -f .jupyterlite.doit.db

# Run jupyter lite build with output directory as dist
jupyter lite build --output-dir dist

echo "==== Built successfully"
# Define the source and destination directories
src="dist/notebooks"
dst="dist/notebooks-readonly"

# Create the destination directory if it doesn't exist
mkdir -p "$dst"

# Copy the contents of the source directory to the destination directory
cp -R "$src/" "$dst"

# Copy the readonly.css file to the destination
cp "notebooks/read-only.css" "dist/notebooks-readonly/read-only.css"

# Inject the CSS into the HTML files

sed -i '' 's/<\/head>/<link rel="stylesheet" type="text\/css" href="read-only.css" \/><\/head>/' dist/notebooks-readonly/index.html
