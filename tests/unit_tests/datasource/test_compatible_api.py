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

"""Compatibility API preserves semantic provider identities before caching."""

from unittest.mock import MagicMock
from uuid import uuid4

import pyarrow as pa
import pytest
from flask import Flask
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    Dimension,
    DimensionSelection,
    Grains,
    Metric,
)
from werkzeug.test import TestResponse

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import QueryObjectValidationError, SupersetSecurityException
from superset.semantic_layers.execution import SemanticBindingMemo
from superset.semantic_layers.models import SemanticLayer, SemanticView


@pytest.mark.parametrize("ambiguous", [False, True])
def test_compatible_endpoint_resolves_semantic_variants(
    app: Flask,
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    ambiguous: bool,
) -> None:
    """The public endpoint uses the real model resolver on cache misses."""
    mocker.patch.dict(
        app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": "compatible-endpoint-tests"}
    )
    raw: Dimension = Dimension(
        "raw",
        "event_time",
        pa.timestamp("us"),
        grains=frozenset({Grains.DAY, Grains.MONTH}),
    )
    month: Dimension = Dimension(
        "month", "event_time", pa.timestamp("us"), grains=frozenset({Grains.MONTH})
    )
    other: Dimension = Dimension(
        "other-month",
        "event_time",
        pa.timestamp("us"),
        grains=frozenset({Grains.MONTH}),
    )
    metric: Metric = Metric("count", "count", pa.int64(), "COUNT(*)")
    provider: MagicMock = MagicMock()
    provider.uid.return_value = "semantic-view-73"
    provider.get_metrics.return_value = {metric}
    provider.get_dimensions.return_value = [raw, other] if ambiguous else [raw]
    provider.get_compatible_metrics.return_value = {metric}
    provider.get_compatible_dimensions.return_value = {month}
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="events-layer", type="test", cache_version=0
    )
    view: SemanticView = SemanticView(
        id=73, name="events", semantic_layer=layer, configuration="{}"
    )
    # `implementation` is a plain (non-settable) property that resolves through
    # `SemanticBindingMemo`, not a `cached_property` instance attributes can
    # override directly -- stub the binding step itself instead.
    mocker.patch.object(
        SemanticBindingMemo,
        "bind",
        return_value=(
            MagicMock(get_semantic_view=MagicMock(return_value=provider)),
            {},
        ),
    )
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource", return_value=view
    )
    mocker.patch.object(SemanticView, "raise_for_access")
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = None
    response: TestResponse = client.post(
        "/api/v1/datasource/semantic_view/73/compatible",
        json={"selected_metrics": ["count"], "selected_dimensions": ["event_time"]},
    )
    if ambiguous:
        assert response.status_code == 400
        assert response.json is not None
        assert "ambiguous" in response.json["message"]
        provider.get_compatible_metrics.assert_not_called()
        provider.get_compatible_dimensions.assert_not_called()
        cache.set.assert_not_called()
    else:
        assert response.status_code == 200
        assert response.json is not None
        assert response.json["result"] == {
            "compatible_metrics": ["count"],
            "compatible_dimensions": ["event_time"],
            "dimension_support": {
                "event_time": {
                    "grains": ["P1M"],
                    "allows_default_grain": True,
                    "omitted_grain": "native",
                    "ungrained_filter": "native",
                }
            },
        }
        provider.get_compatible_metrics.assert_called_once_with(
            {metric}, {DimensionSelection(raw)}
        )
        provider.get_compatible_dimensions.assert_called_once_with(
            {metric}, {DimensionSelection(raw)}
        )
        cache.set.assert_called_once()


