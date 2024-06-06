#!/bin/sh

# Remove the dist folder
rm -rf dist

# Remove the .jupyterlite.doit.db file
rm -f .jupyterlite.doit.db

# Run jupyter lite build with output directory as dist
poetry run jupyter lite build --output-dir dist
cp "notebooks/read-only.css" "dist/notebooks/read-only.css"
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's|</head>|<link rel="stylesheet" type="text/css" href="/notebooks/read-only.css" /></head>|' dist/notebooks/index.html
else
    sed -i 's|</head>|<link rel="stylesheet" type="text/css" href="/notebooks/read-only.css" /></head>|' dist/notebooks/index.html
fi