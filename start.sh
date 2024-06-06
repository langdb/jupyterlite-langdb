#!/bin/sh

poetry run  pip uninstall -y langdb-kernel-lite langdb-files
poetry install
sh build.sh
serve dist -p 8001
