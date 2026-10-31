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

"""Reusable typed builders for semantic-cache unit tests."""

from __future__ import annotations

import sys
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from unittest.mock import PropertyMock

import pyarrow as pa
import pytest
from pydantic import BaseModel
from pytest_mock import MockerFixture
from superset_core.semantic_layers.context import (
    ExecutionOrigin,
    SemanticCredentials,
    SemanticExecutionContext,
)
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView

from superset.app import SupersetApp
from superset.initialization import SupersetAppInitializer
from superset.semantic_layers.cache_identity import (
    SemanticCacheIdentityFactory,
    SemanticCacheProviderIdentity,
    SemanticCacheScopeIdentity,
    SemanticDefinitionIdentity,
    SemanticViewIdentity,
)
from superset.semantic_layers.cache_repository import ViewMeta
from superset.semantic_layers.models import (
    SemanticLayer as SemanticLayerModel,
    SemanticView as SemanticViewModel,
)
from superset.semantic_layers.registry import registry


@dataclass(frozen=True)
class SemanticCapabilityFixture:
    """Provider semantic capabilities used before the core contract is added."""

    comparisons: bool = False
    membership: bool = False
    nulls: bool = False
    patterns: bool = False
    pattern_escape: str | None = None


def build_semantic_query() -> SemanticQuery:
    """Build a minimal typed semantic query."""
    metric: Metric = Metric(
        id="revenue",
        name="Revenue",
        type=pa.float64(),
        definition="SUM(revenue)",
    )
    dimension: Dimension = Dimension(
        id="country",
        name="Country",
        type=pa.string(),
    )
    return SemanticQuery(metrics=[metric], dimensions=[dimension])


def build_semantic_result() -> SemanticResult:
    """Build a minimal typed semantic result."""
    table: pa.Table = pa.table({"Country": ["GB"], "Revenue": [42.0]})
    return SemanticResult(requests=[], results=table)


def build_view_meta() -> ViewMeta:
    """Build stable cache-bucket metadata."""
    definition_identity: SemanticDefinitionIdentity = (
        SemanticCacheIdentityFactory.definition({"version": 1})
    )
    provider_identity: SemanticCacheProviderIdentity = (
        SemanticCacheIdentityFactory.provider({"provider": "fixture"})
    )
    scope_identity: SemanticCacheScopeIdentity = SemanticCacheIdentityFactory.scope(
        {"user": "fixture"}
    )
    return ViewMeta(
        view_identity=SemanticViewIdentity("fixture-view"),
        definition_identity=definition_identity,
        provider_identity=provider_identity,
        scope_identity=scope_identity,
        timeout=300,
    )


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


class LegacyConfiguration(BaseModel):
    """Concrete empty configuration for the contract provider."""


class LegacyLayer(SemanticLayer[LegacyConfiguration, LegacyView]):
    configuration_class: type[BaseModel] = LegacyConfiguration
    context: SemanticExecutionContext
    cache_token: str
    credentials: SemanticCredentials | None

    @classmethod
    def from_configuration(
        cls,
        configuration: dict[str, Any],
        *,
        cache_token: str,
        context: SemanticExecutionContext,
        credentials: SemanticCredentials | None = None,
    ) -> LegacyLayer:
        layer: LegacyLayer = cls()
        layer.context = context
        layer.cache_token = cache_token
        layer.credentials = credentials
        return layer

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


def make_execution_context(**overrides: Any) -> SemanticExecutionContext:
    """Build a trusted-looking, secret-free SDK value for isolated provider tests."""
    return SemanticExecutionContext(
        **{
            "principal_id": "1",
            "role_ids": (),
            "origin": ExecutionOrigin.REQUEST,
            "is_guest": False,
            "namespace": "test-workspace",
            "identity_digest": "test-identity",
            **overrides,
        }
    )


STUB_PATH: Path = (
    Path(__file__).resolve().parents[2] / "e2e_extensions" / "semantic_stub"
)
STUB_TYPE: str = "extensions.superset-e2e.semantic-stub.stub"


@pytest.fixture
def stub_layer(app: SupersetApp, mocker: MockerFixture) -> Iterator[type[Any]]:
    """Load the bundle through the same path ``LOCAL_EXTENSIONS`` uses at startup."""
    mocker.patch.dict(app.config, {"LOCAL_EXTENSIONS": [str(STUB_PATH)]})
    # Startup imports the entrypoint once per process; undo the import and its
    # in-memory finder so each test re-runs the real registration.
    mocker.patch.dict(sys.modules)
    mocker.patch.object(sys, "meta_path", list(sys.meta_path))
    try:
        with app.app_context():
            SupersetAppInitializer(app).init_extensions()
        yield registry[STUB_TYPE]
    finally:
        registry.pop(STUB_TYPE, None)


@pytest.fixture
def stub_view(
    stub_layer: type[SemanticLayer[Any, Any]], mocker: MockerFixture
) -> SemanticView:
    """Serve chart-data requests for a semantic view backed by the stub."""
    view: SemanticView = stub_layer.from_configuration(
        {},
        cache_token="test",  # noqa: S106
        context=make_execution_context(),
    ).get_semantic_view("orders", {})
    model: SemanticViewModel = SemanticViewModel(
        id=91,
        name="orders",
        cache_timeout=-1,
        semantic_layer=SemanticLayerModel(type=STUB_TYPE),
    )
    mocker.patch.object(
        SemanticViewModel,
        "implementation",
        new_callable=PropertyMock,
        return_value=view,
    )
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=model
    )
    mocker.patch.object(SemanticViewModel, "raise_for_access")
    return view
