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
    """Build a two-column sheet: numeric ``sales`` plus a text ``region``."""
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


def _workbook_with_seq_and_sales() -> bytes:
    """Numeric ``seq_in_group`` and ``sales`` so per-column bar flags can differ."""
    workbook = Workbook()
    sheet = workbook.active
    sheet["A1"] = "seq_in_group"
    sheet["B1"] = "sales"
    sheet["A2"] = 1.0
    sheet["A3"] = 2.0
    sheet["B2"] = 10
    sheet["B3"] = 33
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
                "useGradient": False,
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


def test_column_config_can_disable_cell_bars_on_one_column() -> None:
    """Explore Column Settings ``Show cell bars`` off must drop that column's bars."""
    styled = apply_conditional_formatting(
        _workbook_with_seq_and_sales(),
        [],
        show_cell_bars=True,
        column_config={"seq_in_group": {"showCellBars": False}},
    )
    data_bars = [
        rng
        for rng, rule in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if rule.type == "dataBar"
    ]
    assert data_bars == ["B2:B3"]


def test_column_config_can_enable_cell_bars_when_global_is_off() -> None:
    """Per-column ``showCellBars`` true still bars that column if global is off."""
    styled = apply_conditional_formatting(
        _workbook_with_seq_and_sales(),
        [],
        show_cell_bars=False,
        column_config={"sales": {"showCellBars": True}},
    )
    data_bars = [
        rng
        for rng, rule in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if rule.type == "dataBar"
    ]
    assert data_bars == ["B2:B3"]


def test_cell_bars_use_neutral_color_when_color_pn_is_off() -> None:
    """Color +/- off matches Explore theme.colorFill, not Excel's default green."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10, 20),
        [],
        show_cell_bars=True,
        color_pn=False,
    )
    rule = next(
        cf
        for _, cf in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if cf.type == "dataBar"
    )
    assert str(rule.dataBar.color.rgb).endswith("BFBFBF")


def test_cell_bars_use_success_color_when_color_pn_is_on() -> None:
    """Color +/- on uses the same success green as Explore cell bars."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10, 20),
        [],
        show_cell_bars=True,
        color_pn=True,
    )
    rule = next(
        cf
        for _, cf in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if cf.type == "dataBar"
    )
    assert str(rule.dataBar.color.rgb).endswith("52C41A")


def test_column_config_can_disable_color_pn_on_one_column() -> None:
    """Per-column Color +/- off grays that column's bars only."""
    styled = apply_conditional_formatting(
        _workbook_with_seq_and_sales(),
        [],
        show_cell_bars=True,
        color_pn=True,
        column_config={"seq_in_group": {"colorPositiveNegative": False}},
    )
    colors = {
        rng: str(rule.dataBar.color.rgb)
        for rng, rule in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if rule.type == "dataBar"
    }
    assert colors["A2:A3"].endswith("BFBFBF")
    assert colors["B2:B3"].endswith("52C41A")


def test_show_cell_bars_survive_a_rule_on_another_column() -> None:
    """A color formatter on a text column must not drop default bars on sales.

    Table Explore still paints cell bars when Custom conditional formatting
    names a different column (for example ``region``).
    """
    styled = apply_conditional_formatting(
        _workbook_with_sales(10, 20),
        [{"column": "region", "operator": None, "colorScheme": "success"}],
        show_cell_bars=True,
    )
    rules = _cf_rules(load_workbook(io.BytesIO(styled)).active)
    data_bars = [rng for rng, rule in rules if rule.type == "dataBar"]
    assert data_bars == ["A2:A3"]
    assert any(rule.type == "expression" for _, rule in rules)


def test_operator_none_on_text_column_writes_solid_fill() -> None:
    """String color formatters become a fill on non-blank cells, not a color scale.

    Excel color scales do not paint text, so LibreOffice would hide the rule.
    """
    styled = apply_conditional_formatting(
        _workbook_with_sales(10),
        [{"column": "region", "operator": None, "colorScheme": "success"}],
    )
    cf_range, rule = _cf_rules(load_workbook(io.BytesIO(styled)).active)[0]
    assert "B2" in cf_range
    assert rule.type == "expression"
    formula = "".join(str(part) for part in (rule.formula or []))
    assert "NOT(ISBLANK(B2))" in formula
    assert rule.dxf is not None
    assert rule.dxf.fill is not None
    assert str(rule.dxf.fill.fgColor.rgb).endswith("52C41A")


