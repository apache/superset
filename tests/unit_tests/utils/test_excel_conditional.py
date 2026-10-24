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

import pandas as pd
import pytest
from openpyxl import load_workbook, Workbook
from openpyxl.worksheet.worksheet import Worksheet

from superset.utils.excel import df_to_excel
from superset.utils.excel_conditional import (
    _value_matches_rule,
    apply_conditional_formatting,
    polish_explore_xlsx,
)


def _cf_rules(sheet: Worksheet) -> list[tuple[str, Any]]:
    """Collect (sqref, rule) pairs from the first sheet's conditional formatting."""
    rules: list[tuple[str, Any]] = []
    for cf_range, cf_list in sheet.conditional_formatting._cf_rules.items():  # noqa: SLF001
        sqref = str(getattr(cf_range, "sqref", cf_range)).replace("$", "")
        for rule in cf_list:
            rules.append((sqref, rule))
    return rules


def _workbook_with_sales(*values: float) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet["A1"] = "sales"
    sheet["B1"] = "region"
    for offset, value in enumerate(values, start=2):
        sheet.cell(row=offset, column=1, value=value)
    sheet["B2"] = "west"
    raw = io.BytesIO()
    workbook.save(raw)
    return raw.getvalue()


def test_apply_conditional_formatting_writes_cell_is_rule() -> None:
    """A greater-than rule becomes an Excel CellIs rule on the sales column."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10, 50, 5),
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
    """Table show_cell_bars adds data bars on numeric columns only."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10),
        [],
        show_cell_bars=True,
    )
    result = load_workbook(io.BytesIO(styled)).active
    rules = _cf_rules(result)
    assert any(rule.type == "dataBar" for _, rule in rules)
    assert not any("B2" in cf_range for cf_range, _ in rules)


def test_cell_bar_object_writes_data_bar_only_on_matching_cells() -> None:
    """CELL_BAR with a comparator covers matching cells, not the whole column."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(12.5, 5, 20),
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
    data_bars = [(rng, rule) for rng, rule in rules if rule.type == "dataBar"]
    assert len(data_bars) == 1
    cf_range, _ = data_bars[0]
    assert set(cf_range.split()) == {"A2", "A4"}


def test_color_scale_when_operator_is_none() -> None:
    """Operator None becomes a two-color scale, honoring minBound/maxBound."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10),
        [
            {
                "column": "sales",
                "operator": None,
                "colorScheme": "colorSuccess",
                "minBound": 0,
                "maxBound": 100,
            }
        ],
    )
    result = load_workbook(io.BytesIO(styled)).active
    rules = _cf_rules(result)
    assert any(rule.type == "colorScale" for _, rule in rules)
    scale = next(rule for _, rule in rules if rule.type == "colorScale")
    assert scale.colorScale.cfvo[0].type == "num"
    assert float(scale.colorScale.cfvo[0].val) == 0
    assert scale.colorScale.cfvo[1].type == "num"
    assert float(scale.colorScale.cfvo[1].val) == 100


def test_rule_matches_verbose_column_header() -> None:
    """Rules keyed by the physical column still apply after verbose rename."""
    workbook = Workbook()
    sheet = workbook.active
    sheet["A1"] = "Revenue"
    sheet["A2"] = 12
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
        verbose_map={"sales": "Revenue"},
    )
    rules = _cf_rules(load_workbook(io.BytesIO(styled)).active)
    assert len(rules) == 1
    assert "A2" in rules[0][0]


