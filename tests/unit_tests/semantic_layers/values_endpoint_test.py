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
"""Endpoint-level tests: filter-value suggestions for semantic views.

The datasource values endpoint duck-types its datasource; these tests pin the
wiring for ``DatasourceType.SEMANTIC_VIEW`` end to end (sc-119006): 200 with
values, search pass-through, the 400 naming an unknown column, and the cache
header contract.
"""

from typing import Any
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    Dimension,
    SemanticRequest,
    SemanticResult,
)

from superset.semantic_layers.models import SemanticView


@pytest.fixture
def semantic_view_datasource(mocker: MockerFixture) -> SemanticView:
    implementation = MagicMock()
    implementation.uid.return_value = "semantic_view_uid_123"
    implementation.get_dimensions.return_value = [
        Dimension(id="orders.category", name="category", type=pa.utf8()),
    ]
    implementation.get_metrics.return_value = []
    implementation.get_values.return_value = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="values query")],
        results=pa.table({"category": pa.array(["Books", "Clothing"])}),
    )
    view = SemanticView()
    view.id = 1
    view.cache_timeout = None
    mocker.patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: implementation),
    )
    mocker.patch.object(SemanticView, "raise_for_access")
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource",
        return_value=view,
    )
    return view


def _get(client: Any, path: str) -> Any:
    return client.get(f"/api/v1/datasource/semantic_view/1/column/{path}")


def test_semantic_view_values_endpoint_returns_values(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    cache = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = None

    response = _get(client, "category/values/")

    assert response.status_code == 200
    assert response.json["result"] == ["Books", "Clothing"]
    assert response.headers["X-Cache-Status"] == "MISS"
    cache.set.assert_called_once()

    cache.get.return_value = ["Books", "Clothing"]
    cached = _get(client, "category/values/")
    assert cached.status_code == 200
    assert cached.json["result"] == ["Books", "Clothing"]
    assert cached.headers["X-Cache-Status"] == "HIT"


def test_semantic_view_values_endpoint_passes_search_to_the_provider(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.datasource.api.cache_manager"
    ).data_cache.get.return_value = None

    response = _get(client, "category/values/?q=oo")

    assert response.status_code == 200
    implementation = semantic_view_datasource.implementation
    _, filters = implementation.get_values.call_args.args
    (narrowing,) = filters
    assert narrowing.value == "%oo%"


def test_semantic_view_values_endpoint_unknown_column_is_a_400(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.datasource.api.cache_manager"
    ).data_cache.get.return_value = None

    response = _get(client, "no_such_column/values/")

    assert response.status_code == 400
    assert "no_such_column" in response.json["message"]
