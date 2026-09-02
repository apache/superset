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

"""Unit tests for the datasource query endpoint's schema and wiring."""

from typing import Any

import pandas as pd
import pytest
from marshmallow import ValidationError

from superset.common.chart_data import ChartDataResultFormat


@pytest.fixture
def schema():
    from superset.datasource.schemas import DatasourceQuerySchema

    return DatasourceQuerySchema()


def test_defaults_to_json_result_format(schema) -> None:
    """JSON is the primary contract; Arrow is an explicit opt-in."""
    loaded = schema.load({"metrics": ["count"]})

    assert loaded["result_format"] == ChartDataResultFormat.JSON
    assert loaded["offset"] == 0
    assert loaded["order"] == []
    assert loaded["use_cache"] is True
    assert loaded["force"] is False


def test_accepts_arrow_result_format(schema) -> None:
    loaded = schema.load({"metrics": ["count"], "result_format": "arrow"})

    assert loaded["result_format"] == ChartDataResultFormat.ARROW


def test_accepts_adhoc_metric_objects(schema) -> None:
    """metrics is Raw because Metric is `AdhocMetric | str`."""
    adhoc = {
        "expressionType": "SQL",
        "sqlExpression": "SUM(a)/SUM(b)",
        "label": "Ratio",
    }
    assert schema.load({"metrics": [adhoc]})["metrics"] == [adhoc]


def test_rejects_empty_request(schema) -> None:
    """A query with neither metrics nor dimensions has nothing to select."""
    with pytest.raises(ValidationError, match="at least one metric or dimension"):
        schema.load({})


def test_time_grain_accepted_without_explicit_axis(schema) -> None:
    """The schema cannot know which dimensions are temporal, so grain
    resolution is validated in the API against the datasource's columns."""
    assert schema.load({"metrics": ["count"], "time_grain": "P1D"})["time_grain"] == (
        "P1D"
    )
    loaded = schema.load(
        {"metrics": ["count"], "dimensions": ["ds"], "time_grain": "P1M"}
    )
    assert loaded["time_grain"] == "P1M"


def test_rejects_limit_above_cap(schema) -> None:
    with pytest.raises(ValidationError):
        schema.load({"metrics": ["count"], "limit": 500_000})


def test_rejects_negative_offset(schema) -> None:
    with pytest.raises(ValidationError):
        schema.load({"metrics": ["count"], "offset": -1})


def test_order_carries_per_column_direction(schema) -> None:
    """Mirrors SemanticQuery's OrderTuple rather than one flag for all columns."""
    loaded = schema.load(
        {
            "metrics": ["count"],
            "order": [{"column": "count"}, {"column": "region", "descending": False}],
        }
    )

    assert loaded["order"] == [
        {"column": "count", "descending": True},
        {"column": "region", "descending": False},
    ]


def test_order_requires_a_column(schema) -> None:
    with pytest.raises(ValidationError):
        schema.load({"metrics": ["count"], "order": [{"descending": True}]})


def test_rejects_unknown_filter_operator(schema) -> None:
    """Filters reuse ChartDataFilterSchema, which validates against
    FilterOperator."""
    with pytest.raises(ValidationError):
        schema.load(
            {"metrics": ["count"], "filters": [{"col": "a", "op": "NOPE", "val": 1}]}
        )


def test_accepts_ilike_operator(schema) -> None:
    """ILIKE is a valid wire operator and now reaches semantic views too."""
    loaded = schema.load(
        {"metrics": ["count"], "filters": [{"col": "a", "op": "ILIKE", "val": "%x%"}]}
    )
    assert loaded["filters"][0]["op"] == "ILIKE"


def test_query_routes_registered(app) -> None:
    rules = {
        rule.rule
        for rule in app.url_map.iter_rules()
        if "/api/v1/datasource" in rule.rule
    }

    assert "/api/v1/datasource/<datasource_type>/<int:datasource_id>/query" in rules
    assert "/api/v1/datasource/<datasource_type>/<int:datasource_id>" in rules


def test_both_new_routes_share_can_query(app) -> None:
    """Sharing can_query keeps the metadata route off can_get, which
    PUBLIC_ROLE_PERMISSIONS already grants for chart rendering."""
    from superset.datasource.api import DatasourceRestApi

    assert DatasourceRestApi.method_permission_name["query"] == "query"
    assert DatasourceRestApi.method_permission_name["datasource_info"] == "query"


def test_can_query_is_gamma_readable(app) -> None:
    """Without this, Datasource being in GAMMA_READ_ONLY_MODEL_VIEWS makes
    _is_alpha_only withhold can_query from Gamma."""
    from superset.security.manager import SupersetSecurityManager

    assert "can_query" in SupersetSecurityManager.READ_ONLY_PERMISSION
    assert "Datasource" in SupersetSecurityManager.GAMMA_READ_ONLY_MODEL_VIEWS


