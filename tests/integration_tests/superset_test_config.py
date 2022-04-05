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
# type: ignore
import math
from copy import copy
from datetime import timedelta

from superset.config import *
from tests.integration_tests.superset_test_custom_template_processors import (
    CustomPrestoTemplateProcessor,
)

AUTH_USER_REGISTRATION_ROLE = "alpha"
SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(
    DATA_DIR, "unittests.integration_tests.db"
)
DEBUG = False
SUPERSET_WEBSERVER_PORT = 8081
SILENCE_FAB = False
# Allowing SQLALCHEMY_DATABASE_URI and SQLALCHEMY_EXAMPLES_URI to be defined as an env vars for
# continuous integration
if "SUPERSET__SQLALCHEMY_DATABASE_URI" in os.environ:
    SQLALCHEMY_DATABASE_URI = os.environ["SUPERSET__SQLALCHEMY_DATABASE_URI"]

SQLALCHEMY_EXAMPLES_URI = SQLALCHEMY_DATABASE_URI
if "SUPERSET__SQLALCHEMY_EXAMPLES_URI" in os.environ:
    SQLALCHEMY_EXAMPLES_URI = os.environ["SUPERSET__SQLALCHEMY_EXAMPLES_URI"]

if "UPLOAD_FOLDER" in os.environ:
    UPLOAD_FOLDER = os.environ["UPLOAD_FOLDER"]

if "sqlite" in SQLALCHEMY_DATABASE_URI:
    logger.warning(
        "SQLite Database support for metadata databases will be "
        "removed in a future version of Superset."
    )

# Speeding up the tests.integration_tests.
PRESTO_POLL_INTERVAL = 0.1
HIVE_POLL_INTERVAL = 0.1

SQL_MAX_ROW = 10000
SQLLAB_CTAS_NO_LIMIT = True  # SQL_MAX_ROW will not take affect for the CTA queries
FEATURE_FLAGS = {
    **FEATURE_FLAGS,
    "foo": "bar",
    "KV_STORE": True,
    "SHARE_QUERIES_VIA_KV_STORE": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "ALERT_REPORTS": True,
    "DASHBOARD_NATIVE_FILTERS": True,
}


def GET_FEATURE_FLAGS_FUNC(ff):
    ff_copy = copy(ff)
    ff_copy["super"] = "set"
    return ff_copy


TESTING = True
WTF_CSRF_ENABLED = False

FAB_ROLES = {"TestRole": [["Security", "menu_access"], ["List Users", "menu_access"]]}

AUTH_ROLE_PUBLIC = "Public"
EMAIL_NOTIFICATIONS = False
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = os.environ.get("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.environ.get("REDIS_CELERY_DB", 2)
REDIS_RESULTS_DB = os.environ.get("REDIS_RESULTS_DB", 3)
REDIS_CACHE_DB = os.environ.get("REDIS_CACHE_DB", 4)


CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(minutes=1).total_seconds()),
    "CACHE_KEY_PREFIX": "superset_cache",
    "CACHE_REDIS_URL": f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CACHE_DB}",
}

DATA_CACHE_CONFIG = {
    **CACHE_CONFIG,
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(seconds=30).total_seconds()),
    "CACHE_KEY_PREFIX": "superset_data_cache",
}

FILTER_STATE_CACHE_CONFIG = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_THRESHOLD": math.inf,
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(minutes=10).total_seconds()),
}

EXPLORE_FORM_DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_THRESHOLD": math.inf,
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(minutes=10).total_seconds()),
}

GLOBAL_ASYNC_QUERIES_JWT_SECRET = "test-secret-change-me-test-secret-change-me"

ALERT_REPORTS_WORKING_TIME_OUT_KILL = True


class CeleryConfig(object):
    BROKER_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    CELERY_IMPORTS = ("superset.sql_lab",)
    CELERY_RESULT_BACKEND = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    CELERY_ANNOTATIONS = {"sql_lab.add": {"rate_limit": "10/s"}}
    CONCURRENCY = 1


CELERY_CONFIG = CeleryConfig

CUSTOM_TEMPLATE_PROCESSORS = {
    CustomPrestoTemplateProcessor.engine: CustomPrestoTemplateProcessor
}

PRESERVE_CONTEXT_ON_EXCEPTION = False
