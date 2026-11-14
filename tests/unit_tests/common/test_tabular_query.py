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

"""Unit tests for the shared name-based tabular query core."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from flask import current_app

from superset.common.query_object import QueryObject
from superset.common.tabular_query import (
    build_query_dict,
    execute_tabular_query,
    TabularQueryValidationError,
    validate_names,
    validate_query_names,
)
from superset.constants import NO_TIME_RANGE
from superset.jinja_context import ExtraCache
from superset.superset_typing import AdhocColumn, AdhocMetric


def _column(name: str, is_dttm: bool = False) -> MagicMock:
    column = MagicMock()
    column.column_name = name
    column.is_dttm = is_dttm
    return column


def test_build_query_dict_synthesizes_temporal_filter() -> None:
    """A time_range becomes a TEMPORAL_RANGE clause on the resolved column.

    QueryObject.time_range is intentionally omitted so relative ranges keep
    from_dttm/to_dttm in the cache key; Jinja reads the range via
    execute_tabular_query's explicit overlay.
    """
    query_dict = build_query_dict(
        time_column="ds",
        metrics=["count"],
        dimensions=["region"],
        time_range="Last 30 days",
    )

    assert query_dict["granularity"] == "ds"
    assert "time_range" not in query_dict
    assert {
        "col": "ds",
        "op": "TEMPORAL_RANGE",
        "val": "Last 30 days",
    } in query_dict["filters"]


def test_build_query_dict_time_range_without_column_adds_no_filter() -> None:
    """Without a resolved temporal column there is nothing to filter on."""
    query_dict = build_query_dict(metrics=["count"], time_range="Last 30 days")

    assert query_dict["filters"] == []
    assert "granularity" not in query_dict
    assert "time_range" not in query_dict


def test_build_query_dict_time_grain_emits_base_axis_column() -> None:
    """A grain only applies via a BASE_AXIS adhoc column.

    ``SqlaTable.adhoc_column_to_sqla`` gates grain handling on
    ``columnType == "BASE_AXIS"``; ``extras.time_grain_sqla`` alone is read by
    the semantic-layer mapper but silently ignored for datasets.
    """
    query_dict = build_query_dict(
        time_column="ds", metrics=["count"], time_grain="P1D", grain_column="ds"
    )

    assert query_dict["columns"][0] == {
        "label": "ds",
        "sqlExpression": "ds",
        "isColumnReference": True,
        "columnType": "BASE_AXIS",
        "timeGrain": "P1D",
    }
    # Still emitted for the semantic-view path.
    assert query_dict["extras"] == {"time_grain_sqla": "P1D"}


def test_build_query_dict_grain_replaces_plain_dimension() -> None:
    """Naming the temporal column as a dimension must not duplicate it."""
    query_dict = build_query_dict(
        metrics=["count"],
        dimensions=["ds", "gender"],
        time_grain="P1M",
        grain_column="ds",
    )

    assert query_dict["columns"][0]["columnType"] == "BASE_AXIS"
    assert query_dict["columns"][1] == "gender"
    assert "ds" not in [c for c in query_dict["columns"] if isinstance(c, str)]


def test_build_query_dict_grain_without_column_is_not_applied() -> None:
    """No grain column means no BASE_AXIS column; the API rejects this case."""
    query_dict = build_query_dict(metrics=["count"], time_grain="P1D")

    assert query_dict["columns"] == []


def test_resolve_grain_column_precedence() -> None:
    from superset.common.tabular_query import ResolvedExplorable

    resolved = ResolvedExplorable(
        explorable=MagicMock(),
        display_name="sales",
        time_column="ds",
        valid_dimensions={"ds", "created", "gender"},
        valid_metrics={"count"},
        dttm_columns={"ds", "created"},
    )

    # Explicit time_column wins.
    assert resolved.resolve_grain_column("created", ["ds"]) == "created"
    # Else a temporal dimension already requested.
    assert resolved.resolve_grain_column(None, ["gender", "created"]) == "created"
    # Else whatever time_range resolved to.
    assert resolved.resolve_grain_column(None, ["gender"]) == "ds"


def test_resolve_grain_column_returns_none_when_no_temporal() -> None:
    from superset.common.tabular_query import ResolvedExplorable

    resolved = ResolvedExplorable(
        explorable=MagicMock(),
        display_name="sales",
        time_column=None,
        valid_dimensions={"gender"},
        valid_metrics={"count"},
        dttm_columns=set(),
    )

    assert resolved.resolve_grain_column(None, ["gender"]) is None


def test_build_query_dict_maps_limit_offset_to_query_object_names() -> None:
    """The wire uses SemanticQuery's limit/offset; QueryObject wants row_*."""
    assert build_query_dict(metrics=["count"], limit=25)["row_limit"] == 25
    assert "row_offset" not in build_query_dict(metrics=["count"])
    assert build_query_dict(metrics=["count"], offset=100)["row_offset"] == 100


