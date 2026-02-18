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
Tests for locale-aware HTTP response caching via etag_cache.

etag_cache's get_cache_key_extra callback enables locale-sensitive caching.
When content localization is enabled, the callback includes user locale in
the cache key, preventing cross-locale cache poisoning where a cached response
for one locale is served to users with a different locale.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest
from flask import Flask
from werkzeug.wrappers import Response

from superset.utils.cache import etag_cache
from superset.utils.cache_manager import SupersetCache


@pytest.fixture
def cache_test_env() -> Any:
    """Flask app with SimpleCache for etag_cache unit testing."""
    app = Flask(__name__)
    app.config.update(
        {
            "CACHE_DEFAULT_TIMEOUT": 300,
            "HASH_ALGORITHM": "sha256",
        }
    )
    cache = SupersetCache()
    cache.init_app(app, {"CACHE_TYPE": "SimpleCache"})
    with app.app_context():
        yield app, cache


def test_get_cache_key_extra_varies_cache_key(
    cache_test_env: tuple[Flask, SupersetCache],
) -> None:
    """
    Different get_cache_key_extra values produce separate cache entries.

    Two GET requests with identical URL/query params but different extra values
    (e.g., different locales) must be cached independently.
    """
    app, cache = cache_test_env
    locale = "de"

    def locale_extra(*args: Any, **kwargs: Any) -> dict[str, Any]:
        return {"__locale": locale}

    call_count = 0

    @etag_cache(cache=cache, get_cache_key_extra=locale_extra)
    def view() -> Response:
        nonlocal call_count
        call_count += 1
        return Response(f"resp-{call_count}", content_type="text/plain")

    # First call: locale "de" → cache miss → function called
    with app.test_request_context("/test"):
        view()
    assert call_count == 1

    # Different locale → different cache key → function called again
    locale = "en"
    with app.test_request_context("/test"):
        view()
    assert call_count == 2

    # Same locale as first → cache hit → function NOT called
    locale = "de"
    with app.test_request_context("/test"):
        view()
    assert call_count == 2


def test_get_cache_key_extra_not_called_for_post(
    cache_test_env: tuple[Flask, SupersetCache],
) -> None:
    """
    POST requests bypass etag_cache entirely.

    get_cache_key_extra must not be called for POST since the cache
    is skipped and no cache key is computed.
    """
    app, cache = cache_test_env
    extra_called = False

    def track_extra(*args: Any, **kwargs: Any) -> dict[str, Any]:
        nonlocal extra_called
        extra_called = True
        return {}

    @etag_cache(cache=cache, get_cache_key_extra=track_extra)
    def view() -> Response:
        return Response("ok", content_type="text/plain")

    with app.test_request_context("/test", method="POST"):
        view()

    assert not extra_called


def test_etag_cache_caches_get_response(
    cache_test_env: tuple[Flask, SupersetCache],
) -> None:
    """
    GET responses are cached: identical subsequent requests return
    cached response without calling the wrapped function.
    """
    app, cache = cache_test_env
    call_count = 0

    @etag_cache(cache=cache)
    def view() -> Response:
        nonlocal call_count
        call_count += 1
        return Response(f"resp-{call_count}", content_type="text/plain")

    with app.test_request_context("/test"):
        view()
    assert call_count == 1

    with app.test_request_context("/test"):
        view()
    assert call_count == 1  # cached


def test_etag_cache_skips_post_request(
    cache_test_env: tuple[Flask, SupersetCache],
) -> None:
    """
    POST requests bypass cache: wrapped function always called.
    """
    app, cache = cache_test_env
    call_count = 0

    @etag_cache(cache=cache)
    def view() -> Response:
        nonlocal call_count
        call_count += 1
        return Response(f"resp-{call_count}", content_type="text/plain")

    with app.test_request_context("/test", method="POST"):
        view()
    assert call_count == 1

    with app.test_request_context("/test", method="POST"):
        view()
    assert call_count == 2


def test_etag_cache_invalidates_on_last_modified(
    cache_test_env: tuple[Flask, SupersetCache],
) -> None:
    """
    Stale cache is invalidated when content has been modified
    after the cached response's Last-Modified time.
    """
    app, cache = cache_test_env
    call_count = 0
    last_modified = datetime(2025, 1, 1)

    @etag_cache(
        cache=cache,
        get_last_modified=lambda *a, **kw: last_modified,
    )
    def view() -> Response:
        nonlocal call_count
        call_count += 1
        return Response(f"resp-{call_count}", content_type="text/plain")

    with app.test_request_context("/test"):
        view()
    assert call_count == 1

    # Same last_modified → cache valid
    with app.test_request_context("/test"):
        view()
    assert call_count == 1

    # Newer last_modified → cache invalidated
    last_modified = datetime(2025, 6, 1)
    with app.test_request_context("/test"):
        view()
    assert call_count == 2
