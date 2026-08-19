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

from superset.widgets.builtin import Balloons
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
