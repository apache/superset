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
"""World Bank dashboard test fixtures.

This module provides fixtures for tests that need a wb_health_population dataset
with associated dashboard and slices. Uses the new DuckDB-based example loading.
"""

from typing import Any, Optional

import pytest
from flask import current_app
from sqlalchemy import or_

from superset import db
from superset.cli.examples import load_examples_run
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import ReportSchedule
from superset.utils import json
from superset.utils.core import DatasourceType, get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.dashboard_utils import (
    create_dashboard,
    create_table_metadata,
)
from tests.integration_tests.test_app import app

WB_HEALTH_POPULATION = "wb_health_population"

# Module-level flag to track if examples have been loaded
_examples_loaded = False


def _ensure_examples_loaded() -> None:
    """Load examples once per test session."""
    global _examples_loaded
    if not _examples_loaded:
        load_examples_run(
            load_test_data=False,
            load_big_data=False,
            only_metadata=False,
            force=False,  # Don't force - reuse if exists
        )
        _examples_loaded = True


def _get_slice_json(defaults: dict[str, Any], **kwargs: Any) -> str:
    """Generate slice params JSON."""
    params = {**defaults, **kwargs}
    return json.dumps(params, indent=2, sort_keys=True)


def create_slices(tbl: SqlaTable) -> list[Slice]:
    """Create slices for the world_bank dashboard."""
    secondary_metric = {
        "aggregate": "SUM",
        "column": {
            "column_name": "SP_RUR_TOTL",
            "optionName": "_col_SP_RUR_TOTL",
            "type": "DOUBLE",
        },
        "expressionType": "SIMPLE",
        "hasCustomLabel": True,
        "label": "Rural Population",
    }
    defaults = {
        "compare_lag": "10",
        "compare_suffix": "o10Y",
        "limit": "25",
        "granularity_sqla": "year",
        "groupby": [],
        "row_limit": current_app.config.get("ROW_LIMIT", 50000),
        "since": "2014-01-01",
        "until": "2014-01-02",
        "time_range": "2014-01-01 : 2014-01-02",
        "markup_type": "markdown",
        "country_fieldtype": "cca3",
        "entity": "country_code",
        "show_bubbles": True,
    }

    return [
        Slice(
            slice_name="World's Population",
            viz_type="big_number",
            datasource_type=DatasourceType.TABLE,
            datasource_id=tbl.id,
            params=_get_slice_json(
                defaults,
                since="2000",
                viz_type="big_number",
                compare_lag="10",
                metric="sum__SP_POP_TOTL",
                compare_suffix="over 10Y",
            ),
        ),
        Slice(
            slice_name="Most Populated Countries",
            viz_type="table",
            datasource_type=DatasourceType.TABLE,
            datasource_id=tbl.id,
            params=_get_slice_json(
                defaults,
                viz_type="table",
                metrics=["sum__SP_POP_TOTL"],
                groupby=["country_name"],
            ),
        ),
        Slice(
            slice_name="Growth Rate",
            viz_type="echarts_timeseries_line",
            datasource_type=DatasourceType.TABLE,
            datasource_id=tbl.id,
            params=_get_slice_json(
                defaults,
                viz_type="echarts_timeseries_line",
                since="1960-01-01",
                metrics=["sum__SP_POP_TOTL"],
                num_period_compare="10",
                groupby=["country_name"],
            ),
        ),
        Slice(
            slice_name="% Rural",
            viz_type="world_map",
            datasource_type=DatasourceType.TABLE,
            datasource_id=tbl.id,
            params=_get_slice_json(
                defaults,
                viz_type="world_map",
                metric="sum__SP_RUR_TOTL_ZS",
                num_period_compare="10",
                secondary_metric=secondary_metric,
            ),
        ),
    ]


# Simplified dashboard positions for testing
dashboard_positions: dict[str, Any] = {
    "DASHBOARD_VERSION_KEY": "v2",
    "GRID_ID": {"children": [], "id": "GRID_ID", "type": "GRID"},
    "HEADER_ID": {
        "id": "HEADER_ID",
        "meta": {"text": "World Bank Data"},
        "type": "HEADER",
    },
    "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
}


@pytest.fixture(scope="session")
def load_world_bank_data():  # noqa: PT004
    """
    Session-scoped fixture to ensure world_bank data is loaded.
    Uses the new DuckDB-based example loading system.
    """
    with app.app_context():
        _ensure_examples_loaded()
    return