@pytest.mark.parametrize(
    ("value", "rule", "expected"),
    [
        (11, {"operator": ">", "targetValue": 10}, True),
        (10, {"operator": ">", "targetValue": 10}, False),
        (10, {"operator": ">=", "targetValue": 10}, True),
        (10, {"operator": "≥", "targetValue": 10}, True),
        (9, {"operator": "<", "targetValue": 10}, True),
        (10, {"operator": "<=", "targetValue": 10}, True),
        (10, {"operator": "≤", "targetValue": 10}, True),
        (10, {"operator": "=", "targetValue": 10}, True),
        (10, {"operator": "==", "targetValue": 10}, True),
        (9, {"operator": "≠", "targetValue": 10}, True),
        (10, {"operator": "!=", "targetValue": 10}, False),
        ("10", {"operator": ">", "targetValue": "8"}, True),
        ("west", {"operator": "=", "targetValue": "west"}, True),
        ("east", {"operator": ">", "targetValue": "west"}, False),
        (None, {"operator": ">", "targetValue": 1}, False),
        ("", {"operator": ">", "targetValue": 1}, False),
        (5, {"operator": None}, True),
        (5, {"operator": "None"}, True),
        (5, {"operator": ""}, True),
        (5, {"operator": "< x <", "targetValueLeft": 0, "targetValueRight": 10}, True),
        (0, {"operator": "< x <", "targetValueLeft": 0, "targetValueRight": 10}, False),
        (
            10,
            {"operator": "< x <", "targetValueLeft": 0, "targetValueRight": 10},
            False,
        ),
        (0, {"operator": "≤ x ≤", "targetValueLeft": 0, "targetValueRight": 10}, True),
        (10, {"operator": "≤ x ≤", "targetValueLeft": 0, "targetValueRight": 10}, True),
        (
            5,
            {"operator": "< x <", "targetValueLeft": None, "targetValueRight": 10},
            False,
        ),
        (5, {"operator": "unknown", "targetValue": 5}, False),
    ],
)
def test_value_matches_rule_comparators(
    value: Any, rule: dict[str, Any], expected: bool
) -> None:
    """CELL_BAR matching must keep Explore comparator semantics after the C901 split."""
    assert _value_matches_rule(value, rule) is expected


def test_returns_original_bytes_when_nothing_to_apply() -> None:
    raw = _workbook_with_sales(10)
    assert apply_conditional_formatting(raw, []) is raw


def test_missing_column_does_not_add_rules() -> None:
    styled = apply_conditional_formatting(
        _workbook_with_sales(10),
        [{"column": "missing", "operator": ">", "targetValue": 1}],
    )
    assert _cf_rules(load_workbook(io.BytesIO(styled)).active) == []


def test_range_operator_writes_formula_rule() -> None:
    styled = apply_conditional_formatting(
        _workbook_with_sales(5),
        [
            {
                "column": "sales",
                "operator": "≤ x ≤",
                "targetValueLeft": 0,
                "targetValueRight": 10,
                "colorScheme": "#00FF00",
            }
        ],
    )
    cf_range, rule = _cf_rules(load_workbook(io.BytesIO(styled)).active)[0]
    assert "A2" in cf_range
    assert rule.type == "expression"
    formula = "".join(str(part) for part in (rule.formula or []))
    assert "AND(" in formula
    assert "A2>=0" in formula
    assert "A2<=10" in formula


def test_text_color_cell_is_uses_font_not_fill() -> None:
    styled = apply_conditional_formatting(
        _workbook_with_sales(12),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 8,
                "colorScheme": "#FF0000",
                "objectFormatting": "TEXT_COLOR",
            }
        ],
    )
    _, rule = _cf_rules(load_workbook(io.BytesIO(styled)).active)[0]
    assert rule.type == "cellIs"
    assert rule.dxf is not None
    assert rule.dxf.font is not None
    assert str(rule.dxf.font.color.rgb).endswith("FF0000")
    assert rule.dxf.fill is None


def test_pivot_sum_header_matches_rule_column() -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet["A1"] = "SUM(sales)"
    sheet["A2"] = 12
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
    rules = _cf_rules(load_workbook(io.BytesIO(styled)).active)
    assert len(rules) == 1
    assert "A2" in rules[0][0]


def test_cell_bar_range_operator_covers_contiguous_matches() -> None:
    styled = apply_conditional_formatting(
        _workbook_with_sales(1, 5, 15),
        [
            {
                "column": "sales",
                "operator": "< x <",
                "targetValueLeft": 0,
                "targetValueRight": 10,
                "objectFormatting": "CELL_BAR",
                "colorScheme": "#5AC189",
            }
        ],
    )
    data_bars = [
        rng
        for rng, rule in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if rule.type == "dataBar"
    ]
    assert data_bars == ["A2:A3"]


