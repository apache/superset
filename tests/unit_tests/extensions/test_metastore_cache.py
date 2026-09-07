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
from importlib.metadata import version
from uuid import UUID

import pytest
from flask import Flask
from flask_caching import Cache
from packaging.version import Version

from superset.extensions.metastore_cache import SupersetMetastoreCache
from superset.key_value.types import JsonKeyValueCodec
from superset.key_value.utils import get_uuid_namespace


def test_metastore_cache_constructor() -> None:
    """Direct construction remains compatible without extra backend options."""
    namespace = UUID("ee173d1b-ccf3-40aa-941c-985c15224496")
    codec = JsonKeyValueCodec()

    cache = SupersetMetastoreCache(namespace, codec)

    assert cache.default_timeout == 300
    assert cache.namespace == namespace
    assert cache.codec is codec


@pytest.mark.parametrize("ignore_errors", [False, True])
def test_metastore_cache_init_app(ignore_errors: bool) -> None:
    """Flask-Caching can initialize the backend with its generated options."""
    app = Flask(__name__)
    app.config["HASH_ALGORITHM"] = "sha256"
    codec = JsonKeyValueCodec()
    cache = Cache()

    cache.init_app(
        app,
        {
            "CACHE_TYPE": "superset.extensions.metastore_cache.SupersetMetastoreCache",
            "CACHE_DEFAULT_TIMEOUT": 600,
            "CACHE_KEY_PREFIX": "filter_state",
            "CACHE_IGNORE_ERRORS": ignore_errors,
            "CODEC": codec,
        },
    )

    with app.app_context():
        backend = cache.cache
        assert isinstance(backend, SupersetMetastoreCache)
        assert backend.default_timeout == 600
        assert backend.namespace == get_uuid_namespace("filter_state", app)
        assert backend.codec is codec
        if Version(version("flask-caching")) >= Version("2.5.0"):
            assert backend.ignore_delete_many_errors is ignore_errors


@pytest.mark.skipif(
    Version(version("flask-caching")) < Version("2.5.0"),
    reason="ignore_delete_many_errors requires Flask-Caching 2.5.0",
)
def test_metastore_cache_options_override_ignore_errors() -> None:
    """Explicit cache options override the general error-handling setting."""
    app = Flask(__name__)
    app.config["HASH_ALGORITHM"] = "sha256"
    cache = Cache()

    cache.init_app(
        app,
        {
            "CACHE_TYPE": "superset.extensions.metastore_cache.SupersetMetastoreCache",
            "CACHE_IGNORE_ERRORS": False,
            "CACHE_OPTIONS": {"ignore_delete_many_errors": True},
            "CODEC": JsonKeyValueCodec(),
        },
    )

    with app.app_context():
        assert cache.cache.ignore_delete_many_errors is True
