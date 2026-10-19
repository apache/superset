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

from typing import get_type_hints

import pyarrow as pa
import pytest
from superset_core.semantic_layers.errors import (
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
)
from superset_core.semantic_layers.layer import ConfigT, SemanticLayer
from superset_core.semantic_layers.types import Dimension

pytest_plugins: list[str] = ["pytester", "superset_core.semantic_layers.testing"]


def test_configuration_is_part_of_the_typed_contract() -> None:
    """Providers expose their parsed settings under the host's public accessor."""
    assert get_type_hints(SemanticLayer)["configuration"] is ConfigT


def test_sdk_only_provider(semantic_layer_registration: None) -> None:
    """Import the decorated provider only after the registration fixture starts."""
    from example_provider import ExampleLayer, ExampleView

    layer: ExampleLayer = ExampleLayer.from_configuration({"label": "Example"})
    assert layer.configuration.label == "Example"
    assert layer.get_configuration_schema()["properties"]["label"]["type"] == "string"
    assert layer.get_runtime_schema(layer.configuration) == {
        "type": "object",
        "properties": {},
    }
    view: ExampleView = layer.get_semantic_view("example", {})
    assert view.uid() == "example"
    assert view.get_values(next(iter(view.get_dimensions()))).results.to_pydict() == {
        "category": ["A", "B"]
    }
    assert view.metadata_cache_token is None


def test_registration_restores_original_decorator(pytester: pytest.Pytester) -> None:
    """Exercise fixture activation and restoration in one isolated lifecycle."""
    pytester.makepyfile(
        """
        from collections.abc import Iterator

        import pytest
        from superset_core.semantic_layers import decorators

        pytest_plugins: list[str] = ["superset_core.semantic_layers.testing"]

        @pytest.fixture(autouse=True)
        def verify_restore() -> Iterator[None]:
            original: object = decorators.semantic_layer
            yield
            assert decorators.semantic_layer is original

        def test_activation(semantic_layer_registration: None) -> None:
            class Provider:
                "A test provider with no host registration."

            assert decorators.semantic_layer("example", "Example")(Provider) is Provider
        """
    )
    result: pytest.RunResult = pytester.runpytest_subprocess("-q", "-o", "addopts=")
    result.assert_outcomes(passed=1)


def test_example_rejects_unknown_dimension(semantic_layer_registration: None) -> None:
    """Unknown members are invalid queries rather than invalid filters."""
    from example_provider import ExampleView

    dimension: Dimension = Dimension(id="unknown", name="unknown", type=pa.string())
    error: pytest.ExceptionInfo[SemanticQueryRejectedError]
    with pytest.raises(SemanticQueryRejectedError) as error:
        ExampleView().get_values(dimension)
    assert error.value.code == SemanticQueryErrorCode.INVALID_QUERY