def test_build_query_dict_orderby_inverts_each_direction() -> None:
    """QueryObject.orderby is (name, ascending); the wire sends descending."""
    query_dict = build_query_dict(
        metrics=["count"],
        dimensions=["region"],
        order=[("count", True), ("region", False)],
    )

    assert query_dict["orderby"] == [("count", False), ("region", True)]


def test_build_query_dict_passes_adhoc_metrics_through() -> None:
    """Ad-hoc metric dicts survive untouched; datasets accept them."""
    adhoc: AdhocMetric = {
        "expressionType": "SQL",
        "sqlExpression": "SUM(a)/SUM(b)",
        "label": "Ratio",
    }
    assert build_query_dict(metrics=["count", adhoc])["metrics"] == ["count", adhoc]


def test_validate_query_names_reports_unknown_names() -> None:
    """Unknown names are named back to the caller, per kind."""
    errors = validate_query_names(
        {"revenue"},
        {"region"},
        metrics=["revenu"],
        dimensions=["regionn"],
        filters=[{"col": "bogus_col"}],
        order_names=["bogus_order"],
    )

    joined = "; ".join(errors)
    assert "Unknown metric: 'revenu'" in joined
    assert "Unknown dimension: 'regionn'" in joined
    assert "Unknown filter column: 'bogus_col'" in joined
    assert "Unknown order_by: 'bogus_order'" in joined


def test_validate_query_names_accepts_valid_names() -> None:
    assert (
        validate_query_names(
            {"revenue"},
            {"region"},
            metrics=["revenue"],
            dimensions=["region"],
            filters=[{"col": "region"}],
            order_names=["revenue"],
        )
        == []
    )


def test_validate_query_names_skips_adhoc_expressions() -> None:
    """Ad-hoc metrics/columns are dicts, not names, so they bypass name checks.

    Semantic views reject them downstream in the mapper, which owns that rule.
    """
    adhoc_metric: AdhocMetric = {"expressionType": "SQL", "sqlExpression": "SUM(a)"}
    adhoc_column: AdhocColumn = {
        "sqlExpression": "LOWER(region)",
        "label": "region_lc",
    }

    assert (
        validate_query_names(
            set(), set(), metrics=[adhoc_metric], dimensions=[adhoc_column]
        )
        == []
    )


def test_validate_names_suggests_close_matches() -> None:
    (error,) = validate_names(["sum__sale"], {"sum__sales"}, "metric")
    assert "Did you mean: sum__sales?" in error


def test_validate_names_hints_when_no_metrics_defined() -> None:
    (error,) = validate_names(
        ["anything"], set(), "metric", empty_hint="No metrics here."
    )
    assert "No metrics here." in error


def test_validate_names_lists_valid_when_no_close_match() -> None:
    (error,) = validate_names(["zzz"], {"revenue"}, "metric", list_valid_on_miss=True)
    assert "Valid metrics: revenue" in error


def test_resolve_time_column_rejects_non_temporal_column() -> None:
    from superset.common.tabular_query import _resolve_time_column

    explorable = MagicMock()
    explorable.columns = [_column("region"), _column("ds", is_dttm=True)]

    with pytest.raises(TabularQueryValidationError, match="not marked as a datetime"):
        _resolve_time_column(explorable, "sales", "region", False)


def test_resolve_time_column_rejects_unknown_column() -> None:
    from superset.common.tabular_query import _resolve_time_column

    explorable = MagicMock()
    explorable.columns = [_column("ds", is_dttm=True)]

    with pytest.raises(TabularQueryValidationError, match="Unknown time_column"):
        _resolve_time_column(explorable, "sales", "nope", False)


def test_resolve_time_column_infers_from_main_dttm_col() -> None:
    """Datasets carry main_dttm_col; it wins over positional inference."""
    from superset.common.tabular_query import _resolve_time_column

    explorable = MagicMock()
    explorable.columns = [_column("created", is_dttm=True), _column("ds", is_dttm=True)]
    explorable.main_dttm_col = "ds"

    assert _resolve_time_column(explorable, "sales", None, True) == "ds"


