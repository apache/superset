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
"""
Unit tests for SupersetMetastoreCache.__init__ and factory() compatibility
with flask-caching 2.5.0+ / cachelib 0.17.0+.

Reproduces the bug in GitHub issue #43860 where flask-caching 2.5.0
began passing ``ignore_delete_many_errors`` through the backend factory,
causing a TypeError in SupersetMetastoreCache.__init__.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock
from uuid import UUID

NAMESPACE = UUID("ee173d1b-ccf3-40aa-941c-985c15224496")


def test_metastore_cache_init_accepts_extra_basecache_kwargs() -> None:
    """
    SupersetMetastoreCache.__init__ must accept **kwargs so that new
    parameters added by cachelib (e.g. ``ignore_delete_many_errors``
    introduced in cachelib 0.17.0) do not raise TypeError when flask-caching
    passes them through the backend factory.

    This test verifies that no TypeError is raised for any cachelib version.
    """
    from superset.extensions.metastore_cache import SupersetMetastoreCache
    from superset.key_value.types import JsonKeyValueCodec

    cache = SupersetMetastoreCache(
        namespace=NAMESPACE,
        codec=JsonKeyValueCodec(),
        default_timeout=300,
        ignore_delete_many_errors=False,
    )
    assert cache.namespace == NAMESPACE
    assert cache.default_timeout == 300


def test_metastore_cache_init_default_timeout_only() -> None:
    """Basic instantiation without extra kwargs still works."""
    from superset.extensions.metastore_cache import SupersetMetastoreCache
    from superset.key_value.types import JsonKeyValueCodec

    cache = SupersetMetastoreCache(
        namespace=NAMESPACE,
        codec=JsonKeyValueCodec(),
        default_timeout=600,
    )
    assert cache.default_timeout == 600


def test_metastore_cache_factory_with_ignore_delete_many_errors_kwarg() -> None:
    """
    Regression test for issue #43860.

    flask-caching 2.5.0 passes ``ignore_delete_many_errors`` inside the
    ``kwargs`` dict forwarded to the backend factory. Must not raise TypeError.
    """
    from superset.extensions.metastore_cache import SupersetMetastoreCache

    mock_app = MagicMock()
    mock_app.debug = False
    mock_app.config = {"HASH_ALGORITHM": "sha256", "CACHE_KEY_PREFIX": "superset_test_"}

    kwargs: dict[str, Any] = {
        "default_timeout": 300,
        "ignore_delete_many_errors": True,
    }

    cache = SupersetMetastoreCache.factory(
        app=mock_app,
        config={"CACHE_KEY_PREFIX": "superset_test_"},
        args=[],
        kwargs=kwargs,
    )

    assert isinstance(cache, SupersetMetastoreCache)
    assert cache.default_timeout == 300


def test_metastore_cache_factory_without_extra_kwargs() -> None:
    """factory() works with only default_timeout (flask-caching < 2.5.0 compat)."""
    from superset.extensions.metastore_cache import SupersetMetastoreCache

    mock_app = MagicMock()
    mock_app.debug = False
    mock_app.config = {"HASH_ALGORITHM": "sha256", "CACHE_KEY_PREFIX": "superset_"}

    cache = SupersetMetastoreCache.factory(
        app=mock_app,
        config={"CACHE_KEY_PREFIX": "superset_"},
        args=[],
        kwargs={"default_timeout": 300},
    )
    assert isinstance(cache, SupersetMetastoreCache)
