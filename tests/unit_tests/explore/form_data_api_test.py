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
"""Unit tests for ExploreFormDataRestApi."""

from typing import Any

from pytest_mock import MockerFixture

from superset.extensions import cache_manager
from superset.utils import json


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
    mocker.patch("superset.commands.explore.form_data.create.check_access")
    mocker.patch("superset.commands.explore.form_data.delete.check_access")
    mocker.patch(
        "superset.commands.explore.form_data.create.get_user_id", return_value=1
    )
    mocker.patch(
        "superset.commands.explore.form_data.delete.get_user_id", return_value=1
    )
    mocker.patch.object(cache_manager, "_explore_form_data_cache", _DictCache())

    payload = {
        "datasource_id": 1,
        "datasource_type": "table",
        "chart_id": 1,
        "form_data": json.dumps({"datasource": "1__table"}),
    }
    response = client.post("/api/v1/explore/form_data?tab_id=1", json=payload)
    assert response.status_code == 201
    key = response.json["key"]

    response = client.delete(f"/api/v1/explore/form_data/{key}?tab_id=1")
    assert response.status_code == 200

    # Re-creating from the same context must mint a fresh key rather than
    # reuse the deleted one.
    response = client.post("/api/v1/explore/form_data?tab_id=1", json=payload)
    assert response.status_code == 201
    assert response.json["key"] != key