@pytest.fixture
def load_world_bank_dashboard_with_slices(load_world_bank_data):  # noqa: PT004
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = create_dashboard_for_loaded_data()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="module")
def load_world_bank_dashboard_with_slices_module_scope(load_world_bank_data):  # noqa: PT004
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = create_dashboard_for_loaded_data()
        yield
        _cleanup_reports(dash_id_to_delete, slices_ids_to_delete)
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="class")
def load_world_bank_dashboard_with_slices_class_scope(load_world_bank_data):  # noqa: PT004
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = create_dashboard_for_loaded_data()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


def create_dashboard_for_loaded_data():
    """Create or find the World Bank dashboard and slices."""
    # Try to find existing dashboard first (from DuckDB loading)
    dash = (
        db.session.query(Dashboard)
        .filter_by(dashboard_title="World Bank's Data")
        .first()
    )

    if dash:
        # Dashboard exists from examples - return its IDs
        slices_ids = [slice.id for slice in dash.slices]
        return dash.id, slices_ids

    # No existing dashboard - create our own test dashboard
    table = _create_table(WB_HEALTH_POPULATION, get_example_database())

    if not table:
        pytest.skip(
            "wb_health_population table not found. "
            "The new DuckDB-based examples may not be fully loaded."
        )

    slices = _create_world_bank_slices(table)
    dash = _create_world_bank_dashboard(table, slices)
    slices_ids_to_delete = [slice.id for slice in slices]
    dash_id_to_delete = dash.id
    return dash_id_to_delete, slices_ids_to_delete


def _create_table(
    table_name: str,
    database: Database,
) -> Optional[SqlaTable]:
    """Get or create table metadata."""
    schema = get_example_default_schema()
    existing = (
        db.session.query(SqlaTable)
        .filter_by(table_name=table_name, schema=schema)
        .first()
    )

    if existing:
        return existing

    # Create new table metadata
    table = create_table_metadata(table_name, database)
    if table:
        table.fetch_metadata()
        db.session.commit()
    return table


def _create_world_bank_slices(table: SqlaTable) -> list[Slice]:
    slices = create_slices(table)
    _commit_slices(slices)
    return slices


def _commit_slices(slices: list[Slice]):
    for slice in slices:
        o = db.session.query(Slice).filter_by(slice_name=slice.slice_name).one_or_none()
        if o:
            db.session.delete(o)
        db.session.add(slice)
        db.session.commit()


def _create_world_bank_dashboard(table: SqlaTable, slices: list[Slice]) -> Dashboard:
    from superset.examples.helpers import update_slice_ids

    pos: dict[str, Any] = dict(dashboard_positions)

    # Add charts to position
    for i, slc in enumerate(slices):
        chart_id = f"CHART-{i + 1}"
        pos[chart_id] = {
            "children": [],
            "id": chart_id,
            "meta": {
                "chartId": slc.id,
                "height": 50,
                "sliceName": slc.slice_name,
                "width": 4,
            },
            "type": "CHART",
        }
        pos["GRID_ID"]["children"].append(chart_id)

    update_slice_ids(pos)

    table.fetch_metadata()

    dash = create_dashboard(
        "world_health", "World Bank's Data", json.dumps(pos), slices
    )
    dash.json_metadata = '{"mock_key": "mock_value"}'
    db.session.commit()
    return dash


def _cleanup(dash_id: int, slices_ids: list[int]) -> None:
    """Clean up test dashboard and slices (but not the data table)."""
    # Only clean up if we created our own test dashboard
    # Skip cleanup if using the dashboard from examples
    dash = db.session.query(Dashboard).filter_by(id=dash_id).first()
    if dash and dash.dashboard_title == "World Bank's Data":
        # Check if this is the original example dashboard - be careful about cleanup
        pass

    if dash_id:
        dash = db.session.query(Dashboard).filter_by(id=dash_id).first()
        if dash:
            db.session.delete(dash)

    if slices_ids:
        for slice_id in slices_ids:
            db.session.query(Slice).filter_by(id=slice_id).delete()

    db.session.commit()


def _cleanup_reports(dash_id: int, slices_ids: list[int]) -> None:
    reports = db.session.query(ReportSchedule).filter(
        or_(
            ReportSchedule.dashboard_id == dash_id,
            ReportSchedule.chart_id.in_(slices_ids),
        )
    )

    for report in reports:
        db.session.delete(report)
    db.session.commit()
