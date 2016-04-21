#!/usr/bin/env bash
rm /tmp/caravel_unittests.db
rm -f .coverage
export CARAVEL_CONFIG=tests.caravel_test_config
set -e
caravel/bin/caravel db upgrade
python setup.py nosetests
