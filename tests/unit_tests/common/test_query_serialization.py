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
"""Unit tests for canonical single-query serialization."""

from pytest_mock import MockerFixture

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_serialization import (
    load_serialized_query,
    serialize_query,
    SerializedQuery,
)
from superset.utils import json


def _payload() -> SerializedQuery:
    return SerializedQuery(
        datasource={"id": 1, "type": "table"},
        query={"metrics": ["count"], "columns": ["name"], "time_range": "No filter"},
        form_data={"slice_id": 5},
        result_type="full",
        result_format="json",
        force=True,
        custom_cache_timeout=42,
    )


def test_serialize_query_extracts_raw_query_and_context_params(
    mocker: MockerFixture,
) -> None:
    ctx = mocker.MagicMock()
    ctx.cache_values = {
        "datasource": {"id": 1, "type": "table"},
        "queries": [{"a": 1}, {"b": 2}],
    }
    ctx.form_data = {"slice_id": 5}
    ctx.result_type = ChartDataResultType.FULL
    ctx.result_format = ChartDataResultFormat.JSON
    ctx.force = True
    ctx.custom_cache_timeout = 42

    # Serializes the *raw* query dict (not the processed QueryObject) plus the
    # context-level params (force/custom_cache_timeout live on the context).
    assert serialize_query(ctx, 1) == {
        "datasource": {"id": 1, "type": "table"},
        "query": {"b": 2},
        "form_data": {"slice_id": 5},
        "result_type": "full",
        "result_format": "json",
        "force": True,
        "custom_cache_timeout": 42,
    }


def test_serialized_query_is_json_safe() -> None:
    payload = _payload()
    # The payload uses only JSON-native types, so no custom encoder is needed.
    assert json.loads(json.dumps(payload)) == payload


def test_load_serialized_query_rebuilds_via_factory(mocker: MockerFixture) -> None:
    factory_cls = mocker.patch(
        "superset.common.query_context_factory.QueryContextFactory"
    )
    factory = factory_cls.return_value
    payload = _payload()

    result = load_serialized_query(payload)

    # Reconstruction goes through the same factory path that produced the
    # original context, with result_type/result_format back as enum members.
    assert result is factory.create.return_value
    factory.create.assert_called_once_with(
        datasource={"id": 1, "type": "table"},
        queries=[payload["query"]],
        form_data={"slice_id": 5},
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        force=True,
        custom_cache_timeout=42,
    )
