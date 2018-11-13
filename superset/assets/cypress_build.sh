#!/bin/bash
set -e

superset/bin/superset db upgrade
superset/bin/superset load_test_users
superset/bin/superset load_examples
superset/bin/superset init
superset/bin/superset runserver &

cd "$(dirname "$0")"

yarn install --frozen-lockfile
npm run build
npm run cypress run
kill %1
