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

"""Preserve nullable integer values through semantic chart-data serialization."""

from decimal import Decimal
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    Dimension,
    Metric,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView as ProviderView
from werkzeug.test import TestResponse

from superset.semantic_layers.models import SemanticLayer, SemanticView


@pytest.fixture
def semantic_layer(mocker: MockerFixture) -> SemanticLayer:
    """Give chart-data views the registered layer required by cache keys."""
    mocker.patch.dict(
        "superset.semantic_layers.models.registry",
        {"fixture": MagicMock(result_cache_version=None)},
    )
    return SemanticLayer(type="fixture")


@pytest.mark.parametrize("value", [9007199254740993, -9007199254740993, 2**63 - 1, 7])
@pytest.mark.parametrize(
    ("with_offset", "missing_prior_category"),
    [(False, False), (True, False), (True, True)],
)
def test_chart_data_preserves_nullable_integer_precision(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    semantic_layer: SemanticLayer,
    value: int,
    with_offset: bool,
    missing_prior_category: bool,
) -> None:
    """Serialize exact main/offset integers and nulls through the real host path."""
    provider: MagicMock = MagicMock(spec=ProviderView)
    provider.features = frozenset()
    provider.selection_identity_version = None
    provider.uid.return_value = "integer-precision-view"
    provider.get_dimensions.return_value = {
        Dimension("category", "category", pa.string()),
    }
    provider.get_metrics.return_value = {
        Metric("amount", "amount", pa.int64(), "SUM(amount)"),
    }
    offset_values: list[int | None] = (
        [value] if missing_prior_category else [None, -value]
    )
    provider.get_table.side_effect = [
        SemanticResult(
            results=pa.table(
                {
                    "category": ["A", "B"],
                    "amount": pa.array([value, None], type=pa.int64()),
                }
            ),
            requests=[],
        ),
        SemanticResult(
            results=pa.table(
                {
                    "category": ["A"] if missing_prior_category else ["A", "B"],
                    "amount": pa.array(offset_values, type=pa.int64()),
                }
            ),
            requests=[],
        ),
    ]
    view: SemanticView = SemanticView(
        id=7, name="Amounts", configuration="{}", semantic_layer=semantic_layer
    )
    view.__dict__["implementation"] = provider
    mocker.patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=view,
    )
    mocker.patch("superset.common.query_context.QueryContext.raise_for_access")
    mocker.patch("superset.security_manager.raise_for_unsupported_guest_rls")
    mocker.patch(
        "superset.common.query_context_processor.QueryContextProcessor.get_cache_timeout",
        return_value=-1,
    )

    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {
                    "columns": ["category"],
                    "metrics": ["amount"],
                    "time_offsets": ["1 week ago"] if with_offset else [],
                }
            ],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )

    assert response.status_code == 200, response.get_data(as_text=True)
    expected: list[dict[str, str | int | None]] = [
        {"category": "A", "amount": str(value) if abs(value) > 2**53 - 1 else value},
        {"category": "B", "amount": None},
    ]
    if with_offset:
        if missing_prior_category:
            expected[0]["amount__1 week ago"] = (
                str(value) if abs(value) > 2**53 - 1 else value
            )
            expected[1]["amount__1 week ago"] = None
        else:
            expected[0]["amount__1 week ago"] = None
            expected[1]["amount__1 week ago"] = (
                str(-value) if abs(value) > 2**53 - 1 else -value
            )
    assert response.get_json()["result"][0]["data"] == expected
    assert provider.get_table.call_count == (2 if with_offset else 1)
    if abs(value) > 2**53 - 1:
        # Check exact quoted wire values, not a numpy float/int equality comparison.
        assert f'"{value}"' in response.get_data(as_text=True)
        if with_offset:
            offset_value: int = value if missing_prior_category else -value
            assert f'"{offset_value}"' in response.get_data(as_text=True)


