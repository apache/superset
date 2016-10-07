#!/usr/bin/env bash
echo $DB
rm -f .coverage
export CARAVEL_CONFIG=tests.caravel_test_config
set -e
caravel/bin/caravel version -v
export SOLO_TEST=1
nosetests tests.core_tests:CoreTests.test_slice_endpoint
