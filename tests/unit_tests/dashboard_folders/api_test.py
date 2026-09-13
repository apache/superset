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
"""Unit tests for the dashboard folder REST API."""

import inspect
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

from superset.commands.dashboard_folder.exceptions import (
    DashboardFolderDashboardNotFoundError,
    DashboardFolderForbiddenError,
    DashboardFolderInvalidError,
    DashboardFolderNotFoundError,
    DashboardFolderOperationFailedError,
)
from superset.dashboard_folders.api import DashboardFolderRestApi


def build_api() -> DashboardFolderRestApi:
    """Create an API instance for testing view logic without auth decorators."""
    api = DashboardFolderRestApi()
    api.response = MagicMock(side_effect=lambda code, **payload: (code, payload))
    api.response_400 = MagicMock(side_effect=lambda **payload: (400, payload))
    api.response_403 = MagicMock(return_value=(403, {}))
    api.response_404 = MagicMock(return_value=(404, {}))
    api.response_422 = MagicMock(side_effect=lambda **payload: (422, payload))
    return api


def test_get_list_returns_the_visible_tree() -> None:
    """Verify that the list endpoint returns the accessible folder tree."""
    api = build_api()
    get_list = inspect.unwrap(DashboardFolderRestApi.get_list)
    tree = {"result": [], "count": 0, "total_dashboards": 0}

    with patch(
        "superset.dashboard_folders.api.DashboardFolderDAO.get_visible_tree",
        return_value=tree,
    ):
        response = get_list(api)

    assert response == (200, tree)


def test_post_maps_success_validation_and_command_errors(app: Any) -> None:
    """Verify create success responses and exception status mappings."""
    api = build_api()
    post = inspect.unwrap(DashboardFolderRestApi.post)
    folder_id = uuid4()

    with (
        app.test_request_context(json={"name": "Finance"}),
        patch(
            "superset.dashboard_folders.api.CreateDashboardFolderCommand.run",
            return_value=SimpleNamespace(id=folder_id),
        ),
    ):
        assert post(api) == (201, {"id": str(folder_id)})

    with app.test_request_context(json={}):
        assert post(api)[0] == 400

    for exception, status_code in (
        (DashboardFolderForbiddenError(), 403),
        (DashboardFolderInvalidError(), 422),
        (DashboardFolderOperationFailedError(), 422),
    ):
        with (
            app.test_request_context(json={"name": "Finance"}),
            patch(
                "superset.dashboard_folders.api.CreateDashboardFolderCommand.run",
                side_effect=exception,
            ),
        ):
            assert post(api)[0] == status_code


def test_put_maps_success_validation_and_command_errors(app: Any) -> None:
    """Verify that update covers every public exception contract."""
    api = build_api()
    put = inspect.unwrap(DashboardFolderRestApi.put)
    folder_id = uuid4()

    with (
        app.test_request_context(json={"name": "Finance"}),
        patch(
            "superset.dashboard_folders.api.UpdateDashboardFolderCommand.run",
            return_value=SimpleNamespace(id=folder_id),
        ),
    ):
        assert put(api, folder_id) == (200, {"id": str(folder_id)})

    with app.test_request_context(json={"parent_id": "not-a-uuid"}):
        assert put(api, folder_id)[0] == 400

    for exception, status_code in (
        (DashboardFolderNotFoundError(), 404),
        (DashboardFolderForbiddenError(), 403),
        (DashboardFolderInvalidError(), 422),
        (DashboardFolderOperationFailedError(), 422),
    ):
        with (
            app.test_request_context(json={"name": "Finance"}),
            patch(
                "superset.dashboard_folders.api.UpdateDashboardFolderCommand.run",
                side_effect=exception,
            ),
        ):
            assert put(api, folder_id)[0] == status_code


def test_delete_maps_success_and_command_errors() -> None:
    """Verify delete responses for success and command errors."""
    api = build_api()
    delete = inspect.unwrap(DashboardFolderRestApi.delete)
    folder_id = uuid4()

    with patch("superset.dashboard_folders.api.DeleteDashboardFolderCommand.run"):
        assert delete(api, folder_id)[0] == 200

    for exception, status_code in (
        (DashboardFolderNotFoundError(), 404),
        (DashboardFolderForbiddenError(), 403),
        (DashboardFolderOperationFailedError(), 422),
    ):
        with patch(
            "superset.dashboard_folders.api.DeleteDashboardFolderCommand.run",
            side_effect=exception,
        ):
            assert delete(api, folder_id)[0] == status_code


def test_move_dashboard_maps_success_validation_and_command_errors(app: Any) -> None:
    """Verify move returns the target folder and maps every exception."""
    api = build_api()
    move_dashboard = inspect.unwrap(DashboardFolderRestApi.move_dashboard)
    folder_id = uuid4()

    with (
        app.test_request_context(json={"folder_id": str(folder_id)}),
        patch(
            "superset.dashboard_folders.api.MoveDashboardToFolderCommand.run",
            return_value=SimpleNamespace(id=11, folder_id=folder_id),
        ),
    ):
        assert move_dashboard(api, 11) == (
            200,
            {"id": 11, "folder_id": str(folder_id)},
        )

    with app.test_request_context(json={}):
        assert move_dashboard(api, 11)[0] == 400

    for exception, status_code in (
        (DashboardFolderNotFoundError(), 404),
        (DashboardFolderDashboardNotFoundError(), 404),
        (DashboardFolderForbiddenError(), 403),
        (DashboardFolderOperationFailedError(), 422),
    ):
        with (
            app.test_request_context(json={"folder_id": None}),
            patch(
                "superset.dashboard_folders.api.MoveDashboardToFolderCommand.run",
                side_effect=exception,
            ),
        ):
            assert move_dashboard(api, 11)[0] == status_code
