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
"""Tests for dashboard folder commands."""

from types import SimpleNamespace
from typing import cast
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from superset.commands.dashboard_folder.create import CreateDashboardFolderCommand
from superset.commands.dashboard_folder.delete import DeleteDashboardFolderCommand
from superset.commands.dashboard_folder.exceptions import (
    DashboardFolderDashboardNotFoundError,
    DashboardFolderForbiddenError,
    DashboardFolderInvalidError,
    DashboardFolderNameConflictError,
    DashboardFolderNotFoundError,
)
from superset.commands.dashboard_folder.move_dashboard import (
    MoveDashboardToFolderCommand,
)
from superset.commands.dashboard_folder.update import UpdateDashboardFolderCommand
from superset.daos.dashboard import DashboardDAO
from superset.daos.dashboard_folder import DashboardFolderDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard_folder import DashboardFolder


def test_create_accepts_subject_editors_for_non_admin() -> None:
    subject = SimpleNamespace(id=7)
    command = CreateDashboardFolderCommand({"name": "Finance", "editors": [7]})

    with (
        patch.object(DashboardFolderDAO, "find_name_conflict", return_value=None),
        patch(
            "superset.commands.utils.get_subject",
            return_value=subject,
        ),
        patch("superset.commands.utils.get_user_id", return_value=None),
    ):
        command.validate()

    assert command._properties["editors"] == [subject]


def test_create_uses_current_user_as_default_editor() -> None:
    created_folder = SimpleNamespace(id=uuid4())
    command = CreateDashboardFolderCommand({"name": "Finance"})

    with (
        patch.object(command, "validate"),
        patch.object(
            DashboardFolderDAO,
            "create",
            return_value=created_folder,
        ) as create,
    ):
        result = command.run()

    assert result is created_folder
    create.assert_called_once_with(attributes={"name": "Finance"})


def test_create_rejects_missing_parent() -> None:
    command = CreateDashboardFolderCommand({"name": "Finance", "parent_id": uuid4()})

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=None),
        pytest.raises(DashboardFolderInvalidError),
    ):
        command.validate()


def test_create_rejects_parent_without_write_access() -> None:
    parent = SimpleNamespace(id=uuid4(), name="Parent")
    command = CreateDashboardFolderCommand({"name": "Finance", "parent_id": parent.id})

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=parent),
        patch.object(DashboardFolderDAO, "can_write", return_value=False),
        pytest.raises(DashboardFolderForbiddenError),
    ):
        command.validate()


def test_create_rejects_duplicate_root_folder_name() -> None:
    command = CreateDashboardFolderCommand({"name": "  finance  "})

    with (
        patch.object(
            DashboardFolderDAO,
            "find_name_conflict",
            return_value=SimpleNamespace(id=uuid4()),
        ) as find_name_conflict,
        pytest.raises(DashboardFolderNameConflictError),
    ):
        command.validate()

    find_name_conflict.assert_called_once_with("finance", None)


def test_create_rejects_name_matching_parent() -> None:
    parent_id = uuid4()
    parent = SimpleNamespace(id=parent_id, name="Finance")
    command = CreateDashboardFolderCommand(
        {"name": " finance ", "parent_id": parent_id}
    )

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=parent),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        pytest.raises(DashboardFolderNameConflictError),
    ):
        command.validate()


def test_update_rejects_duplicate_sibling_name() -> None:
    folder_id = uuid4()
    parent_id = uuid4()
    folder = SimpleNamespace(id=folder_id, name="Old", parent_id=parent_id)
    parent = SimpleNamespace(id=parent_id, name="Parent", parent_id=None)
    command = UpdateDashboardFolderCommand(folder_id, {"name": " finance "})

    with (
        patch.object(
            DashboardFolderDAO,
            "get_by_id",
            side_effect=[folder, parent],
        ),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        patch.object(
            DashboardFolderDAO,
            "find_name_conflict",
            return_value=SimpleNamespace(id=uuid4()),
        ) as find_name_conflict,
        pytest.raises(DashboardFolderNameConflictError),
    ):
        command.validate()

    find_name_conflict.assert_called_once_with(
        "finance",
        parent_id,
        excluded_folder_id=folder_id,
    )


