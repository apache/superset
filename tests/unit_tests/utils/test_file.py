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

from superset.utils.file import get_filename, MAX_FILENAME_LENGTH, sanitize_title


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


@pytest.mark.parametrize("skip_id", [False, True])
def test_get_filename_is_capped(skip_id: bool) -> None:
    """
    A 250-character chart title produced a ZIP entry Windows refuses to extract,
    even though the archive was written successfully (#42531).
    """
    filename = get_filename("A" * 250, 132, skip_id)

    assert len(filename) <= MAX_FILENAME_LENGTH
    assert filename.startswith("A")


def test_get_filename_keeps_the_id_when_truncating() -> None:
    """The id disambiguates similarly titled assets, so it must survive."""
    filename = get_filename("A" * 250, 132)

    assert filename.endswith("_132")
    assert len(filename) <= MAX_FILENAME_LENGTH


def test_get_filename_does_not_end_on_a_separator() -> None:
    """Truncation must not leave a trailing separator before the extension."""
    filename = get_filename("A" * 199 + "._-" + "B" * 50, 7, skip_id=True)

    assert not filename.endswith((".", "_", "-"))


def test_get_filename_leaves_short_names_alone() -> None:
    assert get_filename("Energy Sankey", 132) == "Energy_Sankey_132"


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
