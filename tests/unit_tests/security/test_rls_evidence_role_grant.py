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
"""Default-role grant policy for the RLS enforcement evidence permission.

The evidence query API surfaces a cross-identity audit trail (outcomes, denial
classes, datasource ids, identity handles). Its read permission must be
admin/auditor-only and must be granted to no broad default role — exactly like
the row-level-security rule view menus. These tests exercise the REAL role
predicates (no ``has_access`` mocking): they build fake permission/view objects
for the evidence view menu and assert the default-Gamma / default-Alpha
predicates deny it, mirroring how "Row Level Security" is treated.
"""

from __future__ import annotations

from types import SimpleNamespace

from superset.extensions import appbuilder
from superset.security.manager import SupersetSecurityManager

# The exact FAB view-menu name the evidence API registers
# (``class_permission_name`` in superset/security/rls_evidence_api.py).
EVIDENCE_VIEW_MENU = "RlsEnforcementEvidence"
RLS_RULE_VIEW_MENU = "Row Level Security"


def _pvm(permission_name: str, view_menu_name: str) -> SimpleNamespace:
    """Build a fake FAB permission/view for the role predicates."""
    return SimpleNamespace(
        permission=SimpleNamespace(name=permission_name),
        view_menu=SimpleNamespace(name=view_menu_name),
    )


def test_evidence_read_is_admin_only(app_context: None) -> None:
    """@AC-FR10-22: reading the evidence trail is admin-only, like an RLS rule.

    The evidence view menu must gate identically to "Row Level Security".
    """
    sm = SupersetSecurityManager(appbuilder)

    evidence = _pvm("can_read", EVIDENCE_VIEW_MENU)
    rls_rule = _pvm("can_read", RLS_RULE_VIEW_MENU)

    assert sm._is_admin_only(evidence) is True
    # Treated exactly as the row-level-security rule view menu is.
    assert sm._is_admin_only(evidence) == sm._is_admin_only(rls_rule)


def test_evidence_read_not_granted_to_gamma(app_context: None) -> None:
    """@AC-FR10-22: the default Gamma role must NOT receive evidence read access.

    ``_is_gamma_pvm`` drives the default-Gamma grant in ``sync_role_definitions``;
    it must deny the evidence permission just as it denies an RLS rule read.
    """
    sm = SupersetSecurityManager(appbuilder)

    evidence = _pvm("can_read", EVIDENCE_VIEW_MENU)
    rls_rule = _pvm("can_read", RLS_RULE_VIEW_MENU)

    assert sm._is_gamma_pvm(evidence) is False
    assert sm._is_gamma_pvm(evidence) == sm._is_gamma_pvm(rls_rule)


def test_evidence_read_not_granted_to_alpha(app_context: None) -> None:
    """@AC-FR10-22: the default Alpha role must NOT receive evidence read access."""
    sm = SupersetSecurityManager(appbuilder)

    evidence = _pvm("can_read", EVIDENCE_VIEW_MENU)
    rls_rule = _pvm("can_read", RLS_RULE_VIEW_MENU)

    assert sm._is_alpha_pvm(evidence) is False
    assert sm._is_alpha_pvm(evidence) == sm._is_alpha_pvm(rls_rule)


def test_evidence_read_excluded_from_public(app_context: None) -> None:
    """@AC-FR10-22: the evidence view menu is excluded from the Public role,
    exactly like the row-level-security rule view menus."""
    assert EVIDENCE_VIEW_MENU in SupersetSecurityManager.PUBLIC_EXCLUDED_VIEW_MENUS
    assert RLS_RULE_VIEW_MENU in SupersetSecurityManager.PUBLIC_EXCLUDED_VIEW_MENUS
