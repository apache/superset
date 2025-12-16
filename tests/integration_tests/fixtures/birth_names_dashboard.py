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
"""Birth names dashboard test fixtures.

This module provides fixtures for tests that need a birth_names dataset
with associated dashboard and slices. Uses the new DuckDB-based example loading.
"""

from typing import Any, Callable, Optional

import pytest
from flask import current_app
from sqlalchemy.sql import column

from superset import db
from superset.cli.examples import load_examples_run
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import DatasourceType, get_example_default_schema
from superset.utils.database import get_example_database
from tests.example_data.data_loading.base_data_loader import DataLoader
from tests.example_data.data_loading.data_definitions.types import Table
from tests.integration_tests.dashboard_utils import create_table_metadata
from tests.integration_tests.test_app import app

BIRTH_NAMES_TBL_NAME = "birth_names"

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


def _set_table_metadata(datasource: SqlaTable, database: Database) -> None:
    """Set table metadata for birth_names dataset."""
    datasource.main_dttm_col = "ds"
    datasource.database = database
    datasource.filter_select_enabled = True
    datasource.fetch_metadata()


def _add_table_metrics(datasource: SqlaTable) -> None:
    """Add metrics and calculated columns to the birth_names table."""
    columns: list[TableColumn] = list(datasource.columns)
    metrics: list[SqlMetric] = list(datasource.metrics)

    if not any(col.column_name == "num_california" for col in columns):
        col_state = str(column("state").compile(db.engine))
        col_num = str(column("num").compile(db.engine))
        columns.append(
            TableColumn(
                column_name="num_california",
                expression=f"CASE WHEN {col_state} = 'CA' THEN {col_num} ELSE 0 END",
            )
        )

    if not any(col.metric_name == "sum__num" for col in metrics):
        col = str(column("num").compile(db.engine))
        metrics.append(SqlMetric(metric_name="sum__num", expression=f"SUM({col})"))

    for col in columns:
        if col.column_name == "ds":
            col.is_dttm = True
            break

    datasource.columns = columns
    datasource.metrics = metrics


def create_slices(tbl: SqlaTable) -> tuple[list[Slice], list[Slice]]:
    """Create slices for the birth_names dashboard."""
    metric = "sum__num"
    metrics = [
        {
            "expressionType": "SIMPLE",
            "column": {"column_name": "num", "type": "BIGINT"},
            "aggregate": "SUM",
            "label": "Births",
            "optionName": "metric_11",
        }
    ]

    defaults = {
        "compare_lag": "10",
        "compare_suffix": "o10Y",
        "limit": "25",
        "granularity_sqla": "ds",
        "groupby": [],
        "row_limit": current_app.config.get("ROW_LIMIT", 50000),
        "time_range": "100 years ago : now",
        "viz_type": "table",
        "markup_type": "markdown",
    }

    slice_kwargs = {
        "datasource_id": tbl.id,
        "datasource_type": DatasourceType.TABLE,
    }

    slices = [
        Slice(
            **slice_kwargs,
            slice_name="Participants",
            viz_type="big_number",
            params=_get_slice_json(
                defaults,
                viz_type="big_number",
                granularity_sqla="ds",
                compare_lag="5",
                compare_suffix="over 5Y",
                metric=metric,
            ),
            owners=[],
        ),
        Slice(
            **slice_kwargs,
            slice_name="Genders",
            viz_type="pie",
            params=_get_slice_json(
                defaults, viz_type="pie", groupby=["gender"], metric=metric
            ),
            owners=[],
        ),
        Slice(
            **slice_kwargs,
            slice_name="Trends",
            viz_type="echarts_timeseries_line",
            params=_get_slice_json(
                defaults,
                viz_type="echarts_timeseries_line",
                groupby=["name"],
                granularity_sqla="ds",
                rich_tooltip=True,
                show_legend=True,
                metrics=metrics,
            ),
            owners=[],
        ),
        Slice(
            **slice_kwargs,
            slice_name="Genders by State",
            viz_type="echarts_timeseries_bar",
            params=_get_slice_json(
                defaults,
                viz_type="echarts_timeseries_bar",
                metrics=metrics,
                groupby=["state"],
            ),
            owners=[],
        ),
        Slice(
            **slice_kwargs,
            slice_name="Name Cloud",
            viz_type="word_cloud",
            params=_get_slice_json(
                defaults,
                viz_type="word_cloud",
                size_from="10",
                series="name",
                size_to="70",
                rotation="square",
                limit="100",
                metric=metric,
            ),
            owners=[],
        ),
    ]

    misc_slices: list[Slice] = []
    return slices, misc_slices


