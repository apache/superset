#!/bin/bash
set -ex

if [ "$SUPERSET_ENV" = "local" ]; then
  superset runserver -d
elif [ "$SUPERSET_ENV" = "production" ]; then
  superset runserver -a 0.0.0.0 -w $((2 * $(getconf _NPROCESSORS_ONLN) + 1))
else
  superset --help
fi
