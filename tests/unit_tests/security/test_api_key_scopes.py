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

import re
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from superset.extensions import appbuilder
from superset.security.api_key_scopes import (
    RESOURCE_SCOPE_ACTIONS,
    RESOURCE_SCOPE_CLASS,
)
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


def test_frontend_scope_catalog_matches_backend_contract() -> None:
    """Keep the UI picker aligned with the canonical enforcement vocabulary."""
    frontend_catalog = (
        Path(__file__).parents[3]
        / "superset-frontend/src/features/apiKeys/apiKeyScopes.ts"
    ).read_text()
    resources_source = re.search(
        r"const API_KEY_SCOPE_RESOURCES = \[(.*?)\] as const;",
        frontend_catalog,
        re.DOTALL,
    )
    actions_source = re.search(
        r"const API_KEY_SCOPE_ACTIONS = \[(.*?)\] as const;",
        frontend_catalog,
        re.DOTALL,
    )

    assert resources_source is not None
    assert actions_source is not None
    assert set(re.findall(r"'([^']+)'", resources_source.group(1))) == set(
        RESOURCE_SCOPE_CLASS
    )
    assert set(re.findall(r"'([^']+)'", actions_source.group(1))) == set(
        RESOURCE_SCOPE_ACTIONS
    )


def test_no_scopes_is_a_noop(sm: SupersetSecurityManager) -> None:
    """No scopes requested: nothing to validate, no RBAC lookups."""
    sm._has_view_access = MagicMock()
    sm._validate_requested_api_key_scopes(_make_user("Gamma"), None)
    sm._validate_requested_api_key_scopes(_make_user("Gamma"), "")
    sm._has_view_access.assert_not_called()


def test_per_resource_scope_allowed_when_user_has_permission(
    sm: SupersetSecurityManager,
) -> None:
    """A per-resource scope the user's RBAC covers is allowed, and is checked
    against the matching can_<method> grant."""
    sm._has_view_access = MagicMock(return_value=True)
    user = _make_user("Gamma")
    sm._validate_requested_api_key_scopes(user, "superset:dashboard:read")
    sm._has_view_access.assert_called_once_with(user, "can_read", "Dashboard")


def test_per_resource_scope_rejected_when_user_lacks_permission(
    sm: SupersetSecurityManager,
) -> None:
    """A per-resource scope beyond the user's RBAC is rejected."""
    sm._has_view_access = MagicMock(return_value=False)
    with pytest.raises(ValueError, match="exceeds the issuing user's own"):
        sm._validate_requested_api_key_scopes(
            _make_user("Gamma"), "superset:dashboard:write"
        )


@pytest.mark.parametrize(
    ("scope", "registered_permission"),
    [
        ("superset:user:read", "can_get"),
        ("superset:role:read", "can_get"),
        ("superset:sqllab:write", "can_execute_sql_query"),
    ],
)
def test_scope_issuance_uses_runtime_method_mapping(
    sm: SupersetSecurityManager, scope: str, registered_permission: str
) -> None:
    """Issuance accepts the FAB method permission used by runtime tools."""
    user = _make_user("Gamma")
    sm._has_view_access = MagicMock(
        side_effect=lambda _user, permission, _view: permission == registered_permission
    )

    sm._validate_requested_api_key_scopes(user, scope)

    assert any(
        call.args[1] == registered_permission
        for call in sm._has_view_access.call_args_list
    )


def test_custom_admin_role_can_issue_flat_scope(
    sm: SupersetSecurityManager,
) -> None:
    """Flat-scope issuance honors AUTH_ROLE_ADMIN rather than a fixed name."""
    with patch("superset.security.manager.get_conf") as get_conf:
        get_conf.return_value = {"AUTH_ROLE_ADMIN": "PlatformAdmin"}
        sm._validate_requested_api_key_scopes(
            _make_user("PlatformAdmin"), "superset:write"
        )


@pytest.mark.parametrize("action", ["delete", "update", "garbage"])
def test_unrecognized_actions_are_rejected(
    sm: SupersetSecurityManager, action: str
) -> None:
    """Actions that runtime enforcement cannot consume are rejected."""
    sm._has_view_access = MagicMock()
    with pytest.raises(ValueError, match="unrecognized action"):
        sm._validate_requested_api_key_scopes(
            _make_user("Gamma"), f"superset:chart:{action}"
        )
    sm._has_view_access.assert_not_called()


def test_unrecognized_resource_slug_rejected_without_rbac_lookup(
    sm: SupersetSecurityManager,
) -> None:
    """An unknown resource slug is rejected outright (fail closed) and never
    consults RBAC."""
    sm._has_view_access = MagicMock()
    with pytest.raises(ValueError, match="unrecognized resource"):
        sm._validate_requested_api_key_scopes(
            _make_user("Admin"), "superset:notathing:read"
        )
    sm._has_view_access.assert_not_called()


def test_flat_scope_allowed_for_admin(sm: SupersetSecurityManager) -> None:
    """A flat scope (superset:write) may be self-issued by an Admin, with no
    per-resource RBAC lookups."""
    sm._has_view_access = MagicMock()
    sm._validate_requested_api_key_scopes(_make_user("Admin"), "superset:write")
    sm._has_view_access.assert_not_called()


def test_unrecognized_flat_scope_rejected_for_admin(
    sm: SupersetSecurityManager,
) -> None:
    """Admins cannot mint undefined flat scopes."""
    sm._has_view_access = MagicMock()
    with pytest.raises(ValueError, match="not a recognized"):
        sm._validate_requested_api_key_scopes(_make_user("Admin"), "superset:garbage")
    sm._has_view_access.assert_not_called()


def test_flat_scope_rejected_for_non_admin(sm: SupersetSecurityManager) -> None:
    """A flat scope grants a method across every resource; non-Admins cannot
    self-issue it."""
    sm._has_view_access = MagicMock()
    with pytest.raises(ValueError, match="requires Admin"):
        sm._validate_requested_api_key_scopes(_make_user("Gamma"), "superset:write")


def test_any_failing_scope_rejects_the_whole_request(
    sm: SupersetSecurityManager,
) -> None:
    """With multiple comma-separated scopes, one failure rejects the request
    even when other scopes are individually allowed."""
    sm._has_view_access = MagicMock(
        side_effect=lambda user, perm, view: view == "Chart"
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
    sm._has_view_access = MagicMock(return_value=False)
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
    sm._has_view_access = MagicMock(return_value=True)
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
