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

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    Dimension,
    DimensionSelection,
    Filter,
    Metric,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature


class MinimalView(SemanticView):
    """Implement the required provider interface without optional capabilities."""

    name: str = "Minimal"

    def uid(self) -> str:
        """Return the provider identity."""
        return "minimal"

    def get_dimensions(self) -> set[Dimension]:
        """Return no dimensions."""
        return set()

    def get_metrics(self) -> set[Metric]:
        """Return no metrics."""
        return set()

    def get_values(
        self, dimension: DimensionSelection, filters: set[Filter] | None = None
    ) -> SemanticResult:
        """Return an empty result."""
        return SemanticResult(requests=[], results=pa.table({}))

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        """Return an empty result."""
        return SemanticResult(requests=[], results=pa.table({}))

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        """Return a zero count."""
        return SemanticResult(requests=[], results=pa.table({"count": [0]}))

    def get_compatible_metrics(
        self,
        selected_metrics: set[Metric],
        selected_dimensions: set[DimensionSelection],
    ) -> set[Metric]:
        """Return no compatible metrics."""
        return set()

    def get_compatible_dimensions(
        self,
        selected_metrics: set[Metric],
        selected_dimensions: set[DimensionSelection],
    ) -> set[Dimension]:
        """Return no compatible dimensions."""
        return set()


def test_row_offset_is_optional_for_minimal_provider() -> None:
    """Adding row-offset support must not require unsupported provider stubs."""
    view: MinimalView = MinimalView()

    assert view.features == frozenset()
    assert SemanticViewFeature.ROW_OFFSET not in view.features
    assert view.uid() == "minimal"

    class OffsetView(MinimalView):
        """Advertise pagination without changing the required interface."""

        features: frozenset[SemanticViewFeature] = frozenset(
            {SemanticViewFeature.ROW_OFFSET}
        )

    offset_view: OffsetView = OffsetView()
    assert SemanticViewFeature.ROW_OFFSET in offset_view.features
    assert SemanticViewFeature.ROW_OFFSET.value == "ROW_OFFSET"
    assert SemanticViewFeature.ROW_OFFSET not in view.features


def test_view_metadata_defaults_are_conservative() -> None:
    assert SemanticView.features == frozenset()
    assert SemanticView.name == ""


def test_compatibility_evidence_is_optional() -> None:
    assert MinimalView().get_compatibility_evidence() is None


@pytest.mark.parametrize("quality", ["known", "partial", "unknown"])
def test_compatibility_evidence_is_immutable(quality: str) -> None:
    from dataclasses import FrozenInstanceError

    from superset_core.semantic_layers.view import CompatibilityEvidence

    evidence: CompatibilityEvidence = CompatibilityEvidence(quality, 1500)
    assert evidence.quality == quality
    assert evidence.valid_for_ms == 1500
    with pytest.raises(FrozenInstanceError):
        evidence.valid_for_ms = 3000  # type: ignore[misc]


@pytest.mark.parametrize(
    "quality,lifetime",
    [
        ("invalid", 100),
        ("known", -1),
        ("known", float("inf")),
        ("known", float("nan")),
        ("known", True),
        ("known", "100"),
    ],
)
def test_compatibility_evidence_rejects_invalid_values(
    quality: str,
    lifetime: object,
) -> None:
    from superset_core.semantic_layers.view import CompatibilityEvidence

    with pytest.raises(ValueError, match="[Cc]ompatibility"):
        CompatibilityEvidence(quality, lifetime)  # type: ignore[arg-type]
