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
"""Dataset column/metric ``extra`` rewrites are not recorded as edits.

The dataset editor re-sends every column and metric with ``extra`` serialized
as ``"{}"`` (or with JSON spacing that differs from the stored value), so a
save that changes only the description and one column label used to record
a phantom edit for every untouched column and metric — and the related-row
summary then read "Dataset metric changed".
"""

from __future__ import annotations

from typing import Any

import pytest

from superset.versioning.diff import diff_dataset_columns, diff_dataset_metrics


def _metric(extra: Any, expression: str = "COUNT(*)") -> dict[str, Any]:
    return {
        "id": 1,
        "metric_name": "count",
        "expression": expression,
        "verbose_name": "COUNT(*)",
        "extra": extra,
    }


def _column(name: str, verbose_name: str | None, extra: Any) -> dict[str, Any]:
    return {
        "id": 1,
        "column_name": name,
        "verbose_name": verbose_name,
        "type": "VARCHAR",
        "extra": extra,
    }


def test_untouched_items_resaved_with_empty_extra_record_only_the_label_edit() -> None:
    """QA repro: description + one column label changed, metrics untouched."""
    pre_cols = [_column("country", None, None), _column("city", None, None)]
    post_cols = [_column("country", "Country", "{}"), _column("city", None, "{}")]

    column_records = diff_dataset_columns(pre_cols, post_cols)
    metric_records = diff_dataset_metrics([_metric(None)], [_metric("{}")])

    assert metric_records == []
    assert [(r.kind, r.operation, r.path) for r in column_records] == [
        ("column", "edit", ["columns", "country"])
    ]


@pytest.mark.parametrize(
    "before, after",
    [
        (None, "{}"),
        ("", "{}"),
        (None, ""),
        ('{"certification": null, "warning_markdown": null}', None),
        ('{"warning_markdown": "careful"}', '{ "warning_markdown" : "careful" }'),
        (
            '{"certification": {"certified_by": "Ann", "details": null}}',
            '{"certification": {"certified_by": "Ann"}}',
        ),
        (
            '{"certification": {"certified_by": "Ann"}, "warning_markdown": "w"}',
            '{"warning_markdown":"w","certification":{"certified_by":"Ann"}}',
        ),
        (
            '{"folders": [{"name": "Sales", "description": null}]}',
            '{"folders": [{"name": "Sales"}]}',
        ),
    ],
    ids=[
        "null-to-empty-object",
        "empty-string-to-empty-object",
        "null-to-empty-string",
        "null-valued-keys",
        "json-spacing",
        "nested-null-key",
        "key-order",
        "null-key-in-object-in-array",
    ],
)
def test_equivalent_extra_is_not_an_edit(before: Any, after: Any) -> None:
    assert diff_dataset_metrics([_metric(before)], [_metric(after)]) == []
    assert (
        diff_dataset_columns(
            [_column("country", None, before)], [_column("country", None, after)]
        )
        == []
    )


@pytest.mark.parametrize(
    "before, after",
    [
        (None, '{"certification": {"certified_by": "Ann"}}'),
        ('{"warning_markdown": "old"}', '{"warning_markdown": "new"}'),
        ('{"warning_markdown": "w"}', "{}"),
        ("not json", "also not json"),
        (None, "[]"),
        (None, "0"),
        ('{"flag": true}', '{"flag": 1}'),
    ],
    ids=[
        "certification-added",
        "warning-changed",
        "warning-removed",
        "unparseable-changed",
        "empty-list-is-not-unset",
        "zero-is-not-unset",
        "bool-vs-number",
    ],
)
def test_real_extra_change_is_still_recorded(before: Any, after: Any) -> None:
    metric_records = diff_dataset_metrics([_metric(before)], [_metric(after)])

    assert [(r.kind, r.operation) for r in metric_records] == [("metric", "edit")]
    # The recorded values are the stored ones, not the normalized comparison.
    assert metric_records[0].from_value["extra"] == before
    assert metric_records[0].to_value["extra"] == after


def test_other_metric_edit_is_recorded_alongside_an_equivalent_extra() -> None:
    records = diff_dataset_metrics(
        [_metric(None)], [_metric("{}", expression="COUNT(1)")]
    )

    assert [(r.kind, r.operation, r.path) for r in records] == [
        ("metric", "edit", ["metrics", "count"])
    ]