def test_background_rule_on_sales_replaces_default_bars() -> None:
    """A fill rule on a numeric column turns off that column's default bars."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10, 20),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 8,
                "colorScheme": "#FF0000",
                "useGradient": False,
            }
        ],
        show_cell_bars=True,
    )
    rules = _cf_rules(load_workbook(io.BytesIO(styled)).active)
    assert any(rule.type == "cellIs" for _, rule in rules)
    assert not any(rule.type == "dataBar" for _, rule in rules)


def test_column_formatting_paints_target_from_source() -> None:
    """Formatting column paints region from a sales comparator, not sales itself."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10, 20),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 10,
                "colorScheme": "#5AC189",
                "columnFormatting": "region",
                "objectFormatting": "BACKGROUND_COLOR",
                "useGradient": False,
            }
        ],
        show_cell_bars=True,
    )
    rules = _cf_rules(load_workbook(io.BytesIO(styled)).active)
    fills = [(rng, rule) for rng, rule in rules if rule.type == "expression"]
    assert len(fills) == 1
    cf_range, rule = fills[0]
    assert "B2" in cf_range
    formula = "".join(str(part) for part in (rule.formula or []))
    assert "$A2>10" in formula
    assert rule.dxf is not None
    assert rule.dxf.fill is not None
    assert str(rule.dxf.fill.fgColor.rgb).endswith("5AC189")
    data_bars = [rng for rng, cf_rule in rules if cf_rule.type == "dataBar"]
    assert data_bars == ["A2:A3"]
    assert not any(cf_rule.type == "cellIs" for _, cf_rule in rules)


def test_entire_row_formula_uses_source_column() -> None:
    """ENTIRE_ROW applies a source-column formula across the used range."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10, 50),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 20,
                "colorScheme": "#ACE1C4",
                "columnFormatting": "ENTIRE_ROW",
                "useGradient": False,
            }
        ],
    )
    cf_range, rule = _cf_rules(load_workbook(io.BytesIO(styled)).active)[0]
    assert "A2" in cf_range
    assert "B" in cf_range
    assert rule.type == "expression"
    formula = "".join(str(part) for part in (rule.formula or []))
    assert "$A2>20" in formula


def test_to_all_row_matches_entire_row() -> None:
    """Legacy toAllRow uses the same entire-row formula as columnFormatting."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10, 50),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 20,
                "colorScheme": "#ACE1C4",
                "toAllRow": True,
                "useGradient": False,
            }
        ],
    )
    cf_range, rule = _cf_rules(load_workbook(io.BytesIO(styled)).active)[0]
    assert rule.type == "expression"
    assert "B" in cf_range
    formula = "".join(str(part) for part in (rule.formula or []))
    assert "$A2>20" in formula


def test_cell_bar_column_formatting_paints_target() -> None:
    """CELL_BAR with Formatting column puts bars on the target, keyed off source."""
    styled = apply_conditional_formatting(
        _workbook_with_seq_and_sales(),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 10,
                "colorScheme": "#5AC189",
                "columnFormatting": "seq_in_group",
                "objectFormatting": "CELL_BAR",
            }
        ],
    )
    data_bars = [
        rng
        for rng, rule in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if rule.type == "dataBar"
    ]
    assert data_bars == ["A3"]


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


