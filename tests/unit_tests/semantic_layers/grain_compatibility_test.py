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
from unittest.mock import MagicMock, PropertyMock

import pyarrow as pa
import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    Dimension,
    DimensionSelection,
    Grains,
    Metric,
)

from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.models import SemanticView


@pytest.mark.parametrize("grain,expected", [("P1D", {"A"}), ("P1M", {"A", "B"})])
def test_compatibility_retains_explicit_grain(
    mocker: MockerFixture, grain: str, expected: set[str]
) -> None:
    dimension: Dimension = Dimension(
        "time",
        "time",
        pa.timestamp("us"),
        grains=frozenset({Grains.DAY, Grains.MONTH}),
        allows_default_grain=False,
        omitted_grain=Grains.DAY,
        ungrained_filter=Grains.DAY,
    )
    a: Metric = Metric("A", "A", pa.int64(), "A")
    b: Metric = Metric("B", "B", pa.int64(), "B")
    provider: MagicMock = MagicMock()
    provider.get_dimensions.return_value = {dimension}
    provider.get_metrics.return_value = {a, b}

    def compatible(
        metrics: set[Metric], dimensions: set[DimensionSelection]
    ) -> set[Metric]:
        return {a, b} if next(iter(dimensions)).grain == Grains.MONTH else {a}

    provider.get_compatible_metrics.side_effect = compatible
    mocker.patch.object(
        SemanticView, "implementation", new_callable=PropertyMock, return_value=provider
    )
    view: SemanticView = SemanticView(id=7, name="saved", configuration="{}")
    assert set(view.get_compatible_metrics([], ["time"], {"time": grain})) == expected


@pytest.mark.parametrize(
    "selections", [{"other": "P1D"}, {"time": "unknown"}, {"time": 3}]
)
def test_compatibility_rejects_unknown_grain_intent(
    mocker: MockerFixture, selections: dict[str, Any]
) -> None:
    provider: MagicMock = MagicMock()
    provider.get_dimensions.return_value = {
        Dimension("time", "time", pa.timestamp("us"))
    }
    provider.get_metrics.return_value = set()
    mocker.patch.object(
        SemanticView, "implementation", new_callable=PropertyMock, return_value=provider
    )
    view: SemanticView = SemanticView(id=7, name="saved", configuration="{}")
    with pytest.raises(QueryObjectValidationError):
        view.get_compatible_metrics([], ["time"], selections)
    provider.get_compatible_metrics.assert_not_called()
