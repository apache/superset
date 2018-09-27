#!/bin/bash
set -e

superset/bin/superset db upgrade
superset/bin/superset load_test_users
superset/bin/superset load_examples
superset/bin/superset init
superset/bin/superset runserver &

cd "$(dirname "$0")"

npm install -g yarn
yarn
npm run build
npm run cypress run --record --parallel --key 1f958c86-be14-44d9-8d08-fad68da06811
kill %1
