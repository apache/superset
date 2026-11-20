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

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature
from werkzeug.test import TestResponse

from superset.charts.schemas import ChartDataExtrasSchema
from superset.common.chart_data import ChartDataResultType
from superset.common.query_actions import get_query_results
from superset.common.query_context_processor import QueryContextProcessor
from superset.common.query_object import QueryObject
from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.mapper import (
    get_results,
    map_query_object,
    validate_query_object,
)
from superset.utils import json


class IdentityView(SemanticView):
    name: str = "Orders"
    features: frozenset[SemanticViewFeature] = frozenset()
    selection_identity_version: str | None = "cube-member-id-v1"

    def __init__(self) -> None:
        self.metrics: set[Metric] = {
            Metric(
                id="Orders.b",
                name="Orders.b",
                type=pa.float64(),
                definition="Orders.b",
                verbose_name="Total",
            )
        }
        self.dimensions: set[Dimension] = set()

    def get_compatible_metrics(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Metric]:
        return self.metrics

    def get_compatible_dimensions(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Dimension]:
        return self.dimensions

    def uid(self) -> str:
        return "identity-test"

    def get_metrics(self) -> set[Metric]:
        return self.metrics

    def get_dimensions(self) -> set[Dimension]:
        return self.dimensions

    def get_values(
        self, dimension: Dimension, filters: set[Filter] | None = None
    ) -> SemanticResult:
        raise AssertionError("legacy request must not execute")

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        raise AssertionError("legacy request must not execute")

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        raise AssertionError("legacy request must not execute")


@pytest.mark.parametrize("version", [None, "old", True, 1])
def test_legacy_id_looking_title_rejected_before_cache_and_mapper(
    version: object,
) -> None:
    datasource: MagicMock = MagicMock(
        type="semantic_view", implementation=IdentityView()
    )
    query: QueryObject = QueryObject(
        datasource=datasource,
        metrics=["Orders.b"],
        extras={"semantic_selection_version": version},
    )
    processor: QueryContextProcessor = QueryContextProcessor(MagicMock())
    cache: MagicMock
    with patch(
        "superset.common.query_context_processor.QueryCacheManager.get"
    ) as cache:
        with pytest.raises(QueryObjectValidationError, match="explicitly reselect"):
            processor.get_df_payload_result(query, force_cached=True)
        cache.assert_not_called()
    with pytest.raises(QueryObjectValidationError, match="explicitly reselect"):
        validate_query_object(query)


def test_current_version_reaches_semantic_query_and_other_providers_opt_out() -> None:
    implementation: IdentityView = IdentityView()
    datasource: MagicMock = MagicMock(
        type="semantic_view", implementation=implementation, fetch_values_predicate=None
    )
    query: QueryObject = QueryObject(
        datasource=datasource,
        metrics=["Orders.b"],
        extras={"semantic_selection_version": "cube-member-id-v1"},
        series_limit=0,
    )
    assert query.validate() is None
    assert validate_query_object(query)
    mapped: list[SemanticQuery] = map_query_object(query)
    assert mapped[0].metrics[0].id == "Orders.b"
    assert mapped[0].selection_identity_version == "cube-member-id-v1"
    implementation.selection_identity_version = None
    query.extras = {}
    assert query.validate() is None
    assert validate_query_object(query)


def test_query_extras_schema_preserves_saved_version_without_upgrading_legacy() -> None:
    """Keep the explicit marker across JSON and schema deserialization."""
    schema: ChartDataExtrasSchema = ChartDataExtrasSchema()
    saved: str = json.dumps({"semantic_selection_version": "cube-member-id-v1"})
    assert schema.load(json.loads(saved))["semantic_selection_version"] == (
        "cube-member-id-v1"
    )
    assert "semantic_selection_version" not in schema.load({})


def test_incompatible_overlay_reports_filter_scope_remediation() -> None:
    """A chart reset alone cannot repair an incompatible dashboard overlay."""
    query: QueryObject = QueryObject(
        datasource=MagicMock(type="semantic_view", implementation=IdentityView()),
        metrics=["Orders.b"],
        extras={"semantic_selection_version": "unverified-external-selections"},
    )
    with pytest.raises(
        QueryObjectValidationError,
        match="Dynamic group-by is unsupported.*remove this chart from its scope",
    ):
        query.validate()


