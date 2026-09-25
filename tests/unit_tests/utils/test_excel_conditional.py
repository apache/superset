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

import io
from typing import Any

from openpyxl import load_workbook, Workbook
from openpyxl.worksheet.worksheet import Worksheet

from superset.utils.excel_conditional import apply_conditional_formatting


def _cf_rules(sheet: Worksheet) -> list[tuple[str, Any]]:
    rules: list[tuple[str, Any]] = []
    for cf_range, cf_list in sheet.conditional_formatting._cf_rules.items():  # noqa: SLF001
        for rule in cf_list:
            rules.append((str(cf_range), rule))
    return rules


def test_apply_conditional_formatting_writes_cell_is_rule() -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet["A1"] = "sales"
    sheet["B1"] = "region"
    sheet["A2"] = 10
    sheet["A3"] = 50
    sheet["A4"] = 5
    sheet["B2"] = "west"
    raw = io.BytesIO()
    workbook.save(raw)

    styled = apply_conditional_formatting(
        raw.getvalue(),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 8,
                "colorScheme": "#FF0000",
            }
        ],
    )
    result = load_workbook(io.BytesIO(styled)).active
    rules = _cf_rules(result)
    assert len(rules) == 1
    cf_range, rule = rules[0]
    assert "A2" in cf_range
    assert rule.type == "cellIs"
    assert rule.operator == "greaterThan"


def test_apply_cell_bars_when_show_cell_bars_and_no_custom_rules() -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet["A1"] = "sales"
    sheet["B1"] = "region"
    sheet["A2"] = 10
    sheet["B2"] = "west"
    raw = io.BytesIO()
    workbook.save(raw)

    styled = apply_conditional_formatting(
        raw.getvalue(),
        [],
        show_cell_bars=True,
    )
    result = load_workbook(io.BytesIO(styled)).active
    rules = _cf_rules(result)
    assert any(rule.type == "dataBar" for _, rule in rules)
    assert not any("B2" in cf_range for cf_range, _ in rules)


def test_cell_bar_object_writes_data_bar_rule() -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet["A1"] = "sales"
    sheet["A2"] = 12.5
    raw = io.BytesIO()
    workbook.save(raw)

    styled = apply_conditional_formatting(
        raw.getvalue(),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 10,
                "colorScheme": "#5AC189",
                "objectFormatting": "CELL_BAR",
            }
        ],
    )
    result = load_workbook(io.BytesIO(styled)).active
    rules = _cf_rules(result)
    assert any(rule.type == "dataBar" for _, rule in rules)


def test_color_scale_when_operator_is_none() -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet["A1"] = "sales"
    sheet["A2"] = 10
    raw = io.BytesIO()
    workbook.save(raw)

    styled = apply_conditional_formatting(
        raw.getvalue(),
        [{"column": "sales", "operator": None, "colorScheme": "colorSuccess"}],
    )
    result = load_workbook(io.BytesIO(styled)).active
    rules = _cf_rules(result)
    assert any(rule.type == "colorScale" for _, rule in rules)
