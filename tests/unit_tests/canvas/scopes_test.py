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
from typing import Any

import pytest

from superset.canvas.definition.ops import (
    apply_operations,
    FieldGroup,
    overlapping,
    Touch,
)
from superset.canvas.definition.scopes import resolve_scopes
from superset.canvas.definition.validation import (
    DefinitionValidationError,
    normalize_definition,
)
from tests.unit_tests.canvas.fixtures import (
    canvas,
    canvas_widget_types,
    FakeResolver,
    node,
    ops,
)


def all_scopes(raw: dict[str, Any]) -> dict[str, dict[str, list[str]]]:
    rules, resolver = canvas_widget_types(), FakeResolver()
    return resolve_scopes(normalize_definition(raw, rules, resolver), rules, resolver)


def scopes(raw: dict[str, Any]) -> dict[str, list[str]]:
    return all_scopes(raw)["filterScopes"]


def analyst_view(**interactions: Any) -> dict[str, Any]:
    """Example dashboard 3: markdown intro, a nested container of two charts
    sharing a filter, and a third chart with its own filter."""
    raw = canvas(
        {
            "intro": node("markdown"),
            "section": node("group", children=["f1", "c1", "c2"]),
            "f1": node("filter-1"),
            "c1": node("chart-1"),
            "c2": node("chart-2"),
            "f2": node("filter-2"),
            "c3": node("chart-3"),
        },
        children=["intro", "section", "f2", "c3"],
    )
    raw["interactions"] = {"filters": interactions}
    return raw


def test_auto_scope_follows_the_nearest_container() -> None:
    assert scopes(analyst_view()) == {
        "f1": ["c1", "c2"],
        # At the root a filter drives every chart on the canvas.
        "f2": ["c1", "c2", "c3"],
    }


def test_global_scope_with_exclusions() -> None:
    result = scopes(analyst_view(f2={"mode": "global", "exclude": ["c1", "c2"]}))

    assert result["f2"] == ["c3"]


def test_custom_scope_names_its_targets() -> None:
    result = scopes(analyst_view(f1={"mode": "custom", "targets": ["c3"]}))

    assert result["f1"] == ["c3"]


def test_tabs_contain_their_filters() -> None:
    raw = canvas(
        {
            "tabs": node("tabs", children=["t1", "t2"]),
            "t1": node("tab-1", children=["f", "c1"]),
            "t2": node("tab-2", children=["c2"]),
            "f": node("filter"),
            "c1": node("chart-1"),
            "c2": node("chart-2"),
        },
        children=["tabs"],
    )

    assert scopes(raw) == {"f": ["c1"]}


def test_filter_bars_do_not_contain_scope() -> None:
    raw = canvas(
        {
            "bar": node("filterbar", children=["f"]),
            "f": node("filter"),
            "g": node("group", children=["c1"]),
            "c1": node("chart-1"),
            "c2": node("chart-2"),
        },
        children=["bar", "g", "c2"],
    )

    assert scopes(raw) == {"f": ["c1", "c2"]}


@pytest.mark.parametrize(
    "override,message",
    [
        ({"c1": {"mode": "global"}}, "node 'c1' is not a filter"),
        (
            {"f1": {"mode": "custom", "targets": ["intro"]}},
            "node 'intro' cannot be filtered",
        ),
        ({"f1": {"mode": "custom", "targets": ["ghost"]}}, "unknown node 'ghost'"),
        ({"f1": {"mode": "auto", "targets": ["c1"]}}, "takes exclude, not targets"),
    ],
)
def test_invalid_overrides(override: dict[str, Any], message: str) -> None:
    with pytest.raises(DefinitionValidationError) as excinfo:
        normalize_definition(
            analyst_view(**override), canvas_widget_types(), FakeResolver()
        )

    assert any(message in issue.message for issue in excinfo.value.issues)


def apply(raw: dict[str, Any], *raw_ops: dict[str, Any]) -> Any:
    rules, resolver = canvas_widget_types(), FakeResolver()
    return apply_operations(
        normalize_definition(raw, rules, resolver),
        ops(*raw_ops),
        widget_types=rules,
        resolver=resolver,
    )


