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

"""Additive operation metadata at the authorized datasource boundary."""

from inspect import unwrap
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
import yaml
from superset_core.semantic_layers.view import SemanticViewFeature

from superset.connectors.sqla.models import SqlaTable
from superset.datasource.api import _HttpError, DatasourceRestApi
from superset.explorables.capabilities import (
    declared_capabilities,
    ExplorableCapabilities,
    ExplorableOperation,
)
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.sql_lab import Query
from superset.semantic_layers.mapper import SUPPORTED_FILTER_OPERATORS
from superset.semantic_layers.models import SemanticView
from superset.utils.core import FilterOperator


@pytest.mark.parametrize(
    ("source_class", "source_type", "expected"),
    [
        (
            SqlaTable,
            "table",
            ["ADHOC_METRICS", "DRILL_TO_DETAIL", "RAW_ROWS", "SAMPLES", "SQL_LAB"],
        ),
        (
            Query,
            "query",
            ["ADHOC_METRICS", "DRILL_TO_DETAIL", "RAW_ROWS", "SAMPLES", "SQL_LAB"],
        ),
        (SemanticView, "semantic_view", []),
    ],
)
def test_operation_payload_preserves_legacy_fields(
    source_class: type[SqlaTable] | type[Query] | type[SemanticView],
    source_type: str,
    expected: list[str],
) -> None:
    """Old readers retain their keys; new readers receive explicit declarations."""
    source: SqlaTable | Query | SemanticView = source_class()
    api: DatasourceRestApi = DatasourceRestApi()
    provider: MagicMock = MagicMock()
    provider.features = frozenset(
        {SemanticViewFeature.GROUP_LIMIT, SemanticViewFeature.ADHOC_COLUMN_EXPRESSIONS}
    )
    is_semantic: bool = source_type == "semantic_view"
    with (
        patch.object(
            SemanticView,
            "implementation",
            new_callable=PropertyMock,
            return_value=provider,
        ),
        patch.object(
            source_class, "data", new_callable=PropertyMock, return_value={"id": 7}
        ),
        patch.object(source_class, "get_time_grains", return_value=[]),
        patch.object(
            api, "_resolve_for_query", return_value=SimpleNamespace(explorable=source)
        ),
        patch.object(api, "response") as response,
    ):
        unwrap(DatasourceRestApi.datasource_info)(api, source_type, 7)

    assert response.call_args.args == (200,)
    payload: dict[str, Any] = response.call_args.kwargs["result"]
    capabilities: dict[str, Any] = payload["capabilities"]
    assert capabilities.pop("operations") == expected
    assert capabilities == {
        "is_rls_supported": source.is_rls_supported,
        "query_language": source.query_language,
        "supports_samples": not is_semantic,
        "supports_drill_to_detail": not is_semantic,
        "supports_adhoc_metrics": not is_semantic,
        "time_grains": [],
        "supported_operators": sorted(
            SUPPORTED_FILTER_OPERATORS
            if is_semantic
            else {op.value for op in FilterOperator}
        ),
        "features": ["GROUP_LIMIT"] if is_semantic else [],
    }
    assert payload["id"] == 7
    provider.query.assert_not_called()


def test_legacy_host_does_not_advertise_an_empty_declaration() -> None:
    """Unknown legacy operations are not reinterpreted as authoritative refusal."""
    source: SimpleNamespace = SimpleNamespace(
        data={"id": 7},
        is_rls_supported=False,
        query_language="custom",
        get_time_grains=lambda: [],
    )
    api: DatasourceRestApi = DatasourceRestApi()
    with (
        patch.object(
            api, "_resolve_for_query", return_value=SimpleNamespace(explorable=source)
        ),
        patch.object(api, "response") as response,
    ):
        unwrap(DatasourceRestApi.datasource_info)(api, "table", 7)
    capabilities: dict[str, Any] = response.call_args.kwargs["result"]["capabilities"]
    assert "operations" not in capabilities
    assert capabilities["supports_samples"] is True
    assert capabilities["supports_adhoc_metrics"] is True


def test_explicit_empty_declaration_is_not_missing() -> None:
    """A host extension can explicitly refuse the complete operation set."""
    assert declared_capabilities(SimpleNamespace()) is None
    source: SimpleNamespace = SimpleNamespace(
        explorable_capabilities=ExplorableCapabilities()
    )
    declaration: ExplorableCapabilities | None = declared_capabilities(source)
    assert declaration is not None
    assert declaration.names == []


@pytest.mark.parametrize("value", ["RAW_ROWS", ["RAW_ROWS"], 7, False, {}])
def test_malformed_host_declarations_grant_nothing(value: object) -> None:
    """Host opt-in uses a typed facet, never truthiness or source-kind guesses."""
    declaration: ExplorableCapabilities | None = declared_capabilities(
        SimpleNamespace(explorable_capabilities=value)
    )
    assert declaration is not None
    assert declaration.names == []


