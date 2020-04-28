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

from flask import Flask
from werkzeug.contrib.cache import RedisCache

from superset.config import *  # type: ignore

AUTH_USER_REGISTRATION_ROLE = "alpha"
SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(DATA_DIR, "unittests.db")
DEBUG = True
SUPERSET_WEBSERVER_PORT = 8081

# Allowing SQLALCHEMY_DATABASE_URI to be defined as an env var for
# continuous integration
if "SUPERSET__SQLALCHEMY_DATABASE_URI" in os.environ:
    SQLALCHEMY_DATABASE_URI = os.environ["SUPERSET__SQLALCHEMY_DATABASE_URI"]

if "sqlite" in SQLALCHEMY_DATABASE_URI:
    logger.warning(
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
PUBLIC_ROLE_LIKE_GAMMA = True
AUTH_ROLE_PUBLIC = "Public"
EMAIL_NOTIFICATIONS = False

CACHE_CONFIG = {"CACHE_TYPE": "simple"}


class CeleryConfig(object):
    BROKER_URL = "redis://localhost"
    CELERY_IMPORTS = ("superset.sql_lab", "superset.tasks.thumbnails")
    CELERY_ANNOTATIONS = {"sql_lab.add": {"rate_limit": "10/s"}}
    CONCURRENCY = 1


CELERY_CONFIG = CeleryConfig

FEATURE_FLAGS = {
    "foo": "bar",
    "KV_STORE": False,
    "SHARE_QUERIES_VIA_KV_STORE": False,
    "THUMBNAILS": True,
    "THUMBNAILS_SQLA_LISTENERS": False,
}


def init_thumbnail_cache(app: Flask) -> RedisCache:
    return RedisCache(
        host="localhost", key_prefix="superset_thumbnails_", default_timeout=10000
    )


THUMBNAIL_CACHE_CONFIG = init_thumbnail_cache
