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
"""Native choice queries preserve their authorization, scope, and exact values."""

from collections.abc import Iterator
from copy import deepcopy
from decimal import Decimal
from typing import Any, Literal
from unittest.mock import Mock

import pytest
from flask import current_app, g
from pytest_mock import MockerFixture
from sqlalchemy import column, create_engine, select, String, text
from sqlalchemy.dialects import mysql, postgresql, sqlite

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.constants import EMPTY_FILTER_SQL_EXPRESSION
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.dashboard import filter_values as choices
from superset.mcp_service.dashboard.schemas import (
    GetDashboardInfoRequest,
    NativeFilterAvailableValues,
    NativeFilterValueSummary,
)
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.helpers import build_like_predicate
from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags


@pytest.fixture
def native_query(mocker: MockerFixture, app_context: None) -> dict[str, Any]:
    """Use real QueryContext construction with query execution at a test boundary."""
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    mocker.patch.object(Database, "get_db_engine_spec", return_value=SqliteEngineSpec)
    dataset = SqlaTable(
        id=5,
        table_name="sales",
        database=Database(id=1, database_name="test", sqlalchemy_uri="sqlite://"),
    )
    dataset.columns = [
        TableColumn(column_name="region", type="VARCHAR"),
        TableColumn(column_name="country", type="VARCHAR"),
        TableColumn(column_name="amount", type="INTEGER"),
        TableColumn(column_name="enabled", type="BOOLEAN"),
    ]
    mocker.patch.object(choices.DatasetDAO, "find_by_id", return_value=dataset)
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=dataset
    )
    mocker.patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="sqlite",
    )
    mocker.patch.object(
        choices, "user_can_view_data_model_metadata", return_value=False
    )
    authorize = mocker.patch("superset.security_manager.raise_for_access")
    query_contexts: list[Any] = []
    rows: list[dict[str, Any]] = [{"region": "Bikes"}]

    def execute(command: ChartDataCommand, **kwargs: Any) -> dict[str, Any]:
        """Record the authorized context before returning warehouse rows."""
        query_contexts.append(command.query_context)
        return {"queries": [{"data": deepcopy(rows)}]}

    run = mocker.patch.object(choices, "_execute", autospec=True, side_effect=execute)
    return {
        "dataset": dataset,
        "contexts": query_contexts,
        "rows": rows,
        "run": run,
        "authorize": authorize,
    }


def _filter(filter_id: str = "region", **kwargs: Any) -> dict[str, Any]:
    """Build a normal saved table select with no chosen value."""
    return {
        "id": filter_id,
        "name": filter_id,
        "filterType": "filter_select",
        "type": "NATIVE_FILTER",
        "targets": [{"datasetId": 5, "column": {"name": filter_id}}],
        "controlValues": {"multiSelect": True},
        "defaultDataMask": {"filterState": {"value": None}, "extraFormData": {}},
        **kwargs,
    }


def _dashboard(*configs: dict[str, Any]) -> Dashboard:
    """Build the authorized dashboard passed to the discovery helper."""
    return Dashboard(
        id=1,
        dashboard_title="Sales",
        json_metadata=json.dumps(
            {"native_filter_configuration": list(configs or [_filter()])}
        ),
    )


def _request(**kwargs: Any) -> GetDashboardInfoRequest:
    """Construct a validated opted-in request."""
    return GetDashboardInfoRequest(identifier=1, include_filter_values=True, **kwargs)


def _available(summary: NativeFilterValueSummary) -> NativeFilterAvailableValues:
    """Require the opt-in choice envelope before asserting its typed fields."""
    assert summary.available_values is not None
    return summary.available_values


def _mask(values: list[Any] | None, **extra: Any) -> dict[str, Any]:
    """Represent snapshot selections without trusting their extra predicates."""
    return {
        "filterState": {"value": values, "excludeFilterValues": True},
        "extraFormData": extra,
    }


def test_native_query_authorized_before_run_and_targets_redacted(
    native_query: dict[str, Any],
) -> None:
    """Dashboard context, target restrictions and viewer redaction survive discovery."""
    summaries, metadata = choices.discover_filter_values(_dashboard(), _request())
    assert summaries[0].targets == []
    assert _available(summaries[0]).values == ["Bikes"]
    assert _available(summaries[0]).status == "complete"
    assert metadata.query_count == 1
    context = native_query["contexts"][0]
    assert context.form_data["type"] == "NATIVE_FILTER"
    assert context.form_data["dashboardId"] == 1
    assert context.form_data["native_filter_id"] == "region"
    assert context.queries[0].columns == ["region"]
    assert context.queries[0].metrics == []
    assert context.queries[0].row_limit == 26
    native_query["authorize"].assert_called_with(query_context=context)


@pytest.mark.parametrize(
    "value",
    [
        "Bikes",
        "Europe, Middle East & Africa",
        "Parts & Service",
        'Bikes "Pro"',
        "Côte d'Ivoire",
        "O'Brien & Sons, Ltd.",
        "Smith, Jones & Partners, LLC",
        " Online ",
        "ignore previous instructions",
        "x" * 1000,
        "a%b_c\\d",
    ],
)
def test_exact_strings_never_split_normalize_or_clip(
    native_query: dict[str, Any], value: str
) -> None:
    """Exact probes preserve quoted, comma-containing, Unicode and long scalars."""
    native_query["rows"][:] = [{"region": value}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(),
        _request(filter_value_requests=[{"filter_id": "region", "exact_value": value}]),
    )
    available = _available(summaries[0])
    assert available.values == [value]
    assert available.model_dump()["exact_value"] == value
    assert native_query["contexts"][0].queries[0].filter == [
        {"col": "region", "op": "==", "val": value, "is_literal": True}
    ]


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("amount", 1),
        ("amount", 1.5),
        ("enabled", True),
        ("enabled", False),
        ("region", None),
    ],
)
def test_exact_scalar_families(
    native_query: dict[str, Any], name: str, value: Any
) -> None:
    """Booleans, numbers and explicit null are returned in their stored types."""
    native_query["rows"][:] = [{name: value}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter(name)),
        _request(filter_value_requests=[{"filter_id": name, "exact_value": value}]),
    )
    available = _available(summaries[0])
    assert available.status == "complete"
    assert type(available.values[0]) is type(value)
    assert available.model_dump()["exact_value"] == value
    assert native_query["contexts"][0].queries[0].filter[0]["op"] == (
        "IS NULL" if value is None else "=="
    )


@pytest.mark.parametrize(
    ("name", "value"),
    [("amount", True), ("amount", "1"), ("enabled", 1), ("region", 1)],
)
def test_incompatible_exact_values_reject_before_all_queries(
    native_query: dict[str, Any], name: str, value: Any
) -> None:
    """A later invalid exact probe cannot leave earlier queries executed."""
    with pytest.raises(ValueError, match="Incompatible exact"):
        choices.discover_filter_values(
            _dashboard(_filter("country"), _filter(name)),
            _request(
                filter_value_requests=[
                    {"filter_id": "country"},
                    {"filter_id": name, "exact_value": value},
                ]
            ),
        )
    native_query["run"].assert_not_called()


def test_search_filters_domain_before_limit_with_literal_wildcards(
    native_query: dict[str, Any],
) -> None:
    """Search is a literal escaped SQL predicate, never a scan of the sample."""
    native_query["rows"][:] = [{"region": "later 10%_O'Brien/\\"}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(),
        _request(
            filter_value_requests=[
                {"filter_id": "region", "search": "10%_O'Brien/\\", "limit": 1}
            ]
        ),
    )
    assert _available(summaries[0]).status == "complete"
    context = native_query["contexts"][0]
    assert context.queries[0].filter == [
        {"col": "region", "op": "ILIKE", "val": "10%_O'Brien/\\", "is_literal": True}
    ]
    assert context.queries[0].orderby == []
    assert context.queries[0].row_limit == 2


@pytest.mark.parametrize(
    "dialect", [sqlite.dialect(), postgresql.dialect(), mysql.dialect()]
)
def test_literal_search_compiles_with_engine_escaping(dialect: Any) -> None:
    """Supported SQLAlchemy dialects keep wildcard/escape characters literal."""
    expression = build_like_predicate(column("region", String), "100%_O'Brien/\\")
    compiled = str(
        expression.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )
    assert "ESCAPE '/'" in compiled
    assert "/_o''brien//" in compiled


def test_literal_search_executes_exact_substring_on_sqlite() -> None:
    """A wildcard-bearing request matches only the literal substring."""
    engine = create_engine("sqlite://")
    with engine.connect() as connection:
        connection.execute(text("create table sales (region text)"))
        connection.execute(
            text("insert into sales values (:value)"),
            [{"value": v} for v in ["10%_O'Brien/\\", "10xx_O'Brien/\\", "other"]],
        )
        expression = build_like_predicate(column("region", String), "10%_O'Brien/\\")
        values = (
            connection.execute(
                select(column("region")).select_from(text("sales")).where(expression)
            )
            .scalars()
            .all()
        )
    assert values == ["10%_O'Brien/\\"]


def test_search_numeric_is_unsupported_without_query(
    native_query: dict[str, Any],
) -> None:
    """Search never casts numeric domains to string."""
    summaries, meta = choices.discover_filter_values(
        _dashboard(_filter("amount")),
        _request(filter_value_requests=[{"filter_id": "amount", "search": "1"}]),
    )
    assert _available(summaries[0]).reason == "unsupported_search"
    assert meta.query_count == 0


def test_saved_predicates_sort_and_transitive_parents(
    native_query: dict[str, Any],
) -> None:
    """Only configured ancestors filter the dropdown; self and nonparents do not."""
    parent = _filter(defaultDataMask=_mask(["Americas"]))
    middle = _filter(
        "country", cascadeParentIds=["region"], defaultDataMask=_mask(["France"])
    )
    target = _filter(
        "amount",
        cascadeParentIds=["country"],
        time_range="2020-01-01 : 2021-01-01",
        granularity_sqla="date",
        adhoc_filters=[
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "enabled",
                "operator": "==",
                "comparator": True,
            }
        ],
        controlValues={"sortMetric": "count", "sortAscending": False},
    )
    native_query["rows"][:] = [{"amount": 9}]
    snapshot = {"dataMask": {"amount": _mask([1]), "enabled": _mask([False])}}
    summaries, _ = choices.discover_filter_values(
        _dashboard(parent, middle, target, _filter("enabled")),
        _request(filter_value_requests=[{"filter_id": "amount"}]),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).status == "complete"
    query = native_query["contexts"][0].queries[0]
    assert query.filter == [
        {"col": "enabled", "op": "==", "val": True},
        {"col": "region", "op": "IN", "val": ["Americas"], "is_literal": True},
        {"col": "country", "op": "IN", "val": ["France"], "is_literal": True},
    ]
    assert query.time_range == "2020-01-01 : 2021-01-01"
    assert query.granularity == "date"
    assert query.metrics[0] == "count"
    assert query.metrics[1]["aggregate"] == "COUNT"
    assert query.orderby == [("count", False)]
    assert snapshot["dataMask"]["amount"]["filterState"]["value"] == [1]


@pytest.mark.parametrize(
    ("required", "loaded", "expected"),
    [
        (False, None, ["Default"]),
        (False, _mask([]), []),
        (True, _mask([]), ["Default"]),
        (True, _mask([None]), ["Default"]),
        (True, _mask(["Loaded"]), ["Default"]),
        (True, _mask(["Loaded"], filters=[{"untrusted": True}]), ["Loaded"]),
    ],
)
def test_snapshot_hydration_matches_required_default_restoration(
    native_query: dict[str, Any],
    required: bool,
    loaded: dict[str, Any] | None,
    expected: list[str],
) -> None:
    """Required incomplete states restore defaults; optional explicit clears remain."""
    parent = _filter(
        controlValues={"enableEmptyFilter": required},
        defaultDataMask=_mask(
            ["Default"], filters=[{"col": "region", "op": "IN", "val": ["Default"]}]
        ),
    )
    child = _filter("country", cascadeParentIds=["region"])
    native_query["rows"][:] = [{"country": "France"}]
    snapshot = {"dataMask": {"region": loaded} if loaded is not None else {}}
    summaries, _ = choices.discover_filter_values(
        _dashboard(parent, child),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).status == "complete"
    assert native_query["contexts"][0].queries[0].filter == (
        [{"col": "region", "op": "IN", "val": expected, "is_literal": True}]
        if expected
        else []
    )