def test_set_filter_scope_and_restore_auto() -> None:
    doc, applied = apply(
        analyst_view(),
        {
            "op": "set_scope",
            "kind": "filter",
            "id": "f2",
            "scope": {"mode": "custom", "targets": ["c3"]},
        },
    )

    assert doc["interactions"]["filters"]["f2"] == {
        "mode": "custom",
        "targets": ["c3"],
        "exclude": [],
    }
    assert applied[0].touched == [Touch("f2", FieldGroup.FILTER_SCOPE)]

    doc, _ = apply(
        doc, {"op": "set_scope", "kind": "filter", "id": "f2", "scope": None}
    )

    assert doc["interactions"]["filters"] == {}


def test_removing_nodes_prunes_scope_overrides() -> None:
    doc, applied = apply(
        analyst_view(
            f1={"mode": "custom", "targets": ["c1", "c3"]},
            f2={"mode": "global", "exclude": ["c3"]},
        ),
        {"op": "remove", "id": "c3"},
    )

    assert doc["interactions"]["filters"]["f1"]["targets"] == ["c1"]
    assert doc["interactions"]["filters"]["f2"]["exclude"] == []
    assert Touch("f1", FieldGroup.FILTER_SCOPE) in applied[0].touched

    doc, _ = apply(doc, {"op": "remove", "id": "section"})

    assert set(doc["interactions"]["filters"]) == {"f2"}


def test_scope_edits_conflict_only_with_scope_edits() -> None:
    scope = [Touch("f1", FieldGroup.FILTER_SCOPE)]

    assert overlapping(scope, [Touch("f1", FieldGroup.LAYOUT)]) == set()
    assert overlapping(scope, scope) == {"f1"}


def sales_view(**settings: Any) -> dict[str, Any]:
    """Two cross-filtering charts and a group-by in a tab, plus a chart outside."""
    raw = canvas(
        {
            "tabs": node("tabs", children=["tab"]),
            "tab": node("tab", children=["x1", "x2", "g1"]),
            "x1": node("xchart-1"),
            "x2": node("xchart-2"),
            "g1": node("groupby-1"),
            "c1": node("chart-1"),
        },
        children=["tabs", "c1"],
    )
    return {**raw, "settings": settings}


def test_cross_filters_and_customizations_scope_like_filters() -> None:
    resolved = all_scopes(sales_view())

    assert resolved["crossFilterScopes"] == {"x1": ["x2"], "x2": ["x1"]}
    assert resolved["customizationScopes"] == {"g1": ["x1", "x2"]}
    assert resolved["filterScopes"] == {}


def test_cross_filter_scopes_are_empty_while_turned_off() -> None:
    resolved = all_scopes(sales_view(crossFilters={"enabled": False}))

    assert resolved["crossFilterScopes"] == {}
    assert resolved["customizationScopes"] == {"g1": ["x1", "x2"]}


def test_scope_kinds_are_set_and_merged_independently() -> None:
    doc, applied = apply(
        sales_view(),
        {
            "op": "set_scope",
            "kind": "crossFilter",
            "id": "x1",
            "scope": {"mode": "global"},
        },
    )

    assert doc["interactions"]["crossFilters"]["x1"]["mode"] == "global"
    assert applied[0].touched == [Touch("x1", FieldGroup.CROSS_FILTER_SCOPE)]
    assert (
        overlapping(applied[0].touched, [Touch("x1", FieldGroup.FILTER_SCOPE)]) == set()
    )
    rules, resolver = canvas_widget_types(), FakeResolver()
    assert resolve_scopes(doc, rules, resolver)["crossFilterScopes"]["x1"] == [
        "x2",
        "c1",
    ]


def test_scope_override_needs_the_matching_role() -> None:
    with pytest.raises(DefinitionValidationError, match="is not a customization"):
        apply(
            sales_view(),
            {
                "op": "set_scope",
                "kind": "customization",
                "id": "x1",
                "scope": {"mode": "global"},
            },
        )


def test_removing_nodes_prunes_every_scope_kind() -> None:
    raw = sales_view()
    raw["interactions"] = {
        "crossFilters": {"x1": {"mode": "custom", "targets": ["x2", "c1"]}},
        "customizations": {"g1": {"mode": "auto", "exclude": ["x2"]}},
    }

    doc, applied = apply(raw, {"op": "remove", "id": "x2"})

    assert doc["interactions"]["crossFilters"]["x1"]["targets"] == ["c1"]
    assert doc["interactions"]["customizations"]["g1"]["exclude"] == []
    assert Touch("x1", FieldGroup.CROSS_FILTER_SCOPE) in applied[0].touched
    assert Touch("g1", FieldGroup.CUSTOMIZATION_SCOPE) in applied[0].touched
