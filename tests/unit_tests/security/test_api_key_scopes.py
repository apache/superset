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

"""Tests for API key scope validation in SupersetSecurityManager.

Covers the "intersection, never broader" rule: a user must not be able to
mint an API key scoped beyond what their own RBAC already permits.
"""

from unittest.mock import MagicMock, patch

import pytest

from superset.extensions import appbuilder
from superset.security.manager import SupersetSecurityManager


def _make_user(*role_names: str) -> MagicMock:
    """Build a mock user whose roles carry the given names."""
    user = MagicMock()
    roles = []
    for role_name in role_names:
        role = MagicMock()
        role.name = role_name
        roles.append(role)
    user.roles = roles
    return user


@pytest.fixture
def sm(app_context: None) -> SupersetSecurityManager:
    return SupersetSecurityManager(appbuilder)


def test_no_scopes_is_a_noop(sm: SupersetSecurityManager) -> None:
    """No scopes requested: nothing to validate, no RBAC lookups."""
    sm.can_access = MagicMock()  # type: ignore[method-assign]
    sm._validate_requested_api_key_scopes(_make_user("Gamma"), None)
    sm._validate_requested_api_key_scopes(_make_user("Gamma"), "")
    sm.can_access.assert_not_called()


def test_per_resource_scope_allowed_when_user_has_permission(
    sm: SupersetSecurityManager,
) -> None:
    """A per-resource scope the user's RBAC covers is allowed, and is checked
    against the matching can_<method> grant."""
    sm.can_access = MagicMock(return_value=True)  # type: ignore[method-assign]
    sm._validate_requested_api_key_scopes(
        _make_user("Gamma"), "superset:dashboard:read"
    )
    sm.can_access.assert_called_once_with("can_read", "Dashboard")


def test_per_resource_scope_rejected_when_user_lacks_permission(
    sm: SupersetSecurityManager,
) -> None:
    """A per-resource scope beyond the user's RBAC is rejected."""
    sm.can_access = MagicMock(return_value=False)  # type: ignore[method-assign]
    with pytest.raises(ValueError, match="exceeds the issuing user's own"):
        sm._validate_requested_api_key_scopes(
            _make_user("Gamma"), "superset:dashboard:write"
        )


@pytest.mark.parametrize("action", ["delete", "update"])
def test_non_read_actions_map_to_can_write(
    sm: SupersetSecurityManager, action: str
) -> None:
    """Non-read actions check can_write — matching the current RBAC
    granularity, which has no separate can_delete/can_update on resources."""
    sm.can_access = MagicMock(return_value=True)  # type: ignore[method-assign]
    sm._validate_requested_api_key_scopes(
        _make_user("Gamma"), f"superset:chart:{action}"
    )
    sm.can_access.assert_called_once_with("can_write", "Chart")


def test_unrecognized_resource_slug_rejected_without_rbac_lookup(
    sm: SupersetSecurityManager,
) -> None:
    """An unknown resource slug is rejected outright (fail closed) and never
    consults RBAC."""
    sm.can_access = MagicMock()  # type: ignore[method-assign]
    with pytest.raises(ValueError, match="unrecognized resource"):
        sm._validate_requested_api_key_scopes(
            _make_user("Admin"), "superset:notathing:read"
        )
    sm.can_access.assert_not_called()


def test_flat_scope_allowed_for_admin(sm: SupersetSecurityManager) -> None:
    """A flat scope (superset:write) may be self-issued by an Admin, with no
    per-resource RBAC lookups."""
    sm.can_access = MagicMock()  # type: ignore[method-assign]
    sm._validate_requested_api_key_scopes(_make_user("Admin"), "superset:write")
    sm.can_access.assert_not_called()


def test_flat_scope_rejected_for_non_admin(sm: SupersetSecurityManager) -> None:
    """A flat scope grants a method across every resource; non-Admins cannot
    self-issue it."""
    sm.can_access = MagicMock()  # type: ignore[method-assign]
    with pytest.raises(ValueError, match="requires Admin"):
        sm._validate_requested_api_key_scopes(_make_user("Gamma"), "superset:write")


def test_any_failing_scope_rejects_the_whole_request(
    sm: SupersetSecurityManager,
) -> None:
    """With multiple comma-separated scopes, one failure rejects the request
    even when other scopes are individually allowed."""
    sm.can_access = MagicMock(  # type: ignore[method-assign]
        side_effect=lambda perm, view: view == "Chart"
    )
    with pytest.raises(ValueError, match="exceeds the issuing user's own"):
        sm._validate_requested_api_key_scopes(
            _make_user("Gamma"),
            "superset:chart:read, superset:dashboard:write",
        )


def test_create_api_key_rejects_before_delegating_to_fab(
    sm: SupersetSecurityManager,
) -> None:
    """create_api_key validates scopes BEFORE calling FAB's implementation:
    a rejected request never reaches FAB."""
    sm.can_access = MagicMock(return_value=False)  # type: ignore[method-assign]
    with patch(
        "flask_appbuilder.security.sqla.manager.SecurityManager.create_api_key"
    ) as fab_create:
        with pytest.raises(ValueError, match="exceeds the issuing user's own"):
            sm.create_api_key(
                user=_make_user("Gamma"),
                name="my key",
                scopes="superset:dashboard:write",
            )
        fab_create.assert_not_called()


def test_create_api_key_delegates_to_fab_on_success(
    sm: SupersetSecurityManager,
) -> None:
    """A validated request is delegated to FAB's create_api_key unchanged."""
    sm.can_access = MagicMock(return_value=True)  # type: ignore[method-assign]
    user = _make_user("Gamma")
    with patch(
        "flask_appbuilder.security.sqla.manager.SecurityManager.create_api_key",
        return_value={"key": "sst_secret"},
    ) as fab_create:
        result = sm.create_api_key(
            user=user,
            name="my key",
            scopes="superset:dashboard:read",
        )
        fab_create.assert_called_once_with(
            user=user, name="my key", scopes="superset:dashboard:read", expires_on=None
        )
    assert result == {"key": "sst_secret"}