def test_required_explicit_clear_is_regenerated_and_caller_sql_not_copied(
    native_query: dict[str, Any],
) -> None:
    """Canonical match-nothing evidence survives hydration without trusting SQL."""
    parent = _filter(
        controlValues={"enableEmptyFilter": True}, defaultDataMask=_mask(["Default"])
    )
    child = _filter("country", cascadeParentIds=["region"])
    clear = _mask(
        [],
        adhoc_filters=[
            {
                "expressionType": "SQL",
                "clause": "WHERE",
                "sqlExpression": EMPTY_FILTER_SQL_EXPRESSION,
            },
            {
                "expressionType": "SQL",
                "clause": "WHERE",
                "sqlExpression": "dangerous()",
            },
        ],
    )
    native_query["rows"][:] = []
    summaries, _ = choices.discover_filter_values(
        _dashboard(parent, child),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"region": clear}},
    )
    assert _available(summaries[0]).status == "complete"
    query = native_query["contexts"][0].queries[0]
    assert EMPTY_FILTER_SQL_EXPRESSION in query.extras["where"]
    assert "dangerous" not in query.extras["where"]


@pytest.mark.parametrize("reason", ["state_missing", "state_invalid"])
def test_bad_whole_snapshot_never_falls_back(
    native_query: dict[str, Any], reason: Literal["state_missing", "state_invalid"]
) -> None:
    """An invalid trusted/supplied snapshot yields no default-backed queries."""
    summaries, meta = choices.discover_filter_values(
        _dashboard(), _request(), state_error=reason
    )
    assert _available(summaries[0]).reason == reason
    assert meta.query_count == 0
    native_query["run"].assert_not_called()


@pytest.mark.parametrize("parents", [["missing"], ["country"], "region"])
def test_broken_parent_graph_is_unavailable(
    native_query: dict[str, Any], parents: Any
) -> None:
    """Missing nodes, cycles and malformed parent lists fail closed."""
    summaries, meta = choices.discover_filter_values(
        _dashboard(_filter("country", cascadeParentIds=parents)), _request()
    )
    assert _available(summaries[0]).reason == "parent_unresolved"
    assert meta.query_count == 0


