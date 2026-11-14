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

"""Every host construction/discovery boundary supplies the same SDK capability."""

from typing import Any
from unittest.mock import ANY, MagicMock, PropertyMock

import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.context import ExecutionMethod
from superset_core.semantic_layers.transport import ProviderTransport
from werkzeug.test import TestResponse

from superset.semantic_layers.execution import SemanticBindingMemo
from superset.semantic_layers.masking import mask_configuration
from superset.semantic_layers.models import SemanticLayer
from tests.unit_tests.semantic_layers.conftest import make_execution_context


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize("fallback", [False, True])
@pytest.mark.parametrize("writer", [False, True])
def test_configuration_paths_inject_transport_preserving_static_gate(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    fallback: bool,
    writer: bool,
) -> None:
    capability: MagicMock = MagicMock(spec=ProviderTransport)
    factory: MagicMock = mocker.patch(
        "superset.semantic_layers.api.build_provider_transport",
        create=True,
        return_value=capability,
    )
    provider: MagicMock = MagicMock()
    provider.configuration_class.model_json_schema.return_value = {"properties": {}}
    provider.get_configuration_schema.side_effect = (
        [OSError("safe fake failure"), {"type": "object"}]
        if fallback
        else [{"type": "object"}]
    )
    mocker.patch.dict("superset.semantic_layers.api.registry", {"test": provider})
    mocker.patch(
        "superset.semantic_layers.api.security_manager.can_access",
        side_effect=lambda permission, view: permission != "can_write" or writer,
    )
    response: TestResponse = client.post(
        "/api/v1/semantic_layer/schema/configuration",
        json={"type": "test", "configuration": {"account": "fixture"}},
    )
    assert response.status_code == 200
    assert provider.get_configuration_schema.call_count == (2 if fallback else 1)
    for call in provider.get_configuration_schema.call_args_list:
        assert call.kwargs == {"transport": capability, "readiness": ANY}
    assert factory.call_count == provider.get_configuration_schema.call_count
    if not writer:
        provider.configuration_class.model_validate.assert_not_called()
        assert all(
            call.args == (None,)
            for call in provider.get_configuration_schema.call_args_list
        )
    else:
        assert (
            provider.get_configuration_schema.call_args_list[0].args[0]
            is provider.configuration_class.model_validate.return_value
        )
    if fallback:
        assert provider.get_configuration_schema.call_args.args == (None,)


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
def test_runtime_schema_injects_transport_after_access(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    capability: MagicMock = MagicMock(spec=ProviderTransport)
    factory: MagicMock = mocker.patch(
        "superset.semantic_layers.api.build_provider_transport",
        create=True,
        return_value=capability,
    )
    layer: MagicMock = MagicMock(type="test", configuration='{"account": "fixture"}')
    provider: MagicMock = MagicMock()
    provider.get_runtime_schema.return_value = {"type": "object"}
    mocker.patch(
        "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid", return_value=layer
    )
    mocker.patch.dict("superset.semantic_layers.api.registry", {"test": provider})
    response: TestResponse = client.post(
        "/api/v1/semantic_layer/00000000-0000-0000-0000-000000000001/schema/runtime",
        json={"runtime_data": {}},
    )
    assert response.status_code == 200
    layer.raise_for_access.assert_called_once()
    provider.get_runtime_schema.assert_called_once_with(
        layer.implementation.configuration, {}, transport=capability, readiness=ANY
    )
    factory.assert_called_once_with()


def test_masking_static_schema_receives_transport(mocker: MockerFixture) -> None:
    capability: MagicMock = MagicMock(spec=ProviderTransport)
    factory: MagicMock = mocker.patch(
        "superset.semantic_layers.masking.build_provider_transport",
        create=True,
        return_value=capability,
    )
    provider: MagicMock = MagicMock()
    provider.get_configuration_schema.return_value = {
        "type": "object",
        "properties": {"plain": {"type": "string"}},
    }
    mocker.patch.dict("superset.semantic_layers.masking.registry", {"test": provider})
    assert mask_configuration("test", {"plain": "value"}) == {"plain": "value"}
    provider.get_configuration_schema.assert_called_once_with(
        transport=capability, readiness=ANY
    )
    factory.assert_called_once_with()


def test_binding_injects_transport_only_on_memo_miss(mocker: MockerFixture) -> None:
    capability: MagicMock = MagicMock(spec=ProviderTransport)
    factory: MagicMock = mocker.patch(
        "superset.semantic_layers.execution.build_provider_transport",
        create=True,
        return_value=capability,
    )
    mocker.patch(
        "superset.semantic_layers.execution.current_host_execution_context",
        return_value=make_execution_context(),
    )
    mocker.patch(
        "superset.semantic_layers.execution.check_execution_allowed",
        return_value=ExecutionMethod.CONNECTION,
    )
    mocker.patch.object(
        SemanticLayer,
        "metadata_generation",
        new_callable=PropertyMock,
        return_value="generation",
    )
    provider: MagicMock = MagicMock()
    mocker.patch.dict("superset.semantic_layers.execution.registry", {"test": provider})
    layer: SemanticLayer = SemanticLayer(type="test", configuration="{}")
    memo: SemanticBindingMemo = SemanticBindingMemo()
    assert memo.bind(layer) is memo.bind(layer)
    factory.assert_called_once_with()
    provider.from_configuration.assert_called_once()
    assert provider.from_configuration.call_args.kwargs["transport"] is capability
