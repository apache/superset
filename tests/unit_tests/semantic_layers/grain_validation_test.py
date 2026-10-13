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

from datetime import date
from typing import Any
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import Dimension, Metric, SemanticResult
from superset_core.semantic_layers.view import SemanticView as ProviderView
from werkzeug.test import TestResponse

from superset.semantic_layers.models import SemanticView


@pytest.fixture
def date_view(mocker: MockerFixture) -> MagicMock:
    """Expose Snowflake's raw DATE metadata through the real host model."""
    provider: MagicMock = MagicMock(spec=ProviderView)
    provider.features = frozenset()
    provider.selection_identity_version = None
    provider.uid.return_value = "date-grain-test"
    provider.get_dimensions.return_value = {
        Dimension(
            id="orders.ORDER_DATE",
            name="ORDER_DATE",
            type=pa.date32(),
            grain=None,
        )
    }
    provider.get_metrics.return_value = {
        Metric(
            id="orders.ORDER_COUNT",
            name="ORDER_COUNT",
            type=pa.int64(),
            definition="COUNT(*)",
        )
    }
    provider.get_table.return_value = SemanticResult(
        results=pa.table(
            {
                "ORDER_DATE": [date(2026, 1, 1), date(2026, 1, 2)],
                "ORDER_COUNT": [2, 3],
            }
        ),
        requests=[],
    )
    view: SemanticView = SemanticView(id=7, name="Orders", configuration="{}")
    view.__dict__["implementation"] = provider
    mocker.patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=view,
    )
    mocker.patch("superset.common.query_context.QueryContext.raise_for_access")
    mocker.patch("superset.security_manager.raise_for_unsupported_guest_rls")
    mocker.patch(
        "superset.common.query_context_processor.QueryContextProcessor.query_cache_key",
        return_value="date-grain-test",
    )
    mocker.patch(
        "superset.common.query_context_processor.QueryContextProcessor.get_cache_timeout",
        return_value=-1,
    )
    return provider


@pytest.mark.parametrize("grain", ["P1D", "P1W", "P1M", "P3M", "P1Y", None])
def test_chart_data_raw_date_grain_returns_client_error(
    client: FlaskClient,
    full_api_access: None,
    date_view: MagicMock,
    grain: str | None,
) -> None:
    """Reject unadvertised grains as HTTP 400 and keep raw-date queries working."""
    query: dict[str, Any] = {
        "columns": [
            {
                "expressionType": "SQL",
                "sqlExpression": "ORDER_DATE",
                "label": "ORDER_DATE",
                "columnType": "BASE_AXIS",
                "isColumnReference": True,
                "timeGrain": grain,
            }
        ],
        "metrics": ["ORDER_COUNT"],
        "extras": {"time_grain_sqla": grain},
        "row_limit": 100,
    }
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "semantic_view"},
            "queries": [query],
            "result_format": "json",
            "result_type": "full",
            "force": True,
        },
    )
    if grain:
        assert response.status_code == 400
        assert "The time grain is not supported" in response.get_json()["message"]
        date_view.get_table.assert_not_called()
        date_view.get_row_count.assert_not_called()
    else:
        assert response.status_code == 200
        assert [
            row["ORDER_COUNT"] for row in response.get_json()["result"][0]["data"]
        ] == [2, 3]
        date_view.get_table.assert_called_once()