def test_first_item_parent_without_resolved_state_is_unavailable(
    native_query: dict[str, Any],
) -> None:
    """The server does not guess a dynamic default-to-first parent."""
    summaries, _ = choices.discover_filter_values(
        _dashboard(
            _filter(
                controlValues={"defaultToFirstItem": True},
                defaultDataMask={"filterState": {}},
            ),
            _filter("country", cascadeParentIds=["region"]),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
    )
    assert _available(summaries[0]).reason == "parent_unresolved"


def test_proposed_parent_preview_is_validated_and_read_only(
    native_query: dict[str, Any],
) -> None:
    """A child can discover EMEA choices while the immutable snapshot has Americas."""
    snapshot = {"dataMask": {"region": _mask(["Americas"])}}
    before = deepcopy(snapshot)
    native_query["run"].side_effect = [
        {"queries": [{"data": [{"region": "EMEA"}]}]},
        {"queries": [{"data": [{"country": "France"}]}]},
    ]
    summaries, meta = choices.discover_filter_values(
        _dashboard(_filter(), _filter("country", cascadeParentIds=["region"])),
        _request(
            filter_value_requests=[{"filter_id": "country"}],
            proposed_filter_values=[{"filter_id": "region", "values": ["EMEA"]}],
        ),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).values == ["France"]
    assert meta.validated_proposed_filter_values[0].values == ["EMEA"]
    assert meta.query_count == 2
    assert snapshot == before
    second_context = native_query["run"].call_args_list[1].args[0].query_context
    assert second_context.queries[0].filter == [
        {"col": "region", "op": "IN", "val": ["EMEA"], "is_literal": True}
    ]


def test_invalid_proposal_blocks_only_dependents(native_query: dict[str, Any]) -> None:
    """Unproven parents do not mutate state or hide unrelated successful choices."""
    native_query["run"].side_effect = [
        {"queries": [{"data": []}]},
        {"queries": [{"data": [{"enabled": True}]}]},
    ]
    summaries, meta = choices.discover_filter_values(
        _dashboard(
            _filter(),
            _filter("country", cascadeParentIds=["region"]),
            _filter("enabled"),
        ),
        _request(
            filter_value_requests=[{"filter_id": "country"}, {"filter_id": "enabled"}],
            proposed_filter_values=[{"filter_id": "region", "values": ["unknown"]}],
        ),
    )
    assert _available(summaries[0]).reason == "proposal_invalid"
    assert _available(summaries[1]).values == [True]
    assert meta.validated_proposed_filter_values == []
    assert meta.query_count == 2


def test_proposed_clear_authorizes_without_running_parent_query(
    native_query: dict[str, Any],
) -> None:
    """Clears require native authorization but spend no dataset-query attempt."""
    native_query["rows"][:] = [{"country": "France"}]
    summaries, meta = choices.discover_filter_values(
        _dashboard(_filter(), _filter("country", cascadeParentIds=["region"])),
        _request(
            filter_value_requests=[{"filter_id": "country"}],
            proposed_filter_values=[{"filter_id": "region", "values": []}],
        ),
    )
    assert _available(summaries[0]).status == "complete"
    authorized = [
        call.kwargs["query_context"]
        for call in native_query["authorize"].call_args_list
    ]
    assert [context.form_data["native_filter_id"] for context in authorized] == [
        "region",
        "region",
        "country",
        "country",
    ]
    parent_context = authorized[1]
    assert parent_context.queries[0].extras["preserve_literal_values"] is True
    assert parent_context.queries[0].filter == [
        {"col": "region", "op": "IN", "val": [], "is_literal": True}
    ]
    assert authorized[3] is native_query["contexts"][0]
    assert authorized[3].queries[0].columns == ["country"]
    assert meta.query_count == 1
    assert meta.validated_proposed_filter_values[0].values == []


@pytest.mark.parametrize(
    "conf",
    [
        _filter(filterType="filter_time"),
        _filter(targets=[]),
        _filter(targets=[{}, {}]),
        _filter(targets=[{"datasetId": "5", "column": {"name": "region"}}]),
        _filter(
            targets=[
                {
                    "datasetId": 5,
                    "datasourceType": "semantic_view",
                    "column": {"name": "region"},
                }
            ]
        ),
        _filter(controlValues={"inverseSelection": True}),
        _filter(controlValues={"operatorType": "ilike_contains"}),
    ],
)
def test_unsupported_native_variants_do_not_query(
    native_query: dict[str, Any], conf: dict[str, Any]
) -> None:
    """Unsupported saved variants are explicit empty failures, not finite domains."""
    summaries, meta = choices.discover_filter_values(_dashboard(conf), _request())
    assert _available(summaries[0]).status == "unsupported"
    assert _available(summaries[0]).values == []
    assert meta.query_count == 0


@pytest.mark.parametrize(
    "value",
    [
        float("nan"),
        float("inf"),
        {"bad": 1},
        [1],
        Decimal("1.0000000000000000001"),
        "bad\ud800",
    ],
)
def test_invalid_database_scalar_makes_listing_incomplete(
    native_query: dict[str, Any], value: Any
) -> None:
    """Unsupported scalars are never skipped while reporting a complete domain."""
    native_query["rows"][:] = [{"region": "Bikes"}, {"region": value}]
    summaries, _ = choices.discover_filter_values(_dashboard(), _request())
    assert _available(summaries[0]).reason == "invalid_scalar"
    assert _available(summaries[0]).values == ["Bikes"]
    assert _available(summaries[0]).status == "truncated"


def test_row_limit_and_lower_server_cap(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """A cap that cannot prove exhaustion is truncated even below requested limit."""
    mocker.patch.dict(current_app.config, {"SQL_MAX_ROW": 1})
    summaries, _ = choices.discover_filter_values(_dashboard(), _request())
    assert _available(summaries[0]).status == "truncated"
    assert _available(summaries[0]).reason == "row_limit"
    assert _available(summaries[0]).values == ["Bikes"]


def test_query_failures_count_against_budget(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Failures are attempts and additional filters never exceed the shared cap."""
    mocker.patch.object(choices, "_MAX_QUERIES", 1)
    native_query["run"].side_effect = RuntimeError("secret database details")
    summaries, meta = choices.discover_filter_values(
        _dashboard(_filter(), _filter("country")), _request()
    )
    assert [_available(s).reason for s in summaries] == [
        "query_failed",
        "query_budget",
    ]
    assert meta.query_count == 1
    assert "secret" not in str(summaries)


def test_scheduling_budget_includes_metadata_time(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Elapsed metadata time prevents scheduling a first dataset query."""
    mocker.patch.object(choices.time, "monotonic", return_value=20)
    summaries, meta = choices.discover_filter_values(
        _dashboard(), _request(), started_at=1
    )
    assert _available(summaries[0]).reason == "scheduling_budget"
    assert meta.query_count == 0
    native_query["authorize"].assert_not_called()


def test_permission_denied_before_cache_or_query(native_query: dict[str, Any]) -> None:
    """Native QueryContext validation runs even when a cache might be warm."""
    native_query["authorize"].side_effect = SupersetSecurityException(
        SupersetError(
            message="private",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    summaries, meta = choices.discover_filter_values(_dashboard(), _request())
    assert _available(summaries[0]).reason == "permission_denied"
    assert meta.query_count == 0
    native_query["run"].assert_not_called()


def test_pages_and_explicit_ids_retain_order(native_query: dict[str, Any]) -> None:
    """Definition pages and explicit IDs bypass generic list caps."""
    configs = [_filter(f"f{i}", targets=_filter()["targets"]) for i in range(47)]
    dashboard = _dashboard(*configs, {"id": "divider", "type": "DIVIDER"})
    summaries, meta = choices.discover_filter_values(
        dashboard, _request(filter_values_offset=20)
    )
    assert [s.id for s in summaries] == [f"f{i}" for i in range(20, 40)]
    assert (meta.total_filter_count, meta.offset, meta.next_offset) == (47, 20, 40)
    summaries, meta = choices.discover_filter_values(
        dashboard,
        _request(filter_value_requests=[{"filter_id": "f46"}, {"filter_id": "f21"}]),
    )
    assert [s.id for s in summaries] == ["f46", "f21"]
    assert meta.offset is None
    assert meta.next_offset is None
    summaries, meta = choices.discover_filter_values(
        dashboard, _request(filter_values_offset=47)
    )
    assert summaries == []
    assert meta.next_offset is None
    assert meta.query_count == 0


@pytest.mark.parametrize("column_name", ["region", "amount"])
@pytest.mark.parametrize("guest", [False, True])
@pytest.mark.parametrize("granted", [False, True])
def test_real_native_authorization_dashboard_grant(
    native_query: dict[str, Any],
    mocker: MockerFixture,
    guest: bool,
    granted: bool,
    column_name: str,
) -> None:
    """Viewer and guest grants traverse the real native QueryContext access path."""
    from superset.extensions import appbuilder
    from superset.security.manager import SupersetSecurityManager

    dashboard = _dashboard(_filter(column_name))
    native_query["rows"][:] = [{column_name: "Bikes" if column_name == "region" else 1}]
    security = SupersetSecurityManager(appbuilder)
    for name in (
        "can_access",
        "can_access_schema",
        "_semantic_layer_grant_allows",
        "is_editor",
    ):
        mocker.patch.object(security, name, return_value=False)
    mocker.patch.object(security, "is_viewer", return_value=True)
    mocker.patch.object(security, "is_guest_user", return_value=guest)
    mocker.patch.object(security, "get_current_guest_user_if_guest", return_value=None)
    grant = mocker.patch.object(security, "can_access_dashboard", return_value=granted)
    mocker.patch("superset.is_feature_enabled", return_value=True)
    mocker.patch.dict(current_app.config, {"VIEWER_PROMISCUOUS_MODE": True})
    query = mocker.MagicMock()
    query.return_value.filter.return_value.one_or_none.return_value = dashboard
    mocker.patch("superset.db.session.query", query)
    mocker.patch.object(
        SupersetSecurityManager,
        "session",
        new_callable=mocker.PropertyMock,
        return_value=mocker.MagicMock(query=query),
    )
    native_query["authorize"].side_effect = security.raise_for_access
    summaries, meta = choices.discover_filter_values(dashboard, _request())
    grant.assert_called_with(dashboard)
    assert _available(summaries[0]).status == ("complete" if granted else "unavailable")
    assert meta.query_count == (1 if granted else 0)
    if not granted:
        assert _available(summaries[0]).reason == "permission_denied"


@pytest.mark.parametrize("allowed", [[5], [6]])
def test_guest_dataset_allowlist_is_enforced(
    native_query: dict[str, Any], mocker: MockerFixture, allowed: list[int]
) -> None:
    """Guest dashboard grants cannot bypass an explicit token dataset allowlist."""
    from superset.extensions import appbuilder
    from superset.security.manager import SupersetSecurityManager

    security = SupersetSecurityManager(appbuilder)
    dashboard = _dashboard()
    mocker.patch.object(security, "is_guest_user", return_value=True)
    mocker.patch.object(security, "can_access_schema", return_value=True)
    mocker.patch.object(
        security,
        "get_current_guest_user_if_guest",
        return_value=Mock(guest_token={"datasets": allowed}),
    )
    query = mocker.patch("superset.db.session.query")
    query.return_value.filter.return_value.one_or_none.return_value = dashboard
    native_query["authorize"].side_effect = security.raise_for_access
    summaries, meta = choices.discover_filter_values(dashboard, _request())
    assert _available(summaries[0]).status == (
        "complete" if allowed == [5] else "unavailable"
    )
    assert meta.query_count == (1 if allowed == [5] else 0)


def test_native_query_cache_keys_include_effective_rls(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Identical choices under distinct RLS scopes cannot share QueryContext cache."""
    choices.discover_filter_values(_dashboard(), _request())
    context = native_query["contexts"][0]
    mocker.patch.object(SqlaTable, "get_extra_cache_keys", return_value=[])
    rls = mocker.patch(
        "superset.security_manager.get_rls_cache_key", return_value=["region = 'EMEA'"]
    )
    first = context._processor.query_cache_key(context.queries[0])
    rls.return_value = ["region = 'Americas'"]
    second = context._processor.query_cache_key(context.queries[0])
    assert first != second


@pytest.mark.parametrize(
    "search",
    ["{{ 7 * 7 }}", "{% set x = 7 %}", "10%_O'Brien/\\", "\n whitespace\t", "<NULL>"],
)
def test_structured_literal_search_never_executes_jinja(
    native_query: dict[str, Any], mocker: MockerFixture, search: str
) -> None:
    """Literal searches remain values through SQL construction with templates on."""
    from superset.extensions import feature_flag_manager

    mocker.patch.object(feature_flag_manager, "is_feature_enabled", return_value=True)
    choices.discover_filter_values(
        _dashboard(),
        _request(filter_value_requests=[{"filter_id": "region", "search": search}]),
    )
    query = native_query["contexts"][0].queries[0]
    dataset = native_query["dataset"]
    result = dataset.get_sqla_query(
        columns=["region"],
        metrics=[],
        extras={},
        filter=query.filter,
        granularity=None,
        is_timeseries=False,
        orderby=[],
    )
    compiled = str(
        result.sqla_query.compile(
            dialect=sqlite.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert (
        search.replace("/", "//")
        .replace("%", "/%")
        .replace("_", "/_")
        .replace("'", "''")
        in compiled
    )
    assert "ESCAPE '/'" in compiled


@pytest.mark.parametrize(
    "value", ["\nBikes\t", "<NULL>", "<empty string>", "{{ 7 * 7 }}"]
)
def test_exact_and_parent_scalar_survive_sql_construction(
    native_query: dict[str, Any], value: str
) -> None:
    """Exact probes and parent selections bypass legacy whitespace/sentinel coercion."""
    choices.discover_filter_values(
        _dashboard(_filter(), _filter("country", cascadeParentIds=["region"])),
        _request(
            filter_value_requests=[{"filter_id": "country", "exact_value": value}]
        ),
        snapshot_state={"dataMask": {"region": _mask([value])}},
    )
    query = native_query["contexts"][0].queries[0]
    result = native_query["dataset"].get_sqla_query(
        columns=["country"],
        metrics=[],
        extras={},
        filter=query.filter,
        granularity=None,
        is_timeseries=False,
        orderby=[],
    )
    compiled = str(
        result.sqla_query.compile(
            dialect=sqlite.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert compiled.count("'" + value.replace("'", "''") + "'") == 2


def test_proposal_mixed_numbers_and_null_compile_as_typed_membership(
    native_query: dict[str, Any],
) -> None:
    """Mixed numeric lists retain fractional values and explicit SQL null membership."""
    dataset = native_query["dataset"]
    result = dataset.get_sqla_query(
        columns=["amount"],
        metrics=[],
        extras={},
        filter=[
            {"col": "amount", "op": "IN", "val": [1, 1.5, None], "is_literal": True}
        ],
        granularity=None,
        is_timeseries=False,
        orderby=[],
    )
    compiled = str(
        result.sqla_query.compile(
            dialect=sqlite.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert "amount IS NULL" in compiled
    assert "amount IN (1, 1.5)" in compiled


@pytest.mark.parametrize(
    "mask",
    [
        {"filterState": []},
        {"extraFormData": []},
        {"filterState": {"value": [float("nan")]}},
        {"filterState": {"value": {"unsafe": True}}},
    ],
)
def test_malformed_snapshot_entry_rejects_whole_snapshot(
    native_query: dict[str, Any], mask: dict[str, Any]
) -> None:
    """Malformed containers and non-JSON values invalidate the whole snapshot."""
    summaries, meta = choices.discover_filter_values(
        _dashboard(), _request(), snapshot_state={"dataMask": {"region": mask}}
    )
    assert _available(summaries[0]).reason == "state_invalid"
    assert meta.query_count == 0


@pytest.mark.parametrize("cap", [0, -1, "bad"])
def test_bad_native_row_cap_never_falls_back_to_default(
    native_query: dict[str, Any], mocker: MockerFixture, cap: Any
) -> None:
    """A nonpositive configured cap cannot trigger QueryObject's default limit."""
    mocker.patch.dict(current_app.config, {"NATIVE_FILTER_DEFAULT_ROW_LIMIT": cap})
    summaries, meta = choices.discover_filter_values(_dashboard(), _request())
    assert _available(summaries[0]).status == "unavailable"
    assert meta.query_count == 0


@pytest.mark.parametrize("value", [[], [None], None])
def test_explicit_first_item_parent_clear_is_resolved(
    native_query: dict[str, Any], value: Any
) -> None:
    """An explicitly defined value suppresses native default-to-first behavior."""
    native_query["rows"][:] = [{"country": "France"}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(
            _filter(controlValues={"defaultToFirstItem": True}),
            _filter("country", cascadeParentIds=["region"]),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"region": _mask(value)}},
    )
    assert _available(summaries[0]).status == "complete"


@pytest.mark.parametrize("value", [float("nan"), float("inf"), 2**60])
def test_dataframe_scalars_are_checked_before_chart_json_conversion(
    native_query: dict[str, Any], mocker: MockerFixture, value: Any
) -> None:
    """Raw dataframe inspection detects nonfinite values and preserves large ints."""
    import pandas as pd

    from superset.common.query_context import QueryContext

    # Restore the production acquisition adapter, mocking only the dataframe cache.
    mocker.stop(native_query["run"])
    mocker.patch.object(
        QueryContext,
        "get_df_payload",
        return_value={
            "df": pd.DataFrame({"amount": [value], "__mcp_native_nonnull_count": [1]}),
            "status": "success",
        },
    )
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("amount")), _request()
    )
    available = _available(summaries[0])
    assert available.reason == "invalid_scalar"
    assert available.values == []


def test_executed_native_query_search_respects_rls_saved_predicate_and_parent(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Full-domain search reaches beyond a sample without escaping native/RLS scope."""
    from types import SimpleNamespace

    dataset = native_query["dataset"]
    mocker.patch(
        "superset.security_manager.get_rls_filters",
        return_value=[SimpleNamespace(clause="amount > 0", group_key=None)],
    )
    engine = create_engine("sqlite://")
    special = "ZZ O'Brien & Sons, Ltd. 10%_{{ 7 * 7 }}"
    with engine.begin() as connection:
        connection.execute(
            text(
                "create table sales (region text, country text, "
                "amount integer, enabled boolean)"
            )
        )
        records = [
            {"region": "EMEA", "country": f"A{i:02}", "amount": 1, "enabled": True}
            for i in range(40)
        ]
        records += [
            {"region": "EMEA", "country": special, "amount": 1, "enabled": True},
            {"region": "EMEA", "country": "RLS hidden", "amount": 0, "enabled": True},
            {
                "region": "EMEA",
                "country": "Saved hidden",
                "amount": 1,
                "enabled": False,
            },
            {
                "region": "Americas",
                "country": "Parent hidden",
                "amount": 1,
                "enabled": True,
            },
        ]
        connection.execute(
            text("insert into sales values (:region, :country, :amount, :enabled)"),
            records,
        )

        def execute(command: ChartDataCommand, **kwargs: Any) -> dict[str, Any]:
            """Execute the real native QueryObject and datasource RLS SQL in SQLite."""
            query = command.query_context.queries[0]
            built = dataset.get_sqla_query(
                columns=query.columns,
                metrics=query.metrics,
                extras=query.extras,
                filter=query.filter,
                granularity=query.granularity,
                is_timeseries=False,
                row_limit=query.row_limit,
                orderby=query.orderby,
            )
            rows = [
                dict(row) for row in connection.execute(built.sqla_query).mappings()
            ]
            return {"queries": [{"data": rows}]}

        native_query["run"].side_effect = execute
        dashboard = _dashboard(
            _filter(),
            _filter(
                "country",
                cascadeParentIds=["region"],
                adhoc_filters=[
                    {
                        "expressionType": "SIMPLE",
                        "clause": "WHERE",
                        "subject": "enabled",
                        "operator": "==",
                        "comparator": True,
                    }
                ],
            ),
        )
        snapshot = {"dataMask": {"region": _mask(["EMEA"]), "country": _mask(["A00"])}}
        listed, _ = choices.discover_filter_values(
            dashboard,
            _request(filter_value_requests=[{"filter_id": "country"}]),
            snapshot_state=snapshot,
        )
        assert _available(listed[0]).status == "truncated"
        assert special not in _available(listed[0]).values
        found, _ = choices.discover_filter_values(
            dashboard,
            _request(
                filter_value_requests=[
                    {"filter_id": "country", "search": "10%_{{ 7 * 7 }}"}
                ]
            ),
            snapshot_state=snapshot,
        )
        assert _available(found[0]).status == "complete"
        assert _available(found[0]).values == [special]
        for hidden in ["RLS hidden", "Saved hidden", "Parent hidden"]:
            absent, _ = choices.discover_filter_values(
                dashboard,
                _request(
                    filter_value_requests=[
                        {"filter_id": "country", "exact_value": hidden}
                    ]
                ),
                snapshot_state=snapshot,
            )
            assert _available(absent[0]).status == "complete"
            assert _available(absent[0]).values == []


def test_numeric_sql_null_is_distinguished_from_nonfinite(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """COUNT evidence restores SQL null while preserving invalid database NaN."""
    import pandas as pd

    from superset.common.query_context import QueryContext

    mocker.stop(native_query["run"])
    mocker.patch.object(
        QueryContext,
        "get_df_payload",
        return_value={
            "df": pd.DataFrame(
                {"amount": [float("nan"), 1.5], "__mcp_native_nonnull_count": [0, 1]}
            ),
            "status": "success",
        },
    )
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("amount")), _request()
    )
    assert _available(summaries[0]).status == "complete"
    assert _available(summaries[0]).values == [None, 1.5]


def test_memory_truncation_cannot_claim_complete(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Datasource truncation evidence is honored even with fewer rows than the cap."""
    import pandas as pd

    from superset.common.query_context import QueryContext

    mocker.stop(native_query["run"])
    mocker.patch.object(
        QueryContext,
        "get_df_payload",
        return_value={
            "df": pd.DataFrame({"region": ["Bikes"]}),
            "status": "success",
            "warning": "Results truncated due to memory constraints",
        },
    )
    summaries, _ = choices.discover_filter_values(_dashboard(), _request())
    assert _available(summaries[0]).status == "truncated"
    assert _available(summaries[0]).reason == "row_limit"


def test_nullable_unsafe_integer_is_omitted_without_losing_null(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Normalization cannot round a nullable integer before exact scalar inspection."""
    import pandas as pd

    from superset.common.query_context import QueryContext

    mocker.stop(native_query["run"])
    value = 2**53 + 1

    def acquire(context: QueryContext, query: Any) -> dict[str, Any]:
        """Run the datasource's real normalization on Arrow-style nullable integers."""
        frame = pd.DataFrame(
            {
                "amount": pd.Series([value, None], dtype=object),
                "__mcp_native_nonnull_count": [1, 0],
            }
        )
        return {
            "df": native_query["dataset"].normalize_df(frame, query),
            "status": "success",
        }

    mocker.patch.object(
        QueryContext, "get_df_payload", autospec=True, side_effect=acquire
    )
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("amount")), _request()
    )
    assert _available(summaries[0]).reason == "invalid_scalar"
    assert _available(summaries[0]).values == [None]
    assert _available(summaries[0]).status == "truncated"


def test_native_dataframe_normalization_preserves_nonfinite_for_rejection(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """The normal chart infinity-to-null conversion cannot hide an invalid option."""
    import pandas as pd

    from superset.common.query_context import QueryContext

    mocker.stop(native_query["run"])

    def acquire(context: QueryContext, query: Any) -> dict[str, Any]:
        """Run real datasource normalization before choice validation."""
        frame = pd.DataFrame(
            {"amount": [float("inf")], "__mcp_native_nonnull_count": [1]}
        )
        return {
            "df": native_query["dataset"].normalize_df(frame, query),
            "status": "success",
        }

    mocker.patch.object(
        QueryContext, "get_df_payload", autospec=True, side_effect=acquire
    )
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("amount")), _request()
    )
    assert _available(summaries[0]).reason == "invalid_scalar"


@pytest.mark.parametrize("engine_name", ["databricks", "spark"])
@pytest.mark.parametrize(
    ("operator", "value"), [("==", True), ("==", False), ("IN", [False, True, None])]
)
def test_literal_boolean_filters_preserve_engine_sql_literals(
    native_query: dict[str, Any],
    mocker: MockerFixture,
    engine_name: str,
    operator: str,
    value: Any,
) -> None:
    """Strict booleans retain the native SQL true/false engine adaptation."""
    from superset.db_engine_specs.databricks import DatabricksBaseEngineSpec
    from superset.db_engine_specs.spark import SparkEngineSpec

    engine_spec = (
        DatabricksBaseEngineSpec if engine_name == "databricks" else SparkEngineSpec
    )
    mocker.patch.object(Database, "get_db_engine_spec", return_value=engine_spec)
    dataset = native_query["dataset"]
    result = dataset.get_sqla_query(
        columns=["enabled"],
        metrics=[],
        extras={},
        filter=[{"col": "enabled", "op": operator, "val": value, "is_literal": True}],
        granularity=None,
        is_timeseries=False,
        orderby=[],
    )
    compiled = result.sqla_query.whereclause.compile()
    assert compiled.params == {}
    if operator == "IN":
        assert "enabled IN (false, true)" in str(compiled)
        assert "enabled IS NULL" in str(compiled)
    else:
        assert ("enabled = true" if value else "enabled = false") in str(compiled)


def test_numeric_null_evidence_metric_executes_as_native_grouped_query(
    native_query: dict[str, Any],
) -> None:
    """The internal COUNT metric preserves the option groups and proves SQL null."""
    choices.discover_filter_values(_dashboard(_filter("amount")), _request())
    query = native_query["contexts"][0].queries[0]
    dataset = native_query["dataset"]
    compiled = dataset.get_sqla_query(
        columns=query.columns,
        metrics=query.metrics,
        extras=query.extras,
        filter=query.filter,
        granularity=None,
        is_timeseries=False,
        row_limit=query.row_limit,
        orderby=query.orderby,
    )
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("create table sales (amount numeric)"))
        connection.execute(text("insert into sales values (NULL), (1.5), (1.5)"))
        rows = [dict(row) for row in connection.execute(compiled.sqla_query).mappings()]
    assert rows == [
        {"amount": None, "__mcp_native_nonnull_count": 0},
        {"amount": 1.5, "__mcp_native_nonnull_count": 2},
    ]


@pytest.mark.parametrize(
    ("filter_type", "value"),
    [
        ("filter_select", "Bikes"),
        ("filter_select", 1),
        ("filter_select", True),
        ("filter_range", [1]),
        ("filter_range", [True, 3]),
        ("filter_time", ["Last year"]),
        ("filter_timegrain", "P1D"),
        ("filter_timegrain", [1]),
        ("filter_timegrain", ["P1D", "P1M"]),
    ],
)
@pytest.mark.parametrize("self_selection", [False, True])
def test_type_changed_snapshot_shape_is_local_stale_state(
    native_query: dict[str, Any], filter_type: str, value: Any, self_selection: bool
) -> None:
    """Valid scalar state from an older control type cannot invalidate siblings."""
    filter_id = "region" if self_selection else "country"
    dashboard = _dashboard(_filter(), _filter("country"))
    configs = choices.current_native_filter_config(dashboard)
    configs[0 if self_selection else 1]["filterType"] = filter_type
    dashboard.json_metadata = json.dumps({"native_filter_configuration": configs})
    summaries, metadata = choices.discover_filter_values(
        dashboard,
        _request(filter_value_requests=[{"filter_id": "region"}]),
        snapshot_state={"dataMask": {filter_id: {"filterState": {"value": value}}}},
    )
    unsupported = self_selection and filter_type != "filter_select"
    assert _available(summaries[0]).reason == (
        "unsupported_filter" if unsupported else None
    )
    assert metadata.query_count == (0 if unsupported else 1)


@pytest.mark.parametrize(
    ("filter_id", "values"),
    [("amount", [True]), ("amount", ["01.5"]), ("enabled", [1]), ("region", [1])],
)
@pytest.mark.parametrize("self_selection", [False, True])
def test_own_and_unrelated_stale_selections_do_not_constrain_dropdowns(
    native_query: dict[str, Any],
    filter_id: str,
    values: list[Any],
    self_selection: bool,
) -> None:
    """Own and unrelated selections never enter a dropdown's option query."""
    dashboard = _dashboard(_filter(filter_id), _filter("country"))
    requested = filter_id if self_selection else "country"
    native_query["rows"][:] = [
        {
            requested: 1
            if requested == "amount"
            else True
            if requested == "enabled"
            else "France"
        }
    ]
    summaries, metadata = choices.discover_filter_values(
        dashboard,
        _request(filter_value_requests=[{"filter_id": requested}]),
        snapshot_state={"dataMask": {filter_id: _mask(values)}},
    )
    assert _available(summaries[0]).reason is None
    assert metadata.query_count == 1


def test_reversed_range_in_nonparent_snapshot_does_not_constrain_dropdown(
    native_query: dict[str, Any],
) -> None:
    """A stale unrelated range selection cannot restrict the requested dropdown."""
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter(), _filter("amount", filterType="filter_range")),
        _request(filter_value_requests=[{"filter_id": "region"}]),
        snapshot_state={"dataMask": {"amount": _mask([2, 1])}},
    )
    assert _available(summaries[0]).reason is None
    assert metadata.query_count == 1


