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

from unittest.mock import MagicMock

from superset.exceptions import SupersetSecurityException
from superset.widgets.builtin import Balloons, FilterSelect
from superset.widgets.registry import registry


def _series_properties(control_values, series):
    widget = registry.get("balloons")
    assert widget is not None
    schema = widget.get_control_schema(control_values, series)
    return schema["$defs"]["Customization"]["properties"]["series"]


def test_series_stays_open_ended_without_dimension_or_series() -> None:
    # No control values at all.
    series = _series_properties(None, None)
    assert "properties" not in series
    # A grouping dimension but no discovered series values yet.
    series = _series_properties(
        {
            "dataBinding": {
                "datasetId": 1,
                "metrics": ["count"],
                "dimensions": ["gender"],
            }
        },
        [],
    )
    assert "properties" not in series
    # Discovered values but no grouping dimension chosen.
    series = _series_properties(
        {"dataBinding": {"datasetId": 1, "metrics": ["count"]}},
        ["boy", "girl"],
    )
    assert "properties" not in series


def test_series_populated_per_value_with_palette_colors() -> None:
    series = _series_properties(
        {
            "dataBinding": {
                "datasetId": 1,
                "metrics": ["count"],
                "dimensions": ["gender"],
            }
        },
        ["boy", "girl", "other"],
    )
    assert set(series["properties"]) == {"boy", "girl", "other"}
    # Open-ended map is replaced by concrete per-series styles.
    assert "additionalProperties" not in series
    # Each entry is titled by its series value and pre-colored from the palette.
    assert series["properties"]["boy"]["title"] == "boy"
    assert (
        series["properties"]["boy"]["properties"]["color"]["default"]
        == Balloons.PALETTE[0]
    )
    assert (
        series["properties"]["girl"]["properties"]["color"]["default"]
        == Balloons.PALETTE[1]
    )


def test_series_deduped_and_capped() -> None:
    binding = {
        "dataBinding": {
            "datasetId": 1,
            "metrics": ["count"],
            "dimensions": ["gender"],
        }
    }
    # Duplicates collapse (order preserved), so no repeated per-series work.
    series = _series_properties(binding, ["boy", "girl", "boy", "girl"])
    assert list(series["properties"]) == ["boy", "girl"]

    # An oversized list is capped, bounding schema construction / response size.
    many = [f"s{i}" for i in range(Balloons.MAX_SERIES + 50)]
    series = _series_properties(binding, many)
    assert len(series["properties"]) == Balloons.MAX_SERIES


def test_filter_select_registered() -> None:
    assert registry.get("filter.select") is FilterSelect


def test_filter_bar_registered() -> None:
    assert registry.get("filter.bar") is not None


def test_filter_select_dataset_enum_lists_viewable_datasets(mocker) -> None:
    # `name` is a reserved `MagicMock.__init__` kwarg (it names the mock
    # itself for repr), so it has to be set as an attribute afterward rather
    # than passed in the constructor like `id`.
    dataset_a = MagicMock(id=1)
    dataset_a.name = "main.sales"
    dataset_b = MagicMock(id=2)
    dataset_b.name = "birth_names"
    mocker.patch(
        "superset.widgets.builtin.DatasetDAO.find_all",
        return_value=[dataset_a, dataset_b],
    )

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema(None, None)

    assert schema["properties"]["datasetId"]["enum"] == [1, 2]
    assert schema["properties"]["datasetId"]["x-enumNames"] == [
        "main.sales",
        "birth_names",
    ]


def test_filter_select_dataset_enum_blank_without_viewable_datasets(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema(None, None)

    assert schema["properties"]["datasetId"]["enum"] == []
    assert schema["properties"]["datasetId"]["x-enumNames"] == []


def test_filter_select_column_enum_blank_without_dataset(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema(None, None)
    assert schema["properties"]["column"]["enum"] == []


def test_filter_select_column_enum_populated_from_dataset(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])
    dataset = MagicMock()
    dataset.filterable_column_names = ["region", "product_line"]
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=dataset)

    widget = registry.get("filter.select")
    assert widget is not None
    # A column already chosen (unlike the payload-shape test above, which
    # covers the moment right after picking a dataset, before `column` has
    # ever been set) — re-fetching still enriches the enum, and still
    # includes the already-selected value alongside the rest.
    schema = widget.get_control_schema({"datasetId": 1, "column": "region"}, None)

    assert schema["properties"]["column"]["enum"] == ["region", "product_line"]
    dataset.raise_for_access.assert_called_once()


def test_filter_select_column_enum_populated_before_column_is_ever_set(
    mocker,
) -> None:
    # The control panel only posts `column` once the author has actually
    # touched it — right after picking a dataset, `control_values` is just
    # `{"datasetId": 1}`, with no `column` key at all (unlike the fixture
    # above, which always includes one). `column` needs a default for this
    # payload to validate at all; without one, `parsed` silently falls back
    # to `None` and `dataset_id` below is never seen.
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])
    dataset = MagicMock()
    dataset.filterable_column_names = ["region", "product_line"]
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=dataset)

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema({"datasetId": 1}, None)

    assert schema["properties"]["column"]["enum"] == ["region", "product_line"]


def test_filter_select_column_enum_blank_on_access_denied(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])
    dataset = MagicMock()
    dataset.raise_for_access.side_effect = SupersetSecurityException(mocker.MagicMock())
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=dataset)

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema({"datasetId": 1}, None)

    assert schema["properties"]["column"]["enum"] == []
