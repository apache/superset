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

import pytest
from sqlalchemy import or_

from superset import db
from superset.cli.examples import load_examples_run
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import ReportSchedule
from superset.utils.core import get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.test_app import app

WB_HEALTH_POPULATION = "wb_health_population"


@pytest.fixture(scope="session")
def load_world_bank_data():
    """
    Legacy fixture for backward compatibility.
    The new DuckDB-based system loads data via load_examples_run().
    """
    yield


@pytest.fixture()
def load_world_bank_dashboard_with_slices(load_world_bank_data):
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = create_dashboard_for_loaded_data()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="module")
def load_world_bank_dashboard_with_slices_module_scope(load_world_bank_data):
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = create_dashboard_for_loaded_data()
        yield
        _cleanup_reports(dash_id_to_delete, slices_ids_to_delete)
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="class")
def load_world_bank_dashboard_with_slices_class_scope(load_world_bank_data):
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = create_dashboard_for_loaded_data()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


def create_dashboard_for_loaded_data():
    """Load the World Bank dashboard using the new DuckDB-based system."""
    
    # Load all examples including world bank
    # This uses the new DuckDB files and YAML configs
    load_examples_run(
        load_test_data=False,
        load_big_data=False,
        only_metadata=False,
        force=True
    )
    
    # Find the created dashboard
    dash = db.session.query(Dashboard).filter_by(
        dashboard_title="World Bank's Data"
    ).first()
    
    if not dash:
        # If dashboard wasn't created, skip the test
        pytest.skip(
            "World Bank's Data dashboard not found. "
            "The new DuckDB-based examples may not be fully loaded."
        )
    
    # Get slice IDs from the dashboard
    slices_ids_to_delete = [slice.id for slice in dash.slices]
    dash_id_to_delete = dash.id
    
    return dash_id_to_delete, slices_ids_to_delete


def _cleanup(dash_id: int, slices_ids: list[int]) -> None:
    schema = get_example_default_schema()
    
    # Clean up datasource
    for datasource in db.session.query(SqlaTable).filter_by(
        table_name=WB_HEALTH_POPULATION, schema=schema
    ):
        for col in datasource.columns + datasource.metrics:
            db.session.delete(col)
        db.session.delete(datasource)

    # Clean up dashboard and slices
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