def test_resolve_time_column_requires_one_when_time_range_given() -> None:
    from superset.common.tabular_query import _resolve_time_column

    explorable = MagicMock()
    explorable.columns = [_column("region")]
    explorable.main_dttm_col = None

    with pytest.raises(TabularQueryValidationError, match="no temporal column"):
        _resolve_time_column(explorable, "view", None, True)


def test_resolve_time_column_not_inferred_without_time_range() -> None:
    """An unfiltered query must not acquire a temporal axis it did not ask for."""
    from superset.common.tabular_query import _resolve_time_column

    explorable = MagicMock()
    explorable.columns = [_column("ds", is_dttm=True)]
    explorable.main_dttm_col = "ds"

    assert _resolve_time_column(explorable, "sales", None, False) is None


def test_metrics_hint_names_the_callers_own_discovery_tool() -> None:
    """The default hint points at get_dataset_info, which cannot resolve a
    semantic view; get_table must be able to name list_metrics instead.

    The hint only appears once the valid list is truncated, i.e. above ten
    metrics — which is why a single-metric fixture never exercised it.
    """
    many = {f"metric_{i:02d}" for i in range(15)}

    (default,) = validate_query_names(many, set(), metrics=["zzz"])
    assert "call get_dataset_info for the full list" in default

    (overridden,) = validate_query_names(
        many,
        set(),
        metrics=["zzz"],
        metrics_full_list_hint="call list_metrics for the full list",
    )
    assert "call list_metrics for the full list" in overridden
    assert "get_dataset_info" not in overridden


def test_order_desc_is_independent_of_order() -> None:
    """order_desc drives series-limit ordering and must not be inferred from
    ``order``; deriving it flipped the value when ``order`` was empty."""
    for order_desc in (True, False):
        assert (
            build_query_dict(metrics=["count"], order=[], order_desc=order_desc)[
                "order_desc"
            ]
            is order_desc
        )
        assert (
            build_query_dict(
                metrics=["count"], order=[("count", True)], order_desc=order_desc
            )["order_desc"]
            is order_desc
        )


def test_grain_column_is_marked_as_a_column_reference() -> None:
    """Semantic views reject adhoc dimensions without this flag, so omitting it
    made every semantic-view time_grain query raise."""
    query_dict = build_query_dict(
        metrics=["count"], time_grain="P1D", grain_column="ds"
    )

    assert query_dict["columns"][0]["isColumnReference"] is True


def test_validation_error_is_a_value_error() -> None:
    """The endpoint maps ValueError to 400 so the semantic-layer mapper's bare
    ValueError validation failures do not escape as 500s; this subclassing is
    what keeps TabularQueryValidationError covered by that handler."""
    assert issubclass(TabularQueryValidationError, ValueError)


def test_resolve_time_column_requires_a_choice_when_ambiguous() -> None:
    from superset.common.tabular_query import _resolve_time_column

    explorable = MagicMock()
    explorable.columns = [
        _column("event_time", is_dttm=True),
        _column("created_at", is_dttm=True),
    ]
    explorable.main_dttm_col = None

    with pytest.raises(TabularQueryValidationError, match="multiple datetime"):
        _resolve_time_column(explorable, "view", None, True)

    assert _resolve_time_column(explorable, "view", "created_at", True) == "created_at"


def test_resolve_time_column_still_infers_a_lone_candidate() -> None:
    from superset.common.tabular_query import _resolve_time_column

    explorable = MagicMock()
    explorable.columns = [_column("region"), _column("event_time", is_dttm=True)]
    explorable.main_dttm_col = None

    assert _resolve_time_column(explorable, "view", None, True) == "event_time"


def test_two_sided_range_stays_a_temporal_range_filter() -> None:
    (clause,) = build_query_dict(
        time_column="ds", metrics=["count"], time_range="1965-01-01 : 1968-01-01"
    )["filters"]

    assert clause["op"] == "TEMPORAL_RANGE"
    assert clause["val"] == "1965-01-01 : 1968-01-01"


def test_one_sided_range_becomes_an_explicit_comparison() -> None:
    """Semantic views only. ``_apply_granularity`` deletes the TEMPORAL_RANGE
    filter once ``granularity`` is set, and the mapper emits nothing unless both
    bounds resolve, so the range would vanish.
    """
    for time_range, op, value in [
        ("1966-01-01 : ", ">=", "1966-01-01 00:00:00"),
        (" : 1966-01-01", "<", "1966-01-01 00:00:00"),
    ]:
        (clause,) = build_query_dict(
            time_column="ds",
            metrics=["count"],
            time_range=time_range,
            rewrite_one_sided_time_range=True,
        )["filters"]

        assert clause == {"col": "ds", "op": op, "val": value}


