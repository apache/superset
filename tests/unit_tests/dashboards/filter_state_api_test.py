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
"""Unit tests for DashboardFilterStateRestApi."""

import inspect
from typing import Any

from pytest_mock import MockerFixture

from superset.commands.dashboard.filter_state.create import CreateFilterStateCommand
from superset.commands.dashboard.filter_state.delete import DeleteFilterStateCommand
from superset.commands.dashboard.filter_state.get import GetFilterStateCommand
from superset.commands.dashboard.filter_state.update import UpdateFilterStateCommand
from superset.dashboards.filter_state.api import DashboardFilterStateRestApi
from superset.extensions import cache_manager
from superset.temporary_cache.api import TemporaryCacheRestApi
from superset.utils import json


def test_dashboard_filter_state_rest_api_inheritance():
    """Ensure DashboardFilterStateRestApi correctly subclasses TemporaryCacheRestApi."""
    assert issubclass(DashboardFilterStateRestApi, TemporaryCacheRestApi)
    assert (
        DashboardFilterStateRestApi.class_permission_name
        == "DashboardFilterStateRestApi"
    )
    assert DashboardFilterStateRestApi.resource_name == "dashboard"
    assert DashboardFilterStateRestApi.openapi_spec_tag == "Dashboard Filter State"


def test_dashboard_filter_state_command_factories():
    """Ensure factory methods return the expected command classes."""
    api = DashboardFilterStateRestApi()
    assert api.get_create_command() is CreateFilterStateCommand
    assert api.get_update_command() is UpdateFilterStateCommand
    assert api.get_get_command() is GetFilterStateCommand
    assert api.get_delete_command() is DeleteFilterStateCommand


def test_post_put_methods_have_no_has_access_api_or_api_decorator():
    """
    Ensure post and put methods are not decorated with @has_access_api or @api.

    Because DashboardFilterStateRestApi is a temporary cache API, permission
    verification is handled dynamically at the command level via
    CheckAccessDataCommand. @has_access_api causes 401 Unauthorized for regular
    users due to missing FAB permissions. The @api wrapper would catch and convert
    uncaught auth errors into 500s.
    """
    source_post = inspect.getsource(DashboardFilterStateRestApi.post)
    source_put = inspect.getsource(DashboardFilterStateRestApi.put)

    assert "has_access_api" not in source_post
    assert "has_access_api" not in source_put

    assert not any(line.strip().startswith("@api") for line in source_post.splitlines())
    assert not any(line.strip().startswith("@api") for line in source_put.splitlines())


class _DictCache:
    """Minimal dict-backed stand-in for the Flask-Caching cache interface."""

    def __init__(self) -> None:
        self._store: dict[str, object] = {}

    def get(self, key: str) -> object | None:
        return self._store.get(key)

    def set(self, key: str, value: object, timeout: int | None = None) -> None:
        self._store[key] = value

    def delete(self, key: str) -> bool:
        return self._store.pop(key, None) is not None


def test_delete_forwards_tab_id_and_clears_contextual_mapping(
    client: Any, app_context: None, mocker: MockerFixture, full_api_access: None
) -> None:
    """
    Regression test for #44385.

    DELETE must forward the ``tab_id`` query parameter to the delete command
    so the contextual cache mapping written at create time is removed.
    Otherwise a subsequent create from the same context reuses the deleted key.
    """
    mocker.patch("superset.commands.dashboard.filter_state.create.check_access")
    mocker.patch("superset.commands.dashboard.filter_state.delete.check_access")
    mocker.patch(
        "superset.commands.dashboard.filter_state.create.get_user_id", return_value=1
    )
    mocker.patch(
        "superset.commands.dashboard.filter_state.delete.get_user_id", return_value=1
    )
    mocker.patch.object(cache_manager, "_filter_state_cache", _DictCache())

    payload = {"value": json.dumps({"filter": "state"})}
    response = client.post("/api/v1/dashboard/1/filter_state?tab_id=1", json=payload)
    assert response.status_code == 201
    key = response.json["key"]

    response = client.delete(f"/api/v1/dashboard/1/filter_state/{key}?tab_id=1")
    assert response.status_code == 200

    # Re-creating from the same context must mint a fresh key rather than
    # reuse the deleted one.
    response = client.post("/api/v1/dashboard/1/filter_state?tab_id=1", json=payload)
    assert response.status_code == 201
    assert response.json["key"] != key
