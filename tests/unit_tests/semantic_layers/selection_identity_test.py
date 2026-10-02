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
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature

from superset.charts.schemas import ChartDataExtrasSchema
from superset.common.query_context_processor import QueryContextProcessor
from superset.common.query_object import QueryObject
from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.mapper import map_query_object, validate_query_object
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
    with pytest.raises(ValueError, match="explicitly reselect"):
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
