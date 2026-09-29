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

import subprocess
import sys
from typing import Any

from pydantic import BaseModel
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.metadata import (
    CatalogSnapshot,
    MetadataRefreshAdapter,
    MetadataRefreshResult,
    MetadataSnapshotStore,
)
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView


class LegacyConfiguration(BaseModel):
    """Empty configuration for a minimal provider."""


class LegacyView(SemanticView):
    """Smallest legacy provider, with no metadata extension declarations."""

    def uid(self) -> str:
        return "legacy"

    def get_dimensions(self) -> set[Dimension]:
        return set()

    def get_metrics(self) -> set[Metric]:
        return set()

    def get_values(
        self, dimension: Dimension, filters: set[Filter] | None = None
    ) -> SemanticResult:
        raise NotImplementedError

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        raise NotImplementedError

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        raise NotImplementedError

    def get_compatible_metrics(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Metric]:
        return set()

    def get_compatible_dimensions(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Dimension]:
        return set()


class LegacyLayer(SemanticLayer[BaseModel, LegacyView]):
    """Existing implementations must not acquire new abstract requirements."""

    @classmethod
    def from_configuration(cls, configuration: dict[str, Any]) -> LegacyLayer:
        return cls()

    @classmethod
    def get_configuration_schema(
        cls, configuration: BaseModel | None = None
    ) -> dict[str, Any]:
        return {}

    @classmethod
    def get_runtime_schema(
        cls, configuration: BaseModel, runtime_data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        return {"type": "object"}

    def get_semantic_views(
        self, runtime_configuration: dict[str, Any]
    ) -> set[LegacyView]:
        return {LegacyView()}

    def get_semantic_view(
        self, name: str, additional_configuration: dict[str, Any]
    ) -> LegacyView:
        return LegacyView()


def test_legacy_layer_defaults_to_no_refresh_adapter() -> None:
    """No new methods are required to instantiate an old provider."""
    layer: LegacyLayer = LegacyLayer.from_configuration({})
    assert layer.metadata_refresh is None
    assert LegacyLayer.supports_metadata_refresh({}) is False
    assert layer.get_runtime_schema(LegacyConfiguration()) == {"type": "object"}


def test_legacy_view_defaults_to_no_metadata_token() -> None:
    """Legacy compatibility caching keeps its original key path."""
    view: LegacyView = LegacyView()
    assert view.metadata_cache_token is None
    assert view.metadata_revision is None


def test_metadata_contract_import_does_not_load_host_or_backend() -> None:
    """An extension can import the SDK without importing Flask or Redis."""
    result: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603 - fixed interpreter and script
        [
            sys.executable,
            "-c",
            "import sys; import superset_core.semantic_layers.metadata; "
            "assert not {'flask', 'redis', 'superset'} & sys.modules.keys()",
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr


class BoundAdapter(MetadataRefreshAdapter):
    """Demonstrate the complete optional provider contract without host imports."""

    def bind(self, store: MetadataSnapshotStore) -> None:
        self.store: MetadataSnapshotStore = store

    def refresh(self) -> MetadataRefreshResult:
        return self.store.refresh(lambda: '{"metrics": []}')

    def get_runtime_schema(
        self, runtime_data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        snapshot: CatalogSnapshot = self.store.read(lambda: '{"metrics": []}')
        return {"type": "object", "description": snapshot.revision}


def test_opted_in_adapter_uses_bound_store_for_refresh_and_schema() -> None:
    """Both consumer paths receive the same immutable snapshot identity."""
    from unittest.mock import Mock

    snapshot: CatalogSnapshot = CatalogSnapshot(
        '{"metrics": []}', "revision", "scope/revision", "2026-09-29T00:00:00Z"
    )
    store: Mock = Mock(spec=MetadataSnapshotStore)
    store.read.return_value = snapshot
    store.refresh.return_value = MetadataRefreshResult("changed", snapshot)
    adapter: BoundAdapter = BoundAdapter()
    adapter.bind(store)
    assert adapter.refresh().snapshot is snapshot
    assert adapter.get_runtime_schema() == {"type": "object", "description": "revision"}
    store.read.assert_called_once()
    store.refresh.assert_called_once()