def test_sql_sample_and_detail_overrides_remain_consistent() -> None:
    """Existing per-source refusals survive the additive operation projection."""
    source: SqlaTable = SqlaTable()
    source.supports_samples = False
    source.supports_drill_to_detail = False
    declaration: ExplorableCapabilities | None = declared_capabilities(source)
    assert declaration is not None
    assert declaration.names == ["ADHOC_METRICS", "RAW_ROWS", "SQL_LAB"]
    assert ExplorableOperation.SAMPLES not in declaration.supported
    assert ExplorableOperation.DRILL_TO_DETAIL not in declaration.supported


def test_operation_vocabulary_does_not_claim_security_or_preview() -> None:
    """RLS, authorization and non-executing preview are distinct contracts."""
    assert {operation.value for operation in ExplorableOperation} == {
        "RAW_ROWS",
        "ADHOC_METRICS",
        "SAMPLES",
        "DRILL_TO_DETAIL",
        "SQL_LAB",
    }


def test_authorization_refusal_does_not_read_the_declaration() -> None:
    """The existing resolver must authorize before operation discovery."""
    api: DatasourceRestApi = DatasourceRestApi()
    with (
        patch.object(api, "_resolve_for_query", side_effect=_HttpError(403, "Denied")),
        patch("superset.datasource.api.declared_capabilities") as project,
        patch.object(api, "response") as response,
    ):
        unwrap(DatasourceRestApi.datasource_info)(api, "semantic_view", 7)
    response.assert_called_once_with(403, message="Denied")
    project.assert_not_called()


def test_explicit_host_refusal_keeps_legacy_booleans_in_sync() -> None:
    """An opted-in legacy host must not advertise conflicting operations."""
    source: SimpleNamespace = SimpleNamespace(
        data={},
        is_rls_supported=True,
        query_language="sql",
        get_time_grains=lambda: [],
        supports_samples=True,
        explorable_capabilities=ExplorableCapabilities(),
    )
    api: DatasourceRestApi = DatasourceRestApi()
    with (
        patch.object(
            api, "_resolve_for_query", return_value=SimpleNamespace(explorable=source)
        ),
        patch.object(api, "response") as response,
    ):
        unwrap(DatasourceRestApi.datasource_info)(api, "table", 7)
    capabilities: dict[str, Any] = response.call_args.kwargs["result"]["capabilities"]
    assert capabilities["operations"] == []
    assert capabilities["supports_samples"] is False
    assert capabilities["supports_drill_to_detail"] is False
    assert capabilities["supports_adhoc_metrics"] is False
    assert capabilities["is_rls_supported"] is True


@pytest.mark.parametrize("source_type", ["table", "semantic_view"])
@pytest.mark.parametrize(
    "declaration_kind", ["operations_only", "malformed", "empty_axes"]
)
def test_optional_axes_preserve_legacy_unless_explicitly_declared(
    source_type: str, declaration_kind: str
) -> None:
    """Declaring operations must not accidentally refuse unrelated SDK axes."""
    declaration: object = "malformed"
    if declaration_kind == "operations_only":
        declaration = ExplorableCapabilities(
            supported=frozenset({ExplorableOperation.RAW_ROWS})
        )
    elif declaration_kind == "empty_axes":
        declaration = ExplorableCapabilities(
            supported_operators=frozenset(), features=frozenset()
        )
    source: SimpleNamespace = SimpleNamespace(
        data={},
        is_rls_supported=False,
        query_language="custom",
        get_time_grains=lambda: [],
        implementation=SimpleNamespace(
            features=frozenset({SemanticViewFeature.GROUP_LIMIT})
        ),
        explorable_capabilities=declaration,
    )
    api: DatasourceRestApi = DatasourceRestApi()
    with (
        patch.object(
            api, "_resolve_for_query", return_value=SimpleNamespace(explorable=source)
        ),
        patch.object(api, "response") as response,
    ):
        unwrap(DatasourceRestApi.datasource_info)(api, source_type, 7)
    capabilities: dict[str, Any] = response.call_args.kwargs["result"]["capabilities"]
    legacy_operators: frozenset[str] | set[str] = (
        SUPPORTED_FILTER_OPERATORS
        if source_type == "semantic_view"
        else {operator.value for operator in FilterOperator}
    )
    assert capabilities["supported_operators"] == (
        [] if declaration_kind == "empty_axes" else sorted(legacy_operators)
    )
    assert capabilities["features"] == (
        [] if declaration_kind == "empty_axes" else ["GROUP_LIMIT"]
    )
    assert capabilities["operations"] == (
        ["RAW_ROWS"] if declaration_kind == "operations_only" else []
    )
    assert "supported" not in capabilities


