#!/usr/bin/env bash
echo $DB
rm -f .coverage
export CARAVEL_CONFIG=tests.caravel_test_config
set -e
caravel/bin/caravel version -v
export SOLO_TEST=1
# e.g. tests.core_tests:CoreTests.test_templated_sql_json
nosetests $1