@pytest.mark.parametrize("grain", [None, "P1D", "P1M"])
def test_explicit_grain_cache_identity_and_live_validation(
    client: FlaskClient, full_api_access: None, mocker: MockerFixture, grain: str | None
) -> None:
    provider: MagicMock = MagicMock()
    dimension: Dimension = Dimension(
        "time", "time", pa.timestamp("us"), grains=frozenset({Grains.DAY, Grains.MONTH})
    )
    provider.get_dimensions.return_value = {dimension}
    provider.get_metrics.return_value = set()
    provider.uid.return_value = "same-view"
    provider.get_compatible_metrics.return_value = set()
    provider.get_compatible_dimensions.return_value = {dimension}
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="layer", type="test", cache_version=0
    )
    view: SemanticView = SemanticView(
        id=73, name="saved", semantic_layer=layer, configuration="{}"
    )
    mocker.patch.object(
        SemanticBindingMemo,
        "bind",
        return_value=(
            MagicMock(get_semantic_view=MagicMock(return_value=provider)),
            {},
        ),
    )
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource", return_value=view
    )
    mocker.patch.object(SemanticView, "raise_for_access")
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = None
    keys: set[str] = set()
    representation: str | None
    for representation in [None, "P1D", "P1M"]:
        response: TestResponse = client.post(
            "/api/v1/datasource/semantic_view/73/compatible",
            json={
                "selected_dimensions": ["time"],
                "dimension_grains": {"time": representation},
            },
        )
        assert response.status_code == 200
        keys.add(cache.get.call_args.args[0])
    assert len(keys) == 3
    cache.get.reset_mock()
    provider.get_dimensions.return_value = {
        Dimension(
            "time",
            "time",
            pa.timestamp("us"),
            allows_default_grain=False,
            grains=frozenset({Grains.DAY}),
            omitted_grain=Grains.DAY,
            ungrained_filter=Grains.DAY,
        )
    }
    response = client.post(
        "/api/v1/datasource/semantic_view/73/compatible",
        json={
            "selected_dimensions": ["time"],
            "dimension_grains": {"time": grain},
        },
    )
    assert response.status_code == (200 if grain == "P1D" else 400)
    if grain != "P1D":
        cache.get.assert_not_called()


@pytest.mark.parametrize("failure", ["metadata", "omitted", "provider"])
def test_compatible_reports_recovery_and_selection_errors(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    failure: str,
) -> None:
    from superset_core.semantic_layers.errors import SemanticViewConfigurationError
    from superset_core.semantic_layers.types import GrainDefault

    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="layer", type="test", cache_version=0
    )
    view: SemanticView = SemanticView(
        id=73, name="saved", semantic_layer=layer, configuration="{}"
    )
    provider: MagicMock = MagicMock()
    dimension: Dimension = Dimension(
        "time",
        "time",
        pa.timestamp("us"),
        grains=frozenset({Grains.MONTH}),
        allows_default_grain=False,
        omitted_grain=GrainDefault.REJECT,
        ungrained_filter=GrainDefault.REJECT,
    )
    provider.get_dimensions.return_value = {dimension}
    provider.get_metrics.return_value = set()
    provider.uid.return_value = "compatible-error-test"
    binding: MagicMock = MagicMock(get_semantic_view=MagicMock(return_value=provider))
    if failure == "metadata":
        binding.get_semantic_view.side_effect = SemanticViewConfigurationError()
    if failure == "provider":
        provider.get_compatible_metrics.side_effect = QueryObjectValidationError(
            "provider-private-detail"
        )
    mocker.patch.object(SemanticBindingMemo, "bind", return_value=(binding, {}))
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource", return_value=view
    )
    mocker.patch.object(SemanticView, "raise_for_access")
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = None
    response: TestResponse = client.post(
        "/api/v1/datasource/semantic_view/73/compatible",
        json={
            "selected_dimensions": ["time"],
            **({"dimension_grains": {"time": "P1M"}} if failure == "provider" else {}),
        },
    )
    assert response.status_code == (422 if failure == "metadata" else 400)
    assert response.json is not None
    if failure == "metadata":
        assert response.json["error_type"] == "SemanticViewConfigurationError"
        assert response.json["recovery"]["id"] == 73
        assert "re-select" in response.json["message"]
    elif failure == "provider":
        assert "provider-private-detail" not in response.get_data(as_text=True)
    else:
        assert "explicit time grain" in response.json["message"]
    cache.set.assert_not_called()


def test_compatible_access_denial_does_not_bind_provider_or_read_cache(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    view: SemanticView = SemanticView(id=73, name="restricted")
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource", return_value=view
    )
    mocker.patch.object(
        SemanticView,
        "raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                message="Forbidden",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        ),
    )
    binding: MagicMock = mocker.patch.object(SemanticBindingMemo, "bind")
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    response: TestResponse = client.post(
        "/api/v1/datasource/semantic_view/73/compatible", json={}
    )
    assert response.status_code == 403
    binding.assert_not_called()
    cache.get.assert_not_called()
    cache.set.assert_not_called()
