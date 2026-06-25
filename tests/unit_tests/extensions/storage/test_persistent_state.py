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

"""Tests for persistent state storage implementation."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from superset.extensions.context import use_context
from superset.extensions.storage.persistent_state_impl import (
    PersistentStateImpl,
    SharedPersistentStateAccessor,
)
from superset.utils import json
from tests.unit_tests.extensions.storage.conftest import (
    create_context,
    set_user,
)


@patch("superset.db")
def test_persistent_state_raises_without_context(
    mock_db: MagicMock, app: Flask
) -> None:
    """PersistentStateImpl operations raise RuntimeError without extension context."""
    with app.app_context():
        set_user(1)

        with pytest.raises(RuntimeError, match="within an extension context"):
            PersistentStateImpl.get("key")

        with pytest.raises(RuntimeError, match="within an extension context"):
            PersistentStateImpl.set("key", "value")

        with pytest.raises(RuntimeError, match="within an extension context"):
            PersistentStateImpl.remove("key")


def test_persistent_state_raises_without_user(app: Flask) -> None:
    """PersistentStateImpl operations raise RuntimeError without authenticated user."""
    ctx = create_context()

    with app.app_context(), use_context(ctx):
        with pytest.raises(RuntimeError, match="requires an authenticated user"):
            PersistentStateImpl.get("key")


@patch("superset.extensions.storage.persistent_state_impl.ExtensionStorageDAO")
def test_persistent_state_get_returns_value(mock_dao: MagicMock, app: Flask) -> None:
    """PersistentStateImpl.get returns decoded value from DAO."""
    ctx = create_context()
    stored = json.dumps({"theme": "dark"}).encode()
    mock_dao.get_value.return_value = stored

    with app.app_context(), use_context(ctx):
        set_user(42)
        result = PersistentStateImpl.get("prefs")

    mock_dao.get_value.assert_called_once_with("test-org.test-ext", "prefs", user_fk=42)
    assert result == {"theme": "dark"}


@patch("superset.extensions.storage.persistent_state_impl.ExtensionStorageDAO")
def test_persistent_state_get_returns_none_when_missing(
    mock_dao: MagicMock, app: Flask
) -> None:
    """PersistentStateImpl.get returns None when key does not exist."""
    ctx = create_context()
    mock_dao.get_value.return_value = None

    with app.app_context(), use_context(ctx):
        set_user(42)
        result = PersistentStateImpl.get("missing")

    assert result is None


@patch("superset.db")
@patch("superset.extensions.storage.persistent_state_impl.ExtensionStorageDAO")
def test_persistent_state_set_encodes_value(
    mock_dao: MagicMock, mock_db: MagicMock, app: Flask
) -> None:
    """PersistentStateImpl.set encodes value as JSON bytes."""
    ctx = create_context()

    with app.app_context(), use_context(ctx):
        set_user(42)
        PersistentStateImpl.set("prefs", {"theme": "dark"})

    expected_bytes = json.dumps({"theme": "dark"}).encode()
    mock_dao.set.assert_called_once_with(
        "test-org.test-ext", "prefs", expected_bytes, user_fk=42
    )


@patch("superset.db")
@patch("superset.extensions.storage.persistent_state_impl.ExtensionStorageDAO")
def test_persistent_state_remove_deletes_entry(
    mock_dao: MagicMock, mock_db: MagicMock, app: Flask
) -> None:
    """PersistentStateImpl.remove calls DAO delete."""
    ctx = create_context()

    with app.app_context(), use_context(ctx):
        set_user(42)
        PersistentStateImpl.remove("prefs")

    mock_dao.delete.assert_called_once_with("test-org.test-ext", "prefs", user_fk=42)


@patch("superset.extensions.storage.persistent_state_impl.ExtensionStorageDAO")
def test_shared_accessor_uses_null_user_fk(mock_dao: MagicMock, app: Flask) -> None:
    """SharedPersistentStateAccessor uses user_fk=None for global scope."""
    ctx = create_context()
    mock_dao.get_value.return_value = json.dumps("shared_value").encode()

    accessor = SharedPersistentStateAccessor()

    with app.app_context(), use_context(ctx):
        set_user(42)
        result = accessor.get("config")

    mock_dao.get_value.assert_called_once_with(
        "test-org.test-ext", "config", user_fk=None
    )
    assert result == "shared_value"