def test_private_flags_are_injected_after_public_schema_validation(
    native_query: dict[str, Any],
) -> None:
    """Ordinary chart callers cannot request internal native materialization modes."""
    from marshmallow import ValidationError

    from superset.charts.schemas import ChartDataExtrasSchema, ChartDataFilterSchema

    with pytest.raises(ValidationError, match="Unknown field"):
        ChartDataFilterSchema().load(
            {"col": "region", "op": "IN", "val": "bad", "is_literal": True}
        )
    with pytest.raises(ValidationError, match="Unknown field"):
        ChartDataExtrasSchema().load({"preserve_literal_values": True})
    choices.discover_filter_values(
        _dashboard(),
        _request(
            filter_value_requests=[{"filter_id": "region", "exact_value": " Bikes "}]
        ),
    )
    query = native_query["contexts"][0].queries[0]
    query.validate()
    assert query.filter[-1]["is_literal"] is True
    assert query.extras["preserve_literal_values"] is True
    literal_key = query.cache_key()
    query.filter[-1].pop("is_literal")
    assert query.cache_key() != literal_key


@pytest.mark.parametrize("proposal", [False, True])
def test_resource_tool_errors_propagate(
    native_query: dict[str, Any], proposal: bool
) -> None:
    """BUSY and other resource ToolErrors retain the MCP-wide retry contract."""
    from fastmcp.exceptions import ToolError

    native_query["run"].side_effect = ToolError("BUSY: retry later")
    with pytest.raises(ToolError, match="BUSY"):
        choices.discover_filter_values(
            _dashboard(_filter(), _filter("country", cascadeParentIds=["region"])),
            _request(
                filter_value_requests=[{"filter_id": "country"}],
                **(
                    {
                        "proposed_filter_values": [
                            {"filter_id": "region", "values": ["EMEA"]}
                        ]
                    }
                    if proposal
                    else {}
                ),
            ),
        )


def test_query_error_is_not_an_invalid_proposal(
    native_query: dict[str, Any], caplog: pytest.LogCaptureFixture
) -> None:
    """Operational proposal failures retain a retryable reason and diagnostic log."""
    native_query["run"].side_effect = RuntimeError("warehouse unavailable")
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter(), _filter("country", cascadeParentIds=["region"])),
        _request(
            filter_value_requests=[{"filter_id": "country"}],
            proposed_filter_values=[{"filter_id": "region", "values": ["EMEA"]}],
        ),
    )
    assert _available(summaries[0]).reason == "query_failed"
    assert "Native filter proposal query failed" in caplog.text


def test_numeric_proposals_compare_by_json_number_family(
    native_query: dict[str, Any],
) -> None:
    """A JS integer selection is a member of an equivalent FLOAT dropdown group."""
    native_query["run"].side_effect = [
        {"queries": [{"data": [{"amount": 2020.0}]}]},
        {"queries": [{"data": [{"country": "France"}]}]},
    ]
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter("amount"), _filter("country", cascadeParentIds=["amount"])),
        _request(
            filter_value_requests=[{"filter_id": "country"}],
            proposed_filter_values=[{"filter_id": "amount", "values": [2020]}],
        ),
    )
    assert _available(summaries[0]).values == ["France"]
    assert metadata.validated_proposed_filter_values[0].values == [2020]
    assert not choices._scalar_equal(True, 1)


@pytest.mark.parametrize("value", [2**53, -(2**53), float(2**53), 10**1000])
@pytest.mark.parametrize("proposal", [False, True])
def test_unsafe_integral_probes_fail_closed_before_execution(
    native_query: dict[str, Any], value: Any, proposal: bool
) -> None:
    """Lossy browser-bound numbers never produce an authoritative empty match."""
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter("amount"), _filter("country", cascadeParentIds=["amount"])),
        _request(
            filter_value_requests=[{"filter_id": "country"}]
            if proposal
            else [{"filter_id": "amount", "exact_value": value}],
            **(
                {"proposed_filter_values": [{"filter_id": "amount", "values": [value]}]}
                if proposal
                else {}
            ),
        ),
    )
    assert _available(summaries[0]).reason == "invalid_scalar"
    assert metadata.query_count == 0


@pytest.mark.parametrize("value", ["1", "1.5", "1e2", "-1.5", str(2**53 - 1)])
def test_canonical_numeric_snapshot_strings_are_normalized_losslessly(
    native_query: dict[str, Any], value: str
) -> None:
    """Browser creatable numeric selections recover their exact numeric predicate."""
    native_query["rows"][:] = [{"country": "France"}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("amount"), _filter("country", cascadeParentIds=["amount"])),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"amount": _mask([value])}},
    )
    assert _available(summaries[0]).status == "complete"
    actual = native_query["contexts"][0].queries[0].filter[0]["val"][0]
    assert Decimal(str(actual)) == Decimal(value)


@pytest.mark.parametrize("value", [str(2**53), "1.00000000000000000001", "1e9999"])
def test_unsafe_numeric_snapshot_only_blocks_affected_descendants(
    native_query: dict[str, Any], value: str
) -> None:
    """Unsafe historical selections never fall back to defaults or hide siblings."""
    native_query["rows"][:] = [{"region": "EMEA"}]
    summaries, metadata = choices.discover_filter_values(
        _dashboard(
            _filter("amount"),
            _filter("country", cascadeParentIds=["amount"]),
            _filter(),
        ),
        _request(
            filter_value_requests=[{"filter_id": "country"}, {"filter_id": "region"}]
        ),
        snapshot_state={"dataMask": {"amount": _mask([value])}},
    )
    assert _available(summaries[0]).reason == "invalid_scalar"
    assert _available(summaries[1]).values == ["EMEA"]
    assert metadata.query_count == 1


def test_deleted_snapshot_filters_are_ignored(native_query: dict[str, Any]) -> None:
    """Old permalink masks may retain deleted controls without changing live scope."""
    summaries, _ = choices.discover_filter_values(
        _dashboard(),
        _request(),
        snapshot_state={"dataMask": {"NATIVE_FILTER-deleted": _mask(["old"])}},
    )
    assert _available(summaries[0]).status == "complete"


@pytest.mark.parametrize(
    "controls", [{"inverseSelection": True}, {"operatorType": "contains"}]
)
def test_empty_unsupported_select_parent_does_not_block_child(
    native_query: dict[str, Any], controls: dict[str, Any]
) -> None:
    """An unsupported unselected control contributes the frontend's no-op mask."""
    native_query["rows"][:] = [{"country": "France"}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(
            _filter(controlValues=controls),
            _filter("country", cascadeParentIds=["region"]),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"region": _mask([])}},
    )
    assert _available(summaries[0]).status == "complete"
    assert native_query["contexts"][0].queries[0].filter == []


@pytest.mark.parametrize("search", ["École", "İ", "Σ"])
def test_unicode_search_does_not_claim_false_completeness(
    native_query: dict[str, Any], search: str
) -> None:
    """Unverified Unicode case behavior is explicit; exact Unicode probes still work."""
    summaries, metadata = choices.discover_filter_values(
        _dashboard(),
        _request(filter_value_requests=[{"filter_id": "region", "search": search}]),
    )
    assert _available(summaries[0]).reason == "unsupported_search"
    assert metadata.query_count == 0