def test_update_rejects_cyclic_parent_hierarchy() -> None:
    folder_id = uuid4()
    child_id = uuid4()
    folder = SimpleNamespace(id=folder_id)
    child = SimpleNamespace(id=child_id, parent_id=folder_id)
    command = UpdateDashboardFolderCommand(folder_id, {"parent_id": child_id})

    with (
        patch.object(
            DashboardFolderDAO,
            "get_by_id",
            side_effect=[folder, child],
        ),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        pytest.raises(DashboardFolderInvalidError),
    ):
        command.validate()


def test_update_rejects_missing_folder() -> None:
    command = UpdateDashboardFolderCommand(uuid4(), {"name": "Finance"})

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=None),
        pytest.raises(DashboardFolderNotFoundError),
    ):
        command.validate()


def test_update_rejects_folder_without_write_access() -> None:
    folder = SimpleNamespace(id=uuid4())
    command = UpdateDashboardFolderCommand(folder.id, {"name": "Finance"})

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=folder),
        patch.object(DashboardFolderDAO, "can_write", return_value=False),
        pytest.raises(DashboardFolderForbiddenError),
    ):
        command.validate()


def test_update_resolves_subject_editors_and_viewers() -> None:
    folder = SimpleNamespace(
        id=uuid4(), name="Finance", parent_id=None, editors=[], viewers=[]
    )
    editors = [SimpleNamespace(id=7)]
    viewers = [SimpleNamespace(id=8)]
    command = UpdateDashboardFolderCommand(folder.id, {"editors": [7], "viewers": [8]})

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=folder),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        patch.object(DashboardFolderDAO, "find_name_conflict", return_value=None),
        patch(
            "superset.commands.utils.get_subject",
            side_effect=[editors[0], viewers[0]],
        ),
        patch("superset.commands.utils.get_user_id", return_value=None),
    ):
        command.validate()

    assert command._properties == {
        "name": "Finance",
        "editors": editors,
        "viewers": viewers,
    }


def test_delete_rejects_subtree_owned_by_another_user() -> None:
    child = SimpleNamespace(children=[])
    folder = SimpleNamespace(children=[child])
    command = DeleteDashboardFolderCommand(uuid4())

    with (
        patch.object(
            DashboardFolderDAO,
            "get_by_id",
            return_value=folder,
        ),
        patch.object(
            DashboardFolderDAO,
            "can_write",
            side_effect=lambda candidate: candidate is folder,
        ),
        patch(
            "superset.commands.dashboard_folder.delete.security_manager.is_admin",
            return_value=False,
        ),
        pytest.raises(DashboardFolderForbiddenError),
    ):
        command.validate()


def test_delete_runs_for_owned_folder_tree() -> None:
    child = SimpleNamespace(children=[])
    folder = SimpleNamespace(children=[child])
    command = DeleteDashboardFolderCommand(uuid4())

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=folder),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        patch.object(DashboardFolderDAO, "uncategorize_dashboards") as uncategorize,
        patch.object(DashboardFolderDAO, "delete") as delete,
        patch(
            "superset.commands.dashboard_folder.delete.security_manager.is_admin",
            return_value=False,
        ),
    ):
        command.run()

    delete.assert_called_once_with([folder])
    uncategorize.assert_called_once_with(folder)


def test_delete_rejects_missing_folder() -> None:
    command = DeleteDashboardFolderCommand(uuid4())

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=None),
        pytest.raises(DashboardFolderNotFoundError),
    ):
        command.validate()


