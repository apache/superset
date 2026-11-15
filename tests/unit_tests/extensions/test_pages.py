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
"""How the host serves an extension's standalone page."""

from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
import superset_core.extensions.pages as core_pages
from flask import Flask
from jinja2 import FileSystemLoader
from pytest_mock import MockerFixture

import superset
from superset.extensions import pages
from superset.utils import json

PAGE = "extensions.acme.reports.report"


def _payload(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """The app shell's bootstrap data, short of a signed-in user's."""
    return {"user": {}, "common": {"locale": "en", "theme": {}}, **(extra or {})}


@pytest.fixture
def spa_payload(app: Flask, mocker: MockerFixture) -> MagicMock:
    """Render with Superset's own templates, short of a signed-in user."""
    templates = Path(superset.__file__).parent / "templates"
    mocker.patch.object(app, "jinja_loader", FileSystemLoader(templates))
    return mocker.patch("superset.views.base.get_spa_payload", side_effect=_payload)


def _bootstrap(page: str) -> dict[str, Any]:
    found = re.search(r'id="app" data-bootstrap="([^"]*)"', page)
    assert found is not None
    return json.loads(html.unescape(found.group(1)))


def test_the_host_implements_render_page() -> None:
    assert core_pages.render_page is pages.render_page


def test_a_page_is_the_app_shell_naming_the_page_and_its_params(
    app: Flask, spa_payload: MagicMock
) -> None:
    with app.test_request_context("/extensions/acme/reports/report/42/page"):
        response = pages.render_page(PAGE, {"reportId": "42"})

    assert response.status_code == 200
    assert response.mimetype == "text/html"
    page = response.get_data(as_text=True)
    assert '<body class="standalone">' in page
    assert _bootstrap(page)["extension_page"] == {
        "id": PAGE,
        "params": {"reportId": "42"},
    }
    spa_payload.assert_called_once_with(
        {"extension_page": {"id": PAGE, "params": {"reportId": "42"}}}
    )


def test_a_page_without_params_gets_an_empty_mapping(
    app: Flask, spa_payload: MagicMock
) -> None:
    with app.test_request_context("/extensions/acme/reports/page"):
        response = pages.render_page(PAGE)

    page = response.get_data(as_text=True)
    assert _bootstrap(page)["extension_page"] == {"id": PAGE, "params": {}}


@pytest.mark.parametrize("page", ["", None, 42])
def test_a_page_has_an_id(app: Flask, page: Any) -> None:
    with app.test_request_context("/"), pytest.raises(ValueError, match="id"):
        pages.render_page(page)


@pytest.mark.parametrize("params", [{"reportId": 42}, {1: "a"}, {"rows": ["a"]}])
def test_a_pages_params_are_strings(app: Flask, params: Any) -> None:
    with app.test_request_context("/"), pytest.raises(TypeError, match="strings"):
        pages.render_page(PAGE, params)
