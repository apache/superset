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
    """Verify that folder owner action permissions remain independent."""
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
    """Verify that folders remain read-only for non-owners."""
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


def test_get_by_id_uses_the_public_folder_uuid() -> None:
    """Verify that the DAO looks up folders by public UUID."""
    folder_id = uuid4()
    folder = SimpleNamespace(id=folder_id)

    with patch(
        "superset.daos.dashboard_folder.db.session.get",
        return_value=folder,
    ) as session_get:
        assert DashboardFolderDAO.get_by_id(folder_id) is folder

    session_get.assert_called_once_with(DashboardFolder, folder_id)


def test_find_name_conflict_scopes_root_and_excluded_folder() -> None:
    """Verify root duplicate checks exclude the folder being renamed."""
    excluded_folder_id = uuid4()
    conflict = SimpleNamespace(id=uuid4())
    query = MagicMock()
    query.filter.return_value = query
    query.first.return_value = conflict

    with patch(
        "superset.daos.dashboard_folder.db.session.query",
        return_value=query,
    ):
        result = DashboardFolderDAO.find_name_conflict(
            " Finance ",
            None,
            excluded_folder_id=excluded_folder_id,
        )

    assert result is conflict
    assert query.filter.call_count == 3


def test_find_name_conflict_scopes_child_to_parent() -> None:
    """Verify child duplicate checks are scoped to the selected parent."""
    query = MagicMock()
    query.filter.return_value = query
    query.first.return_value = None

    with patch(
        "superset.daos.dashboard_folder.db.session.query",
        return_value=query,
    ):
        result = DashboardFolderDAO.find_name_conflict("Finance", uuid4())

    assert result is None
    assert query.filter.call_count == 2


def test_get_users_handles_empty_and_populated_owner_lists() -> None:
    """Verify empty owner lists skip queries and non-empty lists resolve users."""
    users = [SimpleNamespace(id=7), SimpleNamespace(id=8)]
    query = MagicMock()
    query.filter.return_value.all.return_value = users

    with patch(
        "superset.daos.dashboard_folder.db.session.query",
        return_value=query,
    ) as session_query:
        assert DashboardFolderDAO.get_users([]) == []
        assert DashboardFolderDAO.get_users([7, 8]) == users

    session_query.assert_called_once()


def test_accessible_dashboard_query_uses_the_canonical_filter() -> None:
    """Verify dashboard counts reuse Superset's standard access filter."""
    query = MagicMock()
    filtered_query = MagicMock()
    access_filter = MagicMock()
    access_filter.apply.return_value = filtered_query
    data_model = MagicMock()

    with (
        patch(
            "superset.daos.dashboard_folder.db.session.query",
            return_value=query,
        ),
        patch(
            "superset.daos.dashboard_folder.SQLAInterface",
            return_value=data_model,
        ) as interface,
        patch(
            "superset.daos.dashboard_folder.DashboardAccessFilter",
            return_value=access_filter,
        ) as access_filter_class,
    ):
        result = DashboardFolderDAO.accessible_dashboard_query()

    assert result is filtered_query
    interface.assert_called_once()
    access_filter_class.assert_called_once_with("id", data_model)
    access_filter.apply.assert_called_once_with(query, None)


def test_admin_tree_includes_all_folders_and_stops_recursive_cycles() -> None:
    """Verify admins see all folders and cyclic hierarchies terminate."""
    first_id = uuid4()
    second_id = uuid4()
    owner = SimpleNamespace(id=7, first_name="Admin", last_name="User")
    first = SimpleNamespace(
        id=first_id,
        name="First",
        description=None,
        parent_id=second_id,
        owners=[owner],
    )
    second = SimpleNamespace(
        id=second_id,
        name="Second",
        description=None,
        parent_id=first_id,
        owners=[owner],
    )
    folder_query = MagicMock()
    folder_query.all.return_value = [first, second]
    dashboard_query = MagicMock()
    grouped_query = dashboard_query.with_entities.return_value.group_by.return_value
    grouped_query.all.return_value = [(first_id, 1)]

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
        patch.object(DashboardFolderDAO, "can_perform", return_value=True),
        patch(
            "superset.daos.dashboard_folder.security_manager.is_admin",
            return_value=True,
        ),
    ):
        result = DashboardFolderDAO.get_visible_tree()

    assert {item["id"] for item in result["result"]} == {
        str(first_id),
        str(second_id),
    }
    assert {item["dashboard_count"] for item in result["result"]} == {1}
    assert result["total_dashboards"] == 1
