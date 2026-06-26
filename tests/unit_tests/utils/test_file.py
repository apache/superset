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
import pytest

from superset.utils.file import get_filename, sanitize_title


@pytest.mark.parametrize(
    "model_name,model_id,skip_id,expected_filename",
    [
        ("Energy Sankey", 132, False, "Energy_Sankey_132"),
        ("Energy Sankey", 132, True, "Energy_Sankey"),
        ("folder1/Energy Sankey", 132, True, "folder1_Energy_Sankey"),
        ("D:\\Charts\\Energy Sankey", 132, True, "DChartsEnergy_Sankey"),
        ("🥴🥴🥴", 4751, False, "4751"),
        ("🥴🥴🥴", 4751, True, "4751"),
        ("Energy Sankey 🥴🥴🥴", 4751, False, "Energy_Sankey_4751"),
        ("Energy Sankey 🥴🥴🥴", 4751, True, "Energy_Sankey"),
        ("你好", 475, False, "475"),
        ("你好", 475, True, "475"),
        ("Energy Sankey 你好", 475, False, "Energy_Sankey_475"),
        ("Energy Sankey 你好", 475, True, "Energy_Sankey"),
        ("Energy\x08Sankey", 132, False, "EnergySankey_132"),
        ("Energy\x08Sankey", 132, True, "EnergySankey"),
        ("Sales\x7fReport", 1, False, "SalesReport_1"),
    ],
)
def test_get_filename(
    model_name: str, model_id: int, skip_id: bool, expected_filename: str
) -> None:
    original_filename = get_filename(model_name, model_id, skip_id)
    assert expected_filename == original_filename


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("normal", "normal"),
        ("a\x08b", "ab"),
        ("x\x09y", "xy"),
        ("x\ny", "xy"),
        ("x\ry", "xy"),
        ("\x00\x01\x02", ""),
        ("a\x7fb", "ab"),
        ("a\x9fb", "ab"),
    ],
)
def test_sanitize_title(raw: str, expected: str) -> None:
    assert sanitize_title(raw) == expected
