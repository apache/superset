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

"""Tests for the extension storage REST API (_parse_ttl and _build_storage_key)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from flask import Flask, g

from superset.extensions.storage.api import _build_storage_key, _parse_ttl


@pytest.fixture
def app() -> Flask:
    app = Flask(__name__)
    app.config["TESTING"] = True
    return app


# ---------------------------------------------------------------------------
# _parse_ttl
# ---------------------------------------------------------------------------


def test_parse_ttl_requires_ttl(app: Flask) -> None:
    with app.app_context():
        ttl, error = _parse_ttl({})
    assert ttl is None
    assert error == "Field 'ttl' is required"


def test_parse_ttl_rejects_non_integer(app: Flask) -> None:
    with app.app_context():
        ttl, error = _parse_ttl({"ttl": "not-a-number"})
    assert ttl is None
    assert error is not None


def test_parse_ttl_rejects_zero(app: Flask) -> None:
    with app.app_context():
        ttl, error = _parse_ttl({"ttl": 0})
    assert ttl is None
    assert error is not None


def test_parse_ttl_rejects_negative(app: Flask) -> None:
    with app.app_context():
        ttl, error = _parse_ttl({"ttl": -1})
    assert ttl is None
    assert error is not None


def test_parse_ttl_accepts_valid_ttl(app: Flask) -> None:
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {"MAX_TTL": 3600}
    with app.app_context():
        ttl, error = _parse_ttl({"ttl": 300})
    assert ttl == 300
    assert error is None


def test_parse_ttl_rejects_ttl_exceeding_max(app: Flask) -> None:
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {"MAX_TTL": 3600}
    with app.app_context():
        ttl, error = _parse_ttl({"ttl": 7200})
    assert ttl is None
    assert "must not exceed" in (error or "")
    assert "3600" in (error or "")


def test_parse_ttl_accepts_ttl_equal_to_max(app: Flask) -> None:
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {"MAX_TTL": 3600}
    with app.app_context():
        ttl, error = _parse_ttl({"ttl": 3600})
    assert ttl == 3600
    assert error is None


def test_parse_ttl_no_max_ttl_configured(app: Flask) -> None:
    """When MAX_TTL is absent any positive integer is accepted."""
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {}
    with app.app_context():
        ttl, error = _parse_ttl({"ttl": 999999})
    assert ttl == 999999
    assert error is None


# ---------------------------------------------------------------------------
# _build_storage_key
# ---------------------------------------------------------------------------


def test_build_storage_key_user_scoped(app: Flask) -> None:
    with app.app_context():
        g.user = MagicMock(id=42)
        key = _build_storage_key("org.ext", "my-key", shared=False)
    assert key == "superset-ext:org.ext:user:42:my-key"


def test_build_storage_key_shared(app: Flask) -> None:
    with app.app_context():
        key = _build_storage_key("org.ext", "my-key", shared=True)
    assert key == "superset-ext:org.ext:shared:my-key"


def test_build_storage_key_different_extensions_are_isolated(app: Flask) -> None:
    with app.app_context():
        g.user = MagicMock(id=1)
        key1 = _build_storage_key("org.ext1", "k", shared=False)
        key2 = _build_storage_key("org.ext2", "k", shared=False)
    assert key1 != key2


def test_build_storage_key_different_users_are_isolated(app: Flask) -> None:
    with app.app_context():
        g.user = MagicMock(id=1)
        key1 = _build_storage_key("org.ext", "k", shared=False)
        g.user = MagicMock(id=2)
        key2 = _build_storage_key("org.ext", "k", shared=False)
    assert key1 != key2
