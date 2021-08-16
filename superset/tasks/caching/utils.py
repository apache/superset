import json
from typing import Any, Dict, Optional

from maf.tests.models import Slice

from superset import app
from superset.models.dashboard import Dashboard
from superset.views.utils import build_extra_filters


def get_form_data(
    chart_id: int, dashboard: Optional[Dashboard] = None
) -> Dict[str, Any]:
    """
    Build `form_data` for chart GET request from dashboard's `default_filters`.

    When a dashboard has `default_filters` they need to be added  as extra
    filters in the GET request for charts.

    """
    form_data: Dict[str, Any] = {"slice_id": chart_id}

    if dashboard is None or not dashboard.json_metadata:
        return form_data

    json_metadata = json.loads(dashboard.json_metadata)
    default_filters = json.loads(json_metadata.get("default_filters", "null"))
    if not default_filters:
        return form_data

    filter_scopes = json_metadata.get("filter_scopes", {})
    layout = json.loads(dashboard.position_json or "{}")
    if (
        isinstance(layout, dict)
        and isinstance(filter_scopes, dict)
        and isinstance(default_filters, dict)
    ):
        extra_filters = build_extra_filters(
            layout, filter_scopes, default_filters, chart_id
        )
        if extra_filters:
            form_data["extra_filters"] = extra_filters

    return form_data


def get_url(chart: Slice, extra_filters: Optional[Dict[str, Any]] = None) -> str:
    """Return external URL for warming up a given chart/table cache."""
    with app.test_request_context():
        baseurl = (
            "{SUPERSET_WEBSERVER_PROTOCOL}://"
            "{SUPERSET_WEBSERVER_ADDRESS}:"
            "{SUPERSET_WEBSERVER_PORT}".format(**app.config)
        )
        return f"{baseurl}{chart.get_explore_url(overrides=extra_filters)}"
