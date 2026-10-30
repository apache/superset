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

"""Tests for backend-only extension secrets storage."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from superset_core.extensions.storage.models import StorageAccess

from superset.extensions.context import use_context
from superset.extensions.storage.secrets import SecretsState
from superset.utils import json
from tests.unit_tests.extensions.storage.conftest import create_context, set_user


def test_secrets_state_requires_extension_context(app: Flask) -> None:
    """Secrets cannot be accessed outside extension execution."""
    with app.app_context():
        set_user(42)
        with pytest.raises(RuntimeError, match="within an extension context"):
            SecretsState.get("oauth2")


def test_secrets_state_requires_authenticated_user(app: Flask) -> None:
    """Secrets cannot be accessed without an authenticated principal."""
    with app.app_context(), use_context(create_context()):
        with pytest.raises(RuntimeError, match="requires an authenticated user"):
            SecretsState.get("oauth2")


@patch("superset.extensions.storage.secrets.ExtensionStorageDAO")
def test_secrets_state_get_is_user_scoped(
    mock_dao: MagicMock,
    app: Flask,
) -> None:
    """Secret reads use backend access and the authenticated user."""
    mock_dao.get_decoded_value.return_value = {"access_token": "token"}

    with app.app_context(), use_context(create_context()):
        set_user(42)
        result = SecretsState.get("oauth2")

    mock_dao.get_decoded_value.assert_called_once_with(
        "test-org.test-ext",
        "oauth2",
        user_fk=42,
        access=StorageAccess.BACKEND,
    )
    assert result == {"access_token": "token"}


@patch("superset.db")
@patch("superset.extensions.storage.secrets.ExtensionStorageDAO")
def test_secrets_state_set_forces_encryption(
    mock_dao: MagicMock,
    mock_db: MagicMock,
    app: Flask,
) -> None:
    """Secret writes are JSON encoded, encrypted, and backend-only."""
    value = {"access_token": "token", "refresh_token": "refresh"}

    with app.app_context(), use_context(create_context()):
        set_user(42)
        SecretsState.set("oauth2", value)

    mock_dao.set.assert_called_once_with(
        "test-org.test-ext",
        "oauth2",
        json.dumps(value).encode(),
        codec="json",
        user_fk=42,
        encrypt=True,
        access=StorageAccess.BACKEND,
    )


@patch("superset.db")
@patch("superset.extensions.storage.secrets.ExtensionStorageDAO")
def test_secrets_state_remove_is_backend_only(
    mock_dao: MagicMock,
    mock_db: MagicMock,
    app: Flask,
) -> None:
    """Removing a secret cannot remove a frontend entry with the same key."""
    with app.app_context(), use_context(create_context()):
        set_user(42)
        SecretsState.remove("oauth2")

    mock_dao.delete_by_key.assert_called_once_with(
        "test-org.test-ext",
        "oauth2",
        user_fk=42,
        access=StorageAccess.BACKEND,
    )
