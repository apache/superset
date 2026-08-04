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
    extract_dashboard_permalink_key,
    get_dashboard_permalink,
    refresh_request_user_for_permalink_access,
)


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
