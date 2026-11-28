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

from typing import Any
from unittest.mock import patch

import pytest
from flask import current_app
from sqlalchemy.orm.session import Session

from superset import db
from superset.charts.data.dashboard_filter_context import DashboardFilterContext
from superset.connectors.sqla.models import Database, SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.views.utils import (
    get_dashboard_extra_filters_and_time_range,
    get_form_data,
)


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
    """Native filter defaults are included in dashboard cache warming."""
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
    dashboard = Dashboard(
        dashboard_title="native_filter_dash",
        slices=[chart],
        published=True,
        json_metadata=json.dumps(
            {
                "native_filter_configuration": [
                    {
                        "id": "NATIVE_FILTER-1",
                        "name": "Region filter",
                        "type": "NATIVE_FILTER",
                        "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                        "targets": [{"column": {"name": "region"}}],
                        "defaultDataMask": {
                            "extraFormData": {
                                "filters": [
                                    {"col": "region", "op": "IN", "val": ["APAC"]}
                                ]
                            },
                            "filterState": {"value": ["APAC"]},
                        },
                        "controlValues": {},
                    }
                ]
            }
        ),
        position_json="{}",
    )
    db.session.add_all([chart, dashboard])
    db.session.flush()

    with (
        patch("superset.charts.data.dashboard_filter_context._check_dashboard_access"),
        patch("superset.views.utils.security_manager.raise_for_access"),
    ):
        extra_filters, time_range = get_dashboard_extra_filters_and_time_range(
            chart.id, dashboard.id
        )

    assert extra_filters == [{"col": "region", "op": "IN", "val": ["APAC"]}]
    assert time_range is None

    legacy_filter = {"col": "country", "op": "in", "val": ["Brazil"]}
    metadata = json.loads(dashboard.json_metadata)
    metadata["default_filters"] = json.dumps({"legacy-filter": {"country": ["Brazil"]}})
    metadata["filter_scopes"] = {}
    dashboard.json_metadata = json.dumps(metadata)

    with (
        patch("superset.charts.data.dashboard_filter_context._check_dashboard_access"),
        patch("superset.views.utils.security_manager.raise_for_access"),
        patch(
            "superset.views.utils.build_extra_filters",
            return_value=[legacy_filter],
        ),
    ):
        extra_filters, time_range = get_dashboard_extra_filters_and_time_range(
            chart.id, dashboard.id
        )

    assert extra_filters == [
        legacy_filter,
        {"col": "region", "op": "IN", "val": ["APAC"]},
    ]
    assert time_range is None


