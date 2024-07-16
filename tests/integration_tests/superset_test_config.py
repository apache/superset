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
import logging
import math
from copy import copy
from datetime import timedelta

from sqlalchemy.engine import make_url

from superset.config import *  # noqa: F403
from superset.config import DATA_DIR
from tests.integration_tests.superset_test_custom_template_processors import (
    CustomPrestoTemplateProcessor,
)

logging.getLogger("flask_appbuilder.baseviews").setLevel(logging.WARNING)
logging.getLogger("flask_appbuilder.base").setLevel(logging.WARNING)
logging.getLogger("flask_appbuilder.api").setLevel(logging.WARNING)
logging.getLogger("flask_appbuilder.security.sqla.manager").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.engine.Engine").setLevel(logging.WARNING)

SECRET_KEY = "dummy_secret_key_for_test_to_silence_warnings"
AUTH_USER_REGISTRATION_ROLE = "alpha"
SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(  # noqa: F405
    DATA_DIR,
    "unittests.integration_tests.db",  # noqa: F405
)
SILENCE_FAB = False
# Allowing SQLALCHEMY_DATABASE_URI and SQLALCHEMY_EXAMPLES_URI to be defined as an env vars for
# continuous integration
if "SUPERSET__SQLALCHEMY_DATABASE_URI" in os.environ:  # noqa: F405
    SQLALCHEMY_DATABASE_URI = os.environ["SUPERSET__SQLALCHEMY_DATABASE_URI"]  # noqa: F405

SQLALCHEMY_EXAMPLES_URI = SQLALCHEMY_DATABASE_URI
if "SUPERSET__SQLALCHEMY_EXAMPLES_URI" in os.environ:  # noqa: F405
    SQLALCHEMY_EXAMPLES_URI = os.environ["SUPERSET__SQLALCHEMY_EXAMPLES_URI"]  # noqa: F405

if "UPLOAD_FOLDER" in os.environ:  # noqa: F405
    UPLOAD_FOLDER = os.environ["UPLOAD_FOLDER"]  # noqa: F405

if make_url(SQLALCHEMY_DATABASE_URI).get_backend_name() == "sqlite":
    logger.warning(  # noqa: F405
        "SQLite Database support for metadata databases will be "
        "removed in a future version of Superset."
    )

if make_url(SQLALCHEMY_DATABASE_URI).get_backend_name() in ("postgresql", "mysql"):
    SQLALCHEMY_ENGINE_OPTIONS["isolation_level"] = "READ COMMITTED"  # noqa: F405

# Speeding up the tests.integration_tests.
PRESTO_POLL_INTERVAL = 0.1
HIVE_POLL_INTERVAL = 0.1

SQL_MAX_ROW = 50000
SQLLAB_CTAS_NO_LIMIT = True  # SQL_MAX_ROW will not take effect for the CTA queries
FEATURE_FLAGS = {
    **FEATURE_FLAGS,  # noqa: F405
    "foo": "bar",
    "KV_STORE": True,
    "SHARE_QUERIES_VIA_KV_STORE": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "ALERT_REPORTS": True,
    "AVOID_COLORS_COLLISION": True,
    "DRILL_TO_DETAIL": True,
    "DRILL_BY": True,
    "HORIZONTAL_FILTER_BAR": True,
}

WEBDRIVER_BASEURL = "http://0.0.0.0:8081/"


def GET_FEATURE_FLAGS_FUNC(ff):
    ff_copy = copy(ff)
    ff_copy["super"] = "set"
    return ff_copy


TESTING = True
WTF_CSRF_ENABLED = False

FAB_ROLES = {"TestRole": [["Security", "menu_access"], ["List Users", "menu_access"]]}

PUBLIC_ROLE_LIKE = "Gamma"
AUTH_ROLE_PUBLIC = "Public"
EMAIL_NOTIFICATIONS = False
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")  # noqa: F405
REDIS_PORT = os.environ.get("REDIS_PORT", "6379")  # noqa: F405
REDIS_CELERY_DB = os.environ.get("REDIS_CELERY_DB", 2)  # noqa: F405
REDIS_RESULTS_DB = os.environ.get("REDIS_RESULTS_DB", 3)  # noqa: F405
REDIS_CACHE_DB = os.environ.get("REDIS_CACHE_DB", 4)  # noqa: F405

RATELIMIT_ENABLED = False


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

ALERT_REPORTS_QUERY_EXECUTION_MAX_TRIES = 3


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = ("superset.sql_lab",)
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    concurrency = 1


CELERY_CONFIG = CeleryConfig

CUSTOM_TEMPLATE_PROCESSORS = {
    CustomPrestoTemplateProcessor.engine: CustomPrestoTemplateProcessor
}

PRESERVE_CONTEXT_ON_EXCEPTION = False