def test_datasets_keep_temporal_range_for_one_sided_ranges() -> None:
    """``SqlaTable.get_time_filter`` takes either bound alone and is the only
    path applying the dataset timezone, hour offset and grain truncation, so
    rewriting would shift one-sided results relative to two-sided ones.
    """
    (clause,) = build_query_dict(
        time_column="ds", metrics=["count"], time_range="1966-01-01 : "
    )["filters"]

    assert clause["op"] == "TEMPORAL_RANGE"
    assert clause["val"] == "1966-01-01 : "


def test_one_sided_bound_uses_a_space_separator() -> None:
    """``isoformat()`` would emit ``1966-01-01T00:00:00``, which sorts after
    stored ``1966-01-01 00:00:00`` values and moves the boundary."""
    (clause,) = build_query_dict(
        time_column="ds",
        metrics=["count"],
        time_range="1966-01-01 : ",
        rewrite_one_sided_time_range=True,
    )["filters"]

    assert "T" not in clause["val"]


def _resolved_get_table_query_object(time_range: str) -> QueryObject:
    """Model the semantic-view get_table query object at cache-key time.

    ``build_query_dict`` (the get_table builder) expresses the range only as a
    ``TEMPORAL_RANGE`` filter — it never sets ``time_range`` — and
    ``QueryContextFactory`` then resolves that filter to ``from_dttm``/
    ``to_dttm`` and ``_apply_granularity`` drops the granularity-column filter
    before the cache key is taken. This reproduces that resolved state: no
    ``time_range`` attribute, temporal filter removed, bounds resolved.
    """
    from superset.common.utils.time_range_utils import get_since_until_from_time_range

    query_dict = build_query_dict(
        time_column="metric_time",
        metrics=["revenue"],
        dimensions=["metric_time"],
        filters=[{"col": "product__product_name", "op": "==", "val": "mel-bun"}],
        time_range=time_range,
        rewrite_one_sided_time_range=True,  # the view path
    )
    # get_table never sets QueryObject.time_range; the range rides on a filter.
    assert "time_range" not in query_dict
    assert {
        "col": "metric_time",
        "op": "TEMPORAL_RANGE",
        "val": time_range,
    } in query_dict["filters"]

    from_dttm, to_dttm = get_since_until_from_time_range(time_range=time_range)
    non_temporal = [
        flt for flt in query_dict["filters"] if flt["op"] != "TEMPORAL_RANGE"
    ]
    return QueryObject(
        columns=query_dict["columns"],
        metrics=query_dict["metrics"],
        filters=non_temporal,
        granularity="metric_time",
        from_dttm=from_dttm,
        to_dttm=to_dttm,
    )


def test_get_table_cache_key_distinguishes_time_ranges() -> None:
    """sc-120967: two semantic-view get_table calls with the same filters but
    different time ranges must not share a cache entry.

    Regression for the collision fixed on master by #43914 (412ab43712): the
    range reaches the query object only as resolved ``from_dttm``/``to_dttm``
    (no ``time_range`` attribute, temporal filter removed), so those bounds are
    the only thing distinguishing one range's key from another's.
    """
    first = _resolved_get_table_query_object("2024-01-01 : 2024-06-01")
    second = _resolved_get_table_query_object("2024-07-01 : 2024-12-01")

    assert first.cache_key() != second.cache_key()


def test_get_table_cache_key_collides_when_bounds_dropped() -> None:
    """Control: revert #43914's condition (drop the resolved bounds from the
    key) and the two ranges collapse to one cache entry — the sc-120967 bug.

    With ``time_range`` unset and the temporal filter already removed, nulling
    ``from_dttm``/``to_dttm`` (what cache_key did before #43914) leaves the two
    otherwise-identical requests indistinguishable.
    """
    first = _resolved_get_table_query_object("2024-01-01 : 2024-06-01")
    second = _resolved_get_table_query_object("2024-07-01 : 2024-12-01")
    first.from_dttm = first.to_dttm = None
    second.from_dttm = second.to_dttm = None

    assert first.cache_key() == second.cache_key()


def _factory_dataset(*column_names: str) -> SimpleNamespace:
    return SimpleNamespace(
        columns=[
            SimpleNamespace(column_name=name, is_dttm=name != "region")
            for name in column_names
        ],
        main_dttm_col=next((name for name in column_names if name != "region"), None),
    )


