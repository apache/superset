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
from copy import copy

from sqlalchemy.engine import make_url

from superset.config import *  # noqa: F403
from superset.config import DATA_DIR

SECRET_KEY = "dummy_secret_key_for_test_to_silence_warnings"
AUTH_USER_REGISTRATION_ROLE = "alpha"
SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(  # noqa: F405
    DATA_DIR,
    "unittests.integration_tests.db",  # noqa: F405
)
DEBUG = True

# Allowing SQLALCHEMY_DATABASE_URI to be defined as an env var for
# continuous integration
if "SUPERSET__SQLALCHEMY_DATABASE_URI" in os.environ:  # noqa: F405
    SQLALCHEMY_DATABASE_URI = os.environ["SUPERSET__SQLALCHEMY_DATABASE_URI"]  # noqa: F405

if make_url(SQLALCHEMY_DATABASE_URI).get_backend_name() == "sqlite":
    logger.warning(  # noqa: F405
        "SQLite Database support for metadata databases will be removed \
        in a future version of Superset."
    )

SQL_SELECT_AS_CTA = True
SQL_MAX_ROW = 666


def GET_FEATURE_FLAGS_FUNC(ff):
    ff_copy = copy(ff)
    ff_copy["super"] = "set"
    return ff_copy


TESTING = True
WTF_CSRF_ENABLED = False
PUBLIC_ROLE_LIKE = "Gamma"
AUTH_ROLE_PUBLIC = "Public"

CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache"}

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")  # noqa: F405
REDIS_PORT = os.environ.get("REDIS_PORT", "6379")  # noqa: F405
REDIS_CELERY_DB = os.environ.get("REDIS_CELERY_DB", 2)  # noqa: F405
REDIS_RESULTS_DB = os.environ.get("REDIS_RESULTS_DB", 3)  # noqa: F405


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = ("superset.sql_lab", "superset.tasks.thumbnails")
    concurrency = 1


CELERY_CONFIG = CeleryConfig

FEATURE_FLAGS = {
    "foo": "bar",
    "KV_STORE": False,
    "SHARE_QUERIES_VIA_KV_STORE": False,
    "THUMBNAILS": True,
    "THUMBNAILS_SQLA_LISTENERS": False,
}

THUMBNAIL_CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 10000,
    "CACHE_KEY_PREFIX": "superset_thumbnails_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_CELERY_DB,
}
