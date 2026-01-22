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
import hashlib
from unittest.mock import MagicMock, patch

import pytest

from superset.utils.cache_manager import (
    get_cache_hash_method,
    SupersetCache,
)


def test_get_cache_hash_method_returns_sha256():
    """Test that get_cache_hash_method returns sha256 when config is sha256."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}

    with patch("superset.utils.cache_manager.current_app", mock_app):
        result = get_cache_hash_method()
        assert result == hashlib.sha256


def test_get_cache_hash_method_returns_md5():
    """Test that get_cache_hash_method returns md5 when config is md5."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "md5"}

    with patch("superset.utils.cache_manager.current_app", mock_app):
        result = get_cache_hash_method()
        assert result == hashlib.md5


def test_superset_cache_memoize_uses_config_hash_method():
    """Test that SupersetCache.memoize uses config-based hash method."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}

    cache = SupersetCache()

    with (
        patch("superset.utils.cache_manager.current_app", mock_app),
        patch.object(
            cache.__class__.__bases__[0], "memoize", return_value=lambda f: f
        ) as mock_memoize,
    ):
        cache.memoize(timeout=300)

        mock_memoize.assert_called_once()
        call_kwargs = mock_memoize.call_args[1]
        assert call_kwargs["hash_method"] == hashlib.sha256


def test_superset_cache_memoize_with_md5_config():
    """Test that SupersetCache.memoize uses md5 when configured."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "md5"}

    cache = SupersetCache()

    with (
        patch("superset.utils.cache_manager.current_app", mock_app),
        patch.object(
            cache.__class__.__bases__[0], "memoize", return_value=lambda f: f
        ) as mock_memoize,
    ):
        cache.memoize(timeout=300)

        mock_memoize.assert_called_once()
        call_kwargs = mock_memoize.call_args[1]
        assert call_kwargs["hash_method"] == hashlib.md5


def test_superset_cache_memoize_allows_explicit_hash_method():
    """Test that SupersetCache.memoize allows explicit hash_method override."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}

    cache = SupersetCache()

    with (
        patch("superset.utils.cache_manager.current_app", mock_app),
        patch.object(
            cache.__class__.__bases__[0], "memoize", return_value=lambda f: f
        ) as mock_memoize,
    ):
        cache.memoize(timeout=300, hash_method=hashlib.md5)

        mock_memoize.assert_called_once()
        call_kwargs = mock_memoize.call_args[1]
        assert call_kwargs["hash_method"] == hashlib.md5


def test_superset_cache_cached_uses_config_hash_method():
    """Test that SupersetCache.cached uses config-based hash method."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}

    cache = SupersetCache()

    with (
        patch("superset.utils.cache_manager.current_app", mock_app),
        patch.object(
            cache.__class__.__bases__[0], "cached", return_value=lambda f: f
        ) as mock_cached,
    ):
        cache.cached(timeout=300)

        mock_cached.assert_called_once()
        call_kwargs = mock_cached.call_args[1]
        assert call_kwargs["hash_method"] == hashlib.sha256


def test_superset_cache_cached_with_md5_config():
    """Test that SupersetCache.cached uses md5 when configured."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "md5"}

    cache = SupersetCache()

    with (
        patch("superset.utils.cache_manager.current_app", mock_app),
        patch.object(
            cache.__class__.__bases__[0], "cached", return_value=lambda f: f
        ) as mock_cached,
    ):
        cache.cached(timeout=300)

        mock_cached.assert_called_once()
        call_kwargs = mock_cached.call_args[1]
        assert call_kwargs["hash_method"] == hashlib.md5


def test_superset_cache_cached_allows_explicit_hash_method():
    """Test that SupersetCache.cached allows explicit hash_method override."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}

    cache = SupersetCache()

    with (
        patch("superset.utils.cache_manager.current_app", mock_app),
        patch.object(
            cache.__class__.__bases__[0], "cached", return_value=lambda f: f
        ) as mock_cached,
    ):
        cache.cached(timeout=300, hash_method=hashlib.md5)

        mock_cached.assert_called_once()
        call_kwargs = mock_cached.call_args[1]
        assert call_kwargs["hash_method"] == hashlib.md5


def test_superset_cache_memoize_make_cache_key_uses_config():
    """Test that SupersetCache._memoize_make_cache_key uses config hash method."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}

    cache = SupersetCache()

    with (
        patch("superset.utils.cache_manager.current_app", mock_app),
        patch.object(
            cache.__class__.__bases__[0],
            "_memoize_make_cache_key",
            return_value=lambda *args, **kwargs: "cache_key",
        ) as mock_make_key,
    ):
        cache._memoize_make_cache_key(make_name=None, timeout=300)

        mock_make_key.assert_called_once()
        call_kwargs = mock_make_key.call_args[1]
        assert call_kwargs["hash_method"] == hashlib.sha256


def test_superset_cache_memoize_make_cache_key_allows_explicit_hash():
    """Test _memoize_make_cache_key allows explicit hash_method override."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}

    cache = SupersetCache()

    with (
        patch("superset.utils.cache_manager.current_app", mock_app),
        patch.object(
            cache.__class__.__bases__[0],
            "_memoize_make_cache_key",
            return_value=lambda *args, **kwargs: "cache_key",
        ) as mock_make_key,
    ):
        cache._memoize_make_cache_key(
            make_name=None, timeout=300, hash_method=hashlib.md5
        )

        mock_make_key.assert_called_once()
        call_kwargs = mock_make_key.call_args[1]
        assert call_kwargs["hash_method"] == hashlib.md5


@pytest.mark.parametrize(
    "algorithm,expected_hash_method",
    [
        ("sha256", hashlib.sha256),
        ("md5", hashlib.md5),
    ],
)
def test_get_cache_hash_method_parametrized(algorithm, expected_hash_method):
    """Parametrized test for get_cache_hash_method with different algorithms."""
    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": algorithm}

    with patch("superset.utils.cache_manager.current_app", mock_app):
        result = get_cache_hash_method()
        assert result == expected_hash_method
