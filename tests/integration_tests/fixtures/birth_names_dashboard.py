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
from __future__ import annotations

from typing import Callable, Dict, Generator, List, Optional, TYPE_CHECKING

import pytest

from superset import ConnectorRegistry, db
from superset.utils.core import get_example_default_schema
from superset.utils.database import get_example_database

from ...consts import SIMULATOR_FIXTURE_SCOPE
from ...example_data.data_loading.data_loader import DataLoader
from ...example_data.definions.data_definitions.types import Table
from ..test_app import app

if TYPE_CHECKING:
    from superset.models.core import Database

__all__ = [
    "load_birth_names_data",
    "load_birth_names_dashboard_with_slices",
    "load_birth_names_dashboard_with_slices_module_scope",
    "birth_names_columns_supplier",
]

BIRTH_NAMES_TBL_NAME = "birth_names"


@pytest.fixture(scope="session")
def load_birth_names_data(
    birth_names_table_factory: Callable[[], Table], data_loader: DataLoader
) -> Generator[None, None, None]:
    birth_names_table: Table = birth_names_table_factory()
    data_loader.load_table(birth_names_table)
    yield
    data_loader.remove_table(birth_names_table.table_name)


@pytest.fixture()
def load_birth_names_dashboard_with_slices(
    load_birth_names_data, simulate_birth_names_dashboard
) -> None:
    pass


@pytest.fixture(scope="module")
def load_birth_names_dashboard_with_slices_module_scope(
    load_birth_names_data,
) -> Generator[None, None, None]:
    with app.app_context():
        dash_id_to_delete, slices_ids_to_delete = _create_dashboards()
        yield
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


def _create_dashboards():

    table = _create_table(
        table_name=BIRTH_NAMES_TBL_NAME,
        database=get_example_database(),
        fetch_values_predicate="123 = 123",
    )

    from superset.examples.birth_names import create_dashboard, create_slices

    slices, _ = create_slices(table, admin_owner=False)
    dash = create_dashboard(slices)
    slices_ids_to_delete = [slice.id for slice in slices]
    dash_id_to_delete = dash.id
    return dash_id_to_delete, slices_ids_to_delete


def _create_table(
    table_name: str, database: Database, fetch_values_predicate: Optional[str] = None,
):
    from tests.integration_tests.dashboard_utils import create_table_metadata

    table = create_table_metadata(
        table_name=table_name,
        database=database,
        fetch_values_predicate=fetch_values_predicate,
    )
    from superset.examples.birth_names import _add_table_metrics, _set_table_metadata

    _set_table_metadata(table, database)
    _add_table_metrics(table)
    db.session.commit()
    return table


def _cleanup(dash_id: int, slices_ids: List[int]) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    schema = get_example_default_schema()

    table_id = (
        db.session.query(SqlaTable)
        .filter_by(table_name="birth_names", schema=schema)
        .one()
        .id
    )
    datasource = ConnectorRegistry.get_datasource("table", table_id, db.session)
    columns = [column for column in datasource.columns]
    metrics = [metric for metric in datasource.metrics]

    for column in columns:
        db.session.delete(column)
    for metric in metrics:
        db.session.delete(metric)

    dash = db.session.query(Dashboard).filter_by(id=dash_id).first()

    db.session.delete(dash)
    for slice_id in slices_ids:
        db.session.query(Slice).filter_by(id=slice_id).delete()
    db.session.commit()


@pytest.fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_columns_supplier(
    example_data_columns_supplier_factory,
) -> Callable[[], List[Dict[str, str]]]:
    return example_data_columns_supplier_factory("birth_names", "superset")
