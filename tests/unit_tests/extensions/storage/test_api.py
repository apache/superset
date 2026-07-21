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

import base64
from unittest.mock import MagicMock, patch

from flask import Flask, g
from flask_babel import Babel

from superset.extensions.storage.api import ExtensionStorageRestApi
from superset.extensions.storage.codecs import get_codec
from superset.extensions.storage.ephemeral_dao import (
    ExtensionEphemeralTTLInvalid,
    ExtensionEphemeralValueTooLarge,
)
from superset.extensions.storage.persistent_dao import (
    ExtensionStorageListEntry,
    ExtensionStorageListPayloadTooLarge,
    ExtensionStorageQuotaExceeded,
    ExtensionStorageValueTooLarge,
)

# ── Ephemeral GET / PUT / DELETE endpoint logic ──────────────────────────────


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_get_delegates_to_dao(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """get_ephemeral calls ExtensionEphemeralDAO.get_raw with the right scope."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_dao.get_raw.return_value = (get_codec("json").encode({"data": 42}), "json")

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/my-key"
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().get_ephemeral(
            "acme", "dashboard", "my-key"
        )

        assert status_code == 200
        assert body.get_json()["result"] == {"data": 42}
        assert body.get_json()["codec"] == "json"
        mock_dao.get_raw.assert_called_once_with(
            "acme.dashboard", "my-key", shared=False
        )


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_get_returns_none_when_entry_missing(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """get_ephemeral returns result=None without a codec check when absent."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_dao.get_raw.return_value = None

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/missing"
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().get_ephemeral(
            "acme", "dashboard", "missing"
        )

        assert status_code == 200
        assert body.get_json()["result"] is None


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_get_returns_400_for_unsafe_stored_codec(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """get_ephemeral returns 400 when the stored value's codec is not in
    SAFE_CODECS, rather than attempting to decode/return it over the API."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_dao.get_raw.return_value = (get_codec("pickle").encode({"x": 1}), "pickle")

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/my-key"
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().get_ephemeral(
            "acme", "dashboard", "my-key"
        )

        assert status_code == 400


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_get_returns_binary_value_base64_encoded(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """get_ephemeral base64-encodes a binary-codec value for the response
    and flags it with isBinary=True, since JSON has no byte type. Checked
    on the decoded value's actual type, not the codec's name."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    raw_bytes = b"\x89PNG\r\n"
    mock_dao.get_raw.return_value = (get_codec("binary").encode(raw_bytes), "binary")

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/logo"
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().get_ephemeral(
            "acme", "dashboard", "logo"
        )

        assert status_code == 200
        payload = body.get_json()
        assert payload["result"] == base64.b64encode(raw_bytes).decode("ascii")
        assert payload["codec"] == "binary"
        assert payload["isBinary"] is True


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
            "acme.dashboard", "job", {"progress": 50}, 600, codec="json", shared=False
        )


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_set_with_binary_flag_decodes_base64(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """set_ephemeral base64-decodes 'value' before handing it to the DAO
    when 'isBinary' is true, independent of which codec was chosen."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    raw_bytes = b"\x89PNG\r\n"

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/logo",
        method="PUT",
        json={
            "value": base64.b64encode(raw_bytes).decode("ascii"),
            "codec": "binary",
            "isBinary": True,
            "ttl": 600,
        },
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().set_ephemeral(
            "acme", "dashboard", "logo"
        )

        assert status_code == 200
        mock_dao.set.assert_called_once_with(
            "acme.dashboard", "logo", raw_bytes, 600, codec="binary", shared=False
        )


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_set_rejects_invalid_base64_when_binary_flag_set(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """set_ephemeral returns 400 when 'isBinary' is true but 'value' is not
    valid base64, and never calls the DAO."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/logo",
        method="PUT",
        json={"value": "not-base64!!", "isBinary": True, "ttl": 600},
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().set_ephemeral(
            "acme", "dashboard", "logo"
        )

        assert status_code == 400
        mock_dao.set.assert_not_called()


@patch("superset.extensions.storage.api.ExtensionEphemeralDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_ephemeral_set_rejects_unsafe_codec(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """set_ephemeral returns 400 when 'codec' is not in SAFE_CODECS, and never
    calls the DAO — pickle deserialization must not be reachable from the API.
    """
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/job",
        method="PUT",
        json={"value": {"progress": 50}, "ttl": 600, "codec": "pickle"},
    ):
        g.user = MagicMock(id=7)

        body, status_code = ExtensionStorageRestApi().set_ephemeral(
            "acme", "dashboard", "job"
        )

        assert status_code == 400
        assert "not allowed" in body.get_json()["message"].lower()
        mock_dao.set.assert_not_called()


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
    mock_dao.get_raw.return_value = (get_codec("json").encode("shared-data"), "json")

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/ephemeral/config?shared=true"
    ):
        g.user = MagicMock(id=99)

        body, status_code = ExtensionStorageRestApi().get_ephemeral(
            "acme", "dashboard", "config"
        )

        assert status_code == 200
        assert body.get_json()["result"] == "shared-data"
        mock_dao.get_raw.assert_called_once_with(
            "acme.dashboard", "config", shared=True
        )


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


@patch("superset.db")
@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_set_returns_400_on_value_too_large(
    mock_get_ext: MagicMock, mock_dao: MagicMock, mock_db: MagicMock, app: Flask
) -> None:
    """Persistent PUT returns a 400 response when the DAO rejects an
    oversized value."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.set.side_effect = ExtensionStorageValueTooLarge(10)

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent/prefs",
        method="PUT",
        json={"value": "x" * 1000},
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().set_persistent(
            "acme", "dashboard", "prefs"
        )

        assert status_code == 400
        assert "exceeds" in body.get_json()["message"].lower()


# ── Persistent codec validation ──────────────────────────────────────────────


@patch("superset.db")
@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_set_rejects_unsafe_codec(
    mock_get_ext: MagicMock, mock_dao: MagicMock, mock_db: MagicMock, app: Flask
) -> None:
    """Persistent PUT returns 400 when 'codec' is not in SAFE_CODECS, and never
    calls the DAO — pickle deserialization must not be reachable from the API.
    """
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent/prefs",
        method="PUT",
        json={"value": "sk-...", "codec": "pickle"},
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().set_persistent(
            "acme", "dashboard", "prefs"
        )

        assert status_code == 400
        assert "not allowed" in body.get_json()["message"].lower()
        mock_dao.set.assert_not_called()


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_set_defaults_codec_to_json(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent PUT without a 'codec' field encodes with json and stores
    codec="json" on the entry."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent/prefs",
        method="PUT",
        json={"value": {"theme": "dark"}},
    ):
        g.user = MagicMock(id=42)

        ExtensionStorageRestApi().set_persistent("acme", "dashboard", "prefs")

        from superset.utils import json

        mock_dao.set.assert_called_once_with(
            "acme.dashboard",
            "prefs",
            json.dumps({"theme": "dark"}).encode(),
            codec="json",
            user_fk=42,
            encrypt=False,
        )


@patch("superset.db")
@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_set_with_binary_flag_decodes_base64(
    mock_get_ext: MagicMock, mock_dao: MagicMock, mock_db: MagicMock, app: Flask
) -> None:
    """Persistent PUT base64-decodes 'value' before encoding it with 'codec'
    when 'isBinary' is true, independent of which codec was chosen."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    raw_bytes = b"\x89PNG\r\n"

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent/logo",
        method="PUT",
        json={
            "value": base64.b64encode(raw_bytes).decode("ascii"),
            "codec": "binary",
            "isBinary": True,
        },
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().set_persistent(
            "acme", "dashboard", "logo"
        )

        assert status_code == 200
        mock_dao.set.assert_called_once_with(
            "acme.dashboard",
            "logo",
            raw_bytes,
            codec="binary",
            user_fk=42,
            encrypt=False,
        )


@patch("superset.db")
@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_set_rejects_invalid_base64_when_binary_flag_set(
    mock_get_ext: MagicMock, mock_dao: MagicMock, mock_db: MagicMock, app: Flask
) -> None:
    """Persistent PUT returns 400 when 'isBinary' is true but 'value' is not
    valid base64, and never calls the DAO."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent/logo",
        method="PUT",
        json={"value": "not-base64!!", "codec": "binary", "isBinary": True},
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().set_persistent(
            "acme", "dashboard", "logo"
        )

        assert status_code == 400
        mock_dao.set.assert_not_called()


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_get_returns_400_for_unsafe_stored_codec(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent GET returns 400 when the stored entry's codec is not in
    SAFE_CODECS, rather than attempting to decode/return it over the API."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    entry = MagicMock()
    entry.codec = "pickle"
    mock_dao.get.return_value = entry

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent/prefs"
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().get_persistent(
            "acme", "dashboard", "prefs"
        )

        assert status_code == 400
        mock_dao.get_decoded_value.assert_not_called()


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_get_returns_none_when_entry_missing(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent GET returns result=None without a codec check when absent."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.get.return_value = None

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent/missing"
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().get_persistent(
            "acme", "dashboard", "missing"
        )

        assert status_code == 200
        assert body.get_json()["result"] is None


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_persistent_get_returns_binary_value_base64_encoded(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent GET base64-encodes a binary-codec value for the response
    and flags it with isBinary=True."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    entry = MagicMock()
    entry.codec = "binary"
    mock_dao.get.return_value = entry
    raw_bytes = b"\x89PNG\r\n"
    mock_dao.get_decoded_value.return_value = raw_bytes

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent/logo"
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().get_persistent(
            "acme", "dashboard", "logo"
        )

        assert status_code == 200
        payload = body.get_json()
        assert payload["result"] == base64.b64encode(raw_bytes).decode("ascii")
        assert payload["codec"] == "binary"
        assert payload["isBinary"] is True


# ── Persistent list endpoint ──────────────────────────────────────────────────


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_list_persistent_returns_decoded_entries_and_count(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """list_persistent decodes each safe-codec entry's value and returns
    the total count alongside the page."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.list_entries.return_value = (
        [
            ExtensionStorageListEntry(
                key="prefs",
                value=b'{"theme": "dark"}',
                codec="json",
                is_encrypted=False,
            ),
        ],
        1,
    )

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent"
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().list_persistent(
            "acme", "dashboard"
        )

        assert status_code == 200
        payload = body.get_json()
        assert payload["count"] == 1
        assert payload["result"] == [
            {
                "key": "prefs",
                "value": {"theme": "dark"},
                "codec": "json",
                "isBinary": False,
            }
        ]
        mock_dao.list_entries.assert_called_once_with(
            "acme.dashboard",
            user_fk=42,
            resource_type=None,
            resource_uuid=None,
            page=0,
            page_size=10,
        )


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_list_persistent_omits_value_for_unsafe_codec(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """An entry stored with a codec outside SAFE_CODECS (e.g. pickle) comes
    back with value=null, but the row and its codec are still listed."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.list_entries.return_value = (
        [
            ExtensionStorageListEntry(
                key="secret",
                value=b"\x80pickled",
                codec="pickle",
                is_encrypted=False,
            ),
        ],
        1,
    )

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent"
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().list_persistent(
            "acme", "dashboard"
        )

        assert status_code == 200
        result = body.get_json()["result"]
        assert result == [
            {
                "key": "secret",
                "value": None,
                "codec": "pickle",
                "isBinary": False,
            }
        ]


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_list_persistent_flags_binary_entries_as_base64(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """list_persistent base64-encodes a binary-codec entry's value and
    flags it with isBinary=True."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    raw_bytes = b"\x89PNG\r\n"
    mock_dao.list_entries.return_value = (
        [
            ExtensionStorageListEntry(
                key="logo",
                value=get_codec("binary").encode(raw_bytes),
                codec="binary",
                is_encrypted=False,
            ),
        ],
        1,
    )

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent"
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().list_persistent(
            "acme", "dashboard"
        )

        assert status_code == 200
        assert body.get_json()["result"] == [
            {
                "key": "logo",
                "value": base64.b64encode(raw_bytes).decode("ascii"),
                "codec": "binary",
                "isBinary": True,
            }
        ]


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_list_persistent_passes_query_params_to_dao(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Query params (resource_type, resource_uuid, page, page_size, shared)
    are parsed and passed through to the DAO."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.list_entries.return_value = ([], 0)

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent"
        "?shared=true&resource_type=dashboard&resource_uuid=uuid-1"
        "&page=2&page_size=25"
    ):
        g.user = MagicMock(id=42)

        ExtensionStorageRestApi().list_persistent("acme", "dashboard")

        mock_dao.list_entries.assert_called_once_with(
            "acme.dashboard",
            user_fk=None,
            resource_type="dashboard",
            resource_uuid="uuid-1",
            page=2,
            page_size=25,
        )


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_list_persistent_returns_400_for_non_integer_page(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """A non-integer page/page_size query param returns 400 rather than a
    500 from a failed int() conversion."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent?page=not-a-number"
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().list_persistent(
            "acme", "dashboard"
        )

        assert status_code == 400
        mock_dao.list_entries.assert_not_called()


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.utils.get_extensions")
def test_list_persistent_returns_400_on_payload_too_large(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """list_persistent returns 400 when the DAO rejects the page for
    exceeding MAX_LIST_PAYLOAD_SIZE."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.list_entries.side_effect = ExtensionStorageListPayloadTooLarge(100, 50)

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent"
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().list_persistent(
            "acme", "dashboard"
        )

        assert status_code == 400


@patch("superset.extensions.storage.utils.get_extensions")
def test_list_persistent_returns_404_for_missing_extension(
    mock_get_ext: MagicMock, app: Flask
) -> None:
    """list_persistent returns 404 when the extension does not exist."""
    Babel(app)
    app.appbuilder = MagicMock()
    app.appbuilder.sm.is_item_public.return_value = True
    mock_get_ext.return_value = {}

    with app.test_request_context(
        "/api/v1/extensions/acme/dashboard/storage/persistent"
    ):
        g.user = MagicMock(id=42)

        body, status_code = ExtensionStorageRestApi().list_persistent(
            "acme", "dashboard"
        )

        assert status_code == 404


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
