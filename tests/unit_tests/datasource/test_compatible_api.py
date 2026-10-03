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

import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import Dimension, Grains, Metric
from werkzeug.test import TestResponse

from superset.semantic_layers.models import SemanticView


@pytest.mark.parametrize("ambiguous", [False, True])
def test_compatible_endpoint_resolves_semantic_variants(
    client: FlaskClient, full_api_access: None, mocker: MockerFixture, ambiguous: bool
) -> None:
    """The public endpoint uses the real model resolver on cache misses."""
    raw: Dimension = Dimension("raw", "event_time", pa.timestamp("us"))
    month: Dimension = Dimension(
        "month", "event_time", pa.timestamp("us"), grain=Grains.MONTH
    )
    other: Dimension = Dimension(
        "other-month", "event_time", pa.timestamp("us"), grain=Grains.MONTH
    )
    metric: Metric = Metric("count", "count", pa.int64(), "COUNT(*)")
    provider: MagicMock = MagicMock()
    provider.uid.return_value = "semantic-view-73"
    provider.get_metrics.return_value = {metric}
    provider.get_dimensions.return_value = (
        [raw, month, other] if ambiguous else [raw, month]
    )
    provider.get_compatible_metrics.return_value = {metric}
    provider.get_compatible_dimensions.return_value = {raw, month}
    view: SemanticView = SemanticView(id=73, name="events")
    view.implementation = provider
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
        }
        provider.get_compatible_metrics.assert_called_once_with({metric}, {raw})
        provider.get_compatible_dimensions.assert_called_once_with({metric}, {raw})
        cache.set.assert_called_once()
