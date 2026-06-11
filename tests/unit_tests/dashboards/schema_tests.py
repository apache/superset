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

from typing import Any

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset.dashboards.permalink.schemas import DashboardPermalinkStateSchema
from superset.dashboards.schemas import (
    DashboardCopySchema,
    DashboardDatasetSchema,
    DashboardPostSchema,
    DashboardPutSchema,
)

GUEST_RESTRICTED_FIELDS = [
    "owners",
    "database",
    "sql",
    "select_star",
    "perm",
    "edit_url",
    "fetch_values_predicate",
    "template_params",
]


def _dataset_payload() -> dict[str, Any]:
    return {
        "id": 1,
        "database": {"id": 1, "name": "test_db"},
        "owners": [{"id": 1}],
        "sql": "SELECT 1",
        "select_star": "SELECT * FROM t",
        "perm": "[db].[table]",
        "edit_url": "/edit/1",
        "fetch_values_predicate": "1 = 1",
        "template_params": "{}",
        "table_name": "t",
    }


def test_dashboard_dataset_guest_filtering(mocker: MockerFixture) -> None:
    """Guest users should not receive sensitive dataset fields."""
    mocker.patch(
        "superset.dashboards.schemas.security_manager.is_guest_user",
        return_value=True,
    )
    result = DashboardDatasetSchema().dump(_dataset_payload())
    for field in GUEST_RESTRICTED_FIELDS:
        assert field not in result, f"{field} should be removed for guest users"
    assert result["table_name"] == "t"


def test_dashboard_dataset_non_guest_keeps_fields(mocker: MockerFixture) -> None:
    """Non-guest users keep the sensitive dataset fields."""
    mocker.patch(
        "superset.dashboards.schemas.security_manager.is_guest_user",
        return_value=False,
    )
    result = DashboardDatasetSchema().dump(_dataset_payload())
    assert result["sql"] == "SELECT 1"
    assert result["perm"] == "[db].[table]"
    assert "database" in result


def test_dashboard_external_url_accepts_https() -> None:
    """A valid https external_url is accepted."""
    schema = DashboardPostSchema()
    result = schema.load(
        {
            "dashboard_title": "test",
            "external_url": "https://example.com/managed",
        }
    )
    assert result["external_url"] == "https://example.com/managed"


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
    ],
)
def test_dashboard_external_url_rejects_non_http(url: str) -> None:
    """external_url rejects non-http(s) schemes."""
    schema = DashboardPostSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"dashboard_title": "test", "external_url": url})
    assert "external_url" in exc_info.value.messages


@pytest.mark.parametrize(
    "css",
    [
        "",
        ".header { color: red; font-weight: bold; }",
        "div { background: url('/static/assets/images/bg.png') no-repeat; }",
        "div { background: url(data:image/png;base64,iVBORw0KGgo=); }",
        "a { color: #fff; } /* link to https://example.com is fine */",
    ],
)
def test_dashboard_css_accepts_legitimate_styles(css: str) -> None:
    """Ordinary CSS, including image url() references, is accepted."""
    schema = DashboardPostSchema()
    result = schema.load({"dashboard_title": "test", "css": css})
    assert result["css"] == css


@pytest.mark.parametrize(
    "css",
    [
        "div { width: expression(alert(1)); }",
        "div { background: url(javascript:alert(1)); }",
        "body { background: url( 'javascript:alert(1)' ); }",
        "@import url('https://evil.example.com/x.css');",
        "a { content: 'javascript:alert(1)'; }",
        "div { behavior: url(vbscript:msgbox(1)); }",
    ],
)
def test_dashboard_css_rejects_dangerous_constructs(css: str) -> None:
    """Custom CSS with script-ish constructs is rejected on input."""
    schema = DashboardPostSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"dashboard_title": "test", "css": css})
    assert "css" in exc_info.value.messages


def test_dashboard_put_css_rejects_dangerous_constructs() -> None:
    """The PUT schema applies the same CSS hardening."""
    schema = DashboardPutSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"css": "div { width: expression(alert(1)); }"})
    assert "css" in exc_info.value.messages


def test_dashboard_copy_css_rejects_dangerous_constructs() -> None:
    """The Copy schema applies the same CSS hardening."""
    schema = DashboardCopySchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load(
            {
                "json_metadata": "{}",
                "css": "div { width: expression(alert(1)); }",
            }
        )
    assert "css" in exc_info.value.messages


def test_permalink_state_schema_accepts_null_in_active_tabs() -> None:
    """Regression test for #40934.

    Legacy v5 dashboard exports persist ``null`` entries inside
    ``activeTabs`` (one ``None`` per tab level that has no active child).
    The permalink schema must accept those entries instead of rejecting
    the whole payload with ``'activeTabs': {N: ['Field may not be null.']}``.
    """
    schema = DashboardPermalinkStateSchema()
    loaded = schema.load({"activeTabs": ["TAB-abc", None, "TAB-xyz", None]})
    assert loaded["activeTabs"] == ["TAB-abc", None, "TAB-xyz", None]


def test_permalink_state_schema_still_accepts_null_active_tabs_list() -> None:
    """A ``None`` for the whole ``activeTabs`` list (not just entries) must
    keep working — this was the only ``allow_none`` path before #40934."""
    schema = DashboardPermalinkStateSchema()
    loaded = schema.load({"activeTabs": None})
    assert loaded["activeTabs"] is None


def test_permalink_state_schema_still_rejects_non_string_entries() -> None:
    """Allowing ``None`` entries should NOT widen the type to ``Any`` —
    non-string entries like ``int`` or ``dict`` must still be rejected."""
    schema = DashboardPermalinkStateSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"activeTabs": ["TAB-abc", 42]})
    assert "activeTabs" in exc_info.value.messages
