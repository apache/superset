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
from superset.models.dashboard import Dashboard
from superset.models.dashboard_folder import DashboardFolder


def test_visible_tree_uses_access_scoped_dashboard_counts() -> None:
    current_subject = SimpleNamespace(
        id=17, label="Current", secondary_label=None, img=None, type=1
    )
    other_subject = SimpleNamespace(
        id=18, label="Other", secondary_label=None, img=None, type=1
    )
    root_id = uuid4()
    child_id = uuid4()
    hidden_id = uuid4()
    root = SimpleNamespace(
        id=root_id,
        name="Root",
        description=None,
        parent_id=None,
        editors=[other_subject],
    )
    child = SimpleNamespace(
        id=child_id,
        name="Visible child",
        description=None,
        parent_id=root_id,
        editors=[current_subject],
    )
    hidden = SimpleNamespace(
        id=hidden_id,
        name="Hidden",
        description=None,
        parent_id=None,
        editors=[other_subject],
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
            "superset.daos.dashboard_folder.security_manager.is_editor",
            side_effect=lambda folder: folder is child,
        ),
        patch("superset.daos.dashboard_folder.get_user_id", return_value=None),
        patch(
            "superset.daos.dashboard_folder.security_manager.can_access",
            return_value=True,
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
    folder = cast(DashboardFolder, SimpleNamespace(editors=[]))

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
            "superset.daos.dashboard_folder.security_manager.is_editor",
            return_value=True,
        ),
        patch(
            "superset.daos.dashboard_folder.security_manager.can_access",
            side_effect=can_access,
        ),
    ):
        assert DashboardFolderDAO.can_perform(folder, "create") is True
        assert DashboardFolderDAO.can_perform(folder, "rename") is False
        assert DashboardFolderDAO.can_perform(folder, "delete") is False
        assert DashboardFolderDAO.can_perform(folder, "move_dashboard") is True


def test_read_only_folder_has_no_mutation_actions() -> None:
    """Verify that folders remain read-only for non-owners."""
    folder = cast(
        DashboardFolder,
        SimpleNamespace(editors=[]),
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
            "superset.daos.dashboard_folder.security_manager.is_editor",
            return_value=False,
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


def test_subject_payload_uses_compact_response_fields() -> None:
    subject = SimpleNamespace(
        id=7, label="Analyst", secondary_label="Role", img=None, type=2
    )

    assert DashboardFolderDAO._subject_payload(subject) == {
        "id": 7,
        "label": "Analyst",
        "secondary_label": "Role",
        "img": None,
        "type": 2,
    }


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


def test_uncategorize_dashboards_covers_the_entire_folder_subtree() -> None:
    """Verify deleting a folder cannot leave dashboards linked to removed IDs."""
    root_id = uuid4()
    child_id = uuid4()
    child = cast(DashboardFolder, SimpleNamespace(id=child_id, children=[]))
    root = cast(DashboardFolder, SimpleNamespace(id=root_id, children=[child]))
    query = MagicMock()
    query.filter.return_value = query

    with patch("superset.daos.dashboard_folder.db.session.query", return_value=query):
        DashboardFolderDAO.uncategorize_dashboards(root)

    query.filter.assert_called_once()
    query.update.assert_called_once_with(
        {Dashboard.folder_id: None}, synchronize_session=False
    )


def test_admin_tree_includes_all_folders_and_stops_recursive_cycles() -> None:
    """Verify admins see all folders and cyclic hierarchies terminate."""
    first_id = uuid4()
    second_id = uuid4()
    editor = SimpleNamespace(
        id=7, label="Admin", secondary_label=None, img=None, type=1
    )
    first = SimpleNamespace(
        id=first_id,
        name="First",
        description=None,
        parent_id=second_id,
        editors=[editor],
    )
    second = SimpleNamespace(
        id=second_id,
        name="Second",
        description=None,
        parent_id=first_id,
        editors=[editor],
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