@pytest.mark.parametrize("entrypoint", ["rest", "mcp"])
@pytest.mark.parametrize("version", [None, "cube-member-id-v1"])
def test_name_based_entrypoints_preserve_explicit_identity_version(
    entrypoint: str, version: str | None
) -> None:
    """Exercise each wire schema and builder through the real validation/mapper."""
    from superset.datasource.api import DatasourceRestApi
    from superset.datasource.schemas import DatasourceQuerySchema
    from superset.mcp_service.semantic_layer.schemas import GetTableRequest
    from superset.mcp_service.semantic_layer.tool.get_table import _build_query_dict

    datasource: MagicMock = MagicMock(
        type="semantic_view", implementation=IdentityView(), fetch_values_predicate=None
    )
    wire: dict[str, Any] = {
        "metrics": ["Orders.b"],
        "semantic_selection_version": version,
    }
    query_dict: dict[str, Any]
    if entrypoint == "rest":
        payload: dict[str, Any] = DatasourceQuerySchema().load(wire)
        resolved: MagicMock = MagicMock(explorable=datasource, time_column=None)
        query_dict = DatasourceRestApi._build_query_dict(resolved, payload, None)
    else:
        query_dict = _build_query_dict(GetTableRequest(view_id=7, **wire), None)
    query: QueryObject = QueryObject(
        datasource=datasource, series_limit=0, **query_dict
    )
    if version is None:
        assert "semantic_selection_version" not in query_dict.get("extras", {})
        processor: QueryContextProcessor = QueryContextProcessor(MagicMock())
        cache: MagicMock
        with patch(
            "superset.common.query_context_processor.QueryCacheManager.get"
        ) as cache:
            with pytest.raises(QueryObjectValidationError, match="explicitly reselect"):
                processor.get_df_payload_result(query, force_cached=True)
            cache.assert_not_called()
    else:
        assert query.validate() is None
        assert validate_query_object(query)
        mapped: list[SemanticQuery] = map_query_object(query)
        assert mapped[0].selection_identity_version == version
        assert mapped[0].metrics[0].id == "Orders.b"


def test_name_based_version_coexists_with_time_grain_without_auto_upgrade() -> None:
    from superset.common.tabular_query import build_query_dict

    query: dict[str, Any] = build_query_dict(
        metrics=["Orders.b"],
        time_grain="P1D",
        semantic_selection_version="cube-member-id-v1",
    )
    assert query["extras"] == {
        "time_grain_sqla": "P1D",
        "semantic_selection_version": "cube-member-id-v1",
    }
    assert build_query_dict(metrics=["Orders.b"], time_grain="P1D")["extras"] == {
        "time_grain_sqla": "P1D"
    }


def test_malformed_configuration_is_not_a_selection_version_error() -> None:
    datasource: MagicMock = MagicMock(type="semantic_view")
    type(datasource).implementation = PropertyMock(
        side_effect=json.JSONDecodeError("private configuration", "{", 1)
    )
    query: QueryObject = QueryObject(
        datasource=datasource,
        metrics=["Orders.b"],
        extras={"semantic_selection_version": "cube-member-id-v1"},
    )
    with pytest.raises(json.JSONDecodeError):
        query.validate()


