#!/usr/bin/env bash

set -ex

  echo "Initializing database"
  superset db upgrade

  echo "Creating default roles and permissions"
  superset init

# To start a development web server, use the -d switch
 
  gunicorn --bind  0.0.0.0:$SUPERSET_CONTAINER_PORT \
      --workers $((2 * $SUPERSET_NPROCESSORS + 1)) \
      -k gevent \
      --timeout $SUPERSET_SERVER_WORKER_TIMEOUT \
      --limit-request-line 0 \
      --limit-request-field_size 0 \
      superset:app