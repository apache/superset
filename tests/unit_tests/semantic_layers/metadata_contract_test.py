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

import inspect
import json  # noqa: TID251 -- SDK examples must not import the host JSON utility.
import subprocess
import sys
from dataclasses import FrozenInstanceError
from pathlib import Path
from time import monotonic
from typing import Any, cast, get_args, get_type_hints, Literal

import pyarrow as pa
import pytest
from pydantic import BaseModel
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.metadata import (
    CatalogLoader,
    CatalogSnapshot,
    MetadataRefreshAdapter,
    MetadataRefreshError,
    MetadataRefreshErrorCategory,
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


class LegacyView(SemanticView):
    name: str = "legacy"

    def uid(self) -> str:
        return "legacy"

    def get_dimensions(self) -> set[Dimension]:
        return set()

    def get_metrics(self) -> set[Metric]:
        return {Metric("orders", "Orders", pa.int64(), "orders")}

    def get_values(
        self, dimension: Dimension, filters: set[Filter] | None = None
    ) -> SemanticResult:
        return SemanticResult([], pa.table({"value": [17]}))

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        return SemanticResult([], pa.table({"value": [17]}))

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        return SemanticResult([], pa.table({"count": [1]}))

    def get_compatible_metrics(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Metric]:
        return self.get_metrics()

    def get_compatible_dimensions(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Dimension]:
        return self.get_dimensions()


class LegacyLayer(SemanticLayer[BaseModel, LegacyView]):
    configuration_class: type[BaseModel] = BaseModel

    @classmethod
    def from_configuration(cls, configuration: dict[str, Any]) -> LegacyLayer:
        return cls()

    @classmethod
    def get_configuration_schema(
        cls, configuration: BaseModel | None = None
    ) -> dict[str, Any]:
        return {"type": "object"}

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


class SnapshotView(LegacyView):
    def __init__(self, snapshot: CatalogSnapshot) -> None:
        self.snapshot: CatalogSnapshot = snapshot

    @property
    def metadata_cache_token(self) -> str:
        return self.snapshot.cache_token

    def get_metrics(self) -> set[Metric]:
        members: list[str] = json.loads(self.snapshot.payload)
        return {
            Metric(member, member, pa.int64(), member, verbose_name="Shared label")
            for member in members
        }


class MemoryStore:
    """Sequential standalone operations, without waiting or distributed guarantees."""

    def __init__(self) -> None:
        self.snapshot: CatalogSnapshot | None = None
        self.publications: int = 0

    def read(self, fetch: CatalogLoader) -> CatalogSnapshot:
        return (
            self.snapshot if self.snapshot is not None else self.refresh(fetch).snapshot
        )

    def refresh(self, fetch: CatalogLoader) -> MetadataRefreshResult:
        deadline: float = monotonic() + 30.0
        payload: str = fetch(deadline)
        previous: CatalogSnapshot | None = self.snapshot
        self.publications += 1
        self.snapshot = CatalogSnapshot(
            payload, f"connection:{self.publications}", "2026-09-30T12:00:00Z"
        )
        return MetadataRefreshResult(
            "unchanged"
            if previous is not None and previous.payload == payload
            else "changed",
            self.snapshot,
        )


class MemoryAdapter(MetadataRefreshAdapter):
    def __init__(self) -> None:
        self.store: MetadataSnapshotStore | None = None
        self.payload: str = '["orders", "revenue"]'
        self.fetches: int = 0

    def bind(self, store: MetadataSnapshotStore) -> None:
        if self.store is not None:
            raise MetadataRefreshError("configuration")
        self.store = store

    def fetch(self, deadline: float) -> str:
        if deadline <= monotonic():
            raise MetadataRefreshError("deadline")
        self.fetches += 1
        return self.payload

    def snapshot(self) -> CatalogSnapshot:
        if self.store is None:
            raise MetadataRefreshError("unsupported")
        return self.store.read(self.fetch)

    def refresh(self) -> MetadataRefreshResult:
        if self.store is None:
            raise MetadataRefreshError("unsupported")
        return self.store.refresh(self.fetch)

    def get_runtime_schema(
        self, runtime_data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        return {"enum": json.loads(self.snapshot().payload)}


class OptedInLayer(LegacyLayer):
    def __init__(self) -> None:
        self.adapter: MemoryAdapter = MemoryAdapter()

    @classmethod
    def supports_metadata_refresh(cls, configuration: dict[str, Any]) -> bool:
        return True

    @property
    def metadata_refresh(self) -> MemoryAdapter:
        return self.adapter

    def get_semantic_view(
        self, name: str, additional_configuration: dict[str, Any]
    ) -> SnapshotView:
        return SnapshotView(self.adapter.snapshot())

    def get_semantic_views(
        self, runtime_configuration: dict[str, Any]
    ) -> set[LegacyView]:
        return {self.get_semantic_view("example", {})}


def test_legacy_provider_needs_no_metadata_overrides() -> None:
    layer: LegacyLayer = LegacyLayer.from_configuration({})
    view: LegacyView = layer.get_semantic_view("legacy", {})
    assert not layer.supports_metadata_refresh({})
    assert layer.metadata_refresh is None
    assert view.metadata_cache_token is None
    assert {metric.id for metric in view.get_compatible_metrics(set(), set())} == {
        "orders"
    }
    assert view.get_table(SemanticQuery([], [])).results.to_pydict() == {"value": [17]}


def test_provider_and_host_exchange_one_captured_observation() -> None:
    layer: OptedInLayer = OptedInLayer()
    store: MemoryStore = MemoryStore()
    assert layer.supports_metadata_refresh({})
    assert layer.adapter.fetches == 0
    assert layer.metadata_refresh is layer.metadata_refresh
    layer.metadata_refresh.bind(store)
    old_view: SnapshotView = layer.get_semantic_view("example", {})
    assert layer.adapter.get_runtime_schema() == {"enum": ["orders", "revenue"]}
    assert layer.adapter.fetches == 1
    assert {metric.id for metric in old_view.get_metrics()} == {"orders", "revenue"}
    assert {metric.verbose_name for metric in old_view.get_metrics()} == {
        "Shared label"
    }

    layer.adapter.payload = '["orders", "revenue", "customers"]'
    result: MetadataRefreshResult = layer.metadata_refresh.refresh()
    new_view: SnapshotView = layer.get_semantic_view("example", {})
    assert result.status == "changed"
    assert new_view.metadata_cache_token == result.snapshot.cache_token
    assert old_view.metadata_cache_token != new_view.metadata_cache_token
    assert {metric.id for metric in old_view.get_metrics()} == {"orders", "revenue"}
    assert {metric.id for metric in new_view.get_compatible_metrics(set(), set())} == {
        "orders",
        "revenue",
        "customers",
    }
    assert layer.adapter.get_runtime_schema() == {
        "enum": ["orders", "revenue", "customers"]
    }
    assert layer.adapter.fetches == 2


def test_unchanged_discovery_can_have_a_new_cache_identity() -> None:
    adapter: MemoryAdapter = MemoryAdapter()
    adapter.bind(MemoryStore())
    first: MetadataRefreshResult = adapter.refresh()
    second: MetadataRefreshResult = adapter.refresh()
    assert second.status == "unchanged"
    assert first.snapshot.payload == second.snapshot.payload
    assert first.snapshot.cache_token != second.snapshot.cache_token


def test_adapter_example_rejects_use_before_binding_and_rebinding() -> None:
    adapter: MemoryAdapter = MemoryAdapter()
    with pytest.raises(MetadataRefreshError, match="unsupported"):
        adapter.refresh()
    adapter.bind(MemoryStore())
    with pytest.raises(MetadataRefreshError, match="configuration"):
        adapter.bind(MemoryStore())
    assert adapter.fetches == 0


@pytest.mark.parametrize("field", ["payload", "cache_token", "observed_at"])
def test_snapshot_cannot_change_after_capture(field: str) -> None:
    snapshot: CatalogSnapshot = CatalogSnapshot("[]", "scope:1", "2026-09-30T12:00:00Z")
    with pytest.raises(FrozenInstanceError):
        setattr(snapshot, field, "replacement")


@pytest.mark.parametrize("field", ["status", "snapshot"])
def test_refresh_result_cannot_change_after_publication(field: str) -> None:
    snapshot: CatalogSnapshot = CatalogSnapshot("[]", "scope:1", "2026-09-30T12:00:00Z")
    result: MetadataRefreshResult = MetadataRefreshResult("changed", snapshot)
    with pytest.raises(FrozenInstanceError):
        setattr(result, field, "replacement")


@pytest.mark.parametrize(
    "category",
    [
        "unsupported",
        "configuration",
        "in_progress",
        "configuration_changed",
        "upstream",
        "invalid_payload",
        "deadline",
        "unavailable",
        "indeterminate",
    ],
)
def test_declared_errors_cross_the_boundary_without_vendor_details(
    category: MetadataRefreshErrorCategory,
) -> None:
    error: MetadataRefreshError = MetadataRefreshError(category)
    assert error.category == category
    assert str(error) == category
    assert error.args == (category,)


def test_sdk_metadata_imports_without_host_dependencies() -> None:
    source: Path = Path(__file__).resolve().parents[3] / "superset-core" / "src"
    script: str = """
import importlib.abc
import sys
from collections.abc import Sequence
from importlib.machinery import ModuleSpec
from types import ModuleType

class RejectHostImports(importlib.abc.MetaPathFinder):
    def find_spec(
        self, fullname: str, path: Sequence[str] | None = None,
        target: ModuleType | None = None,
    ) -> ModuleSpec | None:
        if fullname.split('.')[0] in {'superset', 'flask', 'redis', 'flask_appbuilder'}:
            raise AssertionError('Host dependency imported: ' + fullname)
        return None

sys.meta_path.insert(0, RejectHostImports())
sys.path.insert(0, sys.argv[1])
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.metadata import CatalogSnapshot
from superset_core.semantic_layers.view import SemanticView
assert not SemanticLayer.supports_metadata_refresh({})
assert CatalogSnapshot('[]', 'scope:1', '2026-09-30T12:00:00Z').cache_token == 'scope:1'
"""
    # The isolated import probe uses a fixed script/interpreter and no shell.
    completed: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603
        [sys.executable, "-I", "-c", script, str(source)],
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert completed.returncode == 0, completed.stderr


@pytest.mark.parametrize("category", ["", "vendor detail: private upstream response"])
def test_unknown_error_category_is_rejected_without_echoing_it(category: str) -> None:
    with pytest.raises(ValueError, match="^Unknown metadata refresh error category$"):
        MetadataRefreshError(cast(MetadataRefreshErrorCategory, category))


def test_empty_snapshot_identity_is_rejected() -> None:
    with pytest.raises(ValueError, match="^Catalog cache token must not be empty$"):
        CatalogSnapshot("[]", "", "2026-09-30T12:00:00Z")


def test_optional_adapter_annotation_resolves_for_sdk_introspection() -> None:
    descriptor: property = inspect.getattr_static(SemanticLayer, "metadata_refresh")
    assert descriptor.fget is not None
    hints: dict[str, Any] = get_type_hints(descriptor.fget)
    assert hints["return"] == MetadataRefreshAdapter | None


@pytest.mark.parametrize("status", ["", "failed", "indeterminate"])
def test_unconfirmed_refresh_status_cannot_construct_success(status: str) -> None:
    snapshot: CatalogSnapshot = CatalogSnapshot("[]", "scope:1", "2026-09-30T12:00:00Z")
    with pytest.raises(ValueError, match="^Unknown metadata refresh result status$"):
        MetadataRefreshResult(cast(Literal["changed", "unchanged"], status), snapshot)


@pytest.mark.parametrize("as_result", [False, True])
def test_snapshot_representations_omit_catalog_and_cache_identity(
    as_result: bool,
) -> None:
    snapshot: CatalogSnapshot = CatalogSnapshot(
        '["private_catalog_member"]', "private_cache_identity", "2026-09-30T12:00:00Z"
    )
    value: CatalogSnapshot | MetadataRefreshResult = (
        MetadataRefreshResult("changed", snapshot) if as_result else snapshot
    )
    representation: str = repr(value)
    assert "private_catalog_member" not in representation
    assert "private_cache_identity" not in representation
    assert "2026-09-30T12:00:00Z" in representation


def test_catalog_loader_accepts_one_absolute_deadline() -> None:
    assert get_args(CatalogLoader) == ([float], str)


def test_expired_loader_deadline_rejects_before_acquisition() -> None:
    adapter: MemoryAdapter = MemoryAdapter()
    with pytest.raises(MetadataRefreshError, match="^deadline$"):
        adapter.fetch(monotonic() - 1.0)
    assert adapter.fetches == 0


def test_store_passes_one_deadline_and_cache_hits_do_not_acquire(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fixed_clock() -> float:
        return 100.0

    monkeypatch.setattr(sys.modules[__name__], "monotonic", fixed_clock)
    deadlines: list[float] = []

    def fetch(deadline: float) -> str:
        deadlines.append(deadline)
        return "[]"

    store: MemoryStore = MemoryStore()
    first: CatalogSnapshot = store.read(fetch)
    assert store.read(fetch) is first
    refreshed: MetadataRefreshResult = store.refresh(fetch)
    assert refreshed.status == "unchanged"
    assert deadlines == [130.0, 130.0]