def create_dashboard(slices: list[Slice]) -> Dashboard:
    """Create the birth_names dashboard."""
    dash = Dashboard(
        dashboard_title="Birth Names Dashboard",
        slug="births",
    )

    pos: dict[str, Any] = {
        "DASHBOARD_VERSION_KEY": "v2",
        "GRID_ID": {"children": [], "id": "GRID_ID", "type": "GRID"},
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "Birth Names"},
            "type": "HEADER",
        },
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
    }

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

    dash.position_json = json.dumps(pos, indent=2)
    dash.slices = slices

    db.session.add(dash)
    db.session.commit()
    return dash


@pytest.fixture(scope="session")
def load_birth_names_data(  # noqa: PT004
    birth_names_table_factory: Callable[[], Table], data_loader: DataLoader
):
    """
    Session-scoped fixture to ensure birth_names data is loaded.
    Uses the new DuckDB-based example loading system.
    """
    with app.app_context():
        _ensure_examples_loaded()
    return


@pytest.fixture()
def load_birth_names_dashboard_with_slices(load_birth_names_data):  # noqa: PT004
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = _create_dashboards()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="module")
def load_birth_names_dashboard_with_slices_module_scope(load_birth_names_data):  # noqa: PT004
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = _create_dashboards()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="class")
def load_birth_names_dashboard_with_slices_class_scope(load_birth_names_data):  # noqa: PT004
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = _create_dashboards()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


def _create_dashboards():
    """Create or find the birth_names dashboard and slices."""
    # Try to find existing dashboard first (from DuckDB loading)
    dash = (
        db.session.query(Dashboard)
        .filter_by(dashboard_title="USA Births Names")
        .first()
    )

    if dash:
        # Dashboard exists from examples - return its IDs
        slices_ids = [slice.id for slice in dash.slices]
        return dash.id, slices_ids

    # No existing dashboard - create our own test dashboard
    table = _create_table(
        table_name=BIRTH_NAMES_TBL_NAME,
        database=get_example_database(),
        fetch_values_predicate="123 = 123",
    )

    if not table:
        pytest.skip(
            "birth_names table not found. "
            "The new DuckDB-based examples may not be fully loaded."
        )

    slices, _ = create_slices(table)
    dash = create_dashboard(slices)
    slices_ids_to_delete = [slice.id for slice in slices]
    dash_id_to_delete = dash.id
    return dash_id_to_delete, slices_ids_to_delete


def _create_table(
    table_name: str,
    database: Database,
    fetch_values_predicate: Optional[str] = None,
) -> Optional[SqlaTable]:
    """Get or create table metadata."""
    # Try to find existing table
    schema = get_example_default_schema()
    existing = (
        db.session.query(SqlaTable)
        .filter_by(table_name=table_name, schema=schema)
        .first()
    )

    if existing:
        return existing

    # Create new table metadata
    table = create_table_metadata(
        table_name=table_name,
        database=database,
        fetch_values_predicate=fetch_values_predicate,
    )
    if table:
        _set_table_metadata(table, database)
        _add_table_metrics(table)
        db.session.commit()
    return table


def _cleanup(dash_id: int, slice_ids: list[int]) -> None:
    """Clean up test dashboard and slices (but not the data table)."""
    # Only clean up if we created our own test dashboard
    # Skip cleanup if using the dashboard from examples
    dash = db.session.query(Dashboard).filter_by(id=dash_id).first()
    if dash and dash.dashboard_title == "USA Births Names":
        # This is the example dashboard - don't delete it
        return

    if dash_id:
        for dash in db.session.query(Dashboard).filter_by(id=dash_id):
            db.session.delete(dash)

    if slice_ids:
        for slc in db.session.query(Slice).filter(Slice.id.in_(slice_ids)):
            db.session.delete(slc)

    db.session.commit()
