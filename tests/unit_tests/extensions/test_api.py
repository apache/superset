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
from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
import rison
from flask.testing import FlaskClient
from superset_core.extensions.types import Manifest, ManifestFrontend

from superset.extensions.types import LoadedExtension

EXTENSIONS_LIST_URL = "/api/v1/extensions/"

_ENABLE_EXTENSIONS_CONFIG = {
    "FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True},
    "LOCAL_EXTENSIONS": [],
}


def _make_extension(
    publisher: str,
    name: str,
    display_name: str,
    version: str = "1.0.0",
    description: str | None = None,
) -> LoadedExtension:
    ext_id = f"{publisher}.{name}"
    manifest = Manifest(
        id=ext_id,
        publisher=publisher,
        name=name,
        displayName=display_name,
        version=version,
        description=description,
        frontend=ManifestFrontend(
            remoteEntry="remoteEntry.js",
            moduleFederationName=f"{publisher}_{name}",
        ),
    )
    return LoadedExtension(
        id=ext_id,
        name=name,
        manifest=manifest,
        frontend={},
        backend={},
        version=version,
        source_base_path="/fake/extensions/path",  # noqa: S108
    )


FAKE_EXTENSIONS: dict[str, LoadedExtension] = {
    "acme.charts": _make_extension(
        "acme", "charts", "ACME Charts", description="Chart extensions by ACME"
    ),
    "acme.filters": _make_extension(
        "acme", "filters", "ACME Filters", description="Filter tools"
    ),
    "globex.dashboards": _make_extension(
        "globex", "dashboards", "Globex Dashboards", description="Dashboard widgets"
    ),
}


def _mock_get_extensions() -> dict[str, LoadedExtension]:
    return dict(FAKE_EXTENSIONS)


def _get_json(client: FlaskClient, url: str) -> dict[str, Any]:
    rv = client.get(url)
    return rv.get_json()


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_no_q_returns_all(client: FlaskClient, full_api_access: None) -> None:
    """GET /api/v1/extensions/ without q returns all extensions."""
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        data = _get_json(client, EXTENSIONS_LIST_URL)
    assert data["count"] == 3
    assert len(data["result"]) == 3


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_q_filter_by_name(client: FlaskClient, full_api_access: None) -> None:
    """GET /api/v1/extensions/?q=... filters by name field."""
    q = rison.dumps({"filters": [{"col": "name", "opr": "eq", "value": "charts"}]})
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        data = _get_json(client, f"{EXTENSIONS_LIST_URL}?q={q}")
    assert data["count"] == 1
    assert data["result"][0]["name"] == "charts"


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_q_filter_by_publisher(
    client: FlaskClient, full_api_access: None
) -> None:
    """GET /api/v1/extensions/?q=... filters by publisher field."""
    q = rison.dumps({"filters": [{"col": "publisher", "opr": "eq", "value": "acme"}]})
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        data = _get_json(client, f"{EXTENSIONS_LIST_URL}?q={q}")
    assert data["count"] == 2
    ids = {ext["id"] for ext in data["result"]}
    assert ids == {"acme.charts", "acme.filters"}


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_q_search_text(client: FlaskClient, full_api_access: None) -> None:
    """GET /api/v1/extensions/?q=... supports text search across name/description."""
    q = rison.dumps({"search": "dashboard"})
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        data = _get_json(client, f"{EXTENSIONS_LIST_URL}?q={q}")
    assert data["count"] == 1
    assert data["result"][0]["id"] == "globex.dashboards"


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_q_search_case_insensitive(
    client: FlaskClient, full_api_access: None
) -> None:
    """Search is case-insensitive."""
    q = rison.dumps({"search": "ACME"})
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        data = _get_json(client, f"{EXTENSIONS_LIST_URL}?q={q}")
    assert data["count"] == 2


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_q_no_matches(client: FlaskClient, full_api_access: None) -> None:
    """q that matches nothing returns empty result."""
    q = rison.dumps({"search": "nonexistent"})
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        data = _get_json(client, f"{EXTENSIONS_LIST_URL}?q={q}")
    assert data["count"] == 0
    assert data["result"] == []


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_q_invalid_rison(client: FlaskClient, full_api_access: None) -> None:
    """Invalid rison q returns 400."""
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        rv = client.get(f"{EXTENSIONS_LIST_URL}?q=((invalid")
    assert rv.status_code == 400


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_q_invalid_filter_col(
    client: FlaskClient, full_api_access: None
) -> None:
    """Filtering on an unsupported column returns 400."""
    q = rison.dumps({"filters": [{"col": "secret_field", "opr": "eq", "value": "x"}]})
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        rv = client.get(f"{EXTENSIONS_LIST_URL}?q={q}")
    assert rv.status_code == 400


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_q_pagination(client: FlaskClient, full_api_access: None) -> None:
    """q supports page and page_size for pagination."""
    q = rison.dumps({"page": 0, "page_size": 2})
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        data = _get_json(client, f"{EXTENSIONS_LIST_URL}?q={q}")
    assert len(data["result"]) == 2
    assert data["count"] == 3


@pytest.mark.parametrize("app", [_ENABLE_EXTENSIONS_CONFIG], indirect=True)
def test_get_list_response_shape_unchanged(
    client: FlaskClient, full_api_access: None
) -> None:
    """Response shape has result and count keys with correct types."""
    with patch(
        "superset.extensions.api.get_extensions",
        side_effect=_mock_get_extensions,
    ):
        data = _get_json(client, EXTENSIONS_LIST_URL)
    assert "result" in data
    assert "count" in data
    assert isinstance(data["result"], list)
    assert isinstance(data["count"], int)
    for ext in data["result"]:
        assert "id" in ext
        assert "name" in ext
        assert "version" in ext
