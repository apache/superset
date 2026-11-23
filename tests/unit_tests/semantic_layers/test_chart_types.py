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

from typing import Any

import pytest

from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.chart_types import (
    pin_saved_chart_type,
    semantic_chart_refusal,
    validate_semantic_chart_type,
)


@pytest.mark.parametrize(
    ("viz_type", "label"),
    [
        ("histogram_v2", "Histogram"),
        ("cal_heatmap", "Calendar Heatmap"),
        ("time_table", "Time-series Table"),
        ("time_pivot", "Time-series Period Pivot"),
        ("rose", "Nightingale Rose"),
        ("horizon", "Horizon"),
        ("paired_ttest", "Paired t-test"),
    ],
)
def test_raw_row_charts_are_refused_with_an_alternative(
    viz_type: str, label: str
) -> None:
    """Each incompatible visualization reports its name and a usable alternative."""
    error: pytest.ExceptionInfo[QueryObjectValidationError]
    with pytest.raises(QueryObjectValidationError, match=label) as error:
        validate_semantic_chart_type("semantic_view", viz_type)
    assert "not yet supported on semantic views. Use " in str(error.value)


@pytest.mark.parametrize("viz_type", [["histogram_v2"], {"type": "table"}, 1, False])
def test_malformed_semantic_chart_type_is_rejected(viz_type: object) -> None:
    """Invalid metadata raises a validation error instead of a server error."""
    with pytest.raises(QueryObjectValidationError, match="Chart type must be a string"):
        validate_semantic_chart_type("semantic_view", viz_type)


@pytest.mark.parametrize(
    "viz_type", [None, "table", "echarts_timeseries_line", "mixed_timeseries"]
)
def test_supported_or_unspecified_semantic_chart_type_is_allowed(
    viz_type: str | None,
) -> None:
    """Supported charts and requests without visualization metadata remain valid."""
    validate_semantic_chart_type("semantic_view", viz_type)


@pytest.mark.parametrize("viz_type", ["histogram_v2", ["histogram_v2"], None])
def test_ordinary_datasets_are_outside_the_policy(viz_type: object) -> None:
    """The semantic policy does not validate ordinary dataset visualization input."""
    validate_semantic_chart_type("table", viz_type)


@pytest.mark.parametrize(
    ("datasource_type", "viz_type", "refused"),
    [
        ("semantic_view", "rose", True),
        ("semantic_view", "table", False),
        ("semantic_view", None, False),
        ("semantic_view", ["rose"], False),
        ("table", "rose", False),
        (None, "rose", False),
    ],
)
def test_semantic_chart_refusal(
    datasource_type: str | None, viz_type: object, refused: bool
) -> None:
    """Only a known refused type on a semantic view returns a reason."""
    reason: str | None = semantic_chart_refusal(datasource_type, viz_type)
    assert (reason is not None) is refused
    if refused:
        assert "Nightingale Rose" in str(reason)


def test_pin_saved_chart_type_overrides_a_stale_request_type() -> None:
    """A replayed context can't claim a supported type the chart no longer has."""
    payload: dict[str, Any] = {"form_data": {"viz_type": "table", "x": 1}}
    pin_saved_chart_type(payload, "semantic_view", "histogram_v2")
    assert payload["form_data"] == {"viz_type": "histogram_v2", "x": 1}


@pytest.mark.parametrize(
    ("datasource_type", "viz_type"),
    [("semantic_view", "pivot_table_v2"), ("table", "histogram_v2")],
)
def test_pin_saved_chart_type_leaves_other_charts_alone(
    datasource_type: str, viz_type: str
) -> None:
    """Supported and non-semantic charts keep their saved context verbatim."""
    payload: dict[str, Any] = {"queries": [{}]}
    pin_saved_chart_type(payload, datasource_type, viz_type)
    assert payload == {"queries": [{}]}
