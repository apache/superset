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

"""Tests for MCP dashboard permalink helpers."""

from unittest.mock import patch

import pytest
from flask import g

from superset.commands.dashboard.exceptions import DashboardAccessDeniedError
from superset.mcp_service.dashboard.permalink import (
    DashboardLookupResult,
    extract_dashboard_permalink_key,
    get_dashboard_permalink,
    get_matching_dashboard_permalink_state,
    lookup_dashboard_reference,
    refresh_request_user_for_permalink_access,
)

FOUND = "dashboard"
PERMALINK_URL = "https://example.test/dashboard/p/shared-key/"


def _lookup_finding(*found_identifiers: int | str):
    """Build a ``lookup`` callable that only resolves ``found_identifiers``."""
    known = {str(identifier) for identifier in found_identifiers}

    def lookup(identifier: int | str) -> str | None:
        return FOUND if str(identifier) in known else None

    return lookup


def _is_found(result: str | None) -> bool:
    return result is not None


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("bare-key", "bare-key"),
        ("/superset/dashboard/p/shared-key/", "shared-key"),
        (
            "https://example.test/prefix/dashboard/p/shared-key/?foo=bar#tab",
            "shared-key",
        ),
        (
            "https://example.test/dashboard/not-p/shared-key/",
            "https://example.test/dashboard/not-p/shared-key/",
        ),
    ],
)
def test_extract_dashboard_permalink_key(value: str, expected: str) -> None:
    assert extract_dashboard_permalink_key(value) == expected


@patch(
    "superset.commands.dashboard.permalink.get.GetDashboardPermalinkCommand.run",
    side_effect=DashboardAccessDeniedError(),
)
@patch(
    "superset.mcp_service.dashboard.permalink.refresh_request_user_for_permalink_access"
)
def test_get_dashboard_permalink_hides_access_denial(mock_refresh, mock_run) -> None:
    assert get_dashboard_permalink("inaccessible-key") is None
    mock_refresh.assert_called_once_with()
    mock_run.assert_called_once_with()


@pytest.mark.parametrize(
    ("username", "email", "expected_kwargs"),
    [
        ("admin", None, {"username": "admin"}),
        (None, "admin@example.com", {"email": "admin@example.com"}),
    ],
)
def test_refresh_request_user_for_permalink_access(
    app, username: str | None, email: str | None, expected_kwargs: dict[str, str]
) -> None:
    current_user = type(
        "CurrentUser",
        (),
        {"username": username, "email": email, "is_anonymous": False},
    )()
    refreshed_user = object()
    with (
        patch(
            "superset.mcp_service.dashboard.permalink.load_user_with_relationships",
            return_value=refreshed_user,
        ) as mock_load,
        app.test_request_context("/mcp"),
    ):
        g.user = current_user
        refresh_request_user_for_permalink_access()
        assert g.user is refreshed_user

    mock_load.assert_called_once_with(**expected_kwargs)


@pytest.mark.parametrize(
    ("username", "email", "is_anonymous"),
    [("anonymous", "anonymous@example.com", True), (None, None, False)],
)
def test_refresh_request_user_for_permalink_access_skips_unresolvable_user(
    app, username: str | None, email: str | None, is_anonymous: bool
) -> None:
    current_user = type(
        "CurrentUser",
        (),
        {"username": username, "email": email, "is_anonymous": is_anonymous},
    )()
    with (
        patch(
            "superset.mcp_service.dashboard.permalink.load_user_with_relationships"
        ) as mock_load,
        app.test_request_context("/mcp"),
    ):
        g.user = current_user
        refresh_request_user_for_permalink_access()
        assert g.user is current_user

    mock_load.assert_not_called()


def test_refresh_request_user_for_permalink_access_keeps_user_when_reload_fails(
    app,
) -> None:
    current_user = type(
        "CurrentUser",
        (),
        {"username": "admin", "email": None, "is_anonymous": False},
    )()
    with (
        patch(
            "superset.mcp_service.dashboard.permalink.load_user_with_relationships",
            return_value=None,
        ) as mock_load,
        app.test_request_context("/mcp"),
    ):
        g.user = current_user
        refresh_request_user_for_permalink_access()
        assert g.user is current_user

    mock_load.assert_called_once_with(username="admin")


@pytest.mark.parametrize(
    ("reference", "expected_match"),
    [
        # CreateDashboardPermalinkCommand stores str(dashboard.uuid).
        ("3f1a2b6c-9d4e-4f80-9c2a-7b1d5e6f8a90", True),
        # Legacy permalinks may hold the numeric id or the slug.
        ("42", True),
        ("sales-dashboard", True),
        ("99", False),
        ("00000000-0000-0000-0000-000000000000", False),
    ],
)
def test_get_matching_dashboard_permalink_state_accepts_every_identifier(
    app, reference: str, expected_match: bool
) -> None:
    lookup_result = DashboardLookupResult(
        result=object(),
        permalink_key="key-1",
        permalink_value={"dashboardId": reference, "state": {"activeTabs": ["TAB-A"]}},
    )
    with app.test_request_context("/mcp"):
        state = get_matching_dashboard_permalink_state(
            lookup_result,
            42,
            "3f1a2b6c-9d4e-4f80-9c2a-7b1d5e6f8a90",
            "sales-dashboard",
        )

    assert (state is not None) is expected_match


