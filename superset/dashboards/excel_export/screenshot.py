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
"""
Render a single dashboard chart to a PNG for the image-mode Excel export.

This reuses the same headless render path scheduled reports use
(:class:`~superset.utils.screenshots.ChartScreenshot`), but points it at an
Explore URL whose ``form_data`` carries the live dashboard filter state — so an
embedded image reflects the same filters the data path applies, rather than the
chart's default saved state.
"""

from __future__ import annotations

import logging
from typing import Any

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app

from superset.charts.data.dashboard_filter_context import (
    get_dashboard_filter_context,
)
from superset.utils import json
from superset.utils.screenshots import ChartScreenshot
from superset.utils.urls import get_url_path

logger = logging.getLogger(__name__)


def render_chart_image(
    chart: Any,
    dashboard_id: int,
    active_data_mask: dict[str, Any],
    user: Any,
) -> bytes | None:
    """
    Render ``chart`` (as seen on ``dashboard_id``) to PNG bytes.

    The chart is rendered through Explore in standalone mode with the live
    dashboard filter state injected as ``extra_form_data`` — the same object the
    data path merges into the query context — so the image and the data stay
    consistent.

    :param chart: The ``Slice`` to render
    :param dashboard_id: The dashboard the chart is displayed on (for filter scope)
    :param active_data_mask: Live dashboard filter state keyed by native filter id
    :param user: The requesting user; the render runs with their permissions
    :returns: PNG bytes, or ``None`` if the render failed (the caller skips and
        notes the chart)
    """
    try:
        filter_context = get_dashboard_filter_context(
            dashboard_id=dashboard_id,
            chart_id=chart.id,
            active_data_mask=active_data_mask,
        )

        # Start from the chart's saved form data and force the slice id, then
        # layer the live filters on top so the render matches the data path.
        form_data: dict[str, Any] = json.loads(chart.params or "{}")
        form_data["slice_id"] = chart.id
        if filter_context.extra_form_data:
            form_data["extra_form_data"] = filter_context.extra_form_data

        url = get_url_path(
            "ExploreView.root",
            form_data=json.dumps(form_data),
        )

        window_size = current_app.config["WEBDRIVER_WINDOW"]["slice"]
        screenshot = ChartScreenshot(
            url,
            chart.digest,
            window_size=window_size,
            thumb_size=window_size,
        )
        return screenshot.get_screenshot(user=user)
    except SoftTimeLimitExceeded:
        # A soft timeout aborts the whole export; don't let the broad handler
        # below turn it into a ``None`` (a per-chart "could not render") result.
        raise
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "Failed to render image for chart %s in dashboard %s",
            getattr(chart, "id", "?"),
            dashboard_id,
        )
        return None
