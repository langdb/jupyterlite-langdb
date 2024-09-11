#!/bin/sh
set -e

poetry run pip uninstall -y langdb-kernel-lite langdb-files jupyterlab-tour

sh build.sh
python -m http.server -d dist 8001