def test_native_sqlserver_search_escapes_wildcard_classes() -> None:
    """SQL Server '[' is literal alongside percent, underscore and escape chars."""
    from sqlalchemy.dialects import mssql

    from superset.db_engine_specs.mssql import MssqlEngineSpec
    from superset.models.helpers import build_native_like_predicate

    expr = build_native_like_predicate(
        column("region", String), "A[^b]%_\\/", MssqlEngineSpec
    )
    compiled = str(
        expr.compile(dialect=mssql.dialect(), compile_kwargs={"literal_binds": True})
    )
    assert "lower('%A/[^b]/%/_\\//%')" in compiled
    assert "ESCAPE '/'" in compiled


def test_native_bigquery_search_has_no_like_escape_layer() -> None:
    """BigQuery STRPOS takes trailing backslashes as data, not LIKE escapes."""
    from sqlalchemy_bigquery import BigQueryDialect

    from superset.db_engine_specs.bigquery import BigQueryEngineSpec
    from superset.models.helpers import build_native_like_predicate

    expr = build_native_like_predicate(
        column("region", String), "A%_\\", BigQueryEngineSpec
    )
    compiled = expr.compile(dialect=BigQueryDialect())
    assert "strpos(lower(`region`), lower(" in str(compiled)
    assert "LIKE" not in str(compiled)
    assert "A%_\\" in compiled.params.values()


def test_real_sqlite_acquisition_guest_rls_and_boolean_options(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Actual guest token scope reaches SQLite, dataframe normalization and cache."""
    from collections.abc import Iterator
    from contextlib import contextmanager

    from flask import g
    from flask_caching import Cache
    from sqlalchemy.engine import Engine

    from superset.common.query_context import QueryContext
    from superset.common.utils import query_cache_manager
    from superset.constants import CacheRegion
    from superset.extensions import appbuilder, cache_manager
    from superset.models.embedded_dashboard import EmbeddedDashboard
    from superset.security.guest_token import GuestTokenResourceType, GuestUser
    from superset.security.manager import SupersetSecurityManager

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                "create table sales (region text, country text, "
                "amount integer, enabled boolean)"
            )
        )
        connection.execute(
            text(
                "insert into sales values ('EMEA', 'France', 1, 1), "
                "('EMEA', 'Hidden', 0, 0), ('Americas', 'US', 1, 0)"
            )
        )
    dashboard = _dashboard(
        _filter(), _filter("country", cascadeParentIds=["region"]), _filter("enabled")
    )
    dashboard.embedded = [EmbeddedDashboard()]
    guest = GuestUser(
        {
            "user": {"username": "native-guest"},
            "resources": [{"type": GuestTokenResourceType.DASHBOARD, "id": "1"}],
            "rls_rules": [{"dataset": "5", "clause": "amount > 0"}],
            "datasets": [5],
            "iat": 0,
            "exp": 9999999999,
        },
        [],
    )
    mocker.patch.object(g, "user", guest, create=True)
    mocker.patch("superset.is_feature_enabled", return_value=True)
    mocker.patch(
        "superset.connectors.sqla.models.is_feature_enabled",
        side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
    )
    security = SupersetSecurityManager(appbuilder)
    for name in (
        "can_access",
        "can_access_schema",
        "_semantic_layer_grant_allows",
        "is_editor",
    ):
        mocker.patch.object(security, name, return_value=False)
    mocker.patch.object(security, "get_rls_filters", return_value=[])
    for name in (
        "get_rls_filters",
        "get_guest_rls_filters",
        "get_guest_rls_filters_str",
        "get_rls_cache_key",
    ):
        mocker.patch(
            f"superset.security_manager.{name}", side_effect=getattr(security, name)
        )
    query = mocker.patch("superset.db.session.query")
    query.return_value.filter.return_value.one_or_none.return_value = dashboard
    native_query["authorize"].side_effect = security.raise_for_access
    mocker.stop(native_query["run"])

    @contextmanager
    def sqla_engine(*args: Any, **kwargs: Any) -> Iterator[Engine]:
        """Keep database query construction on the populated SQLite connection."""
        yield engine

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Iterator[Any]:
        """Expose the real DB-API connection to normal Superset acquisition."""
        with engine.connect() as connection:
            yield connection.connection

    mocker.patch.object(Database, "get_sqla_engine", side_effect=sqla_engine)
    mocker.patch.object(Database, "get_raw_connection", side_effect=raw_connection)
    mocker.patch.object(SqlaTable, "get_extra_cache_keys", return_value=[])
    data_cache = Cache(config={"CACHE_TYPE": "SimpleCache"})
    data_cache.init_app(current_app)
    mocker.patch.object(cache_manager, "_data_cache", data_cache)
    mocker.patch.dict(query_cache_manager._cache, {CacheRegion.DATA: data_cache})
    acquisition = mocker.spy(QueryContext, "get_df_payload")
    database_reads = mocker.spy(Database, "get_df")
    snapshot = {"dataMask": {"region": _mask(["EMEA"])}}
    request = _request(
        filter_value_requests=[{"filter_id": "country"}, {"filter_id": "enabled"}]
    )
    summaries, metadata = choices.discover_filter_values(
        dashboard, request, snapshot_state=snapshot
    )
    assert _available(summaries[0]).values == ["France"]
    assert _available(summaries[1]).values == [False, True]
    assert metadata.query_count == 2
    assert acquisition.call_count == 2
    first_keys = [
        call.args[0]._processor.query_cache_key(call.args[1])
        for call in acquisition.call_args_list
    ]
    assert database_reads.call_count == 2
    cached, _ = choices.discover_filter_values(
        dashboard, request, snapshot_state=snapshot
    )
    assert _available(cached[0]).values == ["France"]
    assert acquisition.spy_return["is_cached"] is True
    assert database_reads.call_count == 2
    guest.rls[0]["clause"] = "amount = 0"
    acquisition.reset_mock()
    restricted, _ = choices.discover_filter_values(
        dashboard, request, snapshot_state=snapshot
    )
    assert _available(restricted[0]).values == ["Hidden"]
    assert _available(restricted[1]).values == [False]
    second_keys = [
        call.args[0]._processor.query_cache_key(call.args[1])
        for call in acquisition.call_args_list
    ]
    assert first_keys != second_keys
    guest.guest_token["datasets"] = [6]
    acquisition.reset_mock()
    denied, metadata = choices.discover_filter_values(
        dashboard, request, snapshot_state=snapshot
    )
    assert all(_available(summary).reason == "permission_denied" for summary in denied)
    assert metadata.query_count == 0
    acquisition.assert_not_called()
    denied_preview, metadata = choices.discover_filter_values(
        dashboard,
        _request(
            filter_value_requests=[{"filter_id": "country"}],
            proposed_filter_values=[{"filter_id": "region", "values": ["EMEA"]}],
        ),
        snapshot_state=snapshot,
    )
    assert _available(denied_preview[0]).reason == "permission_denied"
    assert metadata.validated_proposed_filter_values == []
    assert metadata.query_count == 0
    acquisition.assert_not_called()
    data_cache.clear()
    engine.dispose()


def test_valid_proposal_replaces_stale_parent_selection(
    native_query: dict[str, Any],
) -> None:
    """Explicit valid previews can repair stale typed selections in the cloned state."""
    native_query["run"].side_effect = [
        {"queries": [{"data": [{"amount": 1.0}]}]},
        {"queries": [{"data": [{"country": "France"}]}]},
    ]
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter("amount"), _filter("country", cascadeParentIds=["amount"])),
        _request(
            filter_value_requests=[{"filter_id": "country"}],
            proposed_filter_values=[{"filter_id": "amount", "values": [1]}],
        ),
        snapshot_state={"dataMask": {"amount": _mask(["old invalid value"])}},
    )
    assert _available(summaries[0]).values == ["France"]
    assert metadata.validated_proposed_filter_values[0].values == [1]


def test_cross_dataset_parent_retains_native_numeric_coercion(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """A string parent can constrain a numeric same-named column in another dataset."""
    parent_dataset = native_query["dataset"]
    child_dataset = SqlaTable(
        id=6, table_name="child_sales", database=parent_dataset.database
    )
    child_dataset.columns = [
        TableColumn(column_name="region", type="INTEGER"),
        TableColumn(column_name="country", type="VARCHAR"),
    ]
    mocker.patch.object(
        choices.DatasetDAO,
        "find_by_id",
        side_effect=lambda dataset_id, **kwargs: parent_dataset
        if dataset_id == 5
        else child_dataset,
    )
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource",
        return_value=child_dataset,
    )
    native_query["rows"][:] = [{"country": "France"}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(
            _filter(),
            _filter(
                "country",
                cascadeParentIds=["region"],
                targets=[{"datasetId": 6, "column": {"name": "country"}}],
            ),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"region": _mask(["5"])}},
    )
    assert _available(summaries[0]).values == ["France"]
    query = native_query["contexts"][0].queries[0]
    assert "is_literal" not in query.filter[0]
    built = child_dataset.get_sqla_query(
        columns=query.columns,
        metrics=query.metrics,
        filter=query.filter,
        extras=query.extras,
        granularity=None,
        is_timeseries=False,
        row_limit=query.row_limit,
    )
    compiled = str(
        built.sqla_query.compile(
            dialect=sqlite.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert "region IN (5)" in compiled
    assert "region IN ('5')" not in compiled
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text("create table child_sales (region integer, country text)")
        )
        connection.execute(
            text("insert into child_sales values (5, 'France'), (6, 'Hidden')")
        )
        assert connection.execute(built.sqla_query).scalars().all() == ["France"]
    engine.dispose()


@pytest.mark.parametrize("scope", ["standalone", "missing_entry", "required_restore"])
def test_numeric_defaults_are_normalized_after_hydration(
    native_query: dict[str, Any], scope: str
) -> None:
    """Default and restored creatable values receive lossless typed hydration."""
    native_query["rows"][:] = [{"country": "France"}]
    parent = _filter(
        "amount",
        controlValues={"enableEmptyFilter": scope == "required_restore"},
        defaultDataMask=_mask(["1.5"]),
    )
    snapshot: dict[str, Any] | None = (
        None if scope == "standalone" else {"dataMask": {}}
    )
    if scope == "required_restore":
        snapshot = {"dataMask": {"amount": _mask([])}}
    summaries, _ = choices.discover_filter_values(
        _dashboard(parent, _filter("country", cascadeParentIds=["amount"])),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).values == ["France"]
    assert native_query["contexts"][0].queries[0].filter[0]["val"] == [1.5]


@pytest.mark.parametrize("values", [[True], [1, 2]])
@pytest.mark.parametrize("loaded_has_predicate", [False, True])
def test_required_restoration_precedes_effective_selection_validation(
    native_query: dict[str, Any], values: list[Any], loaded_has_predicate: bool
) -> None:
    """Frontend restoration repairs empty-extra state before validating its values."""
    native_query["rows"][:] = [{"country": "France"}]
    parent = _filter(
        "amount",
        controlValues={"enableEmptyFilter": True, "multiSelect": False},
        defaultDataMask=_mask([1], filters=[{"col": "amount", "op": "IN", "val": [1]}]),
    )
    loaded = _mask(values)
    if loaded_has_predicate:
        loaded["extraFormData"] = {
            "filters": [{"col": "amount", "op": "IN", "val": values}]
        }
    summaries, metadata = choices.discover_filter_values(
        _dashboard(parent, _filter("country", cascadeParentIds=["amount"])),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"amount": loaded}},
    )
    if loaded_has_predicate:
        assert _available(summaries[0]).reason == "state_invalid"
        assert metadata.query_count == 0
    else:
        assert _available(summaries[0]).values == ["France"]
        assert native_query["contexts"][0].queries[0].filter[0]["val"] == [1]


@pytest.fixture
def sqlite_native_execution(
    native_query: dict[str, Any], mocker: MockerFixture
) -> Iterator[dict[str, Any]]:
    """Run real dataframe acquisition against a populated SQLite datasource."""
    from collections.abc import Iterator
    from contextlib import contextmanager

    from sqlalchemy.engine import Engine

    native_query["dataset"].columns.append(
        TableColumn(column_name="visited", type="TIMESTAMP", is_dttm=True)
    )
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                "create table sales (region text, country text, amount integer, "
                "enabled boolean, visited timestamp)"
            )
        )
        connection.execute(
            text(
                "insert into sales values ('EMEA', 'France', 1, 1, '2020-06-01'), "
                "('EMEA', 'Germany', 2, 1, '2020-07-01'), "
                "('EMEA', 'Old', 3, 0, '2010-01-01'), "
                "('Americas', 'US', NULL, 0, '2020-08-01')"
            )
        )

    @contextmanager
    def sqla_engine(*args: Any, **kwargs: Any) -> Iterator[Engine]:
        """Use the populated engine for compilation and acquisition."""
        yield engine

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Iterator[Any]:
        """Use real DB-API execution under the normal Superset dataframe path."""
        with engine.connect() as connection:
            yield connection.connection

    mocker.stop(native_query["run"])
    mocker.patch.object(Database, "get_sqla_engine", side_effect=sqla_engine)
    mocker.patch.object(Database, "get_raw_connection", side_effect=raw_connection)
    mocker.patch.object(SqlaTable, "get_extra_cache_keys", return_value=[])
    mocker.patch("superset.security_manager.get_rls_filters", return_value=[])
    mocker.patch("superset.security_manager.get_guest_rls_filters", return_value=[])
    native_query["database_reads"] = mocker.spy(Database, "get_df")
    native_query["engine"] = engine
    yield native_query
    engine.dispose()


def _time_prefilter() -> dict[str, Any]:
    """Represent the native editor's saved Time column plus temporal pre-filter."""
    return {
        "granularity_sqla": "visited",
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "visited",
                "operator": "TEMPORAL_RANGE",
                "comparator": "2020-01-01 : 2021-01-01",
            }
        ],
    }


