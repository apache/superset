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
"""Tests for ``superset/views/sqla.py``."""


def test_row_level_security_view_uses_canonical_permission_name() -> None:
    """
    Regression for #33744: the RLS view's ``class_permission_name`` must
    match the user-facing model name ("Row Level Security") so that only
    one permission is registered.

    Today the view sets ``class_permission_name = "RowLevelSecurity"``
    (no spaces, derived from the Python class name), while the REST API
    and the security manager allow-list use the spaced form
    ("Row Level Security"). This produces two effectively identical
    permissions in the admin UI:

        - can read on Row Level Security
        - can read on RowLevelSecurity

    Operators have to grant both for a role to actually work, which is
    confusing and error-prone (the second one looks like an
    implementation detail leaking into the UI).

    The fix is a one-line change in ``superset/views/sqla.py`` to align
    ``class_permission_name`` with the canonical name used elsewhere in
    the codebase. This test pins that contract.
    """
    # Cross-check: the security manager's allow-list (the canonical
    # source of truth for RLS view-menu naming) uses the spaced form.
    from superset.security.manager import SupersetSecurityManager
    from superset.views.sqla import RowLevelSecurityView

    assert "Row Level Security" in SupersetSecurityManager.ADMIN_ONLY_VIEW_MENUS
    assert RowLevelSecurityView.class_permission_name == "Row Level Security", (
        "RLS view's class_permission_name diverges from the canonical "
        '"Row Level Security" used by the API and security manager — '
        "produces a duplicate `can read on RowLevelSecurity` permission "
        "alongside `can read on Row Level Security` in the admin UI."
    )