def test_execute_tabular_query_overlays_temporal_range_after_apply_granularity() -> (
    None
):
    """The raw pre-factory dict still has TEMPORAL_RANGE after the factory strips it."""
    from flask import g

    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.query_context_factory import QueryContextFactory

    query_dict = {
        "filters": [
            {"col": "region", "op": "IN", "val": ["North"]},
            {"col": "order_date", "op": "TEMPORAL_RANGE", "val": "Last week"},
        ],
        "columns": ["region"],
        "metrics": ["count"],
        "granularity": "order_date",
    }
    observed: dict[str, bool] = {}

    def run_query(*_args: object, **_kwargs: object) -> dict[str, object]:
        processed_filters = g.form_data["queries"][0]["filters"] or []
        assert all(
            (flt.get("op") if isinstance(flt, dict) else None) != "TEMPORAL_RANGE"
            for flt in processed_filters
        )
        assert ExtraCache().get_time_filter().time_range == "Last week"
        assert ExtraCache().get_time_filter("order_date").time_range == "Last week"
        observed["ran"] = True
        return {"queries": [{"data": []}]}

    with (
        current_app.test_request_context(),
        patch.object(
            QueryContextFactory,
            "_convert_to_model",
            return_value=_factory_dataset("region", "order_date"),
        ),
        patch.object(ChartDataCommand, "validate"),
        patch.object(ChartDataCommand, "run", side_effect=run_query),
    ):
        execute_tabular_query(7, "table", query_dict)

    assert observed["ran"] is True


@pytest.mark.parametrize(
    ("time_range", "expect_since", "expect_until"),
    [
        ("1966-01-01 : ", True, False),
        (" : 1966-01-01", False, True),
    ],
)
def test_execute_tabular_query_overlays_one_sided_semantic_view_range(
    time_range: str,
    expect_since: bool,
    expect_until: bool,
) -> None:
    """One-sided rewrites emit no TEMPORAL_RANGE; the original string is overlaid."""
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.query_context_factory import QueryContextFactory
    from superset.common.utils.time_range_utils import get_since_until_from_time_range

    query_dict = build_query_dict(
        time_column="ds",
        metrics=["count"],
        time_range=time_range,
        rewrite_one_sided_time_range=True,
    )
    assert "time_range" not in query_dict
    assert all(flt["op"] != "TEMPORAL_RANGE" for flt in query_dict["filters"])
    observed: dict[str, bool] = {}

    def run_query(*_args: object, **_kwargs: object) -> dict[str, object]:
        resolved = ExtraCache().get_time_filter().time_range
        assert resolved != NO_TIME_RANGE
        since, until = get_since_until_from_time_range(resolved)
        assert (since is not None) is expect_since
        assert (until is not None) is expect_until
        bound = since or until
        assert bound is not None
        assert (bound.year, bound.month, bound.day) == (1966, 1, 1)
        assert ExtraCache().get_time_filter("ds").time_range == resolved
        observed["ran"] = True
        return {"queries": [{"data": []}]}

    with (
        current_app.test_request_context(),
        patch.object(
            QueryContextFactory,
            "_convert_to_model",
            return_value=_factory_dataset("ds"),
        ),
        patch.object(ChartDataCommand, "validate"),
        patch.object(ChartDataCommand, "run", side_effect=run_query),
    ):
        execute_tabular_query(7, "table", query_dict, time_range=time_range)

    assert observed["ran"] is True


def test_execute_tabular_query_does_not_treat_granularity_comparison_as_range() -> None:
    """time_column without time_range must not turn a comparison filter into a range."""
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.query_context_factory import QueryContextFactory

    query_dict = build_query_dict(
        time_column="ds",
        metrics=["count"],
        filters=[{"col": "ds", "op": ">=", "val": "Q1"}],
    )
    observed: dict[str, bool] = {}

    def run_query(*_args: object, **_kwargs: object) -> dict[str, object]:
        assert ExtraCache().get_time_filter().time_range == NO_TIME_RANGE
        observed["ran"] = True
        return {"queries": [{"data": []}]}

    with (
        current_app.test_request_context(),
        patch.object(
            QueryContextFactory,
            "_convert_to_model",
            return_value=_factory_dataset("ds"),
        ),
        patch.object(ChartDataCommand, "validate"),
        patch.object(ChartDataCommand, "run", side_effect=run_query),
    ):
        execute_tabular_query(7, "table", query_dict)

    assert observed["ran"] is True
