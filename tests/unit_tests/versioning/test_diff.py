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
"""Unit tests for ``superset.versioning.diff`` (T051).

Pure-function tests — no app context, no DB. Covers:

- (a) scalar field change
- (b) filter added / removed / modified (Slice params)
- (c) metric added / removed (Slice params + dataset SqlMetric)
- (d) column added / removed / type-changed (dataset TableColumn)
- (e) ``dashboard_slices`` added / removed
- (f) replay round-trip — applying records in order reconstructs post-state (SC-008)
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from superset.utils import json as _json
from superset.versioning.diff import (
    ChangeRecord,
    diff_dashboard,
    diff_dashboard_slices,
    diff_dataset,
    diff_dataset_columns,
    diff_dataset_metrics,
    diff_scalar_fields,
    diff_slice,
    diff_slice_params,
    scalar_fields_for,
)

# Field universes used by tests. In production the listener passes the
# result of ``scalar_fields_for(ModelClass, special=...)``; in tests we
# pass explicit sets so assertions remain stable even if a contributor
# later adds or renames a column on the real model.

_SLICE_TEST_FIELDS: frozenset[str] = frozenset(
    {
        "slice_name",
        "datasource_type",
        "datasource_id",
        "viz_type",
        "description",
        "cache_timeout",
        "external_url",
        "is_managed_externally",
        "certified_by",
        "certification_details",
    }
)

_DASHBOARD_TEST_FIELDS: frozenset[str] = frozenset(
    {
        "dashboard_title",
        "position_json",
        "json_metadata",
        "slug",
        "css",
        "external_url",
        "is_managed_externally",
        "certified_by",
        "certification_details",
        "published",
    }
)

_DATASET_TEST_FIELDS: frozenset[str] = frozenset(
    {
        "table_name",
        "sql",
        "description",
        "cache_timeout",
        "template_params",
        "extra",
        "main_dttm_col",
        "default_endpoint",
        "offset",
        "schema",
        "catalog",
        "filter_select_enabled",
        "fetch_values_predicate",
        "is_sqllab_view",
        "is_managed_externally",
        "external_url",
        "normalize_columns",
        "always_filter_main_dttm",
    }
)

# ---------------------------------------------------------------------------
# (a) Scalar field change
# ---------------------------------------------------------------------------


def test_slice_scalar_rename() -> None:
    pre = {"slice_name": "Sales Report"}
    post = {"slice_name": "Sales Report Q1"}
    records = diff_slice(pre, post, fields=_SLICE_TEST_FIELDS)
    assert records == [
        ChangeRecord(
            kind="field",
            path=["slice_name"],
            from_value="Sales Report",
            to_value="Sales Report Q1",
        )
    ]


def test_slice_scalar_unchanged_emits_nothing() -> None:
    pre = {"slice_name": "Sales Report", "description": "x"}
    post = {"slice_name": "Sales Report", "description": "x"}
    assert diff_slice(pre, post, fields=_SLICE_TEST_FIELDS) == []


def test_dashboard_scalar_change_falls_through_to_field() -> None:
    pre = {"dashboard_title": "Old", "position_json": '{"a":1}'}
    post = {"dashboard_title": "New", "position_json": '{"a":2}'}
    records = diff_dashboard(pre, post, fields=_DASHBOARD_TEST_FIELDS)
    assert len(records) == 2
    kinds = {r.kind for r in records}
    assert kinds == {"field"}
    paths = {tuple(r.path) for r in records}
    assert paths == {("dashboard_title",), ("position_json",)}


def test_dataset_scalar_change_falls_through_to_field() -> None:
    pre = {"sql": "SELECT 1", "description": "old"}
    post = {"sql": "SELECT 2", "description": "new"}
    records = diff_dataset(pre, post, fields=_DATASET_TEST_FIELDS)
    kinds = {r.kind for r in records}
    paths = {tuple(r.path) for r in records}
    assert kinds == {"field"}
    assert paths == {("sql",), ("description",)}


def test_unknown_fields_are_ignored() -> None:
    # Fields outside the known scalar set are silently skipped — we
    # don't emit spurious ``field`` records for ORM-internal columns.
    pre = {"__unmapped__": "x"}
    post = {"__unmapped__": "y"}
    assert diff_slice(pre, post, fields=_SLICE_TEST_FIELDS) == []
    assert diff_dashboard(pre, post, fields=_DASHBOARD_TEST_FIELDS) == []
    assert diff_dataset(pre, post, fields=_DATASET_TEST_FIELDS) == []


# ---------------------------------------------------------------------------
# scalar_fields_for — model reflection
# ---------------------------------------------------------------------------


class _FakeColumn:
    """Stand-in for a SQLAlchemy ``Column`` that exposes just ``.name``."""

    def __init__(self, name: str) -> None:
        self.name = name


class _FakeTable:
    """Stand-in for ``Model.__table__`` that exposes an iterable ``columns``."""

    def __init__(self, column_names: list[str]) -> None:
        self.columns = [_FakeColumn(n) for n in column_names]


def test_scalar_fields_for_strips_audit_and_excludes() -> None:
    """Reflection excludes __versioned__.exclude + audit fields + special."""

    class _Model:
        __table__ = _FakeTable(
            [
                "id",
                "uuid",
                "name",
                "description",
                "secret_field",
                "created_on",
                "changed_on",
                "created_by_fk",
                "changed_by_fk",
                "params",
            ]
        )
        __versioned__ = {"exclude": ["secret_field"]}

    result = scalar_fields_for(_Model, special=frozenset({"params"}))
    assert result == frozenset({"name", "description"})


def test_scalar_fields_for_no_versioned_attr() -> None:
    """Models without ``__versioned__`` work — exclude defaults to empty."""

    class _Model:
        __table__ = _FakeTable(["id", "name", "created_on"])

    result = scalar_fields_for(_Model)
    assert result == frozenset({"name"})


def test_scalar_fields_for_empty_versioned_dict() -> None:
    """``__versioned__ = {}`` is treated as no additional exclusions."""

    class _Model:
        __table__ = _FakeTable(["id", "name"])
        __versioned__: dict[str, Any] = {}

    result = scalar_fields_for(_Model)
    assert result == frozenset({"name"})


def test_scalar_fields_for_no_table_returns_empty() -> None:
    """Objects without ``__table__`` produce an empty set, not an error."""

    class _NotAModel:
        pass

    assert scalar_fields_for(_NotAModel) == frozenset()


def test_scalar_fields_for_custom_field_in_derivative() -> None:
    """Derivatives get custom scalar fields without editing ``diff.py``."""

    class _DerivedSlice:
        """Simulates a downstream fork that added ``preset_embedded_config``."""

        __table__ = _FakeTable(
            [
                "id",
                "uuid",
                "slice_name",
                "params",
                "preset_embedded_config",  # downstream addition
                "created_on",
                "changed_on",
                "created_by_fk",
                "changed_by_fk",
            ]
        )
        __versioned__ = {"exclude": ["query_context"]}

    result = scalar_fields_for(_DerivedSlice, special=frozenset({"params"}))
    # Core and downstream fields both appear — zero maintenance in diff.py.
    assert "slice_name" in result
    assert "preset_embedded_config" in result
    assert "params" not in result  # handled specially
    assert "id" not in result  # audit


# ---------------------------------------------------------------------------
# diff_scalar_fields — generic primitive used by all entity types
# ---------------------------------------------------------------------------


def test_diff_scalar_fields_only_emits_changed_fields() -> None:
    pre = {"a": 1, "b": "x", "c": True}
    post = {"a": 2, "b": "x", "c": False}
    records = diff_scalar_fields(pre, post, fields={"a", "b", "c"})
    paths = {tuple(r.path) for r in records}
    assert paths == {("a",), ("c",)}
    assert {r.kind for r in records} == {"field"}


def test_diff_scalar_fields_ignores_fields_outside_universe() -> None:
    # ``extra`` differs, but isn't in the fields set → no record.
    pre = {"a": 1, "extra": 100}
    post = {"a": 2, "extra": 200}
    records = diff_scalar_fields(pre, post, fields={"a"})
    assert len(records) == 1
    assert records[0].path == ["a"]


# ---------------------------------------------------------------------------
# (b) Chart params — filters
# ---------------------------------------------------------------------------


FILTER_COUNTRY = {
    "subject": "country",
    "operator": "==",
    "comparator": "Canada",
    "expressionType": "SIMPLE",
}
FILTER_COUNTRY_REGION = {
    "subject": "country",
    "operator": "==",
    "comparator": "Canada/Quebec",
    "expressionType": "SIMPLE",
}
FILTER_DATE = {
    "subject": "order_date",
    "operator": ">",
    "comparator": "2020-01-01",
    "expressionType": "SIMPLE",
}


def _params_json(**kwargs: Any) -> str:
    return _json.dumps(kwargs)


def test_filter_added() -> None:
    records = diff_slice_params(
        _params_json(adhoc_filters=[]),
        _params_json(adhoc_filters=[FILTER_COUNTRY]),
    )
    assert len(records) == 1
    r = records[0]
    assert r.kind == "filter"
    assert r.path == ["params", "adhoc_filters", "country"]
    assert r.from_value is None
    assert r.to_value == FILTER_COUNTRY


def test_filter_removed() -> None:
    records = diff_slice_params(
        _params_json(adhoc_filters=[FILTER_COUNTRY, FILTER_DATE]),
        _params_json(adhoc_filters=[FILTER_DATE]),
    )
    assert len(records) == 1
    r = records[0]
    assert r.kind == "filter"
    assert r.path == ["params", "adhoc_filters", "country"]
    assert r.from_value == FILTER_COUNTRY
    assert r.to_value is None


def test_filter_modified_same_subject() -> None:
    records = diff_slice_params(
        _params_json(adhoc_filters=[FILTER_COUNTRY]),
        _params_json(adhoc_filters=[FILTER_COUNTRY_REGION]),
    )
    assert len(records) == 1
    r = records[0]
    assert r.kind == "filter"
    assert r.path == ["params", "adhoc_filters", "country"]
    assert r.from_value == FILTER_COUNTRY
    assert r.to_value == FILTER_COUNTRY_REGION


def test_filter_insert_in_middle_is_still_one_record() -> None:
    # Position-based diffing would emit three records for this case.
    # Natural-key diffing emits exactly one.
    records = diff_slice_params(
        _params_json(adhoc_filters=[FILTER_COUNTRY, FILTER_DATE]),
        _params_json(
            adhoc_filters=[
                FILTER_COUNTRY,
                {"subject": "city", "operator": "in", "comparator": ["Montreal"]},
                FILTER_DATE,
            ]
        ),
    )
    assert len(records) == 1
    assert records[0].path == ["params", "adhoc_filters", "city"]
    assert records[0].from_value is None
    assert records[0].to_value["subject"] == "city"


# ---------------------------------------------------------------------------
# (b-continued) Chart params — scalar first-class kinds
# ---------------------------------------------------------------------------


def test_time_range_change() -> None:
    records = diff_slice_params(
        _params_json(time_range="Last week"),
        _params_json(time_range="Last month"),
    )
    assert records == [
        ChangeRecord(
            kind="time_range",
            path=["params", "time_range"],
            from_value="Last week",
            to_value="Last month",
        )
    ]


def test_time_range_added_from_null() -> None:
    records = diff_slice_params(
        _params_json(),
        _params_json(time_range="Last week"),
    )
    assert records == [
        ChangeRecord(
            kind="time_range",
            path=["params", "time_range"],
            from_value=None,
            to_value="Last week",
        )
    ]


def test_color_palette_change() -> None:
    records = diff_slice_params(
        _params_json(color_scheme="supersetColors"),
        _params_json(color_scheme="presetColors"),
    )
    assert records[0].kind == "color_palette"
    assert records[0].path == ["params", "color_scheme"]


def test_unknown_params_sub_key_falls_through_to_field() -> None:
    records = diff_slice_params(
        _params_json(something_custom="x"),
        _params_json(something_custom="y"),
    )
    assert records == [
        ChangeRecord(
            kind="field",
            path=["params", "something_custom"],
            from_value="x",
            to_value="y",
        )
    ]


# ---------------------------------------------------------------------------
# (c) Chart params — metrics
# ---------------------------------------------------------------------------


METRIC_SUM_SALES = {
    "label": "SUM(sales)",
    "aggregate": "SUM",
    "column": {"column_name": "sales"},
    "expressionType": "SIMPLE",
}
METRIC_COUNT_ORDERS = {
    "label": "COUNT(orders)",
    "aggregate": "COUNT",
    "column": {"column_name": "orders"},
    "expressionType": "SIMPLE",
}


def test_chart_metric_added() -> None:
    records = diff_slice_params(
        _params_json(metrics=[]),
        _params_json(metrics=[METRIC_SUM_SALES]),
    )
    assert records == [
        ChangeRecord(
            kind="metric",
            path=["params", "metrics", "SUM(sales)"],
            from_value=None,
            to_value=METRIC_SUM_SALES,
        )
    ]


def test_chart_metric_removed() -> None:
    records = diff_slice_params(
        _params_json(metrics=[METRIC_SUM_SALES, METRIC_COUNT_ORDERS]),
        _params_json(metrics=[METRIC_COUNT_ORDERS]),
    )
    assert records == [
        ChangeRecord(
            kind="metric",
            path=["params", "metrics", "SUM(sales)"],
            from_value=METRIC_SUM_SALES,
            to_value=None,
        )
    ]


# ---------------------------------------------------------------------------
# (c-continued) Chart params — dimensions
# ---------------------------------------------------------------------------


def test_dimension_added() -> None:
    records = diff_slice_params(
        _params_json(groupby=["country"]),
        _params_json(groupby=["country", "city"]),
    )
    assert records == [
        ChangeRecord(
            kind="dimension",
            path=["params", "groupby", "city"],
            from_value=None,
            to_value="city",
        )
    ]


def test_dimension_removed() -> None:
    records = diff_slice_params(
        _params_json(groupby=["country", "city"]),
        _params_json(groupby=["country"]),
    )
    assert records == [
        ChangeRecord(
            kind="dimension",
            path=["params", "groupby", "city"],
            from_value="city",
            to_value=None,
        )
    ]


# ---------------------------------------------------------------------------
# (d) Dataset columns
# ---------------------------------------------------------------------------


COLUMN_COUNTRY = {"column_name": "country", "type": "VARCHAR(255)", "is_dttm": False}
COLUMN_COUNTRY_TEXT = {"column_name": "country", "type": "TEXT", "is_dttm": False}
COLUMN_DATE = {"column_name": "order_date", "type": "DATE", "is_dttm": True}


def test_column_added() -> None:
    records = diff_dataset_columns([], [COLUMN_COUNTRY])
    assert records == [
        ChangeRecord(
            kind="column",
            path=["columns", "country"],
            from_value=None,
            to_value=COLUMN_COUNTRY,
        )
    ]


def test_column_removed() -> None:
    records = diff_dataset_columns([COLUMN_COUNTRY, COLUMN_DATE], [COLUMN_DATE])
    assert records == [
        ChangeRecord(
            kind="column",
            path=["columns", "country"],
            from_value=COLUMN_COUNTRY,
            to_value=None,
        )
    ]


def test_column_type_changed() -> None:
    records = diff_dataset_columns([COLUMN_COUNTRY], [COLUMN_COUNTRY_TEXT])
    assert records == [
        ChangeRecord(
            kind="column",
            path=["columns", "country"],
            from_value=COLUMN_COUNTRY,
            to_value=COLUMN_COUNTRY_TEXT,
        )
    ]


def test_column_unchanged_emits_nothing() -> None:
    assert diff_dataset_columns([COLUMN_COUNTRY], [COLUMN_COUNTRY]) == []


def test_column_audit_only_change_is_ignored() -> None:
    """Refreshed ``changed_on`` alone must not produce a record.

    Reproduces the dataset-editor scenario where adding one calculated
    column refreshes ``changed_on`` on every other column as a
    side-effect of the save. Before the audit-field strip, each
    untouched column produced a spurious 'changed' record.
    """
    pre = {
        "column_name": "country",
        "type": "VARCHAR",
        "id": 1226,
        "table_id": 17,
        "changed_on": "2026-04-24T18:49:07.368009",
        "created_on": "2026-04-24T18:49:07.368008",
        "changed_by_fk": 1,
        "created_by_fk": 1,
    }
    post = dict(pre, changed_on="2026-04-24T18:49:07.502720")
    assert diff_dataset_columns([pre], [post]) == []


def test_column_id_change_with_same_content_is_ignored() -> None:
    """``override_columns`` re-insert gives new ids; don't fire a record.

    Under DatasetDAO.update_columns' override_columns pattern a
    column's row can be deleted and re-inserted with the same natural
    key (``column_name``) and content but a new auto-increment id.
    The natural key matches, so we don't emit add+remove; the id-only
    difference must be filtered so we don't emit a spurious 'changed'.
    """
    pre = {"column_name": "country", "type": "VARCHAR", "id": 1226, "table_id": 17}
    post = dict(pre, id=1234)
    assert diff_dataset_columns([pre], [post]) == []


def test_column_real_content_change_still_emits() -> None:
    """After stripping audit fields, a genuine content change still fires."""
    pre = {
        "column_name": "country",
        "type": "VARCHAR",
        "id": 1226,
        "changed_on": "2026-04-24T18:49:07.368009",
    }
    post = dict(pre, type="TEXT", changed_on="2026-04-24T18:49:07.502720")
    records = diff_dataset_columns([pre], [post])
    assert len(records) == 1
    # Stripped values reach the renderer — no audit noise in the record.
    assert "changed_on" not in records[0].from_value
    assert "changed_on" not in records[0].to_value
    assert records[0].from_value["type"] == "VARCHAR"
    assert records[0].to_value["type"] == "TEXT"


# ---------------------------------------------------------------------------
# (d-continued) Dataset metrics
# ---------------------------------------------------------------------------


DATASET_METRIC_SUM = {"metric_name": "sum_sales", "expression": "SUM(sales)"}
DATASET_METRIC_AVG = {"metric_name": "avg_sales", "expression": "AVG(sales)"}


def test_dataset_metric_added() -> None:
    records = diff_dataset_metrics([], [DATASET_METRIC_SUM])
    assert records == [
        ChangeRecord(
            kind="metric",
            path=["metrics", "sum_sales"],
            from_value=None,
            to_value=DATASET_METRIC_SUM,
        )
    ]


def test_dataset_metric_removed() -> None:
    records = diff_dataset_metrics(
        [DATASET_METRIC_SUM, DATASET_METRIC_AVG], [DATASET_METRIC_AVG]
    )
    assert records == [
        ChangeRecord(
            kind="metric",
            path=["metrics", "sum_sales"],
            from_value=DATASET_METRIC_SUM,
            to_value=None,
        )
    ]


# ---------------------------------------------------------------------------
# (e) Dashboard slices (chart membership)
# ---------------------------------------------------------------------------


def test_dashboard_chart_added() -> None:
    records = diff_dashboard_slices(["u-1"], ["u-1", "u-2"])
    assert records == [
        ChangeRecord(
            kind="chart",
            path=["slices", "u-2"],
            from_value=None,
            to_value="u-2",
        )
    ]


def test_dashboard_chart_removed() -> None:
    records = diff_dashboard_slices(["u-1", "u-2"], ["u-1"])
    assert records == [
        ChangeRecord(
            kind="chart",
            path=["slices", "u-2"],
            from_value="u-2",
            to_value=None,
        )
    ]


def test_dashboard_chart_no_change() -> None:
    assert diff_dashboard_slices(["u-1"], ["u-1"]) == []


def test_dashboard_chart_swap_emits_add_plus_remove() -> None:
    records = diff_dashboard_slices(["u-1"], ["u-2"])
    kinds = {r.kind for r in records}
    tos = {r.to_value for r in records}
    froms = {r.from_value for r in records}
    assert kinds == {"chart"}
    assert tos == {"u-2", None}
    assert froms == {"u-1", None}


# ---------------------------------------------------------------------------
# (f) Replay round-trip — SC-008
# ---------------------------------------------------------------------------


def _apply_field(state: dict[str, Any], path: list[Any], value: Any) -> None:
    """Generic set-by-path for ``kind="field"`` records."""
    cursor = state
    for seg in path[:-1]:
        cursor = cursor.setdefault(seg, {})
    cursor[path[-1]] = value


def _replay(pre: dict[str, Any], records: list[ChangeRecord]) -> dict[str, Any]:
    """Apply change records to the pre-state.

    Dispatches on ``kind`` because named kinds use natural-key paths
    (e.g. ``["columns", "country"]``) that are not valid JSON Pointer
    locations — the replay function has to understand the semantics
    of each kind.
    """
    state = deepcopy(pre)
    for r in records:
        if r.kind == "field":
            _apply_field(state, r.path, r.to_value)
        elif r.kind == "filter":
            _apply_list_by_key(state, r, list_key="adhoc_filters", id_key="subject")
        elif r.kind == "metric" and r.path[:2] == ["params", "metrics"]:
            _apply_list_by_key(state, r, list_key="metrics", id_key="label")
        elif r.kind == "metric" and r.path[:1] == ["metrics"]:
            _apply_dataset_list_by_key(
                state, r, list_key="metrics", id_key="metric_name"
            )
        elif r.kind == "column":
            _apply_dataset_list_by_key(
                state, r, list_key="columns", id_key="column_name"
            )
        elif r.kind == "dimension":
            _apply_scalar_list_by_key(state, r)
        elif r.kind in ("time_range", "color_palette"):
            params = _coerce_params_in_state(state)
            params[r.path[-1]] = r.to_value
            state["params"] = _json.dumps(params)
        elif r.kind == "chart":
            _apply_chart_membership(state, r)
        else:
            raise AssertionError(f"replay: unknown kind {r.kind!r}")
    return state


def _coerce_params_in_state(state: dict[str, Any]) -> dict[str, Any]:
    raw = state.get("params")
    if raw is None:
        return {}
    if isinstance(raw, str):
        return _json.loads(raw) if raw else {}
    return raw


def _apply_list_by_key(
    state: dict[str, Any], r: ChangeRecord, list_key: str, id_key: str
) -> None:
    """Apply a record to a ``params.<list_key>`` natural-keyed list."""
    params = _coerce_params_in_state(state)
    items = list(params.get(list_key, []))
    natural_key = r.path[-1]
    idx = next(
        (i for i, item in enumerate(items) if item.get(id_key) == natural_key), None
    )
    if r.to_value is None:
        # removal
        if idx is not None:
            items.pop(idx)
    elif idx is not None:
        # modify in place
        items[idx] = r.to_value
    else:
        items.append(r.to_value)
    params[list_key] = items
    state["params"] = _json.dumps(params)


def _apply_scalar_list_by_key(state: dict[str, Any], r: ChangeRecord) -> None:
    """Dimension-style: groupby/columns are lists of strings."""
    params = _coerce_params_in_state(state)
    list_key = r.path[1]  # "groupby" or "columns"
    items = list(params.get(list_key, []))
    natural_key = r.path[-1]
    if r.to_value is None:
        items = [x for x in items if x != natural_key]
    elif natural_key not in items:
        items.append(r.to_value)
    params[list_key] = items
    state["params"] = _json.dumps(params)


def _apply_dataset_list_by_key(
    state: dict[str, Any], r: ChangeRecord, list_key: str, id_key: str
) -> None:
    """Dataset children live at top level, not inside ``params``."""
    items = list(state.get(list_key, []))
    natural_key = r.path[-1]
    idx = next(
        (i for i, item in enumerate(items) if item.get(id_key) == natural_key), None
    )
    if r.to_value is None:
        if idx is not None:
            items.pop(idx)
    elif idx is not None:
        items[idx] = r.to_value
    else:
        items.append(r.to_value)
    state[list_key] = items


def _apply_chart_membership(state: dict[str, Any], r: ChangeRecord) -> None:
    items = list(state.get("slice_uuids", []))
    target = r.path[-1]
    if r.to_value is None:
        items = [u for u in items if u != target]
    elif target not in items:
        items.append(r.to_value)
    state["slice_uuids"] = items


def test_replay_slice_scalar_roundtrip() -> None:
    pre = {"slice_name": "Old", "description": None, "params": _params_json()}
    post = {
        "slice_name": "New",
        "description": "added",
        "params": _params_json(),
    }
    records = diff_slice(pre, post, fields=_SLICE_TEST_FIELDS)
    assert _replay(pre, records)["slice_name"] == post["slice_name"]
    assert _replay(pre, records)["description"] == post["description"]


def test_replay_slice_params_roundtrip_filter_added() -> None:
    pre = {"slice_name": "x", "params": _params_json(adhoc_filters=[])}
    post = {
        "slice_name": "x",
        "params": _params_json(adhoc_filters=[FILTER_COUNTRY]),
    }
    records = diff_slice(pre, post, fields=_SLICE_TEST_FIELDS)
    result = _replay(pre, records)
    assert _json.loads(result["params"]) == _json.loads(post["params"])


def test_replay_slice_params_roundtrip_filter_removed() -> None:
    pre = {
        "slice_name": "x",
        "params": _params_json(adhoc_filters=[FILTER_COUNTRY, FILTER_DATE]),
    }
    post = {
        "slice_name": "x",
        "params": _params_json(adhoc_filters=[FILTER_DATE]),
    }
    records = diff_slice(pre, post, fields=_SLICE_TEST_FIELDS)
    result = _replay(pre, records)
    assert _json.loads(result["params"]) == _json.loads(post["params"])


def test_replay_time_range_and_color_palette() -> None:
    pre = {
        "slice_name": "x",
        "params": _params_json(time_range="Last week", color_scheme="supersetColors"),
    }
    post = {
        "slice_name": "x",
        "params": _params_json(time_range="Last month", color_scheme="presetColors"),
    }
    records = diff_slice(pre, post, fields=_SLICE_TEST_FIELDS)
    result = _replay(pre, records)
    assert _json.loads(result["params"]) == _json.loads(post["params"])


def test_replay_dataset_columns_roundtrip() -> None:
    pre = {"columns": [COLUMN_COUNTRY, COLUMN_DATE]}
    post = {"columns": [COLUMN_COUNTRY_TEXT, COLUMN_DATE]}  # type-changed
    records = diff_dataset_columns(pre["columns"], post["columns"])
    assert _replay(pre, records)["columns"] == post["columns"]


def test_replay_dataset_metrics_roundtrip() -> None:
    pre = {"metrics": [DATASET_METRIC_SUM]}
    post = {"metrics": [DATASET_METRIC_AVG]}  # add avg, remove sum
    records = diff_dataset_metrics(pre["metrics"], post["metrics"])
    result_metrics = _replay(pre, records)["metrics"]
    # order-insensitive comparison
    assert sorted(result_metrics, key=lambda m: m["metric_name"]) == sorted(
        post["metrics"], key=lambda m: m["metric_name"]
    )


def test_replay_dashboard_slices_roundtrip() -> None:
    pre = {"slice_uuids": ["u-1", "u-2"]}
    post = {"slice_uuids": ["u-2", "u-3"]}  # remove u-1, add u-3
    records = diff_dashboard_slices(pre["slice_uuids"], post["slice_uuids"])
    result = _replay(pre, records)
    assert sorted(result["slice_uuids"]) == sorted(post["slice_uuids"])


def test_replay_dashboard_scalar_roundtrip() -> None:
    pre = {"dashboard_title": "Old", "position_json": '{"a":1}'}
    post = {"dashboard_title": "New", "position_json": '{"a":2}'}
    records = diff_dashboard(pre, post, fields=_DASHBOARD_TEST_FIELDS)
    assert _replay(pre, records) == {
        "dashboard_title": "New",
        "position_json": '{"a":2}',
    }


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_malformed_params_string_is_treated_as_empty() -> None:
    # If ``params`` is not valid JSON, ``diff_slice_params`` degrades
    # to "no params recorded" rather than crashing the save path.
    records = diff_slice_params("not json", _params_json(time_range="Last week"))
    assert records == [
        ChangeRecord(
            kind="time_range",
            path=["params", "time_range"],
            from_value=None,
            to_value="Last week",
        )
    ]


def test_none_params_on_both_sides() -> None:
    assert diff_slice_params(None, None) == []


def test_filter_without_subject_falls_back_to_position() -> None:
    # Keyless filters should not crash; they get a synthetic ``#0`` key.
    filter_no_subject = {"operator": "==", "comparator": "x"}
    records = diff_slice_params(
        _params_json(adhoc_filters=[]),
        _params_json(adhoc_filters=[filter_no_subject]),
    )
    assert len(records) == 1
    assert records[0].kind == "filter"
    assert records[0].to_value == filter_no_subject


def test_empty_state_emits_nothing() -> None:
    assert diff_slice({}, {}, fields=_SLICE_TEST_FIELDS) == []
    assert diff_dashboard({}, {}, fields=_DASHBOARD_TEST_FIELDS) == []
    assert diff_dataset({}, {}, fields=_DATASET_TEST_FIELDS) == []
    assert diff_dataset_columns([], []) == []
    assert diff_dataset_metrics([], []) == []
    assert diff_dashboard_slices([], []) == []
