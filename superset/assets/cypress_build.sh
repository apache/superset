#!/bin/bash
set -e

cd "$(dirname "$0")"

#run all the python steps in a background process
time superset db upgrade
time superset load_test_users
time superset load_examples --load-test-data
time superset init
echo "[completed python build steps]"
flask run -p 8081 --with-threads --reload --debugger &

#block on the longer running javascript process
time npm ci
time npm run build
echo "[completed js build steps]"

CYPRESS_PATH='cypress/integration/'${1}'/*'
time npm run cypress run -- --spec "$CYPRESS_PATH" --record false --config video=false

kill %1