@pytest.mark.parametrize("mode", ["list", "contains", "exact", "proposal"])
def test_temporal_prefilter_survives_real_native_query_factory(
    sqlite_native_execution: dict[str, Any], mode: str
) -> None:
    """Factory removal of saved temporal clauses cannot misattach literal predicates."""
    target = _filter("country", **_time_prefilter())
    options: dict[str, Any] = {}
    request_options: dict[str, Any] = {}
    if mode == "contains":
        options["search"] = "Fran"
    elif mode == "exact":
        options["exact_value"] = "France"
    if mode == "proposal":
        dashboard = _dashboard(target, _filter("region", cascadeParentIds=["country"]))
        filter_id = "region"
        request_options["proposed_filter_values"] = [
            {"filter_id": "country", "values": ["France"]}
        ]
    else:
        dashboard, filter_id = _dashboard(target), "country"
    summaries, metadata = choices.discover_filter_values(
        dashboard,
        _request(
            filter_value_requests=[{"filter_id": filter_id, **options}],
            **request_options,
        ),
    )
    assert _available(summaries[0]).status == "complete"
    assert _available(summaries[0]).values == (
        ["France", "Germany", "US"]
        if mode == "list"
        else ["EMEA"]
        if mode == "proposal"
        else ["France"]
    )
    assert metadata.query_count == (2 if mode == "proposal" else 1)
    assert sqlite_native_execution["database_reads"].call_count == metadata.query_count


def test_numeric_options_execute_real_dataframe_path_and_keep_sql_null(
    sqlite_native_execution: dict[str, Any],
) -> None:
    """Native COUNT evidence and raw normalization preserve numeric values and NULL."""
    with sqlite_native_execution["engine"].begin() as connection:
        connection.execute(
            text(
                "insert into sales values "
                "('EMEA', 'Unsafe', 9007199254740993, 1, '2020-06-01')"
            )
        )
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter("amount")), _request()
    )
    available = _available(summaries[0])
    assert available.values == [None, 1, 2, 3]
    assert available.status == "truncated"
    assert available.reason == "invalid_scalar"
    assert metadata.query_count == 1
    exact, _ = choices.discover_filter_values(
        _dashboard(_filter("amount")),
        _request(filter_value_requests=[{"filter_id": "amount", "exact_value": 2}]),
    )
    assert _available(exact[0]).values == [2]
    assert type(_available(exact[0]).values[0]) is int


@pytest.mark.parametrize(
    "parent_type", ["filter_range", "filter_time", "filter_timegrain"]
)
def test_typed_parent_controls_execute_real_native_dataframe_query(
    sqlite_native_execution: dict[str, Any], parent_type: str
) -> None:
    """Range, time and grain parents enter the same real native acquisition path."""
    value: Any = (
        [1, 2]
        if parent_type == "filter_range"
        else "2020-01-01 : 2021-01-01"
        if parent_type == "filter_time"
        else ["P1D"]
    )
    parent = _filter(
        "parent",
        filterType=parent_type,
        targets=[
            {
                "datasetId": 5,
                "column": {
                    "name": "amount" if parent_type == "filter_range" else "visited"
                },
            }
        ],
        defaultDataMask={"filterState": {"value": value}, "extraFormData": {}},
    )
    summaries, _ = choices.discover_filter_values(
        _dashboard(
            parent,
            _filter("country", cascadeParentIds=["parent"], granularity_sqla="visited"),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
    )
    assert _available(summaries[0]).status == "complete"
    assert _available(summaries[0]).values == (
        ["France", "Germany"]
        if parent_type == "filter_range"
        else ["France", "Germany", "US"]
        if parent_type == "filter_time"
        else ["France", "Germany", "Old", "US"]
    )
    assert sqlite_native_execution["database_reads"].call_count == 1


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
@pytest.mark.parametrize(
    ("url_params", "expected"),
    [
        (None, ["US"]),
        ([["market", "EMEA"]], ["France", "Germany", "Old"]),
        (
            [["market", "Americas"], None, ["market", "EMEA"]],
            ["France", "Germany", "Old"],
        ),
    ],
)
def test_virtual_dataset_url_param_renders_snapshot_url_params(
    sqlite_native_execution: dict[str, Any],
    url_params: list[Any] | None,
    expected: list[str],
) -> None:
    """Dropdown SQL sees the dashboard's URL parameters, as the browser sends them."""
    sqlite_native_execution[
        "dataset"
    ].sql = (
        'select * from sales where region = \'{{ url_param("market", "Americas") }}\''
    )
    snapshot: dict[str, Any] = {"dataMask": {}}
    if url_params is not None:
        snapshot["urlParams"] = url_params
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("country")),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).status == "complete"
    assert _available(summaries[0]).values == expected
    assert "form_data" not in g


_COUNTRY_SEARCH_MACRO_SQL = [
    "select * from sales where 1 = 1 "
    "{% for f in get_filters('country', remove_filter=True) %}"
    "and country like '{{ f.get(\"val\") }}' {% endfor %}",
    "select * from sales where 1 = 1 "
    "{% for f in get_filters('country') %}"
    "and country like '{{ f.get(\"val\") }}' {% endfor %}",
]


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
@pytest.mark.parametrize("sql", _COUNTRY_SEARCH_MACRO_SQL)
def test_search_consumed_by_jinja_filter_macro_is_unsupported(
    sqlite_native_execution: dict[str, Any], sql: str
) -> None:
    """Jinja sees the raw search text, so its rows cannot prove completeness."""
    sqlite_native_execution["dataset"].sql = sql
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("country")),
        _request(filter_value_requests=[{"filter_id": "country", "search": "Fran"}]),
    )
    assert _available(summaries[0]).status == "unsupported"
    assert _available(summaries[0]).reason == "unsupported_search"
    assert _available(summaries[0]).values == []


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
def test_search_on_virtual_dataset_without_filter_macro_is_complete(
    sqlite_native_execution: dict[str, Any],
) -> None:
    """Virtual SQL that does not read the searched column keeps literal search."""
    sqlite_native_execution["dataset"].sql = (
        "select * from sales where 1 = 1 "
        "{% for f in get_filters('region') %}and 1 = 0 {% endfor %}"
    )
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("country")),
        _request(filter_value_requests=[{"filter_id": "country", "search": "Fran"}]),
    )
    assert _available(summaries[0]).status == "complete"
    assert _available(summaries[0]).values == ["France"]


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
def test_virtual_dataset_time_filter_macro_sees_cascading_time_parent(
    sqlite_native_execution: dict[str, Any],
) -> None:
    """A parent time range reaches get_time_filter in the child's virtual SQL."""
    sqlite_native_execution["dataset"].sql = (
        "select * from sales where visited >= "
        '\'{{ get_time_filter(default="1900-01-01 : 2100-01-01", '
        'strftime="%Y-%m-%d").from_expr }}\''
    )
    parent = _filter(
        "parent",
        filterType="filter_time",
        targets=[{"datasetId": 5}],
        defaultDataMask={
            "filterState": {"value": "2020-01-01 : 2021-01-01"},
            "extraFormData": {},
        },
    )
    summaries, _ = choices.discover_filter_values(
        _dashboard(parent, _filter("country", cascadeParentIds=["parent"])),
        _request(filter_value_requests=[{"filter_id": "country"}]),
    )
    assert _available(summaries[0]).status == "complete"
    assert _available(summaries[0]).values == ["France", "Germany", "US"]


@pytest.mark.parametrize(
    ("parent_type", "extra"),
    [
        ("filter_time", {"time_range": "Last year"}),
        (
            "filter_range",
            {"filters": [{"col": "amount", "op": ">=", "val": 2}]},
        ),
        ("filter_timegrain", {"time_grain_sqla": "P1D"}),
    ],
)
def test_typed_parent_predicates_without_value_are_unresolved(
    native_query: dict[str, Any], parent_type: str, extra: dict[str, Any]
) -> None:
    """Predicates lacking a typed value are not read as an unfiltered parent."""
    parent = _filter("parent", filterType=parent_type)
    summaries, _ = choices.discover_filter_values(
        _dashboard(parent, _filter("country", cascadeParentIds=["parent"])),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={
            "dataMask": {"parent": {"filterState": {}, "extraFormData": extra}}
        },
    )
    assert _available(summaries[0]).status == "unavailable"
    assert _available(summaries[0]).reason == "parent_unresolved"
    native_query["run"].assert_not_called()


@pytest.mark.parametrize(
    "url_params",
    ["market=EMEA", [["market"]], [["market", 1]], [{"market": "EMEA"}]],
)
def test_malformed_url_params_invalidate_the_snapshot(
    native_query: dict[str, Any], url_params: Any
) -> None:
    """Caller-supplied URL parameters must be key-value string pairs."""
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("country")),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {}, "urlParams": url_params},
    )
    assert _available(summaries[0]).reason == "state_invalid"
    native_query["run"].assert_not_called()


@pytest.mark.parametrize("sentinel", [float("inf"), 2**53, "bad\ud800"])
def test_unrepresentable_row_limit_sentinel_only_marks_row_truncation(
    native_query: dict[str, Any], sentinel: Any
) -> None:
    """The extra row is never normalized or exposed as an option."""
    native_query["rows"][:] = [{"region": "Bikes"}, {"region": sentinel}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(),
        _request(filter_value_requests=[{"filter_id": "region", "limit": 1}]),
    )
    available = _available(summaries[0])
    assert available.values == ["Bikes"]
    assert available.status == "truncated"
    assert available.reason == "row_limit"


@pytest.mark.parametrize(
    "snapshot",
    [
        {},
        {"urlParams": []},
        {"dataMask": None},
        {"dataMask": None, "urlParams": [["standalone", "1"]]},
        {"activeTabs": [None, "TAB-1"], "anchor": None, "chartStates": None},
        {"urlParams": [None, [None, None]], "chartStates": {"1": {}}},
    ],
)
def test_missing_datamask_hydrates_saved_defaults(
    native_query: dict[str, Any], snapshot: dict[str, Any]
) -> None:
    """Permalink state may omit dataMask while still being a valid snapshot."""
    native_query["rows"][:] = [{"country": "France"}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(
            _filter(defaultDataMask=_mask(["EMEA"])),
            _filter("country", cascadeParentIds=["region"]),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).values == ["France"]
    assert native_query["contexts"][0].queries[0].filter[0]["val"] == ["EMEA"]


@pytest.mark.parametrize("values", [[1], [0], [True], [False]])
def test_boolean_browser_snapshot_values_are_normalized(
    native_query: dict[str, Any], values: list[Any]
) -> None:
    """SQLite browser 0/1 selections become strict booleans only for BOOLEAN targets."""
    native_query["rows"][:] = [{"country": "France"}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(
            _filter("enabled"), _filter("country", cascadeParentIds=["enabled"])
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"enabled": _mask(values)}},
    )
    assert _available(summaries[0]).values == ["France"]
    actual = native_query["contexts"][0].queries[0].filter[0]["val"][0]
    assert type(actual) is bool
    assert actual is bool(values[0])


def test_type_changed_selection_only_blocks_descendants(
    native_query: dict[str, Any],
) -> None:
    """A historical select value cannot become a range predicate or hide siblings."""
    native_query["rows"][:] = [{"region": "EMEA"}]
    summaries, metadata = choices.discover_filter_values(
        _dashboard(
            _filter("amount", filterType="filter_range"),
            _filter("country", cascadeParentIds=["amount"]),
            _filter(),
        ),
        _request(
            filter_value_requests=[{"filter_id": "country"}, {"filter_id": "region"}]
        ),
        snapshot_state={"dataMask": {"amount": _mask(["old selection"])}},
    )
    assert _available(summaries[0]).reason == "state_invalid"
    assert _available(summaries[1]).values == ["EMEA"]
    assert metadata.query_count == 1


