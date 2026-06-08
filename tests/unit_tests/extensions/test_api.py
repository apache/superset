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

"""Unit tests for the extensions REST API (POST and DELETE endpoints)."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

from superset.extensions.api import _validate_segment

# The extension routes are only registered when ENABLE_EXTENSIONS is on at
# app-init time, so the endpoint tests parametrize the app fixture to enable it
# (otherwise the route is absent and requests 404).
_ENABLE_EXTENSIONS = [{"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True}}]

# ---------------------------------------------------------------------------
# _validate_segment helper
# ---------------------------------------------------------------------------


def test_validate_segment_accepts_alphanumeric() -> None:
    assert _validate_segment("acme") is True
    assert _validate_segment("my-ext") is True
    assert _validate_segment("my_ext") is True
    assert _validate_segment("Ext123") is True


def test_validate_segment_rejects_traversal() -> None:
    assert _validate_segment("..") is False
    assert _validate_segment("../etc") is False
    assert _validate_segment("acme/bad") is False
    assert _validate_segment("acme%2Fbad") is False
    assert _validate_segment("") is False


def test_validate_segment_rejects_dots() -> None:
    assert _validate_segment("acme.corp") is False


# ---------------------------------------------------------------------------
# Helpers for building fake .supx payloads
# ---------------------------------------------------------------------------


def _make_supx(manifest_id: str = "acme.chatbot") -> bytes:
    """Return minimal valid .supx (zip) bytes with a manifest."""
    buf = io.BytesIO()
    manifest_json = (
        f'{{"id": "{manifest_id}", "name": "Chatbot", "version": "1.0.0",'
        f'"publisher": "acme", "description": "test"}}'
    )
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("manifest.json", manifest_json)
    return buf.getvalue()


def _make_fake_extension(manifest_id: str = "acme.chatbot") -> MagicMock:
    ext = MagicMock()
    ext.manifest.id = manifest_id
    ext.source_base_path = "upload://"
    ext.frontend = {}
    ext.backend = {}
    ext.version = "1.0.0"
    ext.name = "Chatbot"
    return ext


# ---------------------------------------------------------------------------
# POST /api/v1/extensions/ — upload and install
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("app", _ENABLE_EXTENSIONS, indirect=True)
class TestPostEndpoint:
    def _post(self, client: Any, data: dict[str, Any], full_api_access: None) -> Any:
        return client.post(
            "/api/v1/extensions/",
            data=data,
            content_type="multipart/form-data",
        )

    def test_non_admin_rejected(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=False
        )
        resp = client.post("/api/v1/extensions/", data={})
        assert resp.status_code == 403

    def test_missing_extensions_path_returns_400(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch.dict("flask.current_app.config", {"EXTENSIONS_PATH": None})
        resp = client.post("/api/v1/extensions/", data={})
        assert resp.status_code == 400
        assert "EXTENSIONS_PATH" in resp.json["message"]

    def test_missing_bundle_field_returns_400(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch.dict(
            "flask.current_app.config", {"EXTENSIONS_PATH": str(tmp_path)}
        )
        resp = client.post(
            "/api/v1/extensions/",
            data={},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400
        assert "bundle" in resp.json["message"]

    def test_wrong_extension_rejected(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch.dict(
            "flask.current_app.config", {"EXTENSIONS_PATH": str(tmp_path)}
        )
        resp = client.post(
            "/api/v1/extensions/",
            data={"bundle": (io.BytesIO(b"data"), "evil.zip")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400
        assert ".supx" in resp.json["message"]

    def test_oversize_upload_rejected(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch.dict(
            "flask.current_app.config",
            {"EXTENSIONS_PATH": str(tmp_path), "EXTENSIONS_MAX_UPLOAD_SIZE": 10},
        )
        big = io.BytesIO(b"x" * 20)
        resp = client.post(
            "/api/v1/extensions/",
            data={"bundle": (big, "big.supx")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400
        assert "maximum" in resp.json["message"]

    def test_not_a_zip_returns_400(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch.dict(
            "flask.current_app.config", {"EXTENSIONS_PATH": str(tmp_path)}
        )
        resp = client.post(
            "/api/v1/extensions/",
            data={"bundle": (io.BytesIO(b"not a zip"), "ext.supx")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400
        assert "ZIP" in resp.json["message"]

    def test_zip_slip_rejected(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        """check_is_safe_zip raises on path-traversal entries inside the zip."""
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch.dict(
            "flask.current_app.config", {"EXTENSIONS_PATH": str(tmp_path)}
        )
        mocker.patch(
            "superset.extensions.api.check_is_safe_zip",
            side_effect=Exception("zip-slip detected"),
        )
        supx = _make_supx()
        resp = client.post(
            "/api/v1/extensions/",
            data={"bundle": (io.BytesIO(supx), "ext.supx")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400
        assert "zip-slip" in resp.json["message"]

    def test_local_extensions_collision_returns_409(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch.dict(
            "flask.current_app.config",
            {
                "EXTENSIONS_PATH": str(tmp_path),
                "LOCAL_EXTENSIONS": ["/opt/superset/ext/acme.chatbot"],
            },
        )
        fake_ext = _make_fake_extension("acme.chatbot")
        mocker.patch(
            "superset.extensions.api.get_bundle_files_from_zip", return_value=[]
        )
        mocker.patch(
            "superset.extensions.api.get_loaded_extension", return_value=fake_ext
        )
        supx = _make_supx("acme.chatbot")
        resp = client.post(
            "/api/v1/extensions/",
            data={"bundle": (io.BytesIO(supx), "ext.supx")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 409
        assert "local extension" in resp.json["message"]

    def test_hostile_manifest_id_rejected(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        """A crafted manifest.id with path traversal must not escape EXTENSIONS_PATH."""
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch.dict(
            "flask.current_app.config",
            {"EXTENSIONS_PATH": str(tmp_path), "LOCAL_EXTENSIONS": []},
        )
        fake_ext = _make_fake_extension("../../tmp/evil")
        mocker.patch(
            "superset.extensions.api.get_bundle_files_from_zip", return_value=[]
        )
        mocker.patch(
            "superset.extensions.api.get_loaded_extension", return_value=fake_ext
        )
        supx = _make_supx("../../tmp/evil")
        resp = client.post(
            "/api/v1/extensions/",
            data={"bundle": (io.BytesIO(supx), "ext.supx")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400
        assert "Invalid extension id" in resp.json["message"]

    def test_happy_path_returns_201(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch.dict(
            "flask.current_app.config",
            {"EXTENSIONS_PATH": str(tmp_path), "LOCAL_EXTENSIONS": []},
        )
        fake_ext = _make_fake_extension("acme.chatbot")
        mocker.patch(
            "superset.extensions.api.get_bundle_files_from_zip", return_value=[]
        )
        mocker.patch(
            "superset.extensions.api.get_loaded_extension", return_value=fake_ext
        )
        mocker.patch(
            "superset.extensions.api.build_extension_data",
            return_value={"id": "acme.chatbot"},
        )
        supx = _make_supx("acme.chatbot")
        resp = client.post(
            "/api/v1/extensions/",
            data={"bundle": (io.BytesIO(supx), "ext.supx")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 201
        assert resp.json["result"]["id"] == "acme.chatbot"
        assert (tmp_path / "acme.chatbot.supx").exists()


# ---------------------------------------------------------------------------
# DELETE /api/v1/extensions/<publisher>/<name>
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("app", _ENABLE_EXTENSIONS, indirect=True)
class TestDeleteEndpoint:
    def test_non_admin_rejected(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=False
        )
        resp = client.delete("/api/v1/extensions/acme/chatbot")
        assert resp.status_code == 403

    def test_path_traversal_publisher_rejected(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        # Use percent-encoded dots so Flask routing passes the segment to the
        # handler as the string ".." — literal slashes in the path would be
        # intercepted by the router before reaching the view.
        resp = client.delete("/api/v1/extensions/%2E%2E/passwd")
        assert resp.status_code == 400
        assert "Invalid" in resp.json["message"]

    def test_invalid_name_returns_400(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        resp = client.delete("/api/v1/extensions/acme/bad.name")
        assert resp.status_code == 400
        assert "Invalid" in resp.json["message"]

    def test_unknown_extension_returns_404(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch("superset.extensions.api.get_extensions", return_value={})
        resp = client.delete("/api/v1/extensions/acme/chatbot")
        assert resp.status_code == 404

    def test_local_extension_cannot_be_deleted(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        local_base = str(tmp_path / "local-ext" / "dist")
        fake_ext = _make_fake_extension("acme.chatbot")
        fake_ext.source_base_path = local_base
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch(
            "superset.extensions.api.get_extensions",
            return_value={"acme.chatbot": fake_ext},
        )
        mocker.patch.dict(
            "flask.current_app.config",
            {"LOCAL_EXTENSIONS": [str(tmp_path / "local-ext")]},
        )
        resp = client.delete("/api/v1/extensions/acme/chatbot")
        assert resp.status_code == 400
        assert "LOCAL_EXTENSIONS" in resp.json["message"]

    def test_happy_path_deletes_file(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        supx_file = tmp_path / "acme.chatbot.supx"
        supx_file.write_bytes(b"fake")

        fake_ext = _make_fake_extension("acme.chatbot")
        fake_ext.source_base_path = "upload://"
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch(
            "superset.extensions.api.get_extensions",
            return_value={"acme.chatbot": fake_ext},
        )
        mocker.patch.dict(
            "flask.current_app.config",
            {
                "LOCAL_EXTENSIONS": [],
                "EXTENSIONS_PATH": str(tmp_path),
            },
        )
        resp = client.delete("/api/v1/extensions/acme/chatbot")
        assert resp.status_code == 200
        assert not supx_file.exists()

    def test_supx_file_missing_returns_404(
        self, client: Any, full_api_access: None, mocker: Any, tmp_path: Path
    ) -> None:
        fake_ext = _make_fake_extension("acme.chatbot")
        fake_ext.source_base_path = "upload://"
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch(
            "superset.extensions.api.get_extensions",
            return_value={"acme.chatbot": fake_ext},
        )
        mocker.patch.dict(
            "flask.current_app.config",
            {"LOCAL_EXTENSIONS": [], "EXTENSIONS_PATH": str(tmp_path)},
        )
        resp = client.delete("/api/v1/extensions/acme/chatbot")
        assert resp.status_code == 404
