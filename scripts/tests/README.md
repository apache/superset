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