def test_extreme_decimal_snapshot_does_not_abort_metadata_or_siblings(
    native_query: dict[str, Any],
) -> None:
    """Decimal arithmetic failures stay local to the affected cascade dependency."""
    native_query["rows"][:] = [{"region": "EMEA"}]
    summaries, metadata = choices.discover_filter_values(
        _dashboard(
            _filter("amount"),
            _filter("country", cascadeParentIds=["amount"]),
            _filter(),
        ),
        _request(
            filter_value_requests=[{"filter_id": "country"}, {"filter_id": "region"}]
        ),
        snapshot_state={"dataMask": {"amount": _mask(["1e999999999999999999"])}},
    )
    assert _available(summaries[0]).reason == "invalid_scalar"
    assert _available(summaries[1]).values == ["EMEA"]
    assert metadata.query_count == 1


@pytest.mark.parametrize(
    "filter_id,probe",
    [
        ("region", {"exact_value": 1}),
        ("region", {"exact_value": "one"}),
        ("amount", {"search": "one"}),
        ("visited", {"search": "one"}),
    ],
)
def test_denied_target_does_not_reveal_type_dependent_outcomes(
    native_query: dict[str, Any], filter_id: str, probe: dict[str, Any]
) -> None:
    """Native grants run before typed probes, search support or target-family errors."""
    native_query["dataset"].columns.append(
        TableColumn(column_name="visited", type="TIMESTAMP", is_dttm=True)
    )
    native_query["authorize"].side_effect = SupersetSecurityException(
        SupersetError(
            message="private",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter(filter_id)),
        _request(filter_value_requests=[{"filter_id": filter_id, **probe}]),
    )
    assert _available(summaries[0]).reason == "permission_denied"
    assert metadata.query_count == 0
    native_query["run"].assert_not_called()


def test_duplicate_predicates_only_reattach_the_server_literal(
    native_query: dict[str, Any],
) -> None:
    """Equal saved and appended predicates remain distinct after temporal rewrites."""
    native_query["dataset"].columns.append(
        TableColumn(column_name="visited", type="TIMESTAMP", is_dttm=True)
    )
    temporal = _time_prefilter()
    temporal["adhoc_filters"].append(
        {
            "expressionType": "SIMPLE",
            "clause": "WHERE",
            "subject": "region",
            "operator": "==",
            "comparator": "Bikes",
        }
    )
    choices.discover_filter_values(
        _dashboard(_filter(**temporal)),
        _request(
            filter_value_requests=[{"filter_id": "region", "exact_value": "Bikes"}]
        ),
    )
    predicates = native_query["contexts"][0].queries[0].filter
    assert len(predicates) == 2
    assert [predicate.get("is_literal", False) for predicate in predicates] == [
        False,
        True,
    ]


def test_missing_literal_after_factory_rewrite_fails_without_execution(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """A factory rewrite cannot silently remove an exact predicate and broaden scope."""
    from superset.common.query_context_factory import QueryContextFactory

    create = QueryContextFactory.create

    def remove_filters(factory: Any, *args: Any, **kwargs: Any) -> Any:
        """Simulate a factory normalization that removes the requested literal."""
        context = create(factory, *args, **kwargs)
        for query in context.queries:
            query.filter = []
        return context

    mocker.patch.object(
        QueryContextFactory, "create", autospec=True, side_effect=remove_filters
    )
    summaries, metadata = choices.discover_filter_values(
        _dashboard(),
        _request(
            filter_value_requests=[{"filter_id": "region", "exact_value": "Bikes"}]
        ),
    )
    assert _available(summaries[0]).reason == "query_not_executed"
    assert metadata.query_count == 0
    native_query["run"].assert_not_called()


@pytest.mark.parametrize("proposal", [False, True])
def test_preparation_errors_are_distinguished_from_execution_failures(
    native_query: dict[str, Any], mocker: MockerFixture, proposal: bool
) -> None:
    """Unexpected preparation errors do not claim an attempted warehouse query."""
    mocker.patch.object(
        choices, "_native_query", side_effect=TypeError("invalid configuration")
    )
    kwargs = (
        {"proposed_filter_values": [{"filter_id": "region", "values": ["EMEA"]}]}
        if proposal
        else {}
    )
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter(), _filter("country", cascadeParentIds=["region"])),
        _request(filter_value_requests=[{"filter_id": "country"}], **kwargs),
    )
    assert _available(summaries[0]).reason == "query_not_executed"
    assert metadata.query_count == 0


@pytest.mark.parametrize("redirect", [False, True])
@pytest.mark.parametrize("proposal", [False, True])
def test_oauth_errors_reach_the_tool_authentication_handler(
    native_query: dict[str, Any], redirect: bool, proposal: bool
) -> None:
    """Authentication failures retain the tool's OAuth handling."""
    from superset.exceptions import OAuth2Error, OAuth2RedirectError

    error = (
        OAuth2RedirectError(
            "https://example.test/auth", "tab", "https://example.test/return"
        )
        if redirect
        else OAuth2Error("expired")
    )
    native_query["run"].side_effect = error
    kwargs = (
        {"proposed_filter_values": [{"filter_id": "region", "values": ["EMEA"]}]}
        if proposal
        else {}
    )
    with pytest.raises(type(error)):
        choices.discover_filter_values(
            _dashboard(_filter(), _filter("country", cascadeParentIds=["region"])),
            _request(filter_value_requests=[{"filter_id": "country"}], **kwargs),
        )


@pytest.mark.parametrize(
    "snapshot",
    [
        {"applied_filters": [{"col": "region", "op": "IN", "val": ["EMEA"]}]},
        {"native_filter_values": [{"id": "region", "value": ["EMEA"]}]},
        {"native_filter_values": [], "native_filter_values_incomplete": False},
        {"native_filter_values_incomplete": True},
    ],
)
def test_summary_only_state_cannot_fall_back_to_saved_defaults(
    native_query: dict[str, Any], snapshot: dict[str, Any]
) -> None:
    """Redacted and aggregate metadata are not complete native selection snapshots."""
    summaries, metadata = choices.discover_filter_values(
        _dashboard(
            _filter(defaultDataMask=_mask(["EMEA"])),
            _filter("country", cascadeParentIds=["region"]),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).reason == "state_invalid"
    assert metadata.query_count == 0
    native_query["run"].assert_not_called()


@pytest.mark.parametrize(
    "snapshot",
    [
        {"region": _mask(["Americas"])},
        {"data_mask": {"region": _mask(["Americas"])}},
        {"filters": {"region": ["Americas"]}},
        {"unrelated": "state"},
        {"dataMask": None, "filters": []},
        {"urlParams": [["native_filters", "(region:Americas)"]]},
        {"urlParams": [["native_filters_key", "permalink-key"]]},
        {"dataMask": None, "urlParams": [["native_filters", ""]]},
        {"urlParams": {"native_filters": "(region:Americas)"}},
        {"urlParams": [["native_filters"]]},
        {"urlParams": ["native_filters"]},
        {"activeTabs": "TAB-1"},
        {"activeTabs": [1]},
        {"anchor": {"dataMask": {}}},
        {"chartStates": []},
    ],
)
def test_absent_datamask_rejects_unknown_or_encoded_selection_shapes(
    native_query: dict[str, Any], snapshot: dict[str, Any]
) -> None:
    """Unknown wrappers and URL selections never silently use default parents."""
    summaries, metadata = choices.discover_filter_values(
        _dashboard(
            _filter(defaultDataMask=_mask(["EMEA"])),
            _filter("country", cascadeParentIds=["region"]),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).reason == "state_invalid"
    assert metadata.query_count == 0
    native_query["authorize"].assert_not_called()
    native_query["run"].assert_not_called()


def test_explicit_datamask_is_authoritative_over_other_snapshot_fields(
    native_query: dict[str, Any],
) -> None:
    """A usable native mask wins over incidental or legacy permalink metadata."""
    native_query["rows"][:] = [{"country": "France"}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(
            _filter(defaultDataMask=_mask(["Americas"])),
            _filter("country", cascadeParentIds=["region"]),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={
            "dataMask": {"region": _mask(["EMEA"])},
            "urlParams": [["native_filters", "(region:Americas)"]],
            "filters": "legacy state",
        },
    )
    assert _available(summaries[0]).values == ["France"]
    assert native_query["contexts"][0].queries[0].filter[0]["val"] == ["EMEA"]


@pytest.mark.parametrize("limit", [2, 3, 4])
def test_result_set_int64_overflow_preserves_safe_numeric_options(
    native_query: dict[str, Any], mocker: MockerFixture, limit: int
) -> None:
    """Real Arrow fallback strings are repaired without exposing an unsafe integer."""
    from superset.common.query_context import QueryContext
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.result_set import SupersetResultSet

    frame = SupersetResultSet(
        [(1, 1), (2, 1), (2**63, 1)],
        [
            ("amount", "INTEGER", None, None, None, None, True),
            ("__mcp_native_nonnull_count", "INTEGER", None, None, None, None, False),
        ],
        SqliteEngineSpec,
    ).to_pandas_df()
    assert frame["amount"].tolist() == ["1", "2", str(2**63)]
    mocker.stop(native_query["run"])

    def acquire(context: QueryContext, query: Any) -> dict[str, Any]:
        """Exercise native dataframe normalization after the real ResultSet fallback."""
        return {
            "df": native_query["dataset"].normalize_df(frame.copy(), query),
            "status": "success",
        }

    mocker.patch.object(
        QueryContext, "get_df_payload", autospec=True, side_effect=acquire
    )
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("amount")),
        _request(filter_value_requests=[{"filter_id": "amount", "limit": limit}]),
    )
    available = _available(summaries[0])
    assert available.values == [1, 2]
    assert all(type(value) is int for value in available.values)
    assert available.status == "truncated"
    assert available.reason == ("row_limit" if limit == 2 else "invalid_scalar")


@pytest.mark.parametrize("value", ["01", "-0", "+1", "1.0", " 1", "1 ", "1e0"])
def test_numeric_driver_recovery_does_not_coerce_noncanonical_strings(
    native_query: dict[str, Any], value: str
) -> None:
    """Only the ResultSet integer representation can be recovered into a number."""
    native_query["rows"][:] = [{"amount": value}, {"amount": "2"}]
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("amount")), _request()
    )
    assert _available(summaries[0]).values == [2]
    assert _available(summaries[0]).reason == "invalid_scalar"


@pytest.mark.parametrize("row_cap", [False, True])
def test_row_limit_takes_precedence_over_omitted_unsafe_options(
    native_query: dict[str, Any], mocker: MockerFixture, row_cap: bool
) -> None:
    """An option sample cannot imply that invalid scalars are its sole omission."""
    native_query["rows"][:] = [
        {"amount": 1},
        {"amount": 2**53},
        {"amount": 2},
        {"amount": 3},
    ]
    if row_cap:
        mocker.patch.dict(current_app.config, {"SQL_MAX_ROW": 3})
        native_query["rows"].pop()
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter("amount")),
        _request(filter_value_requests=[{"filter_id": "amount", "limit": 3}]),
    )
    assert _available(summaries[0]).values == [1, 2]
    assert _available(summaries[0]).status == "truncated"
    assert _available(summaries[0]).reason == "row_limit"


@pytest.mark.parametrize("supplied", [False, True])
def test_extreme_range_integer_is_an_invalid_scalar(
    native_query: dict[str, Any], supplied: bool
) -> None:
    """Range math overflow is local scalar failure, not a failed query preparation."""
    values = [0, 10**400]
    summaries, metadata = choices.discover_filter_values(
        _dashboard(
            _filter("amount", filterType="filter_range", defaultDataMask=_mask(values)),
            _filter("country", cascadeParentIds=["amount"]),
        ),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"amount": _mask(values)}} if supplied else None,
    )
    assert _available(summaries[0]).reason == "invalid_scalar"
    assert metadata.query_count == 0
    native_query["run"].assert_not_called()


@pytest.mark.parametrize(
    "filter_type,value",
    [
        ("filter_range", [1]),
        ("filter_range", [2, 1]),
        ("filter_time", ["Last year"]),
        ("filter_timegrain", "P1D"),
    ],
)
@pytest.mark.parametrize("source", ["default", "missing_entry", "supplied", "restored"])
def test_bad_parent_state_reason_identifies_the_effective_selection_source(
    native_query: dict[str, Any], filter_type: str, value: Any, source: str
) -> None:
    """An inherited or restored broken default is not blamed on caller state."""
    parent = _filter("amount", filterType=filter_type, defaultDataMask=_mask(value))
    snapshot: dict[str, Any] | None = None
    if source == "missing_entry":
        snapshot = {"dataMask": {}}
    elif source == "supplied":
        snapshot = {"dataMask": {"amount": _mask(value)}}
    elif source == "restored":
        parent["controlValues"]["enableEmptyFilter"] = True
        snapshot = {"dataMask": {"amount": _mask(None)}}
    summaries, metadata = choices.discover_filter_values(
        _dashboard(parent, _filter("country", cascadeParentIds=["amount"])),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).reason == (
        "state_invalid" if source == "supplied" else "parent_unresolved"
    )
    assert metadata.query_count == 0


