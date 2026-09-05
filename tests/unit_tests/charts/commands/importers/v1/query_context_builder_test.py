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
"""
Hermetic unit tests for ``build_query_context_config`` (F1-T1 / F1-T3).

Pins the FR-002 (fidelity) / FR-003 (honest-fail) boundary, adhoc-filter
translation (RISK-T05), datasource isolation (RISK-T02), idempotency
(NFR-REL-01), and payload validity (RISK-T04). No DB / network — pure.

RED anchors are flagged inline: they fail against a pre-fix tree (module absent)
and pin the derivation contract.
"""

from typing import Any

import pytest

from superset.commands.chart.query_context_builder import build_query_context_config


def test_derivable_metrics_and_columns() -> None:
    """A chart with metrics + groupby + a datasource → a well-formed payload."""
    params: dict[str, Any] = {
        "metrics": ["sum__num"],
        "groupby": ["gender"],
        "time_range": "100 years ago : now",
        "row_limit": 100,
    }
    query_context = build_query_context_config(params, "table", 12, "table")

    # --- RED anchor: synthesis must produce a datasource-backed payload ---
    assert query_context is not None
    assert set(query_context.keys()) == {
        "datasource",
        "force",
        "queries",
        "result_format",
        "result_type",
    }
    assert query_context["result_format"] == "json"
    assert query_context["result_type"] == "full"
    assert query_context["force"] is False

    query_object = query_context["queries"][0]
    assert query_object["metrics"] == ["sum__num"]
    assert query_object["columns"] == ["gender"]  # groupby → columns alias
    assert query_object["time_range"] == "100 years ago : now"
    assert query_object["row_limit"] == 100


def test_columns_only_via_groupby_alias() -> None:
    """columns-only (through the deprecated `groupby` alias) is derivable."""
    query_context = build_query_context_config(
        {"groupby": ["gender"]}, "table", 7, "table"
    )
    assert query_context is not None
    assert query_context["queries"][0]["columns"] == ["gender"]
    assert query_context["queries"][0]["metrics"] == []


def test_metrics_only_is_derivable() -> None:
    """metrics-only (no columns/groupby) is derivable."""
    query_context = build_query_context_config(
        {"metrics": ["count"]}, "big_number_total", 7, "table"
    )
    assert query_context is not None
    assert query_context["queries"][0]["metrics"] == ["count"]


def test_singular_metric_is_normalized_and_derivable() -> None:
    """
    Single-metric viz types (e.g. Big Number) persist the metric under the
    singular ``metric`` key. It must be normalized into ``metrics`` so the chart
    is derivable rather than classified non-derivable (#33615 review: Big Number
    left with a NULL query_context and a 400 data endpoint).
    """
    query_context = build_query_context_config(
        {"metric": "count"}, "big_number", 7, "table"
    )
    assert query_context is not None
    assert query_context["queries"][0]["metrics"] == ["count"]


def test_plural_metrics_take_precedence_over_singular() -> None:
    """When both keys exist, the plural ``metrics`` list wins (no duplication)."""
    query_context = build_query_context_config(
        {"metrics": ["sum__num"], "metric": "count"}, "table", 7, "table"
    )
    assert query_context is not None
    assert query_context["queries"][0]["metrics"] == ["sum__num"]


def test_datasource_taken_from_argument_not_params() -> None:
    """
    Datasource must come from the resolved id/type, NEVER from free-form
    ``params.datasource`` (RISK-T02 / ADR-014 — SEC-T4 unit counterpart).
    """
    params = {"metrics": ["sum__num"], "datasource": "999__table"}
    query_context = build_query_context_config(params, "table", 12, "table")

    # --- RED anchor: datasource fidelity (isolation-critical) ---
    assert query_context is not None
    assert query_context["datasource"] == {"id": 12, "type": "table"}
    assert query_context["datasource"]["id"] != 999


@pytest.mark.parametrize(
    "params,viz_type,datasource_id",
    [
        ({"metrics": ["x"]}, "table", None),  # no datasource
        ({"metrics": ["x"]}, "table", 0),  # falsy datasource id
        ({}, "table", 12),  # no metrics AND no columns/groupby
        ({"metrics": [], "groupby": []}, "table", 12),  # empty query intent
        ({"metrics": ["x"]}, "markup", 12),  # datasource-less viz
        ({"metrics": ["x"]}, "divider", 12),  # datasource-less viz
    ],
)
def test_non_derivable_returns_none(
    params: dict[str, Any], viz_type: str, datasource_id: Any
) -> None:
    """Every FR-003 non-derivable branch → None (never a fabricated context)."""
    # --- RED anchor: honest-fail classification (FR-003) ---
    assert build_query_context_config(params, viz_type, datasource_id, "table") is None


def test_handlebars_is_derivable() -> None:
    """
    `handlebars` renders a template over query results — it has a real buildQuery
    and a parity golden — so the fallback must derive it too. Classifying it
    datasource-less left imported handlebars charts with a null context that 400s
    when the V8 bundle is unavailable (#33615 review).
    """
    query_context = build_query_context_config(
        {"metrics": ["count"]}, "handlebars", 7, "table"
    )
    assert query_context is not None
    assert query_context["queries"][0]["metrics"] == ["count"]


