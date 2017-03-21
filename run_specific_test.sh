#!/usr/bin/env bash
echo $DB
rm -f .coverage
export SUPERSET_CONFIG=tests.superset_test_config
set -e
superset/bin/superset version -v
export SOLO_TEST=1
# e.g. tests.core_tests:CoreTests.test_templated_sql_json
nosetests $1
