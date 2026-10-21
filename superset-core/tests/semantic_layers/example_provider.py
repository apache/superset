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

"""A small SDK-only provider; import under semantic_layer_registration in tests."""

from typing import Any

import pyarrow as pa
from pydantic import BaseModel
from superset_core.semantic_layers.context import (
    SemanticCredentials,
    SemanticExecutionContext,
)
from superset_core.semantic_layers.decorators import semantic_layer
from superset_core.semantic_layers.errors import (
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
)
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.transport import ProviderTransport
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView


class ExampleConfig(BaseModel):
    """Parsed connection settings exposed through the layer."""

    label: str = "Example"


class ExampleView(SemanticView):
    """An in-memory dimension-only view with no optional capabilities or cache."""

    def __init__(self, cache_token: str | None = None) -> None:
        """Capture the discovery generation for this view."""
        self._cache_token: str | None = cache_token

    @property
    def metadata_cache_token(self) -> str | None:
        """Echo the captured generation without retaining a shared cache."""
        return self._cache_token

    def uid(self) -> str:
        """Return stable identity independently of display labels."""
        return "example"

    def get_dimensions(self) -> set[Dimension]:
        """Expose one member whose private ID differs from its selection name."""
        return {Dimension(id="private-category", name="category", type=pa.string())}

    def get_metrics(self) -> set[Metric]:
        """This example has no metrics."""
        return set()

    def get_values(
        self, dimension: Dimension, filters: set[Filter] | None = None
    ) -> SemanticResult:
        """Return complete distinct values named after the requested member."""
        if dimension not in self.get_dimensions():
            raise SemanticQueryRejectedError(SemanticQueryErrorCode.INVALID_QUERY)
        if filters:
            raise SemanticQueryRejectedError(SemanticQueryErrorCode.UNSUPPORTED_QUERY)
        return SemanticResult(
            requests=[], results=pa.table({dimension.name: ["A", "B"]})
        )

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        """Only value discovery is supported by this minimal authoring example."""
        raise SemanticQueryRejectedError(SemanticQueryErrorCode.UNSUPPORTED_QUERY)

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        """Refuse unsupported queries without claiming an incomplete count."""
        raise SemanticQueryRejectedError(SemanticQueryErrorCode.UNSUPPORTED_QUERY)

    def get_compatible_metrics(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Metric]:
        """Return the empty metric catalog."""
        return set()

    def get_compatible_dimensions(
        self, selected_metrics: set[Metric], selected_dimensions: set[Dimension]
    ) -> set[Dimension]:
        """Return the dimension catalog."""
        return self.get_dimensions()


@semantic_layer(id="example", name="Example provider")
class ExampleLayer(SemanticLayer[ExampleConfig, ExampleView]):
    """Construct from parsed configuration without importing a host framework."""

    configuration_class: type[BaseModel] = ExampleConfig

    def __init__(
        self,
        configuration: ExampleConfig,
        *,
        cache_token: str,
        context: SemanticExecutionContext,
    ) -> None:
        """Store parsed settings and the host-supplied binding identity."""
        self.configuration: ExampleConfig = configuration
        self.cache_token: str = cache_token
        self.context: SemanticExecutionContext = context

    @classmethod
    def from_configuration(
        cls,
        configuration: dict[str, Any],
        *,
        cache_token: str,
        context: SemanticExecutionContext,
        transport: ProviderTransport,
        credentials: SemanticCredentials | None = None,
    ) -> "ExampleLayer":
        """Bind settings and execution identity without using network transport."""
        return cls(
            ExampleConfig.model_validate(configuration),
            cache_token=cache_token,
            context=context,
        )

    @classmethod
    def get_configuration_schema(
        cls, configuration: ExampleConfig | None = None, *, transport: ProviderTransport
    ) -> dict[str, Any]:
        """Return a static schema without opening a connection."""
        return ExampleConfig.model_json_schema()

    @classmethod
    def get_runtime_schema(
        cls,
        configuration: ExampleConfig,
        runtime_data: dict[str, Any] | None = None,
        *,
        transport: ProviderTransport,
    ) -> dict[str, Any]:
        """This provider needs no additional runtime settings."""
        return {"type": "object", "properties": {}}

    def get_semantic_views(
        self, runtime_configuration: dict[str, Any]
    ) -> set[ExampleView]:
        """Discover the only view without retaining a shared cache."""
        return {self.get_semantic_view("example", runtime_configuration)}

    def get_semantic_view(
        self, name: str, additional_configuration: dict[str, Any]
    ) -> ExampleView:
        """Find the named view."""
        if name != "example":
            raise KeyError(name)
        return ExampleView(self.cache_token)