def test_move_rejects_folder_without_write_access() -> None:
    dashboard = SimpleNamespace(id=42)
    folder = SimpleNamespace(
        id=uuid4(), name="Finance", parent_id=None, editors=[], viewers=[]
    )
    command = MoveDashboardToFolderCommand(dashboard.id, folder.id)

    with (
        patch.object(
            DashboardDAO,
            "find_by_id",
            return_value=dashboard,
        ),
        patch(
            "superset.commands.dashboard_folder.move_dashboard.security_manager.raise_for_editorship"
        ),
        patch.object(
            DashboardFolderDAO,
            "get_by_id",
            return_value=folder,
        ),
        patch.object(
            DashboardFolderDAO,
            "can_write",
            return_value=False,
        ),
        pytest.raises(DashboardFolderForbiddenError),
    ):
        command.validate()


def test_move_updates_dashboard_to_uncategorized() -> None:
    dashboard = SimpleNamespace(id=42)
    command = MoveDashboardToFolderCommand(dashboard.id, None)

    with (
        patch.object(DashboardDAO, "find_by_id", return_value=dashboard),
        patch(
            "superset.commands.dashboard_folder.move_dashboard.security_manager.raise_for_editorship"
        ),
        patch.object(DashboardDAO, "update", return_value=dashboard) as update,
    ):
        result = command.run()

    assert result is dashboard
    update.assert_called_once_with(dashboard, {"folder_id": None})


def test_move_rejects_missing_dashboard() -> None:
    command = MoveDashboardToFolderCommand(42, None)

    with (
        patch.object(DashboardDAO, "find_by_id", return_value=None),
        pytest.raises(DashboardFolderDashboardNotFoundError),
    ):
        command.validate()


def test_move_maps_editorship_error_to_forbidden() -> None:
    dashboard = SimpleNamespace(id=42)
    command = MoveDashboardToFolderCommand(dashboard.id, None)

    with (
        patch.object(DashboardDAO, "find_by_id", return_value=dashboard),
        patch(
            "superset.commands.dashboard_folder.move_dashboard.security_manager.raise_for_editorship",
            side_effect=SupersetSecurityException(MagicMock()),
        ),
        pytest.raises(DashboardFolderForbiddenError),
    ):
        command.validate()


def test_move_rejects_missing_folder() -> None:
    dashboard = SimpleNamespace(id=42)
    command = MoveDashboardToFolderCommand(dashboard.id, uuid4())

    with (
        patch.object(DashboardDAO, "find_by_id", return_value=dashboard),
        patch(
            "superset.commands.dashboard_folder.move_dashboard.security_manager.raise_for_editorship"
        ),
        patch.object(DashboardFolderDAO, "get_by_id", return_value=None),
        pytest.raises(DashboardFolderNotFoundError),
    ):
        command.validate()


def test_create_rejects_blank_name() -> None:
    """Verify that a folder cannot be created with a whitespace-only name."""
    command = CreateDashboardFolderCommand({"name": "   "})

    with pytest.raises(DashboardFolderInvalidError):
        command.validate()


def test_create_normalizes_valid_properties() -> None:
    """Verify create validation normalizes the name and keeps Subject fields."""
    command = CreateDashboardFolderCommand({"name": " Finance "})

    with patch.object(DashboardFolderDAO, "find_name_conflict", return_value=None):
        command.validate()

    assert command._properties == {"name": "Finance", "editors": []}


def test_update_runs_with_validated_folder() -> None:
    """Verify that update passes normalized attributes to the DAO."""
    folder = cast(DashboardFolder, SimpleNamespace(id=uuid4()))
    command = UpdateDashboardFolderCommand(folder.id, {"name": "Finance"})
    command._folder = folder

    with (
        patch.object(command, "validate"),
        patch.object(DashboardFolderDAO, "update", return_value=folder) as update,
    ):
        assert command.run() is folder

    update.assert_called_once_with(folder, {"name": "Finance"})


