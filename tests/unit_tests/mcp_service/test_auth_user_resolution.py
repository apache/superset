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

"""Tests for _mcp_user_id_var, the ContextVar that carries the resolved
MCP user's id past the per-call app context pop (see auth.py docstring).
"""

from unittest.mock import MagicMock, patch

import pytest


def _make_mock_user(username: str = "testuser") -> MagicMock:
    """Create a mock User with required attributes."""
    user = MagicMock()
    user.username = username
    user.roles = []
    user.groups = []
    return user


def test_setup_user_context_sets_contextvar_for_active_user(app) -> None:
    """_mcp_user_id_var carries the resolved user's id past this call."""
    from superset.mcp_service.auth import _mcp_user_id_var, _setup_user_context

    active_user = _make_mock_user("active_user")
    active_user.id = 321

    with app.test_request_context():
        with patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=active_user,
        ):
            _setup_user_context()
            assert _mcp_user_id_var.get() == 321


def test_setup_user_context_clears_stale_contextvar_on_failure(app) -> None:
    """A previous call's user_id must not leak into a call that fails to
    resolve a user (e.g. sequential calls sharing one asyncio task)."""
    from superset.mcp_service.auth import _mcp_user_id_var, _setup_user_context

    with app.test_request_context():
        _mcp_user_id_var.set(999)
        with patch(
            "superset.mcp_service.auth.get_user_from_request",
            side_effect=ValueError("no user"),
        ):
            with pytest.raises(ValueError, match="no user"):
                _setup_user_context()
            assert _mcp_user_id_var.get() is None


def test_setup_user_context_leaves_contextvar_unset_without_numeric_id(
    app,
) -> None:
    """A resolved principal with no numeric id (e.g. an anonymous/guest
    user) must leave the ContextVar cleared rather than store a bogus
    value."""
    from superset.mcp_service.auth import _mcp_user_id_var, _setup_user_context

    no_id_user = _make_mock_user("no_id_user")
    no_id_user.id = None

    with app.test_request_context():
        with patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=no_id_user,
        ):
            _setup_user_context()
            assert _mcp_user_id_var.get() is None
