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
from typing import Any

import pytest
from flask import current_app
from flask_appbuilder import ModelRestApi


@pytest.mark.parametrize("resource", ["database", "tag"])
def test_info_without_filter_returns_metadata(
    client: Any,
    full_api_access: None,
    resource: str,
) -> None:
    """
    ``GET /api/v1/<resource>/_info`` without a ``q`` filter builds the add/edit field
    metadata for every declared column. Columns missing from the explicit add/edit
    schemas must be skipped instead of raising a 500.
    """
    response = client.get(f"/api/v1/{resource}/_info")

    assert response.status_code == 200
    payload = response.json
    assert "permissions" in payload
    assert "add_columns" in payload
    assert "edit_columns" in payload


def test_database_info_describes_only_schema_fields(
    client: Any,
    full_api_access: None,
) -> None:
    """
    The database add/edit schemas expose ``masked_encrypted_extra``, not the legacy
    ``encrypted_extra`` column, so only the schema-backed fields are described.
    """
    response = client.get("/api/v1/database/_info")

    assert response.status_code == 200
    for key in ("add_columns", "edit_columns"):
        names = {field["name"] for field in response.json[key]}
        assert "database_name" in names
        assert "encrypted_extra" not in names


def test_every_model_api_info_without_filter_succeeds(
    client: Any,
    full_api_access: None,
) -> None:
    """
    Guard all ``ModelRestApi`` views that expose ``_info`` against a 500 when the
    endpoint is called without a filter.
    """
    failures = {}
    for view in current_app.appbuilder.baseviews:
        if not isinstance(view, ModelRestApi):
            continue
        if view.include_route_methods is not None and (
            "info" not in view.include_route_methods
        ):
            continue
        response = client.get(f"/api/v1/{view.resource_name}/_info")
        if response.status_code != 200:
            failures[type(view).__name__] = response.status_code

    assert failures == {}
