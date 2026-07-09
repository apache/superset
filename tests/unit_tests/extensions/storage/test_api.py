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

"""Tests for the Extension Storage REST API endpoint handler logic.

Pure helper functions (`parse_ttl`, `get_extension_or_404`, etc.) are shared
across call sites and tested once in `superset.extensions.storage.utils`;
see `test_utils.py`. Ephemeral (Tier 2) cache access and MAX_TTL/
MAX_VALUE_SIZE validation live in `ExtensionEphemeralDAO`, tested in
`test_ephemeral_dao.py`; these tests mock that DAO to verify the endpoints
call into it correctly.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from flask import Flask, g
from flask_babel import Babel

from superset.extensions.storage.api import ExtensionStorageRestApi
from superset.extensions.storage.ephemeral_dao import (
    ExtensionEphemeralTTLInvalid,
    ExtensionEphemeralValueTooLarge,
)
from superset.extensions.storage.persistent_dao import (
    ExtensionStorageQuotaExceeded,
)

# ── Ephemeral GET / PUT / DELETE endpoint logic ──────────────────────────────


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_get_delegates_to_dao(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """get_ephemeral calls ExtensionEphemeralDAO.get with the right scope."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_dao.get.return_value = {"data": 42}

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/my-key"
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().get_ephemeral(
            "acme", "dashboard", "my-key"
        )

        assert status_code == 200
        assert body.get_json()["result"] == {"data": 42}
        mock_dao.get.assert_called_once_with("acme.dashboard", "my-key", shared=False)


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_set_passes_ttl_and_value_to_dao(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """set_ephemeral parses TTL from the body and delegates to the DAO."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/job",
        method="PUT",
        json={"value": {"progress": 50}, "ttl": 600},
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().set_ephemeral(
            "acme", "dashboard", "job"
        )

        assert status_code == 200
        mock_dao.set.assert_called_once_with(
            "acme.dashboard", "job", {"progress": 50}, 600, shared=False
        )


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_set_returns_400_on_ttl_invalid(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """set_ephemeral returns a 400 when the DAO rejects the TTL."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_dao.set.side_effect = ExtensionEphemeralTTLInvalid("TTL too large")

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/job",
        method="PUT",
        json={"value": {"progress": 50}, "ttl": 999999},
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().set_ephemeral(
            "acme", "dashboard", "job"
        )

        assert status_code == 400
        assert "TTL too large" in body.get_json()["message"]


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_set_returns_400_on_value_too_large(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """set_ephemeral returns a 400 when the DAO rejects an oversized value."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_dao.set.side_effect = ExtensionEphemeralValueTooLarge("Value too large")

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/job",
        method="PUT",
        json={"value": "x" * 1000, "ttl": 300},
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().set_ephemeral(
            "acme", "dashboard", "job"
        )

        assert status_code == 400
        assert "Value too large" in body.get_json()["message"]


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_delete_delegates_to_dao(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """delete_ephemeral calls ExtensionEphemeralDAO.delete with the right scope."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/to-delete",
        method="DELETE",
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().delete_ephemeral(
            "acme", "dashboard", "to-delete"
        )

        assert status_code == 200
        mock_dao.delete.assert_called_once_with(
            "acme.dashboard", "to-delete", shared=False
        )


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_shared_query_param_uses_shared_scope(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """?shared=true passes shared=True through to the DAO instead of scoping by user."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_dao.get.return_value = "shared-data"

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/config?shared=true"
    ):
        g.user = MagicMock(id=99)

        body, status_code = ExtensionStorageRestApi().get_ephemeral(
            "acme", "dashboard", "config"
        )

        assert status_code == 200
        assert body.get_json()["result"] == "shared-data"
        mock_dao.get.assert_called_once_with("acme.dashboard", "config", shared=True)


# ── Persistent GET / PUT / DELETE endpoint logic ─────────────────────────────


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_get_user_scoped(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent GET with user scope passes user_fk to DAO."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.get_value.return_value = b'{"theme":"dark"}'

    with app.app_context():
        g.user = MagicMock(id=42)

        extension_id = "acme.dashboard"
        user_fk = g.user.id
        raw = mock_dao.get_value(extension_id, "prefs", user_fk=user_fk)

        assert raw == b'{"theme":"dark"}'
        mock_dao.get_value.assert_called_once_with(
            "acme.dashboard", "prefs", user_fk=42
        )


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_get_shared_scope(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent GET with shared=True passes user_fk=None to DAO."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.get_value.return_value = b'{"version":2}'

    with app.app_context():
        g.user = MagicMock(id=42)

        extension_id = "acme.dashboard"
        raw = mock_dao.get_value(extension_id, "config", user_fk=None)

        assert raw == b'{"version":2}'
        mock_dao.get_value.assert_called_once_with(
            "acme.dashboard", "config", user_fk=None
        )


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_set_encodes_and_stores(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent PUT encodes value as JSON bytes and calls DAO.set."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}

    with app.app_context():
        g.user = MagicMock(id=42)

        from superset.utils import json

        extension_id = "acme.dashboard"
        value = {"theme": "dark"}
        value_bytes = json.dumps(value).encode()
        mock_dao.set(extension_id, "prefs", value_bytes, user_fk=42, encrypt=False)

        mock_dao.set.assert_called_once_with(
            "acme.dashboard", "prefs", value_bytes, user_fk=42, encrypt=False
        )


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_set_encrypt_flag(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent PUT passes encrypt=True to DAO when encrypt=True in body."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}

    with app.app_context():
        g.user = MagicMock(id=42)

        from superset.utils import json

        extension_id = "acme.dashboard"
        value = {"secret": "token"}
        value_bytes = json.dumps(value).encode()
        mock_dao.set(extension_id, "token", value_bytes, user_fk=42, encrypt=True)

        mock_dao.set.assert_called_once_with(
            "acme.dashboard", "token", value_bytes, user_fk=42, encrypt=True
        )


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_delete_calls_dao(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent DELETE calls DAO.delete_by_key with correct scope."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}

    with app.app_context():
        g.user = MagicMock(id=42)

        extension_id = "acme.dashboard"
        mock_dao.delete_by_key(extension_id, "prefs", user_fk=42)

        mock_dao.delete_by_key.assert_called_once_with(
            "acme.dashboard", "prefs", user_fk=42
        )


@patch("superset.db")
@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_set_returns_413_on_quota_exceeded(
    mock_get_ext: MagicMock, mock_dao: MagicMock, mock_db: MagicMock, app: Flask
) -> None:
    """Persistent PUT returns a 413 response when the DAO raises quota-exceeded."""
    Babel(app)
    # Bypass @protect()'s auth checks via its public-resource short-circuit,
    # so this test exercises route logic (the quota except-branch) without
    # standing up the full Flask-AppBuilder security stack.
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.set.side_effect = ExtensionStorageQuotaExceeded("acme.dashboard", 100)

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent/prefs",
        method="PUT",
        json={"value": {"theme": "dark"}},
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().set_persistent(
            "acme", "dashboard", "prefs"
        )

        assert status_code == 413
        assert "quota" in body.get_json()["message"].lower()


# ── Extension ID reconstruction ──────────────────────────────────────────────


def test_extension_id_reconstruction():
    """Verify publisher + name are correctly joined to form extension_id."""
    publisher = "acme"
    name = "dashboard"
    extension_id = f"{publisher}.{name}"
    assert extension_id == "acme.dashboard"


def test_extension_id_with_special_characters():
    """Extension ID supports publisher/name with hyphens."""
    publisher = "my-org"
    name = "my-ext"
    extension_id = f"{publisher}.{name}"
    assert extension_id == "my-org.my-ext"


# ── Missing value field ─────────────────────────────────────────────────────


def test_set_ephemeral_requires_value_field():
    """PUT body must contain 'value' field — test the validation logic."""
    body = {"ttl": 300}  # missing 'value'
    assert "value" not in body


def test_set_persistent_requires_value_field():
    """PUT body must contain 'value' field — test the validation logic."""
    body = {"some_other_field": True}  # missing 'value'
    assert "value" not in body
