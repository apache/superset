#!/usr/bin/env bash

set -ex

  echo "Initializing database"
  superset db upgrade

  echo "Creating default roles and permissions"
  superset init

# To start a development web server, use the -d switch
 
  gunicorn --bind  0.0.0.0:8088 \
      --workers $((2 * $(getconf _NPROCESSORS_ONLN) + 1)) \
      --timeout 60 \
      --limit-request-line 0 \
      --limit-request-field_size 0 \
      superset:app
