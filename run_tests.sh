#!/usr/bin/env bash
echo $DB
rm ~/.caravel/unittests.db
rm ~/.caravel/celerydb.sqlite
rm ~/.caravel/celery_results.sqlite
rm -f .coverage
export CARAVEL_CONFIG=tests.caravel_test_config
set -e
caravel/bin/caravel db upgrade
caravel/bin/caravel db upgrade  # running twice on purpose as a test
caravel/bin/caravel version -v
python setup.py nosetests