@pytest.mark.parametrize(
    "datasource_type,version",
    [
        ("semantic_view", "cube-member-id-v1"),
        ("semantic_view", None),
        ("table", None),
    ],
)
def test_column_suggestions_version_gate_precedes_cache(
    datasource_type: str,
    version: str | None,
) -> None:
    from inspect import unwrap
    from types import MethodType

    from flask import Flask

    from superset.datasource.api import DatasourceRestApi

    app: Flask = Flask(__name__)
    app.config["FILTER_SELECT_ROW_LIMIT"] = 100
    app.config["SQL_MAX_ROW"] = 1000
    app.config["HASH_ALGORITHM"] = "sha256"
    datasource: MagicMock = MagicMock(
        type=datasource_type, uid="1", normalize_columns=False, changed_on="fixed"
    )
    datasource.implementation.selection_identity_version = version
    api: MagicMock = MagicMock()
    api._column_values_response = MethodType(
        DatasourceRestApi._column_values_response, api
    )
    cache: MagicMock
    with (
        app.test_request_context(),
        patch(
            "superset.datasource.api.DatasourceDAO.get_datasource",
            return_value=datasource,
        ),
        patch("superset.datasource.api.cache_manager") as cache,
        patch(
            "superset.datasource.api.security_manager.get_rls_cache_key",
            return_value=[],
        ),
    ):
        cache.data_cache.get.return_value = ["cached"]
        unwrap(DatasourceRestApi.get_column_values)(api, datasource_type, 1, "Orders.b")
    datasource.raise_for_access.assert_called_once()
    if version:
        cache.data_cache.get.assert_not_called()
        datasource.values_for_column.assert_not_called()
        api.response.assert_called_once_with(
            200,
            result=[],
            suggestions_status="unavailable_versioned_view",
        )
    else:
        cache.data_cache.get.assert_called_once()
        assert api.response.call_args.kwargs["result"] == ["cached"]


@pytest.mark.parametrize(
    "result_type", [ChartDataResultType.TIMEGRAINS, ChartDataResultType.COLUMNS]
)
@pytest.mark.parametrize("extras", [{}, {"semantic_selection_version": "old"}])
def test_datasource_metadata_request_skips_selection_version(
    result_type: ChartDataResultType, extras: dict[str, Any]
) -> None:
    """Time grain and column options select no members, so carry no identity."""
    query: QueryObject = QueryObject(
        datasource=MagicMock(type="semantic_view", implementation=IdentityView()),
        result_type=result_type,
        columns=[],
        metrics=[],
        orderby=[],
        extras=extras,
    )
    assert query.validate() is None


@pytest.mark.parametrize(
    "result_type",
    [None, ChartDataResultType.QUERY, ChartDataResultType.SAMPLES],
)
def test_selection_requests_still_require_current_version(
    result_type: ChartDataResultType | None,
) -> None:
    """Only datasource-metadata result types are exempt from the identity guard."""
    query: QueryObject = QueryObject(
        datasource=MagicMock(type="semantic_view", implementation=IdentityView()),
        result_type=result_type,
        metrics=["Orders.b"],
        extras={"semantic_selection_version": "old"},
    )
    with pytest.raises(QueryObjectValidationError, match="explicitly reselect"):
        query.validate()


@pytest.mark.parametrize("result_type", [None, ChartDataResultType.FULL])
def test_empty_non_metadata_request_still_requires_current_version(
    result_type: ChartDataResultType | None,
) -> None:
    """An empty selection cannot exempt an ordinary request from identity checks."""
    query: QueryObject = QueryObject(
        datasource=MagicMock(type="semantic_view", implementation=IdentityView()),
        result_type=result_type,
        columns=[],
        metrics=[],
        orderby=[],
        extras={"semantic_selection_version": "old"},
    )
    with pytest.raises(QueryObjectValidationError, match="explicitly reselect"):
        query.validate()


@pytest.mark.parametrize("datasource_type", ["semantic_view", "table"])
def test_time_grain_options_load_through_processor(datasource_type: str) -> None:
    """The control's request validates and returns grains for both source kinds."""
    grains: list[dict[str, Any]] = [{"name": "Day", "duration": "P1D"}]
    datasource: MagicMock = MagicMock(
        type=datasource_type, implementation=IdentityView()
    )
    datasource.get_time_grains.return_value = grains
    query: QueryObject = QueryObject(
        datasource=datasource,
        result_type=ChartDataResultType.TIMEGRAINS,
        columns=[],
        metrics=[],
        orderby=[],
    )
    query_context: MagicMock = MagicMock(datasource=datasource, queries=[query])
    processor: QueryContextProcessor = QueryContextProcessor(query_context)
    sm: MagicMock
    with patch("superset.common.query_context_processor.security_manager") as sm:
        processor.raise_for_access()
    sm.raise_for_access.assert_called_once_with(query_context=query_context)
    assert get_query_results(
        ChartDataResultType.TIMEGRAINS, query_context, query, False
    ) == {"data": grains}