def test_get_dashboard_extra_filters_denies_unauthorized_dashboard(
    session: Session,
) -> None:
    """
    A chart can legitimately be reused across multiple dashboards, so
    chart-membership on a dashboard is not an entitlement check for that
    dashboard. A caller who can access the chart but not the dashboard it's
    also placed on must not have that dashboard's filter configuration
    pulled into their request.
    """
    Dashboard.metadata.create_all(session.get_bind())

    dataset = SqlaTable(
        table_name="unauthorized_dash_table",
        database=Database(
            database_name="unauthorized_dash_db", sqlalchemy_uri="sqlite://"
        ),
    )
    db.session.add(dataset)
    db.session.flush()

    chart = Slice(
        slice_name="shared_chart",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    dashboard = Dashboard(
        dashboard_title="dashboard_caller_cant_access",
        slices=[chart],
        published=True,
        json_metadata=json.dumps(
            {
                "default_filters": json.dumps(
                    {"legacy-filter": {"country": ["Brazil"]}}
                ),
                "filter_scopes": {},
            }
        ),
        position_json="{}",
    )
    db.session.add_all([chart, dashboard])
    db.session.flush()

    from unittest.mock import MagicMock

    from superset.exceptions import SupersetSecurityException

    with (
        patch("superset.charts.data.dashboard_filter_context._check_dashboard_access"),
        patch(
            "superset.views.utils.security_manager.raise_for_access",
            side_effect=SupersetSecurityException(MagicMock()),
        ),
        patch(
            "superset.views.utils.build_extra_filters",
            return_value=[{"col": "country", "op": "in", "val": ["Brazil"]}],
        ),
    ):
        result = get_dashboard_extra_filters_and_time_range(chart.id, dashboard.id)

    assert result == ([], None)


def test_get_dashboard_extra_filters_and_time_range_returns_time_range_default(
    session: Session,
) -> None:
    """The in-scope native Time Range default is returned beside the clauses."""
    Dashboard.metadata.create_all(session.get_bind())

    dataset = SqlaTable(
        table_name="time_range_table",
        database=Database(database_name="time_range_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()

    chart = Slice(
        slice_name="chart_with_time_range",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    dashboard = Dashboard(
        dashboard_title="time_range_dash",
        slices=[chart],
        published=True,
        json_metadata=json.dumps({}),
        position_json="{}",
    )
    db.session.add_all([chart, dashboard])
    db.session.flush()

    native_filter = {"col": "region", "op": "IN", "val": ["APAC"]}
    filter_context = DashboardFilterContext(
        extra_form_data={
            "filters": [native_filter],
            "time_range": "2005-01-01 : 2010-01-01",
        }
    )

    with (
        patch("superset.views.utils.security_manager.raise_for_access"),
        patch(
            "superset.views.utils.get_dashboard_filter_context",
            return_value=filter_context,
        ) as mock_get_filter_context,
    ):
        result = get_dashboard_extra_filters_and_time_range(chart.id, dashboard.id)

    assert result == ([native_filter], "2005-01-01 : 2010-01-01")
    mock_get_filter_context.assert_called_once_with(
        dashboard_id=dashboard.id,
        chart_id=chart.id,
    )


def test_get_dashboard_extra_filters_and_time_range_with_legacy_filters(
    session: Session,
) -> None:
    """Legacy clauses precede native clauses, and the time range is kept."""
    Dashboard.metadata.create_all(session.get_bind())

    dataset = SqlaTable(
        table_name="legacy_time_range_table",
        database=Database(
            database_name="legacy_time_range_db", sqlalchemy_uri="sqlite://"
        ),
    )
    db.session.add(dataset)
    db.session.flush()

    chart = Slice(
        slice_name="chart_with_legacy_and_time_range",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    dashboard = Dashboard(
        dashboard_title="legacy_time_range_dash",
        slices=[chart],
        published=True,
        json_metadata=json.dumps(
            {
                "default_filters": json.dumps(
                    {"legacy-filter": {"country": ["Brazil"]}}
                ),
                "filter_scopes": {},
            }
        ),
        position_json="{}",
    )
    db.session.add_all([chart, dashboard])
    db.session.flush()

    legacy_filter = {"col": "country", "op": "in", "val": ["Brazil"]}
    native_filter = {"col": "region", "op": "IN", "val": ["APAC"]}
    filter_context = DashboardFilterContext(
        extra_form_data={
            "filters": [native_filter],
            "time_range": "2005-01-01 : 2010-01-01",
        }
    )

    with (
        patch("superset.views.utils.security_manager.raise_for_access"),
        patch(
            "superset.views.utils.get_dashboard_filter_context",
            return_value=filter_context,
        ),
        patch(
            "superset.views.utils.build_extra_filters",
            return_value=[legacy_filter],
        ),
    ):
        result = get_dashboard_extra_filters_and_time_range(chart.id, dashboard.id)

    assert result == (
        [legacy_filter, native_filter],
        "2005-01-01 : 2010-01-01",
    )


@pytest.mark.parametrize(
    "extra_form_data",
    [
        {},
        {"time_range": ""},
        {"time_range": None},
        {"time_range": ["2005-01-01 : 2010-01-01"]},
    ],
)
def test_get_dashboard_extra_filters_and_time_range_ignores_unusable_time_range(
    session: Session,
    extra_form_data: dict[str, Any],
) -> None:
    """A missing, empty, or non-string time range is returned as ``None``."""
    Dashboard.metadata.create_all(session.get_bind())

    dataset = SqlaTable(
        table_name="no_time_range_table",
        database=Database(database_name="no_time_range_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()

    chart = Slice(
        slice_name="chart_without_time_range",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    dashboard = Dashboard(
        dashboard_title="no_time_range_dash",
        slices=[chart],
        published=True,
        json_metadata=json.dumps({}),
        position_json="{}",
    )
    db.session.add_all([chart, dashboard])
    db.session.flush()

    with (
        patch("superset.views.utils.security_manager.raise_for_access"),
        patch(
            "superset.views.utils.get_dashboard_filter_context",
            return_value=DashboardFilterContext(extra_form_data=extra_form_data),
        ),
    ):
        result = get_dashboard_extra_filters_and_time_range(chart.id, dashboard.id)

    assert result == ([], None)