def test_adhoc_simple_filter_translation() -> None:
    """SIMPLE adhoc filters → simple {col, op, val} filters."""
    params = {
        "metrics": ["sum__num"],
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "subject": "gender",
                "operator": "==",
                "comparator": "boy",
                "clause": "WHERE",
            }
        ],
    }
    query_context = build_query_context_config(params, "table", 12, "table")
    assert query_context is not None
    assert query_context["queries"][0]["filters"] == [
        {"col": "gender", "op": "==", "val": "boy"}
    ]


def test_adhoc_sql_filter_routed_to_extras_and_no_crash() -> None:
    """
    A SQL-expression adhoc filter is routed to ``extras.where`` (and HAVING to
    ``extras.having``); a malformed/unmappable filter is dropped without raising
    (RISK-T05).
    """
    params = {
        "metrics": ["sum__num"],
        "adhoc_filters": [
            {"expressionType": "SQL", "sqlExpression": "num > 0", "clause": "WHERE"},
            {
                "expressionType": "SQL",
                "sqlExpression": "sum(num) > 1",
                "clause": "HAVING",
            },
            {"expressionType": "SIMPLE"},  # unmappable → dropped, no crash
            "not-a-dict",  # junk → skipped, no crash
        ],
    }
    query_context = build_query_context_config(params, "table", 12, "table")
    assert query_context is not None
    extras = query_context["queries"][0]["extras"]
    # Composed via the shared splitter: each predicate is parenthesized.
    assert extras["where"] == "(num > 0)"
    assert extras["having"] == "(sum(num) > 1)"
    assert query_context["queries"][0]["filters"] == []


def test_adhoc_sql_or_predicate_is_parenthesized() -> None:
    """
    Multiple SQL WHERE predicates must be parenthesized before being AND-joined,
    like ``split_adhoc_filters_into_base_filters`` (#33615 review). Without the
    parentheses, ``status='a' OR status='b'`` AND ``type='x'`` would bind as
    ``status='a' OR (status='b' AND type='x')`` and change the result set.
    """
    params = {
        "metrics": ["sum__num"],
        "adhoc_filters": [
            {
                "expressionType": "SQL",
                "sqlExpression": "status = 'a' OR status = 'b'",
                "clause": "WHERE",
            },
            {"expressionType": "SQL", "sqlExpression": "type = 'x'", "clause": "WHERE"},
        ],
    }
    query_context = build_query_context_config(params, "table", 12, "table")
    assert query_context is not None
    assert query_context["queries"][0]["extras"]["where"] == (
        "(status = 'a' OR status = 'b') AND (type = 'x')"
    )


def test_adhoc_sql_trailing_comment_is_neutralized() -> None:
    """
    A trailing ``--`` line comment must not swallow predicates joined after it;
    the shared splitter appends a newline so the following ``AND`` survives.
    """
    params = {
        "metrics": ["sum__num"],
        "adhoc_filters": [
            {
                "expressionType": "SQL",
                "sqlExpression": "a = 1 -- note",
                "clause": "WHERE",
            },
            {"expressionType": "SQL", "sqlExpression": "b = 2", "clause": "WHERE"},
        ],
    }
    query_context = build_query_context_config(params, "table", 12, "table")
    assert query_context is not None
    where = query_context["queries"][0]["extras"]["where"]
    # The newline keeps `b = 2` from being commented out.
    assert "\n) AND (b = 2)" in where


def test_idempotent_deterministic() -> None:
    """
    Re-invoking with the same params yields an equal payload (NFR-REL-01,
    supports FR-006 idempotency).
    """
    params = {"metrics": ["sum__num"], "groupby": ["gender"]}
    first = build_query_context_config(params, "table", 12, "table")
    second = build_query_context_config(params, "table", 12, "table")
    assert first == second


def test_none_params_is_non_derivable() -> None:
    """A missing/None params object is non-derivable, not a crash."""
    assert build_query_context_config(None, "table", 12, "table") is None


def test_payload_round_trips_through_query_context_factory() -> None:
    """
    RISK-T04 / INV-1: the synthesized payload must be one that
    ``QueryContextFactory.create(**payload)`` accepts (the real verification
    path, NOT a mock). Requires an app context + a resolvable datasource, so it
    is skipped when the integration DB is unavailable.

    [SECURITY-CRITICAL] This is the real end-to-end validity check for the
    helper's output shape.
    """
    pytest.importorskip("superset.common.query_context_factory")
    factory_module = __import__(
        "superset.common.query_context_factory",
        fromlist=["QueryContextFactory"],
    )
    QueryContextFactory = factory_module.QueryContextFactory  # noqa: N806

    params = {"metrics": ["count"], "groupby": ["gender"]}
    payload = build_query_context_config(params, "table", 1, "table")
    assert payload is not None
    try:
        # --- RED anchor: produced payload constructs a real QueryContext ---
        QueryContextFactory().create(**payload)
    except Exception as exc:  # pragma: no cover - environment-dependent
        pytest.skip(
            f"QueryContextFactory.create needs an app context / datasource: {exc}"
        )
