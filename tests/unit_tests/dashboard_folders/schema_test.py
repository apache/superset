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
"""Tests for dashboard folder request schemas."""

from uuid import uuid4

import pytest
from marshmallow import ValidationError

from superset.dashboard_folders.api import DashboardFolderRestApi
from superset.dashboard_folders.schemas import (
    DashboardFolderMoveDashboardSchema,
    DashboardFolderPostSchema,
)


def test_folder_api_uses_granular_permissions() -> None:
    """Verify that every write operation uses a dedicated FAB permission."""
    permissions = DashboardFolderRestApi.method_permission_name

    assert permissions["get_list"] == "read"
    assert permissions["post"] == "create"
    assert permissions["put"] == "rename"
    assert permissions["delete"] == "delete"
    assert permissions["move_dashboard"] == "move_dashboard"


def test_folder_post_schema_accepts_valid_hierarchy() -> None:
    parent_id = uuid4()
    result = DashboardFolderPostSchema().load(
        {"name": "Finance", "parent_id": str(parent_id)}
    )
    assert result == {
        "name": "Finance",
        "parent_id": parent_id,
        "editors": [],
        "viewers": [],
    }


def test_folder_post_schema_rejects_empty_name() -> None:
    with pytest.raises(ValidationError):
        DashboardFolderPostSchema().load({"name": ""})


def test_move_dashboard_schema_requires_folder_id_key() -> None:
    with pytest.raises(ValidationError):
        DashboardFolderMoveDashboardSchema().load({})


def test_move_dashboard_schema_accepts_uncategorized() -> None:
    assert DashboardFolderMoveDashboardSchema().load({"folder_id": None}) == {
        "folder_id": None
    }