def test_cell_bar_without_operator_covers_full_column() -> None:
    styled = apply_conditional_formatting(
        _workbook_with_sales(12.5, 5, 20),
        [
            {
                "column": "sales",
                "operator": None,
                "objectFormatting": "CELL_BAR",
                "colorScheme": "#5AC189",
            }
        ],
    )
    data_bars = [
        rng
        for rng, rule in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if rule.type == "dataBar"
    ]
    assert data_bars == ["A2:A4"]


def test_color_scale_without_bounds_uses_min_max() -> None:
    styled = apply_conditional_formatting(
        _workbook_with_sales(10),
        [{"column": "sales", "operator": None, "colorScheme": "success"}],
    )
    scale = next(
        rule
        for _, rule in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if rule.type == "colorScale"
    )
    assert scale.colorScale.cfvo[0].type == "min"
    assert scale.colorScale.cfvo[1].type == "max"


def test_polish_explore_xlsx_table_cf_on_xlsxwriter_workbook() -> None:
    """Explore Table download writes xlsxwriter; polish must still see data rows."""
    df = pd.DataFrame({"sales": [10, 50, 5], "region": ["west", "east", "north"]})
    polished = polish_explore_xlsx(
        df_to_excel(df, index=False),
        df,
        {
            "viz_type": "table",
            "conditionalFormatting": [
                {
                    "column": "sales",
                    "operator": ">",
                    "targetValue": 8,
                    "colorScheme": "#FF0000",
                }
            ],
            "show_cell_bars": False,
            "column_config": {
                "sales": {
                    "d3NumberFormat": ",.1f",
                    "horizontalAlign": "right",
                }
            },
        },
    )
    sheet = load_workbook(io.BytesIO(polished)).active
    assert sheet.max_row == 4
    assert sheet["A2"].value == 10
    assert sheet["A3"].value == 50
    rules = _cf_rules(sheet)
    assert len(rules) == 1
    assert rules[0][1].type == "cellIs"
    assert rules[0][1].operator == "greaterThan"
    assert "A2" in rules[0][0]
    assert sheet["A2"].number_format == "#,##0.0"
    assert sheet["A2"].alignment.horizontal == "right"
    assert sheet["B2"].alignment.horizontal is None


def test_polish_explore_xlsx_default_cell_bars_on_xlsxwriter() -> None:
    df = pd.DataFrame({"sales": [10, 20], "region": ["west", "east"]})
    polished = polish_explore_xlsx(
        df_to_excel(df, index=False),
        df,
        {
            "viz_type": "table",
            "show_cell_bars": True,
            "conditional_formatting": [],
        },
    )
    sheet = load_workbook(io.BytesIO(polished)).active
    data_bars = [rng for rng, rule in _cf_rules(sheet) if rule.type == "dataBar"]
    assert data_bars == ["A2:A3"]


def test_polish_explore_xlsx_skips_unrelated_viz() -> None:
    df = pd.DataFrame({"sales": [10]})
    raw = df_to_excel(df, index=False)
    assert (
        polish_explore_xlsx(raw, df, {"viz_type": "big_number", "show_cell_bars": True})
        is raw
    )


def test_polish_explore_xlsx_skips_pivot_percent_display_override() -> None:
    """Percent pivot already has Excel 0.0%; valueFormat must not replace it."""
    df = pd.DataFrame({"SUM(num)": [0.25]})
    polished = polish_explore_xlsx(
        df_to_excel(df, number_format="0.0%", index=False),
        df,
        {
            "viz_type": "pivot_table_v2",
            "showValuesAs": "percent_row",
            "valueFormat": ",.2f",
            "conditional_formatting": [
                {
                    "column": "SUM(num)",
                    "operator": ">",
                    "targetValue": 0.1,
                    "colorScheme": "#FF0000",
                }
            ],
        },
    )
    sheet = load_workbook(io.BytesIO(polished)).active
    assert "0.0%" in sheet["A2"].number_format
    assert sheet["A2"].number_format != "#,##0.00"
    rules = _cf_rules(sheet)
    assert len(rules) == 1
    assert rules[0][1].type == "cellIs"
