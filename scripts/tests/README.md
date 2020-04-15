# Utility script to run tests faster

## Use:

From the superset repo root directory:

- Example run a single module, will launch (or clean relaunch) Redis and Postgres:
```$bash
scripts/tests/run.sh tests.charts.api_tests
```

- Example run a single test, will launch (or clean relaunch) Redis and Postgres:
```$bash
scripts/tests/run.sh tests.charts.api_tests:ChartApiTests.test_get_charts
```

- Example run a single test, without any init procedures. Init procedures include
  relaunching containers, db upgrade, superset init, loading example data. If your tests
  are idempotent, after the first run, subsequent runs are really fast
```$bash
scripts/tests/run.sh tests.charts.api_tests:ChartApiTests.test_get_charts --no-init
```

- Same has above but using MySQL backend
```$bash
scripts/tests/run.sh tests.charts.api_tests:ChartApiTests.test_get_charts --no-init --mysql
```

- Example for not using the "provided" containers, you have your own probably
```$bash
scripts/tests/run.sh tests.charts.api_tests:ChartApiTests.test_get_charts --no-docker
```
