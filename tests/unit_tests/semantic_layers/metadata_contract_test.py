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

from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.types import (
    SemanticQuery,
)

from superset.semantic_layers.transport import build_provider_transport
from tests.unit_tests.semantic_layers.conftest import (
    LegacyConfiguration,
    LegacyLayer,
    LegacyView,
    make_execution_context,
)


def test_legacy_provider_needs_no_metadata_overrides() -> None:
    layer: LegacyLayer = LegacyLayer.from_configuration(
        {},
        cache_token="test",  # noqa: S106
        context=make_execution_context(),
        transport=build_provider_transport(),
    )
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


def test_factory_accepts_required_host_identity() -> None:
    """Providers accept the required host identity through the single factory."""
    layer: SemanticLayer[LegacyConfiguration, LegacyView] = (
        LegacyLayer.from_configuration(
            {},
            cache_token="host-generation",  # noqa: S106
            context=make_execution_context(),
            transport=build_provider_transport(),
        )
    )
    assert isinstance(layer, LegacyLayer)
    assert layer.get_semantic_view("legacy", {}).metadata_cache_token is None
