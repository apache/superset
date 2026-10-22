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
from contextlib import nullcontext

import pytest
from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import PermissionView

from superset.extensions import db, security_manager
from tests.integration_tests.fixtures.public_role import _public_role_like
from tests.integration_tests.test_app import app


@pytest.mark.parametrize("role_name", ["Gamma", "TestRole", "Public"])
@pytest.mark.parametrize("test_raises", [False, True])
def test_public_role_restored_after_commits(
    app_context: AppContext, role_name: str, test_raises: bool
) -> None:
    """Restore custom Public grants after session replacement and test failures."""
    original_value = app.config["PUBLIC_ROLE_LIKE"]
    original_permission_ids = {
        permission.id for permission in security_manager.get_public_role().permissions
    }
    try:
        # Use a custom set that cannot be restored by re-syncing a built-in role.
        app.config["PUBLIC_ROLE_LIKE"] = None
        permissions = [
            security_manager.find_permission_view_menu("can_read", "Dashboard"),
            security_manager.find_permission_view_menu("menu_access", "Security"),
        ]
        expected_permission_ids = {permission.id for permission in permissions}
        security_manager.get_public_role().permissions = permissions
        db.session.commit()

        with (
            pytest.raises(RuntimeError, match="Test failure")
            if test_raises
            else nullcontext()
        ):
            with _public_role_like(role_name):
                assert app.config["PUBLIC_ROLE_LIKE"] == role_name
                security_manager.get_public_role().permissions = []
                db.session.commit()
                db.session.remove()
                if test_raises:
                    raise RuntimeError("Test failure")

        assert app.config["PUBLIC_ROLE_LIKE"] is None
        assert {
            permission.id
            for permission in security_manager.get_public_role().permissions
        } == expected_permission_ids
    finally:
        app.config["PUBLIC_ROLE_LIKE"] = original_value
        security_manager.get_public_role().permissions = (
            db.session.query(PermissionView)
            .filter(PermissionView.id.in_(original_permission_ids))
            .all()
        )
        db.session.commit()