def test_prepared_configuration_reuses_target_authorization_with_final_query_gates(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Preflight grants are memoized; both executed query contexts are revalidated."""
    dashboard = _dashboard(_filter(), _filter("country", cascadeParentIds=["region"]))
    request = _request(
        filter_value_requests=[{"filter_id": "country", "exact_value": "France"}],
        proposed_filter_values=[{"filter_id": "region", "values": ["EMEA"]}],
    )
    native_query["run"].side_effect = [
        {"queries": [{"data": [{"region": "EMEA"}]}]},
        {"queries": [{"data": [{"country": "France"}]}]},
    ]
    configuration_reads = mocker.spy(choices, "_configured_filters")
    context = choices.validate_discovery_configuration(dashboard, request)
    summaries, metadata = choices.discover_filter_values(
        dashboard, request, discovery_context=context
    )
    assert _available(summaries[0]).values == ["France"]
    assert metadata.query_count == 2
    configuration_reads.assert_called_once_with(dashboard)
    authorized = [
        call.kwargs["query_context"]
        for call in native_query["authorize"].call_args_list
    ]
    assert [query.form_data["native_filter_id"] for query in authorized] == [
        "country",
        "region",
        "region",
        "country",
    ]
    assert [
        query.queries[0].extras.get("preserve_literal_values", False)
        for query in authorized
    ] == [False, False, True, True]


def test_query_budget_stops_authorization_before_the_next_filter(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Exhausting attempts prevents expensive preparation of subsequent dropdowns."""
    mocker.patch.object(choices, "_MAX_QUERIES", 1)
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter(), _filter("country")), _request()
    )
    assert _available(summaries[1]).reason == "query_budget"
    assert metadata.query_count == 1
    assert [
        call.kwargs["query_context"].form_data["native_filter_id"]
        for call in native_query["authorize"].call_args_list
    ] == ["region", "region"]


def test_elapsed_preflight_stops_later_authorization_and_acquisition(
    native_query: dict[str, Any], mocker: MockerFixture
) -> None:
    """Exact/proposal preflights share the scheduling deadline with actual queries."""
    clock = mocker.patch.object(choices.time, "monotonic", return_value=1)

    def authorize(*, query_context: Any) -> None:
        """Simulate a slow authorization using the call's monotonic deadline."""
        clock.return_value = 12

    native_query["authorize"].side_effect = authorize
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter(), _filter("country", cascadeParentIds=["region"])),
        _request(
            filter_value_requests=[{"filter_id": "country", "exact_value": "France"}],
            proposed_filter_values=[{"filter_id": "region", "values": ["EMEA"]}],
        ),
        started_at=1,
    )
    assert _available(summaries[0]).reason == "scheduling_budget"
    assert metadata.query_count == 0
    assert native_query["authorize"].call_count == 1
    native_query["run"].assert_not_called()


def test_own_and_unrelated_snapshots_do_not_trigger_parent_authorization(
    native_query: dict[str, Any],
) -> None:
    """Hydration checks shapes globally and reads types only for needed parents."""
    summaries, _ = choices.discover_filter_values(
        _dashboard(_filter(), _filter("amount"), _filter("enabled")),
        _request(filter_value_requests=[{"filter_id": "region"}]),
        snapshot_state={
            "dataMask": {
                "region": _mask(["self"]),
                "amount": _mask(["2"]),
                "enabled": _mask([1]),
            }
        },
    )
    assert _available(summaries[0]).values == ["Bikes"]
    assert [
        call.kwargs["query_context"].form_data["native_filter_id"]
        for call in native_query["authorize"].call_args_list
    ] == ["region", "region"]


@pytest.mark.parametrize("column_type", ["INTEGER", "VARCHAR"])
def test_denied_parent_snapshot_does_not_reveal_the_parent_column_family(
    native_query: dict[str, Any], column_type: str
) -> None:
    """Parent state is typed only after its own native target grant succeeds."""
    native_query["dataset"].columns[2].type = column_type

    def authorize(*, query_context: Any) -> None:
        """Allow the child's native target, but refuse access to its parent."""
        if query_context.form_data["native_filter_id"] == "amount":
            raise SupersetSecurityException(
                SupersetError(
                    message="private parent",
                    error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

    native_query["authorize"].side_effect = authorize
    summaries, metadata = choices.discover_filter_values(
        _dashboard(_filter("amount"), _filter("country", cascadeParentIds=["amount"])),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"amount": _mask(["x"])}},
    )
    assert _available(summaries[0]).reason == "permission_denied"
    assert metadata.query_count == 0
    native_query["run"].assert_not_called()


@pytest.fixture(params=["role", "guest"])
def restricted_parent_query(
    native_query: dict[str, Any], mocker: MockerFixture, request: pytest.FixtureRequest
) -> dict[str, Any]:
    """Authorize the child dataset through real role or guest security checks."""
    from flask import g
    from flask_appbuilder.security.sqla.models import Role, User

    from superset.extensions import appbuilder
    from superset.security.guest_token import GuestTokenResourceType, GuestUser
    from superset.security.manager import SupersetSecurityManager

    datasets = {5: native_query["dataset"]}
    datasets[5].perm = "child-dataset"
    for dataset_id in (6, 7):
        datasets[dataset_id] = SqlaTable(
            id=dataset_id,
            table_name=f"parent_{dataset_id}",
            database=datasets[5].database,
            perm=f"parent-dataset-{dataset_id}",
        )
        datasets[dataset_id].columns = [
            TableColumn(column_name="region", type="VARCHAR")
        ]
    mocker.patch.object(
        choices.DatasetDAO,
        "find_by_id",
        side_effect=lambda dataset_id, **kwargs: datasets[dataset_id],
    )
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource",
        side_effect=lambda datasource_type, database_id_or_uuid: datasets[
            int(database_id_or_uuid)
        ],
    )
    guest = request.param == "guest"
    principal: Any = (
        GuestUser(
            {
                "user": {"username": "child-viewer"},
                "resources": [{"type": GuestTokenResourceType.DASHBOARD, "id": "1"}],
                "rls_rules": [],
                "datasets": [5],
                "iat": 0,
                "exp": 9999999999,
            },
            [],
        )
        if guest
        else User(
            id=42, username="child-viewer", active=True, roles=[Role(name="Gamma")]
        )
    )
    mocker.patch.object(g, "user", principal, create=True)
    mocker.patch(
        "superset.is_feature_enabled",
        side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
    )
    security = SupersetSecurityManager(appbuilder)
    mocker.patch.object(
        security,
        "can_access",
        side_effect=lambda permission, resource: permission == "datasource_access"
        and (guest or resource == "child-dataset"),
    )
    for method in ("can_access_schema", "_semantic_layer_grant_allows", "is_editor"):
        mocker.patch.object(security, method, return_value=False)
    lookup = mocker.patch("superset.db.session.query")
    lookup.return_value.filter.return_value.one_or_none.return_value = (
        _restricted_parent_dashboard(transitive=True)
    )
    native_query["authorize"].side_effect = security.raise_for_access
    native_query["rows"][:] = [{"country": "France"}]
    # Prove the fixture actually refuses either parent independently of discovery.
    for dataset_id in (6, 7):
        with pytest.raises(SupersetSecurityException):
            security.raise_for_access(datasource=datasets[dataset_id])
    return native_query


def _restricted_parent_dashboard(
    *, transitive: bool, required: bool = False
) -> Dashboard:
    """Build a cascade whose ancestor datasets are absent from the child's grants."""
    parent = _filter(
        "region",
        targets=[{"datasetId": 6, "column": {"name": "region"}}],
        controlValues={"enableEmptyFilter": required},
    )
    middle = _filter(
        "middle",
        targets=[{"datasetId": 7, "column": {"name": "region"}}],
        cascadeParentIds=["region"],
    )
    return _dashboard(
        parent,
        *([middle] if transitive else []),
        _filter("country", cascadeParentIds=["middle" if transitive else "region"]),
    )


@pytest.mark.parametrize("transitive", [False, True])
@pytest.mark.parametrize("values", [None, []])
@pytest.mark.parametrize("required", [False, True])
def test_empty_parent_dataset_grants_do_not_block_authorized_descendants(
    restricted_parent_query: dict[str, Any],
    transitive: bool,
    values: list[Any] | None,
    required: bool,
) -> None:
    """Empty parents need no type lookup; required clears still mean match nothing."""
    mask = _mask(values)
    if required:
        mask["extraFormData"] = {
            "adhoc_filters": [
                {
                    "expressionType": "SQL",
                    "clause": "WHERE",
                    "sqlExpression": EMPTY_FILTER_SQL_EXPRESSION,
                }
            ]
        }
        restricted_parent_query["rows"][:] = []
    summaries, metadata = choices.discover_filter_values(
        _restricted_parent_dashboard(transitive=transitive, required=required),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"region": mask}},
    )
    available = _available(summaries[0])
    assert available.status == "complete", available
    assert available.values == ([] if required else ["France"])
    assert metadata.query_count == 1
    authorized = [
        call.kwargs["query_context"]
        for call in restricted_parent_query["authorize"].call_args_list
    ]
    assert [context.datasource.id for context in authorized] == [5, 5]
    assert authorized[-1] is restricted_parent_query["contexts"][0]
    query = authorized[-1].queries[0]
    assert query.filter == []
    assert (
        EMPTY_FILTER_SQL_EXPRESSION in (query.extras.get("where") or "")
    ) is required


@pytest.mark.parametrize("transitive", [False, True])
def test_selected_denied_parent_still_blocks_descendant_without_execution(
    restricted_parent_query: dict[str, Any],
    transitive: bool,
) -> None:
    """A selected ancestor still requires authorization before interpreting its type."""
    summaries, metadata = choices.discover_filter_values(
        _restricted_parent_dashboard(transitive=transitive),
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state={"dataMask": {"region": _mask(["EMEA"])}},
    )
    assert _available(summaries[0]).reason == "permission_denied"
    assert metadata.query_count == 0
    restricted_parent_query["run"].assert_not_called()


@pytest.mark.parametrize("operation", ["list", "proposal_clear"])
def test_empty_parent_authorization_is_required_when_requested_or_proposed(
    restricted_parent_query: dict[str, Any],
    operation: str,
) -> None:
    """Reading a parent or proposing its clear keeps the parent's access gate."""
    options: dict[str, Any] = {"filter_value_requests": [{"filter_id": "region"}]}
    if operation == "proposal_clear":
        options = {
            "filter_value_requests": [{"filter_id": "country"}],
            "proposed_filter_values": [{"filter_id": "region", "values": []}],
        }
    summaries, metadata = choices.discover_filter_values(
        _restricted_parent_dashboard(transitive=False),
        _request(**options),
        snapshot_state={"dataMask": {"region": _mask([])}},
    )
    assert _available(summaries[0]).reason == "permission_denied"
    assert metadata.validated_proposed_filter_values == []
    assert metadata.query_count == 0
    restricted_parent_query["run"].assert_not_called()


@pytest.mark.parametrize("state", ["first_item", "restored_default", "sql_only"])
def test_unresolved_empty_parent_evidence_cannot_broaden_descendant_choices(
    restricted_parent_query: dict[str, Any],
    state: str,
) -> None:
    """Empty-mask type handling retains required restoration and state safeguards."""
    dashboard = _restricted_parent_dashboard(transitive=False)
    configs = choices.current_native_filter_config(dashboard)
    snapshot = {"dataMask": {"region": _mask(None)}}
    if state == "first_item":
        configs[0]["controlValues"] = {"defaultToFirstItem": True}
        configs[0]["defaultDataMask"] = {"filterState": {}, "extraFormData": {}}
        snapshot = {"dataMask": {}}
    elif state == "restored_default":
        configs[0]["controlValues"] = {"enableEmptyFilter": True}
        configs[0]["defaultDataMask"] = _mask(["EMEA"])
    else:
        snapshot["dataMask"]["region"]["extraFormData"] = {
            "adhoc_filters": [
                {
                    "expressionType": "SQL",
                    "clause": "WHERE",
                    "sqlExpression": "1 = 1",
                }
            ],
        }
    dashboard.json_metadata = json.dumps({"native_filter_configuration": configs})
    summaries, metadata = choices.discover_filter_values(
        dashboard,
        _request(filter_value_requests=[{"filter_id": "country"}]),
        snapshot_state=snapshot,
    )
    assert _available(summaries[0]).reason == (
        "parent_unresolved" if state == "first_item" else "permission_denied"
    )
    assert metadata.query_count == 0
    restricted_parent_query["run"].assert_not_called()