def test_get_matching_dashboard_permalink_state_skips_check_when_permalink_resolved(
    app,
) -> None:
    """The permalink-only path already selected the dashboard from the permalink,
    so its state is never re-verified against the resolved identifiers.
    """
    lookup_result = DashboardLookupResult(
        result=object(),
        permalink_key="key-1",
        permalink_value={"dashboardId": "whatever", "state": {"activeTabs": ["TAB-A"]}},
        resolved_from_permalink=True,
    )
    with app.test_request_context("/mcp"):
        state = get_matching_dashboard_permalink_state(lookup_result, 42)

    assert state is not None
    assert state.key == "key-1"


@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
def test_lookup_dashboard_reference_identifier_only(mock_get_permalink) -> None:
    result = lookup_dashboard_reference(
        identifier=42,
        permalink_key=None,
        lookup=_lookup_finding(42),
        is_found=_is_found,
    )

    assert result.result == FOUND
    assert result.permalink_key is None
    assert result.permalink_value is None
    assert result.resolved_from_permalink is False
    mock_get_permalink.assert_not_called()


@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
def test_lookup_dashboard_reference_identifier_wins_but_permalink_adds_state(
    mock_get_permalink,
) -> None:
    """An explicit identifier selects the dashboard; the permalink only adds state."""
    value = {"dashboardId": "42", "state": {"activeTabs": ["TAB-A"]}}
    mock_get_permalink.return_value = ("key-1", value)

    result = lookup_dashboard_reference(
        identifier=42,
        permalink_key="key-1",
        lookup=_lookup_finding(42),
        is_found=_is_found,
    )

    assert result.result == FOUND
    assert result.permalink_key == "key-1"
    assert result.permalink_value == value
    assert result.resolved_from_permalink is False


@patch(
    "superset.mcp_service.dashboard.permalink.get_dashboard_permalink",
    return_value=None,
)
def test_lookup_dashboard_reference_keeps_dashboard_when_permalink_unresolvable(
    mock_get_permalink,
) -> None:
    result = lookup_dashboard_reference(
        identifier=42,
        permalink_key="expired-key",
        lookup=_lookup_finding(42),
        is_found=_is_found,
    )

    assert result.result == FOUND
    assert result.permalink_key == "expired-key"
    assert result.permalink_value is None


@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
def test_lookup_dashboard_reference_numeric_identifier_not_found(
    mock_get_permalink,
) -> None:
    """A numeric identifier never falls back to permalink resolution."""
    result = lookup_dashboard_reference(
        identifier=99,
        permalink_key=None,
        lookup=_lookup_finding(),
        is_found=_is_found,
    )

    assert result.result is None
    assert result.permalink_key is None
    mock_get_permalink.assert_not_called()


@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
def test_lookup_dashboard_reference_identifier_not_found_with_explicit_permalink(
    mock_get_permalink,
) -> None:
    """An explicit permalink_key keeps the identifier's own not-found result."""
    result = lookup_dashboard_reference(
        identifier="missing-slug",
        permalink_key="key-1",
        lookup=_lookup_finding(),
        is_found=_is_found,
    )

    assert result.result is None
    assert result.permalink_key == "key-1"
    mock_get_permalink.assert_not_called()


@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
def test_lookup_dashboard_reference_shared_url_identifier(mock_get_permalink) -> None:
    value = {"dashboardId": "42", "state": {"activeTabs": ["TAB-A"]}}
    mock_get_permalink.return_value = ("shared-key", value)

    result = lookup_dashboard_reference(
        identifier=PERMALINK_URL,
        permalink_key=None,
        lookup=_lookup_finding(42),
        is_found=_is_found,
    )

    assert result.result == FOUND
    assert result.permalink_key == "shared-key"
    assert result.permalink_value == value
    assert result.resolved_from_permalink is True
    mock_get_permalink.assert_called_once_with("shared-key")


@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
def test_lookup_dashboard_reference_permalink_only(mock_get_permalink) -> None:
    value = {"dashboardId": "42", "state": {"activeTabs": ["TAB-A"]}}
    mock_get_permalink.return_value = ("key-1", value)

    result = lookup_dashboard_reference(
        identifier=None,
        permalink_key="key-1",
        lookup=_lookup_finding(42),
        is_found=_is_found,
    )

    assert result.result == FOUND
    assert result.permalink_key == "key-1"
    assert result.resolved_from_permalink is True


@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
def test_lookup_dashboard_reference_bare_string_falls_back_to_permalink(
    mock_get_permalink,
) -> None:
    """An ambiguous bare string tries identifier lookup before permalink lookup."""
    value = {"dashboardId": "42", "state": {"activeTabs": ["TAB-A"]}}
    mock_get_permalink.return_value = ("maybe-key", value)

    result = lookup_dashboard_reference(
        identifier="maybe-key",
        permalink_key=None,
        lookup=_lookup_finding(42),
        is_found=_is_found,
    )

    assert result.result == FOUND
    assert result.permalink_key == "maybe-key"
    assert result.resolved_from_permalink is True
    mock_get_permalink.assert_called_once_with("maybe-key")


@patch(
    "superset.mcp_service.dashboard.permalink.get_dashboard_permalink",
    return_value=None,
)
def test_lookup_dashboard_reference_unresolvable_reference(mock_get_permalink) -> None:
    result = lookup_dashboard_reference(
        identifier="nonexistent",
        permalink_key=None,
        lookup=_lookup_finding(),
        is_found=_is_found,
    )

    assert result.result is None
    assert result.permalink_key == "nonexistent"
    assert result.permalink_value is None
    assert result.resolved_from_permalink is False
