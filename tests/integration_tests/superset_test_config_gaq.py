# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# flake8: noqa
# type: ignore

"""Config for the Global Async Queries Playwright job only.

This deliberately does NOT live in ``superset_test_config``. That module is
imported by ``tests/conftest.py`` on every test run, and
``CacheManager._init_distributed_coordination`` only *sets*
``_distributed_coordination`` when a config is present -- it never clears it.
Putting ``DISTRIBUTED_COORDINATION_CONFIG`` in the shared config therefore
leaves the process-wide ``cache_manager`` singleton pointing at a real Redis
for unit tests too, so any test reaching ``DistributedLock`` /
``CoordinationService`` without mocking would silently take the Redis path
instead of the documented no-op default, and fail outright wherever
localhost:6379 is not available.
"""

import os
from datetime import timedelta

from .superset_test_config import *  # noqa: F403
from .superset_test_config import REDIS_HOST, REDIS_PORT

# Async chart data runs on the Global Task Framework, which reaches Redis
# through the coordination service rather than a GAQ-specific cache backend
# (`GLOBAL_ASYNC_QUERIES_CACHE_BACKEND` was removed with that migration). The
# config default is `None`, so without this there is no coordinator: task
# completion is never signalled, submissions return 202 and the client waits
# forever. Built from the same environment variables as `CACHE_CONFIG`, with
# its own DB index so coordination streams stay out of the query cache.
#
# Note the discrete host/port/db keys rather than a CACHE_REDIS_URL: the Redis
# backends read CACHE_REDIS_HOST/PORT/DB and ignore a URL entirely, so supplying
# one silently leaves the connection on its localhost:6379 defaults.
COORDINATION_REDIS_DB = os.environ.get("COORDINATION_REDIS_DB", 5)
DISTRIBUTED_COORDINATION_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(minutes=10).total_seconds()),
    "CACHE_KEY_PREFIX": "superset_coordination",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": int(REDIS_PORT),
    "CACHE_REDIS_DB": int(COORDINATION_REDIS_DB),
}
