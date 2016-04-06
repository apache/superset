#!/usr/bin/env bash
<<<<<<< HEAD
rm /tmp/dashed_unittests.db
export DASHED_CONFIG=tests.dashed_test_config
dashed/bin/dashed db upgrade
nosetests tests/core_tests.py --with-coverage --cover-package=dashed -v
=======
rm /tmp/caravel_unittests.db
rm -f .coverage
export CARAVEL_CONFIG=tests.caravel_test_config
caravel/bin/caravel db upgrade
python setup.py nosetests
>>>>>>> c2baa53b060cda4352582d238f53369e3f7773d0
