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

"""Tests for API key authentication in get_user_from_request()."""

from unittest.mock import MagicMock, patch

import pytest
from flask import g

from superset.mcp_service.auth import get_user_from_request


@pytest.fixture()
def mock_user():
    user = MagicMock()
    user.username = "api_key_user"
    return user


@pytest.fixture()
def _enable_api_keys(app):
    """Enable FAB API key auth and clear MCP_DEV_USERNAME so the API key
    path is exercised instead of falling through to the dev-user fallback."""
    app.config["FAB_API_KEY_ENABLED"] = True
    old_dev = app.config.pop("MCP_DEV_USERNAME", None)
    yield
    app.config.pop("FAB_API_KEY_ENABLED", None)
    if old_dev is not None:
        app.config["MCP_DEV_USERNAME"] = old_dev


@pytest.fixture()
def _disable_api_keys(app):
    app.config["FAB_API_KEY_ENABLED"] = False
    old_dev = app.config.pop("MCP_DEV_USERNAME", None)
    yield
    app.config.pop("FAB_API_KEY_ENABLED", None)
    if old_dev is not None:
        app.config["MCP_DEV_USERNAME"] = old_dev


# -- Valid API key -> user loaded --


@pytest.mark.usefixtures("_enable_api_keys")
def test_valid_api_key_returns_user(app, mock_user) -> None:
    """A valid API key should authenticate and return the user."""
    mock_sm = MagicMock()
    mock_sm._extract_api_key_from_request.return_value = "sst_abc123"
    mock_sm.validate_api_key.return_value = mock_user

    with app.test_request_context(headers={"Authorization": "Bearer sst_abc123"}):
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with patch(
            "superset.mcp_service.auth.load_user_with_relationships",
            return_value=mock_user,
        ):
            result = get_user_from_request()

    assert result.username == "api_key_user"
    mock_sm.validate_api_key.assert_called_once_with("sst_abc123")


# -- Invalid API key -> PermissionError --


@pytest.mark.usefixtures("_enable_api_keys")
def test_invalid_api_key_raises(app) -> None:
    """An invalid API key should raise PermissionError."""
    mock_sm = MagicMock()
    mock_sm._extract_api_key_from_request.return_value = "sst_bad_key"
    mock_sm.validate_api_key.return_value = None

    with app.test_request_context(headers={"Authorization": "Bearer sst_bad_key"}):
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with pytest.raises(PermissionError, match="Invalid or expired API key"):
            get_user_from_request()


# -- API key disabled -> falls through to next auth method --


@pytest.mark.usefixtures("_disable_api_keys")
def test_api_key_disabled_skips_auth(app) -> None:
    """When FAB_API_KEY_ENABLED is False, API key auth is skipped entirely."""
    mock_sm = MagicMock()

    with app.test_request_context(headers={"Authorization": "Bearer sst_abc123"}):
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        # Without API key auth or MCP_DEV_USERNAME, should raise ValueError
        # about no authenticated user (not about invalid API key)
        with pytest.raises(ValueError, match="No authenticated user found"):
            get_user_from_request()

    # SecurityManager API key methods should never be called
    mock_sm._extract_api_key_from_request.assert_not_called()


# -- No request context -> API key auth skipped --


@pytest.mark.usefixtures("_enable_api_keys")
def test_no_request_context_skips_api_key_auth(app) -> None:
    """Without a request context, API key auth should be skipped
    (e.g., during MCP tool discovery with only an app context)."""
    mock_sm = MagicMock()

    with app.app_context():
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        # Explicitly mock has_request_context to False because the test
        # framework's app fixture may implicitly provide a request context.
        with patch("superset.mcp_service.auth.has_request_context", return_value=False):
            with pytest.raises(ValueError, match="No authenticated user found"):
                get_user_from_request()

    mock_sm._extract_api_key_from_request.assert_not_called()


# -- g.user fallback when no higher-priority auth succeeds --


@pytest.mark.usefixtures("_disable_api_keys")
def test_g_user_fallback_when_no_jwt_or_api_key(app, mock_user) -> None:
    """When no JWT or API key auth succeeds and MCP_DEV_USERNAME is not set,
    g.user (set by external middleware) is used as fallback."""
    with app.test_request_context():
        g.user = mock_user

        result = get_user_from_request()

    assert result.username == "api_key_user"


# -- FAB version without _extract_api_key_from_request --


@pytest.mark.usefixtures("_enable_api_keys")
def test_fab_without_extract_method_skips_gracefully(app) -> None:
    """If FAB SecurityManager lacks _extract_api_key_from_request,
    API key auth should be skipped with a debug log, not crash."""
    mock_sm = MagicMock(spec=[])  # empty spec = no attributes

    with app.test_request_context():
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with pytest.raises(ValueError, match="No authenticated user found"):
            get_user_from_request()


# -- FAB version without validate_api_key --


@pytest.mark.usefixtures("_enable_api_keys")
def test_fab_without_validate_method_raises(app) -> None:
    """If FAB has _extract_api_key_from_request but not validate_api_key,
    should raise PermissionError about unavailable validation."""
    mock_sm = MagicMock(spec=["_extract_api_key_from_request"])
    mock_sm._extract_api_key_from_request.return_value = "sst_abc123"

    with app.test_request_context(headers={"Authorization": "Bearer sst_abc123"}):
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with pytest.raises(
            PermissionError, match="API key validation is not available"
        ):
            get_user_from_request()


# -- Relationship reload fallback --


@pytest.mark.usefixtures("_enable_api_keys")
def test_relationship_reload_failure_returns_original_user(app, mock_user) -> None:
    """If load_user_with_relationships fails, the original user from
    validate_api_key should be returned as fallback."""
    mock_sm = MagicMock()
    mock_sm._extract_api_key_from_request.return_value = "sst_abc123"
    mock_sm.validate_api_key.return_value = mock_user

    with app.test_request_context(headers={"Authorization": "Bearer sst_abc123"}):
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with patch(
            "superset.mcp_service.auth.load_user_with_relationships",
            return_value=None,
        ):
            result = get_user_from_request()

    assert result is mock_user