@pytest.mark.parametrize(
    ("post_processing", "time_offsets", "expected"),
    [
        (
            [
                {
                    "operation": "contribution",
                    "options": {"orientation": "column", "columns": ["amount"]},
                }
            ],
            [],
            {"amount": [0.25, 0.0, 0.75]},
        ),
        (
            [
                {
                    "operation": "diff",
                    "options": {"columns": {"amount": "amount"}, "periods": 1},
                }
            ],
            [],
            {"amount": [None, None, None]},
        ),
        (
            [
                {
                    "operation": "contribution",
                    "options": {
                        "orientation": "column",
                        "columns": ["amount__1 week ago"],
                    },
                }
            ],
            ["1 week ago"],
            {"amount__1 week ago": [0.2, 0.0, 0.8]},
        ),
    ],
    ids=["contribution", "diff", "contribution-offset"],
)
def test_post_processing_receives_numeric_nullable_integer_metrics(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    semantic_layer: SemanticLayer,
    post_processing: list[dict[str, object]],
    time_offsets: list[str],
    expected: dict[str, list[float | None]],
) -> None:
    """Metric calculations see numbers, as for SQL datasets, not object integers."""
    provider: MagicMock = MagicMock(spec=ProviderView)
    provider.features = frozenset()
    provider.selection_identity_version = None
    provider.uid.return_value = "integer-precision-view"
    provider.get_dimensions.return_value = {
        Dimension("category", "category", pa.string()),
    }
    provider.get_metrics.return_value = {
        Metric("amount", "amount", pa.int64(), "SUM(amount)"),
    }
    provider.get_table.side_effect = [
        SemanticResult(
            results=pa.table(
                {
                    "category": ["A", "B", "C"],
                    "amount": pa.array([5, None, 15], type=pa.int64()),
                }
            ),
            requests=[],
        ),
        SemanticResult(
            results=pa.table(
                {
                    "category": ["A", "B", "C"],
                    "amount": pa.array([2, None, 8], type=pa.int64()),
                }
            ),
            requests=[],
        ),
    ]
    view: SemanticView = SemanticView(
        id=7, name="Amounts", configuration="{}", semantic_layer=semantic_layer
    )
    view.__dict__["implementation"] = provider
    mocker.patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=view,
    )
    mocker.patch("superset.common.query_context.QueryContext.raise_for_access")
    mocker.patch("superset.security_manager.raise_for_unsupported_guest_rls")
    mocker.patch(
        "superset.common.query_context_processor.QueryContextProcessor.get_cache_timeout",
        return_value=-1,
    )

    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {
                    "columns": ["category"],
                    "metrics": ["amount"],
                    "time_offsets": time_offsets,
                    "post_processing": post_processing,
                }
            ],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )

    assert response.status_code == 200, response.get_data(as_text=True)
    data: list[dict[str, object]] = response.get_json()["result"][0]["data"]
    for column, values in expected.items():
        assert [row[column] for row in data] == values


@pytest.mark.parametrize(
    ("dtype", "values"),
    [
        (
            pa.decimal128(12, 2),
            [Decimal("5.25"), None, Decimal("15.75"), Decimal("26.25")],
        ),
        (pa.int64(), [5, None, 15, 27]),
        (pa.float64(), [5.25, None, 15.75, 26.25]),
    ],
    ids=["decimal", "int", "float"],
)
def test_contribution_with_separate_totals_query(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    semantic_layer: SemanticLayer,
    dtype: pa.DataType,
    values: list[Decimal | int | float | None],
) -> None:
    """Contribution divides by totals from a second query of the same metric."""
    provider: MagicMock = MagicMock(spec=ProviderView)
    provider.features = frozenset()
    provider.selection_identity_version = None
    provider.uid.return_value = "contribution-totals-view"
    provider.get_dimensions.return_value = {
        Dimension("category", "category", pa.string()),
    }
    provider.get_metrics.return_value = {
        Metric("amount", "amount", dtype, "SUM(amount)"),
    }
    total: Decimal | int | float = sum(value for value in values if value is not None)
    main_result: SemanticResult = SemanticResult(
        results=pa.table(
            {
                "category": ["A", "B", "C", "D"],
                "amount": pa.array(values, type=dtype),
            }
        ),
        requests=[],
    )
    totals_result: SemanticResult = SemanticResult(
        results=pa.table({"amount": pa.array([total], type=dtype)}),
        requests=[],
    )

    def get_table(query: SemanticQuery) -> SemanticResult:
        return main_result if query.dimensions else totals_result

    provider.get_table.side_effect = get_table
    view: SemanticView = SemanticView(
        id=7, name="Amounts", configuration="{}", semantic_layer=semantic_layer
    )
    view.__dict__["implementation"] = provider
    mocker.patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=view,
    )
    mocker.patch("superset.common.query_context.QueryContext.raise_for_access")
    mocker.patch("superset.security_manager.raise_for_unsupported_guest_rls")
    mocker.patch(
        "superset.common.query_context_processor.QueryContextProcessor.get_cache_timeout",
        return_value=-1,
    )

    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [
                {
                    "columns": ["category"],
                    "metrics": ["amount"],
                    "post_processing": [
                        {
                            "operation": "contribution",
                            "options": {"orientation": "column", "columns": ["amount"]},
                        }
                    ],
                },
                {"columns": [], "metrics": ["amount"], "post_processing": []},
            ],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )

    assert response.status_code == 200, response.get_data(as_text=True)
    data: list[dict[str, object]] = response.get_json()["result"][0]["data"]
    expected: list[float] = [
        0.0 if value is None else float(value) / float(total) for value in values
    ]
    assert [row["amount"] for row in data] == pytest.approx(expected)
