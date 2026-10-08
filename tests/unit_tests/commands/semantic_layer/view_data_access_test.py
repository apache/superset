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
"""Semantic view edits require data access to the view, as reads do."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from unittest.mock import MagicMock, patch

import pytest
from pytest_mock import MockerFixture

from superset.commands.semantic_layer.delete import (
    BulkDeleteSemanticViewCommand,
    DeleteSemanticViewCommand,
)
from superset.commands.semantic_layer.exceptions import SemanticViewForbiddenError
from superset.commands.semantic_layer.update import UpdateSemanticViewCommand
from superset.semantic_layers.models import SemanticLayer, SemanticView

GRANTED_PERM: str = "[Layer].[granted_view](id:1)"
OTHER_PERM: str = "[Layer].[other_view](id:2)"
LAYER_PERM: str = "[Layer](id:abc)"


def _view(view_id: int, perm: str, layer: SemanticLayer | None = None) -> SemanticView:
    """A view authorized by its own grant, or by its parent layer's grant."""
    return SemanticView(
        id=view_id,
        name=f"view_{view_id}",
        configuration="{}",
        perm=perm,
        semantic_layer=layer,
    )


@pytest.fixture
def access() -> Iterator[Callable[[bool, set[str]], None]]:
    """Stub the security manager's datasource grants for the current user."""
    from superset import security_manager

    all_access: MagicMock = MagicMock(return_value=False)
    granted: set[str] = set()

    def can_access(permission_name: str, view_name: str) -> bool:
        return permission_name == "datasource_access" and view_name in granted

    def configure(is_admin: bool, perms: set[str]) -> None:
        all_access.return_value = is_admin
        granted.clear()
        granted.update(perms)

    with (
        patch.object(security_manager, "can_access_all_datasources", all_access),
        patch.object(security_manager, "can_access", side_effect=can_access),
        patch.object(security_manager, "raise_for_unsupported_guest_rls"),
    ):
        yield configure


def _patch_dao(
    command: str, models: list[SemanticView], mocker: MockerFixture
) -> MagicMock:
    module: str = "update" if command == "update" else "delete"
    dao: MagicMock = mocker.patch(
        f"superset.commands.semantic_layer.{module}.SemanticViewDAO"
    )
    dao.find_by_id.return_value = models[0]
    dao.find_by_ids.return_value = models
    dao.validate_update_uniqueness.return_value = True
    return dao


def _execute(command: str, models: list[SemanticView]) -> None:
    if command == "update":
        UpdateSemanticViewCommand(models[0].id, {"description": "new"}).run()
    elif command == "delete":
        DeleteSemanticViewCommand(models[0].id).run()
    else:
        BulkDeleteSemanticViewCommand([model.id for model in models]).run()


@pytest.mark.parametrize("command", ["update", "delete", "bulk_delete"])
@pytest.mark.parametrize(
    "is_admin, perms, allowed",
    [
        (False, set(), False),
        (False, {GRANTED_PERM}, True),
        (False, {LAYER_PERM}, True),
        (True, set(), True),
    ],
    ids=[
        "editor_without_access",
        "editor_with_access",
        "editor_with_layer_access",
        "admin",
    ],
)
def test_view_edit_requires_data_access(
    command: str,
    is_admin: bool,
    perms: set[str],
    allowed: bool,
    access: Callable[[bool, set[str]], None],
    mocker: MockerFixture,
) -> None:
    """An editor needs data access to the view; admin access is unchanged."""
    access(is_admin, perms)
    mocker.patch("superset.commands.utils.security_manager.raise_for_editorship")
    layer: SemanticLayer = SemanticLayer(name="Layer", perm=LAYER_PERM)
    models: list[SemanticView] = [_view(1, GRANTED_PERM, layer)]
    dao: MagicMock = _patch_dao(command, models, mocker)
    write: MagicMock = dao.update if command == "update" else dao.delete
    if allowed:
        _execute(command, models)
        write.assert_called_once()
        return
    with pytest.raises(SemanticViewForbiddenError):
        _execute(command, models)
    write.assert_not_called()


def test_bulk_delete_refuses_the_batch_when_one_view_lacks_access(
    access: Callable[[bool, set[str]], None],
    mocker: MockerFixture,
) -> None:
    """Bulk delete keeps its all-or-nothing behavior for the access check."""
    access(False, {GRANTED_PERM})
    mocker.patch("superset.commands.utils.security_manager.raise_for_editorship")
    models: list[SemanticView] = [_view(1, GRANTED_PERM), _view(2, OTHER_PERM)]
    dao: MagicMock = _patch_dao("bulk_delete", models, mocker)
    with pytest.raises(SemanticViewForbiddenError):
        _execute("bulk_delete", models)
    dao.delete.assert_not_called()
