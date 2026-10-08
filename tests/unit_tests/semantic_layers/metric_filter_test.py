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

"""Non-dimension filters fail instead of returning silently unfiltered data."""

from collections.abc import Callable
from typing import Any
from unittest.mock import MagicMock, PropertyMock

import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    Operator,
    PredicateType,
    SemanticQuery,
    SemanticResult,
)
from werkzeug.test import TestResponse

from superset.common.query_context_processor import QueryCacheManager
from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.mapper import (
    map_query_object,
    validate_query_object,
    ValidatedQueryObject,
)
from superset.semantic_layers.models import SemanticView
from superset.utils.core import QueryObjectFilterClause


@pytest.fixture
def metric_view(mocker: MockerFixture) -> tuple[SemanticView, MagicMock]:
    """Use real host metadata/query mapping with an observable provider boundary."""
    provider: MagicMock = MagicMock(selection_identity_version=None)
    provider.uid.return_value = "metric-filter-view"
    provider.features = frozenset()
    provider.get_dimensions.return_value = {
        Dimension("category", "category", pa.string()),
    }
    provider.get_metrics.return_value = {
        Metric("total_amount", "total_amount", pa.int64(), "SUM(amount)"),
    }
    provider.get_table.return_value = SemanticResult(
        requests=[],
        results=pa.table({"category": ["Books"], "total_amount": [7]}),
    )
    view: SemanticView = SemanticView(id=73, name="Orders", cache_timeout=-1)
    mocker.patch.object(
        SemanticView, "implementation", new_callable=PropertyMock, return_value=provider
    )
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=view
    )
    mocker.patch.object(SemanticView, "raise_for_access")
    return view, provider


def _request(filters: list[QueryObjectFilterClause]) -> dict[str, Any]:
    """Build an ordinary synchronous JSON chart-data request."""
    return {
        "datasource": {"id": 73, "type": "semantic_view"},
        "queries": [
            {"columns": ["category"], "metrics": ["total_amount"], "filters": filters},
        ],
        "result_type": "full",
        "result_format": "json",
    }


@pytest.mark.parametrize("column", ["total_amount", "missing_column"])
@pytest.mark.parametrize("mixed", [False, True])
def test_chart_data_rejects_non_dimension_filters(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    column: str,
    mixed: bool,
) -> None:
    """Metric, unknown and mixed filters refuse the whole data request with 400."""
    provider: MagicMock = metric_view[1]
    filters: list[QueryObjectFilterClause] = (
        [
            {"col": "category", "op": "==", "val": "Books"},
        ]
        if mixed
        else []
    )
    filters.append({"col": column, "op": ">=", "val": 999999})

    response: TestResponse = client.post("/api/v1/chart/data", json=_request(filters))

    assert response.status_code == 400, response.json
    assert column in str(response.json)
    provider.get_table.assert_not_called()
    provider.get_row_count.assert_not_called()


def test_invalid_filter_is_rejected_before_result_cache(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    mocker: MockerFixture,
) -> None:
    """A cached partially filtered result cannot bypass column validation."""
    cache_get: MagicMock = mocker.spy(QueryCacheManager, "get")
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json=_request(
            [
                {"col": "category", "op": "==", "val": "Books"},
                {"col": "total_amount", "op": ">=", "val": 999999},
            ]
        ),
    )
    assert response.status_code == 400, response.json
    assert "total_amount" in str(response.json)
    cache_get.assert_not_called()
    metric_view[1].get_table.assert_not_called()


@pytest.mark.parametrize("entry", ["validation", "mapping"])
def test_direct_semantic_entry_rejects_metric_filter(
    metric_view: tuple[SemanticView, MagicMock], entry: str
) -> None:
    """Direct mapper callers receive the same column-specific validation error."""
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=metric_view[0],
        columns=["category"],
        metrics=["total_amount"],
        filters=[{"col": "total_amount", "op": ">=", "val": 999999}],
    )
    entry_point: Callable[[ValidatedQueryObject], object] = (
        validate_query_object if entry == "validation" else map_query_object
    )
    with pytest.raises(QueryObjectValidationError, match="total_amount"):
        entry_point(query)


@pytest.mark.parametrize("same_named_metric", [False, True])
def test_dimension_filters_still_reach_provider(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    same_named_metric: bool,
) -> None:
    """An existing dimension remains filterable even if a metric shares its name."""
    provider: MagicMock = metric_view[1]
    if same_named_metric:
        provider.get_metrics.return_value.add(
            Metric("category_metric", "category", pa.int64(), "COUNT(*)")
        )
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json=_request([{"col": "category", "op": "==", "val": "Books"}]),
    )
    assert response.status_code == 200, response.json
    assert response.json is not None
    assert response.json["result"][0]["data"] == [
        {"category": "Books", "total_amount": 7},
    ]
    provider.get_table.assert_called_once()
    query: SemanticQuery = provider.get_table.call_args.args[0]
    assert query.filters == {
        Filter(
            PredicateType.WHERE,
            Dimension("category", "category", pa.string()),
            Operator.EQUALS,
            "Books",
        ),
    }
