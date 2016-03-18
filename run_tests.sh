#!/usr/bin/env bash
rm /tmp/dashed_unittests.db
export DASHED_CONFIG=tests.dashed_test_config
dashed/bin/dashed db upgrade
nosetests tests/core_tests.py --with-coverage --cover-package=dashed -v
