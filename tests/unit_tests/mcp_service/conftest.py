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

"""Test configuration for MCP service unit tests."""

from collections.abc import Iterator
from unittest.mock import MagicMock, patch

import pytest
from flask_appbuilder.security.sqla.models import User


@pytest.fixture(autouse=True)
def mock_mcp_auth(request) -> Iterator[None]:
    """
    Mock MCP authentication for all tests in this directory.

    This fixture automatically mocks the authentication system so that
    MCP tests can run without needing real users in the database.

    Skip this fixture for auth-specific test files that need to test
    the actual auth functionality.
    """
    # Skip auth mocking for auth test files
    if "test_auth" in str(request.fspath):
        yield
        return
    # Create a mock user for testing
    mock_user = MagicMock(spec=User)
    mock_user.username = "test_user"
    mock_user.id = 1
    mock_user.is_active = True
    mock_user.first_name = "Test"
    mock_user.last_name = "User"
    mock_user.email = "test@example.com"

    with (
        patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user,
        patch("superset.mcp_service.auth.has_permission") as mock_has_permission,
        patch("superset.mcp_service.auth.impersonate_user") as mock_impersonate,
        patch("flask.g") as mock_g,
    ):
        # Mock user extraction to always return test user
        mock_get_user.return_value = mock_user

        # Mock permission checks to always allow access
        mock_has_permission.return_value = True

        # Mock impersonation to return the same user (no impersonation)
        mock_impersonate.side_effect = lambda user, run_as: user

        # Mock Flask's g object
        mock_g.user = mock_user

        yield


@pytest.fixture
def test_user() -> User:
    """Provide a test user for tests that need one."""
    mock_user = MagicMock(spec=User)
    mock_user.username = "test_user"
    mock_user.id = 1
    mock_user.is_active = True
    mock_user.first_name = "Test"
    mock_user.last_name = "User"
    mock_user.email = "test@example.com"
    return mock_user


@pytest.fixture
def mcp_server():
    """Provide the MCP server instance for testing."""
    from superset.mcp_service.mcp_app import mcp

    return mcp
