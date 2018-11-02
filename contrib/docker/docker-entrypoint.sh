#!/bin/bash
set -ex

if [ "$#" -ne 0 ]; then
    exec "$@"
elif [ "$SUPERSET_ENV" = "local" ]; then
    flask run -p 8080 --with-threads --reload --debugger  --host=0.0.0.0
elif [ "$SUPERSET_ENV" = "production" ]; then
    superset runserver -a 0.0.0.0 -w $((2 * $(getconf _NPROCESSORS_ONLN) + 1))
else
    superset --help
fi
