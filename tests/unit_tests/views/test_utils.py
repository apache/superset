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
"""Tests for superset.views.utils module"""

from flask import current_app
from sqlalchemy.orm.session import Session

from superset import db
from superset.connectors.sqla.models import Database, SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.views.utils import get_dashboard_extra_filters, get_form_data


def test_get_form_data_handles_non_json_body_with_json_content_type() -> None:
    """get_form_data returns gracefully when Content-Type claims JSON but the
    body isn't parseable JSON, instead of letting Werkzeug's BadRequest escape.

    This is the shape of the request context an MCP tool call runs in when a
    chart/dataset SQL template calls the ``filter_values()`` Jinja macro: the
    Content-Type header says ``application/json`` but the body is not a JSON
    chart-data payload.
    """
    with current_app.test_request_context(
        data="not-json-at-all", content_type="application/json"
    ):
        form_data, slc = get_form_data()

    assert form_data == {}
    assert slc is None


def test_get_form_data_handles_non_dict_json_body() -> None:
    """get_form_data coerces a well-formed but non-object JSON body to {}.

    ``request.get_json()`` happily returns a scalar or list for valid JSON
    that isn't a JSON object (e.g. ``null`` or ``42``). Downstream code treats
    the parsed body as a mapping, so a non-dict result must not leak through.
    """
    with current_app.test_request_context(data="42", content_type="application/json"):
        form_data, slc = get_form_data()

    assert form_data == {}
    assert slc is None


def test_get_dashboard_extra_filters_includes_native_filter_defaults(
    session: Session,
) -> None:
    """
    get_dashboard_extra_filters must surface native filter defaults, not just
    the legacy Filter Box ``default_filters``/``filter_scopes`` metadata.

    Reported in apache/superset#43024 (originally raised in discussion #42382):
    ``ChartWarmUpCacheCommand`` relies on this function to reconstruct a
    dashboard's applied filters for cache warming. Because it only reads the
    legacy fields, warming a
    dashboard that uses native filters (the standard mechanism today, not the
    deprecated Filter Box) silently drops every native filter's default
    value, so the warmed cache key never matches what the browser actually
    requests and warm_up_cache is effectively a no-op for such dashboards.

    A working native-filter extractor already exists and is wired into the
    real ``/api/v1/chart/data`` endpoint (see
    ``superset.charts.data.dashboard_filter_context.get_dashboard_filter_context``)
    -- this function just isn't using it.
    """
    Dashboard.metadata.create_all(session.get_bind())

    dataset = SqlaTable(
        table_name="extra_filters_table",
        database=Database(database_name="extra_filters_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()

    chart = Slice(
        slice_name="chart_with_native_filter",
        datasource_id=dataset.id,
        datasource_type="table",
    )

    native_filter_configuration = [
        {
            "id": "NATIVE_FILTER-1",
            "name": "Region filter",
            "type": "NATIVE_FILTER",
            "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            "targets": [{"column": {"name": "region"}}],
            "defaultDataMask": {
                "extraFormData": {
                    "filters": [{"col": "region", "op": "IN", "val": ["APAC"]}]
                },
                "filterState": {"value": ["APAC"]},
            },
            "controlValues": {},
        }
    ]
    dashboard = Dashboard(
        dashboard_title="native_filter_dash",
        slices=[chart],
        published=True,
        json_metadata=json.dumps(
            {"native_filter_configuration": native_filter_configuration}
        ),
        position_json="{}",
    )
    db.session.add_all([chart, dashboard])
    db.session.flush()

    extra_filters = get_dashboard_extra_filters(chart.id, dashboard.id)

    assert extra_filters, (
        "get_dashboard_extra_filters returned no filters for a dashboard "
        "with a native filter default value -- it currently only reads the "
        "legacy default_filters/filter_scopes metadata, so native filter "
        "defaults are silently dropped from cache warming."
    )
