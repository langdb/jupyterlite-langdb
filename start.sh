#!/bin/sh
set -e
# Run eslint
#cd packages/langdb-files && yarn eslint:check --fix
#cd ../..
#cd packages/langdb-kernel-lite && yarn eslint:check --fix
#cd ../..

poetry run pip uninstall -y langdb-kernel-lite langdb-trace-ui langdb-files

sh build.sh
python -m http.server -d dist 8001
