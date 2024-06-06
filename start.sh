#!/bin/sh

# Run eslint
cd packages/langdb-files && yarn eslint:check --fix
cd ../..
cd packages/langdb-kernel-lite && yarn eslint:check --fix
cd ../..

poetry run  pip uninstall -y langdb-kernel-lite langdb-files
poetry install

sh build.sh
serve dist -p 8001