def test_update_accepts_editor_changes_from_an_editor() -> None:
    """Verify that an editor can update the folder Subject relationships."""
    folder = SimpleNamespace(
        id=uuid4(), name="Finance", parent_id=None, editors=[], viewers=[]
    )
    command = UpdateDashboardFolderCommand(folder.id, {"editors": [7]})

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=folder),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        patch.object(DashboardFolderDAO, "find_name_conflict", return_value=None),
        patch(
            "superset.commands.utils.get_subject", return_value=SimpleNamespace(id=7)
        ),
        patch("superset.commands.utils.get_user_id", return_value=None),
    ):
        command.validate()


def test_update_rejects_blank_name() -> None:
    """Verify that a folder cannot be updated with a whitespace-only name."""
    folder = SimpleNamespace(id=uuid4(), name="Finance", parent_id=None)
    command = UpdateDashboardFolderCommand(folder.id, {"name": "   "})

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=folder),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        pytest.raises(DashboardFolderInvalidError),
    ):
        command.validate()


def test_update_rejects_missing_effective_parent() -> None:
    """Verify that retaining a parent still checks whether it exists."""
    parent_id = uuid4()
    folder = SimpleNamespace(id=uuid4(), name="Finance", parent_id=parent_id)
    command = UpdateDashboardFolderCommand(folder.id, {"name": "Reports"})

    with (
        patch.object(
            DashboardFolderDAO,
            "get_by_id",
            side_effect=[folder, None],
        ),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        pytest.raises(DashboardFolderInvalidError),
    ):
        command.validate()


def test_update_rejects_name_matching_effective_parent() -> None:
    """Verify that a folder cannot have the same name as its parent."""
    parent_id = uuid4()
    folder = SimpleNamespace(id=uuid4(), name="Reports", parent_id=parent_id)
    parent = SimpleNamespace(id=parent_id, name="Finance", parent_id=None)
    command = UpdateDashboardFolderCommand(folder.id, {"name": " finance "})

    with (
        patch.object(
            DashboardFolderDAO,
            "get_by_id",
            side_effect=[folder, parent],
        ),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        pytest.raises(DashboardFolderNameConflictError),
    ):
        command.validate()


def test_update_rejects_missing_target_parent() -> None:
    """Verify that a move target parent must exist."""
    folder = SimpleNamespace(id=uuid4(), name="Finance", parent_id=None)
    command = UpdateDashboardFolderCommand(folder.id, {"parent_id": uuid4()})

    with (
        patch.object(
            DashboardFolderDAO,
            "get_by_id",
            side_effect=[folder, None],
        ),
        patch.object(DashboardFolderDAO, "can_write", return_value=True),
        pytest.raises(DashboardFolderInvalidError),
    ):
        command.validate()


def test_update_rejects_read_only_target_parent() -> None:
    """Verify that a folder cannot move into a read-only target parent."""
    folder = SimpleNamespace(id=uuid4(), name="Finance", parent_id=None)
    parent = SimpleNamespace(id=uuid4(), name="Reports", parent_id=None)
    command = UpdateDashboardFolderCommand(folder.id, {"parent_id": parent.id})

    with (
        patch.object(
            DashboardFolderDAO,
            "get_by_id",
            side_effect=[folder, parent],
        ),
        patch.object(
            DashboardFolderDAO,
            "can_write",
            side_effect=[True, False],
        ),
        pytest.raises(DashboardFolderForbiddenError),
    ):
        command.validate()


def test_delete_rejects_root_without_write_access() -> None:
    """Verify that a user cannot delete a read-only root folder."""
    folder = SimpleNamespace(id=uuid4(), children=[])
    command = DeleteDashboardFolderCommand(folder.id)

    with (
        patch.object(DashboardFolderDAO, "get_by_id", return_value=folder),
        patch.object(DashboardFolderDAO, "can_write", return_value=False),
        pytest.raises(DashboardFolderForbiddenError),
    ):
        command.validate()
