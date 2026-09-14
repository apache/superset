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

from openpyxl import Workbook, load_workbook

from superset.utils.excel_conditional import apply_conditional_formatting, cell_matches_rule


def test_cell_matches_rule_comparators() -> None:
    assert cell_matches_rule(5, {"operator": ">", "targetValue": 3})
    assert not cell_matches_rule(2, {"operator": ">", "targetValue": 3})
    assert cell_matches_rule(3, {"operator": "≥", "targetValue": 3})
    assert cell_matches_rule(4, {"operator": "< x <", "targetValueLeft": 1, "targetValueRight": 5})
    assert not cell_matches_rule(1, {"operator": "< x <", "targetValueLeft": 1, "targetValueRight": 5})
    assert cell_matches_rule(99, {"operator": "None"})


def test_apply_conditional_formatting_on_generated_sheet() -> None:
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
                "useGradient": False,
            }
        ],
    )
    result = load_workbook(io.BytesIO(styled)).active
    assert result["A2"].fill.fill_type == "solid"
    assert result["A2"].fill.fgColor.rgb.endswith("FF0000")
    assert result["A3"].fill.fill_type == "solid"
    assert result["A4"].fill.fill_type != "solid"
    assert result["B2"].fill.fill_type != "solid"
