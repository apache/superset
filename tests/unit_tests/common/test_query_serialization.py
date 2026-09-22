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
        force_nonce="nonce-abc",
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
    ctx.force_nonce = "nonce-abc"
    ctx.custom_cache_timeout = 42

    # Serializes the *raw* query dict (not the processed QueryObject) plus the
    # context-level params (force/force_nonce/custom_cache_timeout live on the
    # context). force_nonce is carried so the async task and the follow-up
    # read-back share one forced-refresh idempotency token.
    assert serialize_query(ctx, 1) == {
        "datasource": {"id": 1, "type": "table"},
        "query": {"b": 2},
        "form_data": {"slice_id": 5},
        "result_type": "full",
        "result_format": "json",
        "force": True,
        "force_nonce": "nonce-abc",
        "custom_cache_timeout": 42,
    }


def test_serialized_query_is_json_safe() -> None:
    payload = _payload()
    # The payload uses only JSON-native types, so no custom encoder is needed.
    assert json.loads(json.dumps(payload)) == payload


def test_serialize_query_does_not_preserve_defaulted_null_row_limit(
    mocker: MockerFixture,
) -> None:
    ctx = mocker.MagicMock()
    ctx.cache_values = {
        "datasource": {"id": 1, "type": "table"},
        "queries": [{"row_limit": None}],
    }
    ctx.queries = [mocker.MagicMock(row_limit=5000)]
    ctx.form_data = None
    ctx.result_type = ChartDataResultType.FULL
    ctx.result_format = ChartDataResultFormat.JSON
    ctx.force = False
    ctx.custom_cache_timeout = None

    payload = serialize_query(ctx, 0)

    assert "preserve_null_row_limit" not in payload


def test_load_serialized_query_rebuilds_via_factory(mocker: MockerFixture) -> None:
    factory_cls = mocker.patch(
        "superset.common.query_context_factory.QueryContextFactory"
    )
    factory = factory_cls.return_value
    payload = _payload()

    result = load_serialized_query(payload)

    # Reconstruction goes through the same factory path that produced the
    # original context, with result_type/result_format back as enum members.
    # ``preserve_null_row_limit`` is always passed, defaulting to False for a
    # payload that did not record it.
    assert result is factory.create.return_value
    factory.create.assert_called_once_with(
        datasource={"id": 1, "type": "table"},
        queries=[payload["query"]],
        form_data={"slice_id": 5},
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        force=True,
        force_nonce="nonce-abc",
        custom_cache_timeout=42,
        preserve_null_row_limit=False,
    )


def test_contribution_totals_round_trip_preserves_cache_key(
    mocker: MockerFixture,
) -> None:
    from superset.common.query_context_factory import QueryContextFactory

    datasource = mocker.MagicMock()
    datasource.uid = "table__1"
    datasource.cache_timeout = None
    datasource.changed_on = None
    datasource.get_extra_cache_keys.return_value = []
    datasource.database.extra = "{}"
    datasource.database.impersonate_user = False
    datasource.database.db_engine_spec.get_impersonation_key.return_value = None
    mocker.patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=datasource,
    )
    mocker.patch(
        "superset.common.query_context_processor.security_manager.get_rls_cache_key",
        return_value=None,
    )

    contribution = {
        "operation": "contribution",
        "options": {
            "columns": ["sum__num"],
            "rename_columns": ["%sum__num"],
        },
    }
    query_context = QueryContextFactory().create(
        datasource={"id": 1, "type": "table"},
        queries=[
            {
                "columns": ["state"],
                "metrics": ["sum__num"],
                "orderby": [],
                "post_processing": [contribution],
                "row_limit": 100,
                "row_offset": 0,
            },
            {
                "columns": [],
                "metrics": ["sum__num"],
                "orderby": [],
                "post_processing": [],
                "row_limit": 0,
                "row_offset": 0,
            },
        ],
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
    )
    contribution_queries, totals_idx = query_context.prepare_contribution_totals()

    assert contribution_queries == [0]
    assert totals_idx == 1
    assert query_context.queries[totals_idx].row_limit is None
    assert query_context.cache_values["queries"][totals_idx]["row_limit"] is None

    totals_key = query_context.query_cache_key(query_context.queries[totals_idx])
    serialized = serialize_query(query_context, totals_idx)
    rebuilt = load_serialized_query(serialized)

    assert serialized["preserve_null_row_limit"] is True
    assert serialized["query"]["row_limit"] is None
    assert rebuilt.queries[0].row_limit is None
    assert rebuilt.query_cache_key(rebuilt.queries[0]) == totals_key
