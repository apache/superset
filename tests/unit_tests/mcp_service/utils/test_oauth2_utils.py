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

"""
Unit tests for MCP service OAuth2 utilities.
"""

import pytest

from superset.exceptions import OAuth2RedirectError
from superset.mcp_service.utils.oauth2_utils import (
    build_oauth2_redirect_message,
    OAUTH2_CONFIG_ERROR_MESSAGE,
)


def _make_error(
    url: str = "https://example.com/oauth/authorize",
    tab_id: str = "tab-123",
    redirect_uri: str = "https://example.com/oauth/callback",
) -> OAuth2RedirectError:
    return OAuth2RedirectError(url=url, tab_id=tab_id, redirect_uri=redirect_uri)


def test_build_oauth2_redirect_message_includes_the_authorization_url() -> None:
    """Should embed the OAuth2 authorization URL from the exception's extra."""
    ex = _make_error(url="https://auth.example.com/start")

    message = build_oauth2_redirect_message(ex)

    assert "https://auth.example.com/start" in message


def test_build_oauth2_redirect_message_explains_next_steps() -> None:
    """Should tell the user to open the URL and retry the request."""
    ex = _make_error()

    message = build_oauth2_redirect_message(ex)

    assert message.startswith("This database uses OAuth for authentication.")
    assert "open the following URL in your browser" in message
    assert "retry this request" in message


def test_build_oauth2_redirect_message_ends_with_url_on_its_own_line() -> None:
    """Should place the URL at the end of the message after a blank line."""
    ex = _make_error(url="https://auth.example.com/oauth2/authorize?client_id=abc")

    message = build_oauth2_redirect_message(ex)

    assert message.endswith("https://auth.example.com/oauth2/authorize?client_id=abc")
    assert "\n\n" in message


def test_build_oauth2_redirect_message_raises_assertion_when_extra_missing() -> None:
    """Should assert when the exception's error.extra is unexpectedly None."""
    ex = _make_error()
    ex.error.extra = None

    with pytest.raises(AssertionError):
        build_oauth2_redirect_message(ex)


def test_build_oauth2_redirect_message_raises_key_error_when_url_missing() -> None:
    """Should raise a KeyError if extra is present but lacks a 'url' key."""
    ex = _make_error()
    ex.error.extra = {"tab_id": "tab-123", "redirect_uri": "https://example.com/cb"}

    with pytest.raises(KeyError):
        build_oauth2_redirect_message(ex)


def test_oauth2_config_error_message_is_a_nonempty_string() -> None:
    """Should expose a non-empty, human-readable config error message."""
    assert isinstance(OAUTH2_CONFIG_ERROR_MESSAGE, str)
    assert len(OAUTH2_CONFIG_ERROR_MESSAGE) > 0


def test_oauth2_config_error_message_points_to_the_administrator() -> None:
    """Should direct the user to contact their Superset administrator."""
    assert "administrator" in OAUTH2_CONFIG_ERROR_MESSAGE
    assert "Superset" in OAUTH2_CONFIG_ERROR_MESSAGE
