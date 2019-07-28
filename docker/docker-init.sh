#!/usr/bin/env bash

set -ex

  echo "Initializing database"
  superset db upgrade

  echo "Creating default roles and permissions"
  superset init

# To start a development web server, use the -d switch
 
  gunicorn --bind  0.0.0.0:$CONTAINER_PORT \
      --workers $((2 * $GUNICORN_PROCESSORS + 1)) \
      -k gevent \
      --timeout $GUNICORN_WORKER_TIMEOUT \
      --limit-request-line 0 \
      --limit-request-field_size 0 \
      superset:app