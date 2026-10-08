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
from pathlib import Path
from typing import Any

import pyarrow as pa
from pydantic import BaseModel
from superset_core.semantic_layers.layer import SemanticLayer
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


def test_legacy_provider_needs_no_metadata_overrides() -> None:
    layer: LegacyLayer = LegacyLayer.from_configuration({})
    view: LegacyView = layer.get_semantic_view("legacy", {})
    assert view.metadata_cache_token is None
    assert {metric.id for metric in view.get_compatible_metrics(set(), set())} == {
        "orders"
    }
    assert view.get_table(SemanticQuery([], [])).results.to_pydict() == {"value": [17]}


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
from superset_core.semantic_layers.view import SemanticView
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


class CapturedView(LegacyView):
    """A provider view retains the identity captured with its members."""

    def __init__(self, token: str) -> None:
        self.token: str = token

    @property
    def metadata_cache_token(self) -> str:
        return self.token


def test_views_retain_their_captured_cache_identity() -> None:
    """A later provider observation does not relabel an existing view."""
    old_view: CapturedView = CapturedView("scope:1")
    new_view: CapturedView = CapturedView("scope:2")
    assert old_view.metadata_cache_token == "scope:1"  # noqa: S105
    assert new_view.metadata_cache_token == "scope:2"  # noqa: S105
