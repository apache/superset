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

from unittest.mock import MagicMock, patch

import pytest
from werkzeug.exceptions import BadRequest


def test_availability_is_evaluated_on_every_call() -> None:
    """A runtime hook can change availability without reconstructing the app."""
    enabled: MagicMock
    from superset.semantic_layers.access import is_semantic_layers_enabled

    with patch(
        "superset.feature_flag_manager.is_feature_enabled",
        side_effect=[False, True, False],
    ) as enabled:
        assert not is_semantic_layers_enabled()
        assert is_semantic_layers_enabled()
        assert not is_semantic_layers_enabled()
        assert enabled.call_count == 3
        enabled.assert_called_with("SEMANTIC_LAYERS")


def test_disabled_error_is_tenant_neutral() -> None:
    """Transport adapters receive one stable error without workspace details."""
    from superset.semantic_layers.access import SemanticLayersDisabledError

    error: SemanticLayersDisabledError = SemanticLayersDisabledError()
    assert str(error) == "Semantic layers are not enabled."


def test_unsupported_chart_image_translates_validation_error() -> None:
    """Image callers receive an HTTP 400 with the chart policy's useful message."""
    from superset.exceptions import QueryObjectValidationError
    from superset.models.slice import Slice
    from superset.semantic_layers.access import is_semantic_image_unavailable

    chart: Slice = Slice(datasource_type="semantic_view", viz_type="histogram_v2")
    error: pytest.ExceptionInfo[BadRequest]
    with (
        patch(
            "superset.semantic_layers.access.is_semantic_layers_enabled",
            return_value=True,
        ),
        pytest.raises(BadRequest) as error,
    ):
        is_semantic_image_unavailable(chart)
    assert error.value.code == 400
    assert error.value.description == (
        "Histogram is not yet supported on semantic views. "
        "Use a Bar or Table chart with an explicit count metric."
    )
    assert str(error.value) == error.value.description
    assert isinstance(error.value.__cause__, QueryObjectValidationError)
