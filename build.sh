#!/bin/sh

# Remove the dist folder
rm -rf dist

# Remove the .jupyterlite.doit.db file
rm -f .jupyterlite.doit.db

# Run jupyter lite build with output directory as dist
poetry run jupyter lite build --output-dir dist
