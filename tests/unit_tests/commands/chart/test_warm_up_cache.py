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

"""Disabled semantic charts never warm a cache or return a cached screenshot."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask.testing import FlaskClient
from werkzeug.test import TestResponse

from superset.commands.chart.warm_up_cache import ChartWarmUpCacheCommand
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.semantic_layers.access import SemanticLayersDisabledError
from superset.utils.screenshots import ScreenshotCachePayload


def test_semantic_warm_up_refuses_before_query_context() -> None:
    """Availability is checked even when a caller already holds the chart object."""
    context: MagicMock
    chart: Slice = Slice(id=17, datasource_id=17, datasource_type="semantic_view")
    with (
        patch(
            "superset.feature_flag_manager.is_feature_enabled",
            side_effect=lambda name: name == "THUMBNAILS",
        ),
        patch(
            "superset.commands.chart.warm_up_cache.security_manager.raise_for_access"
        ),
        patch.object(Slice, "get_query_context") as context,
        pytest.raises(SemanticLayersDisabledError),
    ):
        ChartWarmUpCacheCommand(chart, None, None).run()
    context.assert_not_called()


@pytest.mark.parametrize(
    "app",
    [
        {
            "FEATURE_FLAGS": {
                "THUMBNAILS": True,
                "ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS": True,
            }
        }
    ],
    indirect=True,
)
@pytest.mark.parametrize("resource", ["chart", "dashboard"])
@pytest.mark.parametrize(
    "route", ["cache_screenshot/?q=()", "screenshot/digest/", "thumbnail/digest/"]
)
def test_cached_semantic_chart_images_are_unavailable(
    client: FlaskClient[Any],
    full_api_access: None,
    route: str,
    resource: str,
) -> None:
    """A cache hit must not make disabled semantic data accessible."""
    cache: MagicMock
    schedule: MagicMock
    chart: Slice = Slice(id=17, datasource_id=17, datasource_type="semantic_view")
    dashboard: Dashboard = Dashboard(id=17, slices=[chart])
    payload: ScreenshotCachePayload = ScreenshotCachePayload(
        image=b"\x89PNG\r\n\x1a\nimage", scope=f"{resource}:17"
    )
    model: Slice | Dashboard = chart if resource == "chart" else dashboard
    with (
        patch(
            "superset.feature_flag_manager.is_feature_enabled",
            side_effect=lambda name: name == "THUMBNAILS",
        ),
        patch(
            "flask_appbuilder.models.sqla.interface.SQLAInterface.get",
            return_value=model,
        ),
        patch(
            f"superset.{resource}s.api.is_feature_enabled",
            side_effect=lambda name: name == "THUMBNAILS",
        ),
        patch(
            f"superset.{resource}s.api.{resource.title()}Screenshot.get_from_cache_key",
            return_value=payload,
        ) as cache,
        patch(f"superset.{resource}s.api.cache_{resource}_thumbnail.delay") as schedule,
    ):
        response: TestResponse
        if resource == "dashboard" and route.startswith("cache_"):
            response = client.post(
                "/api/v1/dashboard/17/cache_dashboard_screenshot/?q=()", json={}
            )
        else:
            response = client.get(f"/api/v1/{resource}/17/{route}")
    assert response.status_code == 404
    assert "Semantic layers are not enabled." in response.get_data(as_text=True)
    cache.assert_not_called()
    schedule.assert_not_called()


@pytest.mark.parametrize("kind,enabled", [("table", False), ("semantic_view", True)])
def test_available_chart_warm_up_proceeds(kind: str, enabled: bool) -> None:
    """Ordinary charts and enabled semantic charts retain cache warming."""
    command: MagicMock
    chart: Slice = Slice(id=17, datasource_id=17, datasource_type=kind)
    context: MagicMock = MagicMock()
    with (
        patch("superset.feature_flag_manager.is_feature_enabled", return_value=enabled),
        patch(
            "superset.commands.chart.warm_up_cache.security_manager.raise_for_access"
        ),
        patch.object(Slice, "get_query_context", return_value=context),
        patch("superset.commands.chart.warm_up_cache.ChartDataCommand") as command,
    ):
        command.return_value.run.return_value = {"queries": [{}]}
        result: dict[str, Any] = ChartWarmUpCacheCommand(chart, None, None).run()
    assert result["viz_error"] is None
    command.return_value.run.assert_called_once()
