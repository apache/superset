#!/usr/bin/env bash
<<<<<<< a5f33fecd81ce1c86859856bdc1a3a4f73b7893c
rm /tmp/caravel_unittests.db
rm -f .coverage
export CARAVEL_CONFIG=tests.caravel_test_config
set -e
caravel/bin/caravel db upgrade
python setup.py nosetests
=======
rm /tmp/dashed_unittests.db
export DASHED_CONFIG=tests.dashed_test_config
dashed/bin/dashed db upgrade
nosetests tests/core_tests.py --with-coverage --cover-package=dashed -v
>>>>>>> [panoramix] -> [dashed]
