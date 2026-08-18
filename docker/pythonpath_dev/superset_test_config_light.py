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
#
# Test configuration for docker-compose-light.yml - uses SimpleCache instead of Redis

# Import all settings from the main test config first
import os
import sys

# Add the tests directory to the path to import the test config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from tests.integration_tests.superset_test_config import *  # noqa: F403

# Override Redis-based caching to use simple in-memory cache
CACHE_CONFIG = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_test_",
}

DATA_CACHE_CONFIG = {
    **CACHE_CONFIG,
    "CACHE_DEFAULT_TIMEOUT": 30,
    "CACHE_KEY_PREFIX": "superset_test_data_",
}

# Keep SimpleCache for these as they're already using it
# FILTER_STATE_CACHE_CONFIG - already SimpleCache in parent
# EXPLORE_FORM_DATA_CACHE_CONFIG - already SimpleCache in parent

# Disable Celery for lightweight testing
CELERY_CONFIG = None

# Use FileSystemCache for SQL Lab results instead of Redis
from flask_caching.backends.filesystemcache import FileSystemCache  # noqa: E402

RESULTS_BACKEND = FileSystemCache("/app/superset_home/sqllab_test")

# Override WEBDRIVER_BASEURL for tests to match expected values
WEBDRIVER_BASEURL = "http://0.0.0.0:8080/"
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL
