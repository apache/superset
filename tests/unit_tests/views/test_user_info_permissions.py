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
"""Permissions for the Settings → Info (/user_info/) page."""

from unittest.mock import MagicMock

from superset.security.manager import SupersetSecurityManager
from superset.views.user_info import UserInfoView


def test_user_info_view_uses_accessible_userinfo_permission() -> None:
    """Settings → Info must not require Admin-only can_read on User/user."""
    assert UserInfoView.class_permission_name == "UserInfo"
    # FAB's @permission_name("userinfo") yields permission can_userinfo.
    assert getattr(UserInfoView.list, "_permission_name") == "userinfo"


def test_can_userinfo_on_user_info_is_accessible_to_all(app_context: None) -> None:
    """can_userinfo is in ACCESSIBLE_PERMS, so Gamma/Alpha get UserInfo access."""
    from superset.extensions import appbuilder

    sm = SupersetSecurityManager(appbuilder)
    pvm = MagicMock()
    pvm.permission.name = "can_userinfo"
    pvm.view_menu.name = "UserInfo"

    assert "can_userinfo" in SupersetSecurityManager.ACCESSIBLE_PERMS
    assert sm._is_accessible_to_all(pvm) is True
    assert sm._is_gamma_pvm(pvm) is True
    assert sm._is_alpha_pvm(pvm) is True


def test_can_read_on_user_remains_admin_only(app_context: None) -> None:
    """Regression: user management stays Admin-only after the UserInfo split."""
    from superset.extensions import appbuilder

    sm = SupersetSecurityManager(appbuilder)
    pvm = MagicMock()
    pvm.permission.name = "can_read"
    pvm.view_menu.name = "User"

    assert "User" in SupersetSecurityManager.ADMIN_ONLY_VIEW_MENUS
    assert sm._is_admin_only(pvm) is True
    assert sm._is_gamma_pvm(pvm) is False
