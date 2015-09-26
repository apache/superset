rm /tmp/panoramix_unittests.db
export PANORAMIX_CONFIG=tests.panoramix_test_config
panoramix/bin/panoramix db upgrade
nosetests tests/core_tests.py --with-coverage --cover-package=panoramix
