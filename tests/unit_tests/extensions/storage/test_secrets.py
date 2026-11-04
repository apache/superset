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

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from superset_core.extensions.storage.models import StorageAccess

from superset.extensions.context import use_context
from superset.extensions.storage.persistent_model import ExtensionStorage
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


@patch("superset.extensions.storage.secrets.Session")
@patch("superset.extensions.storage.secrets.db")
@patch("superset.extensions.storage.secrets.ExtensionStorageDAO")
def test_secrets_state_set_forces_encryption(
    mock_dao: MagicMock,
    mock_db: MagicMock,
    mock_session: MagicMock,
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
        session=mock_session.return_value.__enter__.return_value,
    )


@patch("superset.extensions.storage.secrets.Session")
@patch("superset.extensions.storage.secrets.db")
@patch("superset.extensions.storage.secrets.ExtensionStorageDAO")
def test_secrets_state_remove_is_backend_only(
    mock_dao: MagicMock,
    mock_db: MagicMock,
    mock_session: MagicMock,
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
        session=mock_session.return_value.__enter__.return_value,
    )


@pytest.mark.parametrize("operation", ["rotate", "remove"])
def test_secret_changes_survive_outer_rollback(
    app: Flask, tmp_path: Path, operation: str
) -> None:
    """An independent secret commit neither loses tokens nor commits caller work."""
    engine = create_engine(f"sqlite:///{tmp_path / 'secrets.db'}")
    ExtensionStorage.metadata.create_all(engine)
    app.config["SECRET_KEY"] = "test-secret"  # noqa: S105
    try:
        with app.app_context(), use_context(create_context()), Session(engine) as outer:
            set_user(42)
            with (
                patch("superset.extensions.storage.secrets.db") as secret_db,
                patch("superset.extensions.storage.persistent_dao.db") as storage_db,
                patch("superset.extensions.storage.persistent_dao.DistributedLock"),
            ):
                secret_db.session = outer
                storage_db.session = outer
                storage_db.engine = engine
                SecretsState.set("oauth2", {"refresh_token": "old"})
                outer.add(
                    ExtensionStorage(
                        extension_id="unrelated",
                        key="pending",
                        value=b"pending",
                        value_size=7,
                        codec="json",
                        access="frontend",
                    )
                )
                if operation == "rotate":
                    SecretsState.set("oauth2", {"refresh_token": "rotated"})
                else:
                    SecretsState.remove("oauth2")
                outer.rollback()
                assert SecretsState.get("oauth2") == (
                    {"refresh_token": "rotated"} if operation == "rotate" else None
                )
        with Session(engine) as reader:
            assert (
                reader.scalar(
                    select(ExtensionStorage).where(
                        ExtensionStorage.extension_id == "unrelated"
                    )
                )
                is None
            )
    finally:
        engine.dispose()