def test_use_gradient_greater_than_writes_color_scale() -> None:
    """Use gradient + numeric comparator becomes an Excel 2-color scale."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(1, 2, 3),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 1,
                "colorScheme": "#5AC189",
                "useGradient": True,
                "objectFormatting": "BACKGROUND_COLOR",
            }
        ],
    )
    scale = next(
        rule
        for _, rule in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if rule.type == "colorScale"
    )
    assert scale.colorScale.cfvo[0].type == "num"
    assert float(scale.colorScale.cfvo[0].val) == 1
    assert scale.colorScale.cfvo[1].type == "max"
    colors = [str(color.rgb) for color in scale.colorScale.color]
    assert colors[0].endswith("FFFFFF")
    assert colors[1].endswith("5AC189")


def test_use_gradient_cross_column_bakes_varying_fills() -> None:
    """Gradient keyed off sales paints region with opacity scaled to the value."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10, 20),
        [
            {
                "column": "sales",
                "operator": ">",
                "targetValue": 5,
                "colorScheme": "#5AC189",
                "columnFormatting": "region",
                "objectFormatting": "BACKGROUND_COLOR",
                "useGradient": True,
            }
        ],
    )
    sheet = load_workbook(io.BytesIO(styled)).active
    fill_low = str(sheet["B2"].fill.fgColor.rgb)
    fill_high = str(sheet["B3"].fill.fgColor.rgb)
    assert fill_low != fill_high
    assert fill_high.endswith("5AC189")


def test_polish_explore_xlsx_qty_gradient() -> None:
    """qty > 1 with Use gradient writes a color scale, not a solid CellIs fill."""
    df = pd.DataFrame({"qty": [1.0, 2.0, 3.0]})
    polished = polish_explore_xlsx(
        df_to_excel(df, index=False),
        df,
        {
            "viz_type": "table",
            "show_cell_bars": False,
            "conditional_formatting": [
                {
                    "column": "qty",
                    "operator": ">",
                    "targetValue": 1,
                    "colorScheme": "#5AC189",
                    "columnFormatting": "qty",
                    "objectFormatting": "BACKGROUND_COLOR",
                    "useGradient": True,
                }
            ],
        },
    )
    scale = next(
        rule
        for _, rule in _cf_rules(load_workbook(io.BytesIO(polished)).active)
        if rule.type == "colorScale"
    )
    assert float(scale.colorScale.cfvo[0].val) == 1
    assert str(scale.colorScale.color[1].rgb).endswith("5AC189")


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
    """Empty rules and no cell bars leave the workbook bytes unchanged."""
    raw = _workbook_with_sales(10)
    assert apply_conditional_formatting(raw, []) is raw


