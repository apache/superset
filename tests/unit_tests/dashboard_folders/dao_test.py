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
"""Tests for dashboard folder data access."""

from types import SimpleNamespace
from typing import cast
from unittest.mock import MagicMock, patch
from uuid import uuid4

from superset.daos.dashboard_folder import DashboardFolderDAO
from superset.models.dashboard_folder import DashboardFolder


def test_visible_tree_uses_access_scoped_dashboard_counts() -> None:
    current_user = SimpleNamespace(id=7, first_name="Current", last_name="Owner")
    other_user = SimpleNamespace(id=8, first_name="Other", last_name="Owner")
    root_id = uuid4()
    child_id = uuid4()
    hidden_id = uuid4()
    root = SimpleNamespace(
        id=root_id,
        name="Root",
        description=None,
        parent_id=None,
        owners=[other_user],
    )
    child = SimpleNamespace(
        id=child_id,
        name="Visible child",
        description=None,
        parent_id=root_id,
        owners=[current_user],
    )
    hidden = SimpleNamespace(
        id=hidden_id,
        name="Hidden",
        description=None,
        parent_id=None,
        owners=[other_user],
    )
    folder_query = MagicMock()
    folder_query.all.return_value = [root, child, hidden]
    dashboard_query = MagicMock()
    grouped_query = dashboard_query.with_entities.return_value.group_by.return_value
    grouped_query.all.return_value = [
        (child_id, 2),
        (None, 1),
    ]

    with (
        patch(
            "superset.daos.dashboard_folder.db.session.query",
            return_value=folder_query,
        ),
        patch.object(
            DashboardFolderDAO,
            "accessible_dashboard_query",
            return_value=dashboard_query,
        ),
        patch(
            "superset.daos.dashboard_folder.security_manager.is_admin",
            return_value=False,
        ),
        patch(
            "superset.daos.dashboard_folder.security_manager.can_access",
            return_value=True,
        ),
        patch(
            "superset.daos.dashboard_folder.g",
            SimpleNamespace(user=current_user),
        ),
    ):
        result = DashboardFolderDAO.get_visible_tree()

    folders = {item["id"]: item for item in result["result"]}
    assert set(folders) == {str(root_id), str(child_id)}
    assert folders[str(root_id)]["dashboard_count"] == 2
    assert folders[str(child_id)]["dashboard_count"] == 2
    assert folders[str(root_id)]["can_create"] is False
    assert folders[str(root_id)]["can_rename"] is False
    assert folders[str(root_id)]["can_delete"] is False
    assert folders[str(root_id)]["can_move_dashboard"] is False
    assert folders[str(child_id)]["can_create"] is True
    assert folders[str(child_id)]["can_rename"] is True
    assert folders[str(child_id)]["can_delete"] is True
    assert folders[str(child_id)]["can_move_dashboard"] is True
    assert result["total_dashboards"] == 3
    assert result["uncategorized_dashboards"] == 1


def test_folder_actions_follow_granular_permissions() -> None:
    """验证文件夹所有者的动作权限相互独立。"""
    current_user = SimpleNamespace(id=7)
    folder = cast(DashboardFolder, SimpleNamespace(owners=[current_user]))

    def can_access(permission: str, resource: str) -> bool:
        return permission in {"can_create", "can_move_dashboard"} and (
            resource == "DashboardFolder"
        )

    with (
        patch(
            "superset.daos.dashboard_folder.security_manager.is_admin",
            return_value=False,
        ),
        patch(
            "superset.daos.dashboard_folder.security_manager.can_access",
            side_effect=can_access,
        ),
        patch(
            "superset.daos.dashboard_folder.g",
            SimpleNamespace(user=current_user),
        ),
    ):
        assert DashboardFolderDAO.can_perform(folder, "create") is True
        assert DashboardFolderDAO.can_perform(folder, "rename") is False
        assert DashboardFolderDAO.can_perform(folder, "delete") is False
        assert DashboardFolderDAO.can_perform(folder, "move_dashboard") is True


def test_read_only_folder_has_no_mutation_actions() -> None:
    """验证非所有者看到的文件夹保持只读。"""
    current_user = SimpleNamespace(id=7)
    folder = cast(
        DashboardFolder,
        SimpleNamespace(owners=[SimpleNamespace(id=8)]),
    )

    with (
        patch(
            "superset.daos.dashboard_folder.security_manager.is_admin",
            return_value=False,
        ),
        patch(
            "superset.daos.dashboard_folder.security_manager.can_access",
            return_value=True,
        ),
        patch(
            "superset.daos.dashboard_folder.g",
            SimpleNamespace(user=current_user),
        ),
    ):
        assert DashboardFolderDAO.can_perform(folder, "create") is False
        assert DashboardFolderDAO.can_perform(folder, "rename") is False
        assert DashboardFolderDAO.can_perform(folder, "delete") is False
        assert DashboardFolderDAO.can_perform(folder, "move_dashboard") is False
