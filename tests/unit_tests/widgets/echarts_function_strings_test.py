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
"""A JavaScript function in an ECharts option is refused when written: the
renderer can't run it, and ECharts would draw its source as the label."""

from __future__ import annotations

from typing import Any

import pytest

from superset.widgets.controls import javascript_functions
from superset.widgets.registry import registry


def props(options: dict[str, Any]) -> dict[str, Any]:
    return {
        "dataBinding": {"datasetId": 1, "metrics": ["count"]},
        "echartsOptions": options,
    }


@pytest.mark.parametrize(
    "source",
    [
        "function (p) { return '$' + p.value.toLocaleString(); }",
        "async function format(p) { return p.value }",
        "(p) => p.value",
        "p => p.value",
        "value => value + ' USD'",
        "p => p",
        "  function(){}",
    ],
)
def test_a_function_string_anywhere_in_the_option_is_refused(source: str) -> None:
    widget = registry["echarts"]

    errors = widget.validate_control_values(props({"tooltip": {"formatter": source}}))

    assert [error["loc"] for error in errors] == [["echartsOptions"]]
    assert "tooltip.formatter is a JavaScript function" in errors[0]["message"]
    assert "$template" in errors[0]["message"]

    nested = props({"series": [{"label": {"formatter": source}}]})
    assert (
        "series[0].label.formatter"
        in widget.validate_control_values(nested)[0]["message"]
    )


def test_template_strings_and_prose_are_not_functions() -> None:
    widget = registry["echarts"]
    options = {
        "tooltip": {"formatter": "{b}: {c} USD"},
        "title": {"text": "2023 => 2024 (forecast)", "subtext": "function (beta) x"},
        "legend": {"data": ["Old => New (2024)"]},
        "series": [{"name": "f => growth", "data": [1, 2]}],
        "label": {"formatter": {"$template": "{{name}}"}},
    }

    assert widget.validate_control_values(props(options)) == []
    assert javascript_functions(options) == []
