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
from datetime import datetime
from types import SimpleNamespace
from typing import Any
from uuid import UUID

from superset.folders.api import serialize_asset, serialize_assets, serialize_folder


def _user(uid: int) -> SimpleNamespace:
    return SimpleNamespace(id=uid, first_name="Ada", last_name="Lovelace")


# Returns ``Any`` so the lightweight stubs satisfy the ``Folder``-typed helpers.
def _folder(**kwargs: Any) -> Any:
    defaults = {
        "id": 1,
        "uuid": UUID("00000000-0000-0000-0000-000000000001"),
        "name": "Folder",
        "description": None,
        "parent": None,
        "folder_type": "analytics",
        "is_private": False,
        "children": [],
        "objects": [],
        "created_on": datetime(2026, 1, 1),
        "changed_on": datetime(2026, 1, 2),
        "created_by": _user(1),
        "changed_by": _user(2),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_serialize_folder_at_root() -> None:
    result = serialize_folder(_folder(children=[1, 2], objects=[1]))
    assert result["uuid"] == "00000000-0000-0000-0000-000000000001"
    assert result["parent_uuid"] is None
    assert result["children_count"] == 2
    assert result["asset_count"] == 1
    assert result["created_by"] == {
        "id": 1,
        "first_name": "Ada",
        "last_name": "Lovelace",
    }


def test_serialize_folder_includes_parent_uuid() -> None:
    parent = SimpleNamespace(uuid=UUID("00000000-0000-0000-0000-0000000000ff"))
    result = serialize_folder(_folder(parent=parent))
    assert result["parent_uuid"] == "00000000-0000-0000-0000-0000000000ff"


def test_serialize_folder_without_audit_user() -> None:
    result = serialize_folder(_folder(created_by=None, changed_by=None))
    assert result["created_by"] is None
    assert result["changed_by"] is None


def test_serialize_asset_uses_type_specific_title() -> None:
    dashboard = SimpleNamespace(
        id=7,
        uuid=UUID("00000000-0000-0000-0000-00000000000a"),
        dashboard_title="Sales",
        url="/superset/dashboard/7/",
        changed_on=datetime(2026, 1, 1),
    )
    chart = SimpleNamespace(
        id=9,
        uuid=None,
        slice_name="Revenue",
        url="/explore/?slice_id=9",
        changed_on=datetime(2026, 1, 1),
    )
    assert serialize_asset("dashboard", dashboard)["name"] == "Sales"
    assert serialize_asset("dashboard", dashboard)["type"] == "dashboard"
    assert serialize_asset("chart", chart)["name"] == "Revenue"
    assert serialize_asset("chart", chart)["uuid"] is None


def test_serialize_assets_sorts_by_changed_on_desc() -> None:
    older = SimpleNamespace(
        id=1,
        uuid=None,
        dashboard_title="Old",
        url=None,
        changed_on=datetime(2025, 1, 1),
    )
    newer = SimpleNamespace(
        id=2,
        uuid=None,
        dashboard_title="New",
        url=None,
        changed_on=datetime(2026, 1, 1),
    )
    undated = SimpleNamespace(
        id=3, uuid=None, dashboard_title="None", url=None, changed_on=None
    )
    result = serialize_assets(
        [("dashboard", older), ("dashboard", undated), ("dashboard", newer)]
    )
    assert [item["name"] for item in result] == ["New", "Old", "None"]