def test_missing_column_does_not_add_rules() -> None:
    """A rule for a header that is not on the sheet is a no-op."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10),
        [{"column": "missing", "operator": ">", "targetValue": 1}],
    )
    assert _cf_rules(load_workbook(io.BytesIO(styled)).active) == []


def test_range_operator_writes_formula_rule() -> None:
    """Between-style operators become an Excel formula on the data range."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(5),
        [
            {
                "column": "sales",
                "operator": "≤ x ≤",
                "targetValueLeft": 0,
                "targetValueRight": 10,
                "colorScheme": "#00FF00",
                "useGradient": False,
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
    """TEXT_COLOR CellIs rules stamp font color and leave fill empty."""
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
    """Rules keyed by ``sales`` still match a Pivot ``SUM(sales)`` header."""
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
    """CELL_BAR plus a between operator covers only the matching run of cells."""
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
    """CELL_BAR with no comparator paints the whole numeric column."""
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
    """Operator None without bounds uses Excel min/max, not num cfvo with val=None."""
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
    assert scale.colorScale.cfvo[0].val is None
    assert scale.colorScale.cfvo[1].type == "max"
    assert scale.colorScale.cfvo[1].val is None


def test_color_scale_invalid_bound_does_not_emit_num_none() -> None:
    """A non-numeric maxBound falls back to max instead of type=num val=None."""
    styled = apply_conditional_formatting(
        _workbook_with_sales(10),
        [
            {
                "column": "sales",
                "operator": None,
                "colorScheme": "success",
                "minBound": 0,
                "maxBound": "abc",
            }
        ],
    )
    scale = next(
        rule
        for _, rule in _cf_rules(load_workbook(io.BytesIO(styled)).active)
        if rule.type == "colorScale"
    )
    assert scale.colorScale.cfvo[0].type == "num"
    assert float(scale.colorScale.cfvo[0].val) == 0
    assert scale.colorScale.cfvo[1].type == "max"
    assert scale.colorScale.cfvo[1].val is None


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
                    "useGradient": False,
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
    """xlsxwriter Table downloads get data bars on numeric columns only."""
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


def test_polish_explore_xlsx_honors_color_pn() -> None:
    """Table color_pn=false writes gray data bars, matching Color +/- off."""
    df = pd.DataFrame({"seq_in_group": [1.0, 2.0], "sales": [10, 33]})
    polished = polish_explore_xlsx(
        df_to_excel(df, index=False),
        df,
        {"viz_type": "table", "show_cell_bars": True, "color_pn": False},
    )
    colors = [
        str(rule.dataBar.color.rgb)
        for _, rule in _cf_rules(load_workbook(io.BytesIO(polished)).active)
        if rule.type == "dataBar"
    ]
    assert colors
    assert all(color.endswith("BFBFBF") for color in colors)


def test_polish_explore_xlsx_honors_column_show_cell_bars() -> None:
    """Table column_config.showCellBars=false must not bar that column in XLSX."""
    df = pd.DataFrame({"seq_in_group": [1.0, 2.0], "sales": [10, 33]})
    polished = polish_explore_xlsx(
        df_to_excel(df, index=False),
        df,
        {
            "viz_type": "table",
            "show_cell_bars": True,
            "column_config": {"seq_in_group": {"showCellBars": False}},
        },
    )
    data_bars = [
        rng
        for rng, rule in _cf_rules(load_workbook(io.BytesIO(polished)).active)
        if rule.type == "dataBar"
    ]
    assert data_bars == ["B2:B3"]


def test_polish_explore_xlsx_sales_rule_paints_region() -> None:
    """Explore 'sales > 10' with Formatting column=region paints region in XLSX."""
    df = pd.DataFrame({"region": ["EMEA", "APAC"], "sales": [10, 33]})
    polished = polish_explore_xlsx(
        df_to_excel(df, index=False),
        df,
        {
            "viz_type": "table",
            "show_cell_bars": True,
            "conditional_formatting": [
                {
                    "column": "sales",
                    "operator": ">",
                    "targetValue": 10,
                    "colorScheme": "#5AC189",
                    "columnFormatting": "region",
                    "objectFormatting": "BACKGROUND_COLOR",
                    "useGradient": False,
                }
            ],
        },
    )
    sheet = load_workbook(io.BytesIO(polished)).active
    rules = _cf_rules(sheet)
    fills = [(rng, rule) for rng, rule in rules if rule.type == "expression"]
    assert len(fills) == 1
    cf_range, rule = fills[0]
    assert "A2" in cf_range
    formula = "".join(str(part) for part in (rule.formula or []))
    assert "$B2>10" in formula
    data_bars = [rng for rng, cf_rule in rules if cf_rule.type == "dataBar"]
    assert data_bars == ["B2:B3"]


def test_polish_explore_xlsx_table_bars_with_region_color_formatter() -> None:
    """Explore Table with region CF and show_cell_bars still bars sales."""
    df = pd.DataFrame({"sales": [10, 33], "region": ["EMEA", "APAC"]})
    polished = polish_explore_xlsx(
        df_to_excel(df, index=False),
        df,
        {
            "viz_type": "table",
            "show_cell_bars": True,
            "conditional_formatting": [
                {"column": "region", "operator": None, "colorScheme": "success"}
            ],
        },
    )
    sheet = load_workbook(io.BytesIO(polished)).active
    types = [rule.type for _, rule in _cf_rules(sheet)]
    assert "dataBar" in types
    assert "expression" in types
    data_bars = [rng for rng, rule in _cf_rules(sheet) if rule.type == "dataBar"]
    assert data_bars == ["A2:A3"]


def test_polish_explore_xlsx_skips_unrelated_viz() -> None:
    """Non Table/Pivot viz types leave the workbook bytes untouched."""
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
                    "useGradient": False,
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