@pytest.mark.parametrize(
    "selection",
    [
        {"metrics": ["Orders.b"]},
        {"columns": ["Orders.region"]},
        {"orderby": [("Orders.b", True)]},
        {"filters": [{"col": "Orders.region", "op": "==", "val": "EUROPE"}]},
        {"granularity": "Orders.order_date"},
        {"series_columns": ["Orders.region"]},
        {"series_limit_metric": "Orders.b"},
    ],
)
@pytest.mark.parametrize(
    "result_type", [ChartDataResultType.TIMEGRAINS, ChartDataResultType.COLUMNS]
)
def test_metadata_result_type_naming_members_still_requires_version(
    result_type: ChartDataResultType, selection: dict[str, Any]
) -> None:
    """The exemption covers what a query selects, not only what it declares."""
    query: QueryObject = QueryObject(
        datasource=MagicMock(type="semantic_view", implementation=IdentityView()),
        result_type=result_type,
        **selection,
    )
    with pytest.raises(QueryObjectValidationError, match="explicitly reselect"):
        query.validate()


@pytest.mark.parametrize(
    ("version", "message"),
    [
        (None, "explicitly reselect"),
        ("unverified-external-selections", "remove this chart from its scope"),
    ],
)
def test_mapper_refuses_stale_version_as_validation_error(
    version: str | None, message: str
) -> None:
    """A query reaching the mapper unvalidated gets the same 400 as validate()."""
    query: QueryObject = QueryObject(
        datasource=MagicMock(type="semantic_view", implementation=IdentityView()),
        metrics=["Orders.b"],
        extras={"semantic_selection_version": version},
    )
    with pytest.raises(QueryObjectValidationError, match=message):
        validate_query_object(query)
    with pytest.raises(QueryObjectValidationError, match=message):
        get_results(query)


@pytest.mark.parametrize("result_type", ["timegrains", "columns"])
def test_forced_async_metadata_request_runs_synchronously(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    result_type: str,
) -> None:
    """A forced refresh under GAQ answers the control's options without a task."""
    from superset.semantic_layers.models import SemanticView as SemanticViewModel

    grains: list[dict[str, Any]] = [{"name": "Day", "function": "", "duration": "P1D"}]
    view: SemanticViewModel = SemanticViewModel(id=73, name="Orders", cache_timeout=600)
    mocker.patch.object(
        SemanticViewModel,
        "implementation",
        new_callable=PropertyMock,
        return_value=IdentityView(),
    )
    mocker.patch.object(SemanticViewModel, "get_time_grains", return_value=grains)
    column: MagicMock = MagicMock(
        column_name="Orders.order_date", verbose_name="Order date"
    )
    mocker.patch.object(
        SemanticViewModel, "columns", new_callable=PropertyMock, return_value=[column]
    )
    mocker.patch(
        "superset.common.query_actions.extract_column_dtype", return_value="DATETIME"
    )
    mocker.patch.object(SemanticViewModel, "raise_for_access")
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=view
    )
    # Every other async precondition holds, so only the result type decides.
    mocker.patch("superset.charts.data.api.is_feature_enabled", return_value=True)
    mocker.patch("superset.charts.data.api.get_user_id", return_value=1)
    mocker.patch(
        "superset.charts.data.api.security_manager.can_access", return_value=True
    )
    cache: MagicMock = mocker.patch("superset.charts.data.api.cache_manager")
    cache.data_cache.cache = MagicMock()
    submit: MagicMock = mocker.patch(
        "superset.charts.data.api.submit_chart_data_query_tasks",
        return_value={"task_ids": ["task-1"], "cursor": "cursor"},
    )

    # The control's builder: a full context holding one metadata query.
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 73, "type": "semantic_view"},
            "force": True,
            "async_mode": True,
            "queries": [
                {
                    "result_type": result_type,
                    "columns": [],
                    "metrics": [],
                    "orderby": [],
                }
            ],
            "result_type": "full",
            "result_format": "json",
        },
    )

    submit.assert_not_called()
    assert response.status_code == 200, response.get_json()
    assert response.get_json()["result"][0]["data"] == (
        grains
        if result_type == "timegrains"
        else [
            {
                "column_name": "Orders.order_date",
                "verbose_name": "Order date",
                "dtype": "DATETIME",
            }
        ]
    )
