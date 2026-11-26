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
"""``dataBinding.filters`` took any dict at schema version 1 and applied only
Explore's adhoc shape; version 2 types the field. Stored props upgrade on
read and on write, so a widget saved at version 1 stays editable."""

from __future__ import annotations

from typing import Any

import pytest
from pytest_mock import MockerFixture

from superset.widgets.registry import registry

QUERYING = ["echarts", "metric-tile", "ag-grid-table"]


def binding(*filters: Any) -> dict[str, Any]:
    return {
        "dataBinding": {"datasetId": 1, "metrics": ["count"], "filters": list(filters)},
        "echartsOptions": {"series": [{"type": "bar"}]},
    }


@pytest.mark.parametrize("widget_type", QUERYING)
def test_querying_widgets_are_at_version_two_with_a_migrator(
    widget_type: str,
) -> None:
    widget = registry[widget_type]
    assert widget.schema_version == 2
    assert set(widget.migrators) == {1}


def test_adhoc_filters_become_the_filters_they_were_applied_as() -> None:
    widget = registry["echarts"]
    stored = binding(
        {
            "expressionType": "SIMPLE",
            "subject": "country",
            "operator": "==",
            "comparator": "FR",
            "clause": "WHERE",
        },
        {
            "expressionType": "SIMPLE",
            "subject": "size",
            "operator": "IN",
            "comparator": ["S", "M"],
        },
        {"expressionType": "SIMPLE", "subject": "status", "operatorId": "IS_NOT_NULL"},
        {"expressionType": "SQL", "sqlExpression": "a > 1", "clause": "WHERE"},
        {"expressionType": "SQL", "sqlExpression": "SUM(x) > 1", "clause": "HAVING"},
        # Already in the current shape: kept as is.
        {"column": "kept", "op": "=", "value": 1},
    )

    upgraded = widget.upgrade_props(stored, 1)

    assert upgraded["dataBinding"]["filters"] == [
        {"column": "country", "op": "=", "value": "FR"},
        {"column": "size", "op": "IN", "value": ["S", "M"]},
        {"column": "status", "op": "IS NOT NULL"},
        {"sql": "a > 1"},
        {"sql": "SUM(x) > 1", "clause": "HAVING"},
        {"column": "kept", "op": "=", "value": 1},
    ]
    assert upgraded["echartsOptions"] == stored["echartsOptions"]
    assert widget.validate_control_values(upgraded) == []


def test_filters_version_one_never_applied_are_left_out() -> None:
    """Version 1 skipped these at query time, so the rows don't change."""
    widget = registry["echarts"]
    stored = binding(
        {"country": "Atlantis"},
        # A simple HAVING filter had no query-object form.
        {
            "expressionType": "SIMPLE",
            "subject": "x",
            "operator": ">",
            "comparator": 1,
            "clause": "HAVING",
        },
        "junk",
    )

    assert widget.upgrade_props(stored, 1)["dataBinding"]["filters"] == []
    assert widget.upgrade_props(
        {"dataBinding": {"datasetId": 1, "filters": "x"}}, 1
    ) == {"dataBinding": {"datasetId": 1, "filters": []}}


def test_props_without_filters_are_untouched() -> None:
    props = {"dataBinding": {"datasetId": 1, "metrics": ["count"]}}
    assert registry["metric-tile"].upgrade_props(props, 1) == props


def test_a_widget_saved_at_version_one_can_be_saved_again(
    mocker: MockerFixture,
) -> None:
    """What a widget update and a canvas ``set_props`` run on stored props."""
    from superset.canvas.definition.ops import entity_props

    mocker.patch(
        "superset.canvas.definition.ops.unreadable_datasets", return_value=set()
    )
    stored = binding(
        {
            "expressionType": "SIMPLE",
            "subject": "country",
            "operator": "==",
            "comparator": "FR",
        }
    )
    edited = {**stored, "echartsOptions": {"series": [{"type": "line"}]}}

    props, version = entity_props("echarts", edited, 1, previous=stored)

    assert version == 2
    assert props["echartsOptions"] == {"series": [{"type": "line"}]}
    assert props["dataBinding"]["filters"] == [
        {"column": "country", "op": "=", "value": "FR"}
    ]
