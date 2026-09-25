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

import pytest

from superset.dashboard_v2.document import (
    DocumentValidationError,
    load_stored_document,
    normalize_document,
    write_stored_document,
)
from superset.utils import json
from superset.widgets.data import (
    build_widget_query,
    FilterValidationError,
    resolved_filters_to_adhoc,
    WidgetDataError,
)

COLUMNS = {"gender", "num", "ds"}


def _document() -> dict[str, Any]:
    return {
        "version": 1,
        "nodes": {
            "root": {"type": "grid", "layout": {"columns": 24}, "children": ["tabs"]},
            "tabs": {
                "type": "tabs",
                "children": ["node_1", "node_2"],
                "props": {"title": "Tabs"},
            },
            "node_1": {
                "type": "echarts",
                "layout": {"colSpan": 12},
                "props": {"dataBinding": {"datasetId": 7, "metrics": ["count"]}},
                "widgetUuid": "stale-key-from-an-older-document",
            },
            "node_2": {"type": "markdown", "props": {"content": "# hi"}},
        },
    }


def test_normalize_document_keeps_props_inline_and_drops_unknown_keys() -> None:
    stored, leaves = normalize_document(_document())

    assert stored["version"] == 1
    assert stored["nodes"]["node_1"] == {
        "type": "echarts",
        "layout": {"colSpan": 12},
        "props": {"dataBinding": {"datasetId": 7, "metrics": ["count"]}},
    }
    assert stored["nodes"]["tabs"]["children"] == ["node_1", "node_2"]
    assert [(leaf.node_id, leaf.widget_type) for leaf in leaves] == [
        ("node_1", "echarts"),
        ("node_2", "markdown"),
    ]
    assert leaves[1].props == {"content": "# hi"}


@pytest.mark.parametrize(
    "document, message",
    [
        (None, "document.nodes"),
        ({"nodes": {}}, "root container"),
        (
            {"nodes": {"root": {"type": "grid", "children": ["missing"]}}},
            "unknown children",
        ),
        (
            {
                "nodes": {
                    "root": {"type": "grid", "children": ["a"]},
                    "a": {"type": "markdown", "props": ["not", "a", "dict"]},
                }
            },
            "props must be an object",
        ),
        (
            {
                "nodes": {
                    "root": {"type": "grid", "children": ["a"]},
                    "a": {"props": {}},
                }
            },
            "string type",
        ),
    ],
)
def test_normalize_document_rejects_malformed(document: Any, message: str) -> None:
    with pytest.raises(DocumentValidationError, match=message):
        normalize_document(document)


def test_stored_document_round_trips_through_json_metadata() -> None:
    stored, _ = normalize_document(_document())
    json_metadata = write_stored_document(
        json.dumps({"color_scheme": "supersetColors"}), stored
    )

    metadata = json.loads(json_metadata)
    assert metadata["color_scheme"] == "supersetColors"
    assert load_stored_document(json_metadata) == stored


def test_load_stored_document_rejects_non_v2() -> None:
    assert load_stored_document(json.dumps({"color_scheme": "x"})) is None
    assert load_stored_document("not json") is None
    assert load_stored_document(None) is None


@pytest.mark.parametrize(
    "resolved, expected",
    [
        ({"column": "gender", "operator": "EQUALS", "value": "boy"}, [("==", "boy")]),
        (
            {"column": "gender", "operator": "NOT_EQUALS", "value": "boy"},
            [("!=", "boy")],
        ),
        (
            {"column": "gender", "operator": "IN", "value": ["a", "b"]},
            [("IN", ["a", "b"])],
        ),
        (
            {"column": "gender", "operator": "NOT_IN", "value": ["a"]},
            [("NOT IN", ["a"])],
        ),
        (
            {"column": "num", "operator": "RANGE", "value": {"min": 1, "max": 5}},
            [(">=", 1), ("<=", 5)],
        ),
        (
            {
                "column": "ds",
                "operator": "TIME_RANGE",
                "value": {"start": "2020-01-01", "end": "2021-01-01"},
            },
            [(">=", "2020-01-01"), ("<", "2021-01-01")],
        ),
        ({"column": "gender", "operator": "IN", "value": []}, []),
        (
            {
                "column": "gender",
                "operator": "EQUALS",
                "value": "boy",
                "datasource": 7,
            },
            [("==", "boy")],
        ),
    ],
)
def test_resolved_filters_to_adhoc(
    resolved: dict[str, Any], expected: list[tuple[str, Any]]
) -> None:
    adhoc = resolved_filters_to_adhoc([resolved], COLUMNS)

    assert [(item["operator"], item["comparator"]) for item in adhoc] == expected
    assert all(
        item["expressionType"] == "SIMPLE"
        and item["clause"] == "WHERE"
        and item["subject"] == resolved["column"]
        for item in adhoc
    )


@pytest.mark.parametrize(
    "filters, message",
    [
        ({"column": "gender"}, "must be a list"),
        (["gender = 'boy'"], "must be an object"),
        (
            [{"column": "salary", "operator": "EQUALS", "value": 1}],
            "unknown column",
        ),
        (
            [{"column": "gender", "operator": "LIKE", "value": "b%"}],
            "unsupported operator",
        ),
        (
            [{"expressionType": "SQL", "clause": "WHERE", "sqlExpression": "1 = 1"}],
            "unknown column",
        ),
        (
            [{"column": "gender", "operator": "EQUALS", "value": ["a"]}],
            "scalar",
        ),
        (
            [{"column": "gender", "operator": "IN", "value": [{"a": 1}]}],
            "list of scalars",
        ),
        (
            [
                {
                    "column": "num",
                    "operator": "RANGE",
                    "value": {"min": 1, "sqlExpression": "1"},
                }
            ],
            "object with",
        ),
    ],
)
def test_resolved_filters_to_adhoc_rejects(filters: Any, message: str) -> None:
    with pytest.raises(FilterValidationError, match=message):
        resolved_filters_to_adhoc(filters, COLUMNS)


def test_build_widget_query_uses_stored_binding() -> None:
    props = {
        "dataBinding": {
            "datasetId": 7,
            "metrics": ["count", ""],
            "dimensions": ["gender", ""],
            "filters": [
                {"expressionType": "SQL", "clause": "WHERE", "sqlExpression": "1 = 1"},
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "num",
                    "operator": ">",
                    "comparator": 0,
                },
                {},
            ],
        }
    }
    host_filters = resolved_filters_to_adhoc(
        [{"column": "gender", "operator": "EQUALS", "value": "boy"}], COLUMNS
    )

    dataset_id, query, form_data = build_widget_query(props, host_filters)

    assert dataset_id == 7
    assert query["metrics"] == ["count"]
    assert query["columns"] == ["gender"]
    assert query["row_limit"] == 1000
    assert query["extras"] == {"where": "(1 = 1)", "having": ""}
    assert query["filters"] == [
        {"col": "num", "op": ">", "val": 0},
        {"col": "gender", "op": "==", "val": "boy"},
    ]
    assert form_data["datasource"] == "7__table"


@pytest.mark.parametrize(
    "props",
    [{}, {"dataBinding": {"metrics": ["count"]}}, {"dataBinding": {"datasetId": "7"}}],
)
def test_build_widget_query_requires_binding(props: dict[str, Any]) -> None:
    with pytest.raises(WidgetDataError):
        build_widget_query(props, [])
