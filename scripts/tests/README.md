<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Utility script to run tests faster

By default tests will be run using the Postgres container defined at the `docker-compose` file on the root of the repo,
so prior to using this script make sure to launch the dev containers.

You can use a different DB backend by defining `SUPERSET__SQLALCHEMY_DATABASE_URI` env var.

## Use:

From the superset repo root directory:

- Example run a single test module:
```$bash
scripts/tests/run.sh tests.charts.api_tests
```

- Example run a single test:
```$bash
scripts/tests/run.sh tests.charts.api_tests:ChartApiTests.test_get_charts
```

- Example run a single test, without any init procedures. Init procedures include:
  resetting test database, db upgrade, superset init, loading example data. If your tests
  are idempotent, after the first run, subsequent runs are really fast
```$bash
scripts/tests/run.sh tests.charts.api_tests:ChartApiTests.test_get_charts --no-init
```

- Example for not recreating the test DB (will still run all the tests init procedures)
```$bash
scripts/tests/run.sh tests.charts.api_tests:ChartApiTests.test_get_charts --no-reset-db
```

- Example for not running tests just initialize the test DB (drop/create, upgrade and load examples)
```$bash
scripts/tests/run.sh . --no-tests
```

- Example for just resetting the tests DB
```$bash
scripts/tests/run.sh . --reset-db
```