def test_arrow_is_not_export_gated() -> None:
    """Arrow is a programmatic transport, not a human file export, so it stays
    out of table_like() and its can_export_data / can_csv gate."""
    assert ChartDataResultFormat.ARROW not in ChartDataResultFormat.table_like()


def test_arrow_serializer_round_trips() -> None:
    import pyarrow as pa

    from superset.common.query_context_processor import QueryContextProcessor

    df = pd.DataFrame({"region": ["EMEA", "APAC"], "sales": [10, 20]})
    payload = QueryContextProcessor._to_arrow_ipc(df)

    assert isinstance(payload, bytes)
    restored = pa.ipc.open_stream(payload).read_all().to_pandas()
    pd.testing.assert_frame_equal(restored, df)


def test_chart_data_schema_rejects_arrow() -> None:
    """`ARROW` lives on the shared enum so `get_data` can serialize it, but
    `_send_chart_response` has no Arrow branch — accepting it on chart/data
    would execute the query and only then fail with "Unsupported result_format".
    """
    from superset.charts.schemas import ChartDataQueryContextSchema

    field = ChartDataQueryContextSchema().fields["result_format"]

    with pytest.raises(ValidationError) as excinfo:
        field.deserialize("arrow")
    assert "arrow" in str(excinfo.value)
    assert "/api/v1/datasource/" in str(excinfo.value)

    # Its own formats are unaffected.
    for fmt in ("json", "csv", "xlsx"):
        assert field.deserialize(fmt) == ChartDataResultFormat(fmt)


def test_rejects_cache_timeout_below_disabled_sentinel(schema) -> None:
    """-1 is CACHE_DISABLED_TIMEOUT; below that is meaningless and would reach
    the cache backend as an arbitrary negative timeout."""
    assert (
        schema.load({"metrics": ["count"], "cache_timeout": -1})["cache_timeout"] == -1
    )
    assert (
        schema.load({"metrics": ["count"], "cache_timeout": 300})["cache_timeout"]
        == 300
    )

    with pytest.raises(ValidationError):
        schema.load({"metrics": ["count"], "cache_timeout": -2})


def test_rejects_unsupported_result_formats(schema) -> None:
    for fmt in ("csv", "xlsx"):
        with pytest.raises(ValidationError):
            schema.load({"metrics": ["count"], "result_format": fmt})


def test_semantic_views_advertise_only_mapper_supported_operators() -> None:
    from superset.semantic_layers.mapper import SUPPORTED_FILTER_OPERATORS
    from superset.utils.core import FilterOperator

    assert SUPPORTED_FILTER_OPERATORS < {op.value for op in FilterOperator}
    assert FilterOperator.TEMPORAL_RANGE.value in SUPPORTED_FILTER_OPERATORS
    assert FilterOperator.CONTAINS_ANY.value not in SUPPORTED_FILTER_OPERATORS


def test_offset_rejected_when_engine_cannot_paginate(app) -> None:
    from unittest.mock import MagicMock, patch

    from superset.datasource.api import DatasourceRestApi

    resolved = MagicMock()
    resolved.explorable.database.db_engine_spec.supports_offset = False
    resolved.explorable.database.db_engine_spec.engine = "elasticsearch"
    payload: dict[str, Any] = {
        "offset": 10,
        "time_grain": None,
        "time_column": None,
        "dimensions": [],
    }

    api = DatasourceRestApi()
    with patch.object(api, "response_400", side_effect=AssertionError("rejected")) as m:
        with pytest.raises(AssertionError):
            api._execute_and_respond(resolved, payload)
    assert "offset" in m.call_args.kwargs["message"]


def test_rejects_unsupported_time_grain(app) -> None:
    """A grain the engine cannot express reaches get_timestamp_expr, which
    raises NotImplementedError rather than a validation error."""
    from unittest.mock import MagicMock, patch

    from superset.datasource.api import DatasourceRestApi

    resolved = MagicMock()
    resolved.explorable.database.db_engine_spec.supports_offset = True
    resolved.explorable.get_time_grains.return_value = [{"duration": "P1D"}]
    resolved.resolve_grain_column.return_value = "ds"
    payload: dict[str, Any] = {
        "offset": 0,
        "time_grain": "P1DD",
        "time_column": "ds",
        "dimensions": [],
    }

    api = DatasourceRestApi()
    with patch.object(api, "response_400", side_effect=AssertionError) as m:
        with pytest.raises(AssertionError):
            api._execute_and_respond(resolved, payload)
    assert "Unsupported time_grain" in m.call_args.kwargs["message"]
