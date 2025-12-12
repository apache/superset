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
from typing import Callable, Optional

import pytest

from superset import db
from superset.cli.examples import load_examples_run
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.core import get_example_default_schema
from superset.utils.database import get_example_database
from tests.example_data.data_loading.base_data_loader import DataLoader
from tests.example_data.data_loading.data_definitions.types import Table
from tests.integration_tests.dashboard_utils import create_table_metadata
from tests.integration_tests.test_app import app

BIRTH_NAMES_TBL_NAME = "birth_names"


@pytest.fixture(scope="session")
def load_birth_names_data(
    birth_names_table_factory: Callable[[], Table], data_loader: DataLoader
):
    """
    Legacy fixture for backward compatibility.
    The new DuckDB-based system loads data via load_examples_run().
    """
    yield


@pytest.fixture()
def load_birth_names_dashboard_with_slices(load_birth_names_data):
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = _create_dashboards()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="module")
def load_birth_names_dashboard_with_slices_module_scope(load_birth_names_data):
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = _create_dashboards()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="class")
def load_birth_names_dashboard_with_slices_class_scope(load_birth_names_data):
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = _create_dashboards()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


def _create_dashboards():
    """Load the birth_names dashboard using the new DuckDB-based system."""
    
    # Load all examples including birth_names
    # This uses the new DuckDB files and YAML configs
    load_examples_run(
        load_test_data=False,
        load_big_data=False,
        only_metadata=False,
        force=True
    )
    
    # Find the created dashboard
    dash = db.session.query(Dashboard).filter_by(
        dashboard_title="USA Births Names"
    ).first()
    
    if not dash:
        # If dashboard wasn't created, skip the test
        pytest.skip(
            "USA Births Names dashboard not found. "
            "The new DuckDB-based examples may not be fully loaded."
        )
    
    # Get slice IDs from the dashboard
    slices_ids_to_delete = [slice.id for slice in dash.slices]
    dash_id_to_delete = dash.id
    
    return dash_id_to_delete, slices_ids_to_delete


def _cleanup(dash_id: int, slice_ids: list[int]) -> None:
    schema = get_example_default_schema()
    
    # Clean up datasource
    for datasource in db.session.query(SqlaTable).filter_by(
        table_name=BIRTH_NAMES_TBL_NAME, schema=schema
    ):
        for col in datasource.columns + datasource.metrics:
            db.session.delete(col)
        db.session.delete(datasource)

    # Clean up dashboard and slices
    if dash_id:
        for dash in db.session.query(Dashboard).filter_by(id=dash_id):
            db.session.delete(dash)
    
    if slice_ids:
        for slc in db.session.query(Slice).filter(Slice.id.in_(slice_ids)):
            db.session.delete(slc)
    
    db.session.commit()