def test_provider_features_do_not_introduce_expression_operations() -> None:
    """Adapt existing SDK features without deciding additional operation names."""
    source: SemanticView = SemanticView()
    provider: SimpleNamespace = SimpleNamespace(
        features=frozenset(
            {
                SemanticViewFeature.GROUP_LIMIT,
                SemanticViewFeature.ADHOC_COLUMN_EXPRESSIONS,
                SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY,
            }
        )
    )
    with patch.object(
        SemanticView,
        "implementation",
        new_callable=PropertyMock,
        return_value=provider,
    ):
        declaration: ExplorableCapabilities = source.explorable_capabilities
    assert declaration.names == []
    assert declaration.features == frozenset(
        {
            "GROUP_LIMIT",
            "ADHOC_EXPRESSIONS_IN_ORDERBY",
        }
    )

    provider.features = frozenset()
    with patch.object(
        SemanticView,
        "implementation",
        new_callable=PropertyMock,
        return_value=provider,
    ):
        declaration = source.explorable_capabilities
    assert declaration.names == []
    assert declaration.features == frozenset()


@pytest.mark.parametrize("payload_kind", ["info", "explore", "dashboard"])
def test_declared_refusal_projects_existing_booleans_everywhere(
    payload_kind: str,
) -> None:
    """Every authorized metadata payload honors the same explicit declaration."""
    source: SqlaTable = SqlaTable(
        id=7,
        table_name="projection_test",
        database=Database(database_name="test", sqlalchemy_uri="sqlite://"),
    )
    api: DatasourceRestApi = DatasourceRestApi()
    chart: MagicMock = MagicMock()
    chart.datasource_type = "table"
    chart.datasource_id = 7
    chart.resolved_datasource = source

    def unchanged_labels(
        datasource: object,
        slices: object,
        payload: dict[str, Any],
        *args: object,
        **kwargs: object,
    ) -> dict[str, Any]:
        """Keep this capability test independent of display-label enrichment."""
        return payload

    response: MagicMock
    with (
        patch.object(
            SqlaTable, "select_star", new_callable=PropertyMock, return_value=""
        ),
        patch.object(
            SqlaTable,
            "explorable_capabilities",
            new_callable=PropertyMock,
            return_value=ExplorableCapabilities(),
        ),
        patch.object(SqlaTable, "get_time_grains", return_value=[]),
        patch.object(
            api, "_resolve_for_query", return_value=SimpleNamespace(explorable=source)
        ),
        patch.object(api, "response") as response,
        patch.object(
            Dashboard, "slices", new_callable=PropertyMock, return_value=[chart]
        ),
        patch.object(
            Dashboard, "_with_chart_display_labels", side_effect=unchanged_labels
        ),
        patch.object(
            SqlaTable,
            "data_for_slices",
            return_value={
                "supports_samples": True,
                "supports_drill_to_detail": True,
                "supports_adhoc_metrics": True,
            },
        ),
    ):
        payload: dict[str, Any]
        if payload_kind == "info":
            unwrap(DatasourceRestApi.datasource_info)(api, "table", 7)
            payload = response.call_args.kwargs["result"]
            assert payload["capabilities"]["operations"] == []
        elif payload_kind == "explore":
            payload = dict(source.data)
        else:
            payload = Dashboard().datasets_trimmed_for_slices()[0][1]
    assert payload["supports_samples"] is False
    assert payload["supports_drill_to_detail"] is False
    if "supports_adhoc_metrics" in payload:
        assert payload["supports_adhoc_metrics"] is False


def test_query_data_keeps_its_legacy_wire_keys() -> None:
    """SQL Lab's data payload does not gain boolean keys it never serialized."""
    source: Query = Query(
        database=Database(database_name="test", sqlalchemy_uri="sqlite://")
    )
    with patch.object(Query, "columns", new_callable=PropertyMock, return_value=[]):
        payload: dict[str, Any] = dict(source.data)
    assert (
        not {"supports_samples", "supports_drill_to_detail", "supports_adhoc_metrics"}
        & payload.keys()
    )
    assert source.explorable_capabilities.names == [
        "ADHOC_METRICS",
        "DRILL_TO_DETAIL",
        "RAW_ROWS",
        "SAMPLES",
        "SQL_LAB",
    ]


def test_operation_openapi_schema_matches_the_declared_vocabulary() -> None:
    """The optional additive list is documented without making it required."""
    doc: str = DatasourceRestApi.datasource_info.__doc__ or ""
    schema: dict[str, Any] = yaml.safe_load(doc.split("---", 1)[1])
    capabilities: dict[str, Any] = schema["get"]["responses"][200]["content"][
        "application/json"
    ]["schema"]["properties"]["result"]["properties"]["capabilities"]
    assert "operations" not in capabilities.get("required", [])
    assert capabilities["properties"]["operations"]["type"] == "array"
    assert set(capabilities["properties"]["operations"]["items"]["enum"]) == {
        operation.value for operation in ExplorableOperation
    }
