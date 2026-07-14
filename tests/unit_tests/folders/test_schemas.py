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
import pytest
from marshmallow import ValidationError

from superset.folders.schemas import (
    FolderAssetsPutSchema,
    FolderPostSchema,
    FolderPutSchema,
)


def test_post_schema_applies_defaults() -> None:
    data = FolderPostSchema().load({"name": "Marketing"})
    assert data == {
        "name": "Marketing",
        "description": None,
        "parent_uuid": None,
        "folder_type": "analytics",
        "is_private": False,
    }


def test_post_schema_requires_name() -> None:
    with pytest.raises(ValidationError) as excinfo:
        FolderPostSchema().load({})
    assert "name" in excinfo.value.messages


def test_post_schema_rejects_blank_name() -> None:
    with pytest.raises(ValidationError):
        FolderPostSchema().load({"name": ""})


def test_post_schema_rejects_overlong_name() -> None:
    with pytest.raises(ValidationError):
        FolderPostSchema().load({"name": "x" * 251})


def test_put_schema_is_partial() -> None:
    # Only provided keys appear, so the DAO leaves other fields untouched.
    assert FolderPutSchema().load({}) == {}
    assert FolderPutSchema().load({"name": "Renamed"}) == {"name": "Renamed"}


def test_put_schema_allows_clearing_parent_and_description() -> None:
    data = FolderPutSchema().load({"parent_uuid": None, "description": None})
    assert data == {"parent_uuid": None, "description": None}


def test_assets_schema_accepts_known_types() -> None:
    data = FolderAssetsPutSchema().load(
        {"assets": [{"type": "dashboard", "id": 1}, {"type": "chart", "id": 2}]}
    )
    assert data["assets"] == [
        {"type": "dashboard", "id": 1},
        {"type": "chart", "id": 2},
    ]


def test_assets_schema_rejects_unknown_type() -> None:
    with pytest.raises(ValidationError):
        FolderAssetsPutSchema().load({"assets": [{"type": "report", "id": 1}]})


def test_assets_schema_allows_empty_list() -> None:
    # Membership-set semantics: an empty list empties the folder.
    assert FolderAssetsPutSchema().load({"assets": []}) == {"assets": []}


def test_assets_schema_defaults_missing_to_empty() -> None:
    assert FolderAssetsPutSchema().load({}) == {"assets": []}


def test_assets_schema_requires_id() -> None:
    with pytest.raises(ValidationError):
        FolderAssetsPutSchema().load({"assets": [{"type": "dashboard"}]})
