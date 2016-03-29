#!/usr/bin/env bash
rm /tmp/caravel_unittests.db
export CARAVEL_CONFIG=tests.caravel_test_config
caravel/bin/caravel db upgrade
python setup.py nosetests
