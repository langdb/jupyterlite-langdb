#!/bin/sh

# Remove the dist folder
rm -rf dist

# Remove the .jupyterlite.doit.db file
rm -f .jupyterlite.doit.db

# Run jupyter lite build with output directory as dist
poetry run jupyter lite build --output-dir dist
echo "=== JupyterLite build done ==="
ls -la dist/notebooks/

echo "=== Copied the notebooks to samples folder ==="

src="dist/notebooks"
dst="dist/notebooks-samples"
mkdir -p "$dst"

if [[ "$OSTYPE" == "darwin"* ]]; then
    cp -R "$src/" "$dst"
else 
    cp -R "$src/"* "$dst"
fi

echo "=== list the files in samples folder ==="

ls -la dist/notebooks-samples/



echo "=== Copying the notebooks and css files ==="


cp "notebooks/notebooks.css" "dist/notebooks/notebooks.css"
cp "notebooks/samples.css" "dist/notebooks-samples/samples.css"



if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's|</head>|<link rel="stylesheet" type="text/css" href="/notebooks/notebooks.css" /></head>|' dist/notebooks/index.html
    sed -i '' 's|</head>|<link rel="stylesheet" type="text/css" href="/notebooks-samples/samples.css" /></head>|' dist/notebooks-samples/index.html
else
    sed -i 's|</head>|<link rel="stylesheet" type="text/css" href="/notebooks/notebooks.css" /></head>|' dist/notebooks/index.html
    sed -i 's|</head>|<link rel="stylesheet" type="text/css" href="/notebooks-samples/samples.css" /></head>|' dist/notebooks-samples/index.html
fi