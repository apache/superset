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

import re
from copy import deepcopy
from typing import Any
from unittest.mock import MagicMock

from superset.exceptions import SupersetSecurityException
from superset.widgets.builtin import Balloons, FilterSelect
from superset.widgets.controls import BalloonsControls
from superset.widgets.registry import registry

HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{3,8}$")


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


def _hex_defaults(node: Any) -> list[str]:
    """Every hex-color ``default`` anywhere in a JSON Schema fragment."""
    found: list[str] = []
    if isinstance(node, dict):
        default = node.get("default")
        if isinstance(default, str) and HEX_COLOR.match(default):
            found.append(default)
        for value in node.values():
            found.extend(_hex_defaults(value))
    elif isinstance(node, list):
        for item in node:
            found.extend(_hex_defaults(item))
    return found


def test_series_populated_per_value_without_invented_colors() -> None:
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
    # Each entry is titled by its series value; its color is left to the
    # renderer rather than pre-filled with a schema-invented hex value.
    assert series["properties"]["boy"]["title"] == "boy"
    for style in series["properties"].values():
        assert style["properties"]["color"]["default"] == ""
    assert _hex_defaults(series) == []


def test_base_schema_has_no_invented_color_defaults() -> None:
    widget = registry.get("balloons")
    assert widget is not None
    schema = widget.get_control_schema(None, None)
    color = schema["$defs"]["SeriesStyle"]["properties"]["color"]
    assert color["default"] == ""
    assert color["description"] == (
        "Empty means no explicit color; the renderer chooses."
    )
    assert _hex_defaults(schema["$defs"]) == []


def test_series_color_optional_and_explicit_colors_survive() -> None:
    widget = registry.get("balloons")
    assert widget is not None
    props = {
        "dataBinding": {
            "datasetId": 1,
            "metrics": ["count"],
            "dimensions": ["gender"],
        },
        "customize": {
            "series": {
                # Omitted and empty colors both mean "renderer chooses".
                "boy": {"sizeScale": 2.0},
                "girl": {"color": ""},
                # An explicitly authored color is kept verbatim.
                "other": {"color": "#123456"},
                # A stored override for a value the query no longer returns.
                "retired": {"color": "#abcdef"},
            }
        },
    }
    assert widget.validate_control_values(props) == []

    parsed = BalloonsControls.model_validate(props)
    stored = parsed.customize.series
    assert stored["boy"].color == ""
    assert stored["girl"].color == ""
    assert stored["other"].color == "#123456"
    assert stored["retired"].color == "#abcdef"

    # Enriching the schema for the live series neither rewrites nor drops the
    # stored props it was computed from.
    snapshot = deepcopy(props)
    series = _series_properties(props, ["boy", "girl", "other"])
    assert props == snapshot
    assert _hex_defaults(series) == []


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
    listing = mocker.patch(
        "superset.widgets.builtin.DatasetDAO.list",
        return_value=([dataset_a, dataset_b], -1),
    )
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=None)

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema({"datasetId": 1}, None)

    assert schema["properties"]["datasetId"]["enum"] == [1, 2]
    assert schema["properties"]["datasetId"]["x-enumNames"] == [
        "main.sales",
        "birth_names",
    ]
    assert listing.call_args.kwargs["page_size"] == FilterSelect.MAX_DATASET_CHOICES


def test_filter_select_dataset_enum_keeps_the_chosen_dataset_past_the_cap(
    mocker,
) -> None:
    listed = MagicMock(id=1)
    listed.name = "a"
    chosen = MagicMock(id=900)
    chosen.name = "z"
    mocker.patch(
        "superset.widgets.builtin.DatasetDAO.list", return_value=([listed], -1)
    )
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=chosen)

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema({"datasetId": 900}, None)

    assert schema["properties"]["datasetId"]["enum"] == [1, 900]


def test_filter_select_base_schema_does_not_list_datasets(mocker) -> None:
    listing = mocker.patch("superset.widgets.builtin.DatasetDAO.list")
    find_all = mocker.patch("superset.widgets.builtin.DatasetDAO.find_all")

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema(None, None)

    assert schema["properties"]["datasetId"]["enum"] == []
    assert schema["properties"]["datasetId"]["x-enumNames"] == []
    listing.assert_not_called()
    find_all.assert_not_called()


def test_filter_select_dataset_enum_blank_without_viewable_datasets(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.list", return_value=([], -1))
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=None)

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema({"datasetId": 1}, None)

    assert schema["properties"]["datasetId"]["enum"] == []
    assert schema["properties"]["datasetId"]["x-enumNames"] == []


def test_filter_select_column_enum_blank_without_dataset(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.list", return_value=([], -1))

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema(None, None)
    assert schema["properties"]["column"]["enum"] == []


def test_filter_select_column_enum_populated_from_dataset(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.list", return_value=([], -1))
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
    mocker.patch("superset.widgets.builtin.DatasetDAO.list", return_value=([], -1))
    dataset = MagicMock()
    dataset.filterable_column_names = ["region", "product_line"]
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=dataset)

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema({"datasetId": 1}, None)

    assert schema["properties"]["column"]["enum"] == ["region", "product_line"]


def test_filter_select_column_enum_blank_on_access_denied(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.list", return_value=([], -1))
    dataset = MagicMock()
    dataset.raise_for_access.side_effect = SupersetSecurityException(mocker.MagicMock())
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=dataset)

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema({"datasetId": 1}, None)

    assert schema["properties"]["column"]["enum"] == []


def test_containers_that_draw_their_own_chrome_reserve_a_row_for_it() -> None:
    """
    A container is grown to fit its children (``_fit``), so anything it draws
    above them has to be counted or the last row lands outside its box -- as a
    group's title did, cutting off the widgets in that row.
    """
    for widget_type in ("group", "tabs"):
        widget = registry.get(widget_type)
        assert widget is not None, widget_type
        assert widget.ui.chrome_rows == 1, widget_type
