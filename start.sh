#!/bin/sh
set -e

poetry run pip uninstall -y langdb-kernel-lite langdb-files

sh build.sh
python -m http.server -d dist 8001
