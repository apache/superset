#!/usr/bin/env bash
<<<<<<< 4386977960aaa513607464e437084f2dc7435647
<<<<<<< a5f33fecd81ce1c86859856bdc1a3a4f73b7893c
rm /tmp/caravel_unittests.db
rm -f .coverage
export CARAVEL_CONFIG=tests.caravel_test_config
set -e
caravel/bin/caravel db upgrade
python setup.py nosetests
=======
=======
<<<<<<< HEAD
>>>>>>> merge from caravel/master
rm /tmp/dashed_unittests.db
export DASHED_CONFIG=tests.dashed_test_config
dashed/bin/dashed db upgrade
nosetests tests/core_tests.py --with-coverage --cover-package=dashed -v
<<<<<<< 4386977960aaa513607464e437084f2dc7435647
>>>>>>> [panoramix] -> [dashed]
=======
=======
rm /tmp/caravel_unittests.db
rm -f .coverage
export CARAVEL_CONFIG=tests.caravel_test_config
caravel/bin/caravel db upgrade
python setup.py nosetests
>>>>>>> c2baa53b060cda4352582d238f53369e3f7773d0
>>>>>>> merge from caravel/master
