#!/bin/sh

# Remove the dist folder
rm -rf dist || 0

# Remove the .jupyterlite.doit.db file
rm -f .jupyterlite.doit.db || 0

poetry install
# Run jupyter lite build with output directory as dist
poetry run jupyter lite build --output-dir dist

src="dist/notebooks"
dst="dist/notebooks-samples"
mkdir -p "$dst"

if [[ "$OSTYPE" == "darwin"* ]]; then
    cp -R "$src/" "$dst"
else 
    cp -R "$src/"* "$dst"
fi


cp "notebooks/notebooks.css" "dist/notebooks/notebooks.css"
cp "notebooks/samples.css" "dist/notebooks-samples/samples.css"
cp "repl/repl.css" "dist/repl/repl.css"


if [[ "$OSTYPE" == "darwin"* ]]; then
    BACKUP_FILE=".bak"
else
    BACKUP_FILE=""
fi

sed -i$BACKUP_FILE 's|</head>|<link rel="stylesheet" type="text/css" href="../notebooks/notebooks.css" /></head>|' dist/notebooks/index.html
sed -i$BACKUP_FILE 's|</head>|<link rel="stylesheet" type="text/css" href="../notebooks-samples/samples.css" /></head>|' dist/notebooks-samples/index.html
sed -i$BACKUP_FILE 's|</head>|<link rel="stylesheet" type="text/css" href="../repl/repl.css" /></head>|' dist/repl/index.html