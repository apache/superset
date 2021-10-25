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
import json
import string
from datetime import date, datetime
from random import choice, getrandbits, randint, random, uniform
from typing import Any, Dict, List, Optional

import pandas as pd
import pytest
from pandas import DataFrame
from sqlalchemy import DateTime, String, TIMESTAMP

from superset import ConnectorRegistry, db
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.core import get_example_database
from tests.integration_tests.dashboard_utils import create_table_for_dashboard
from tests.integration_tests.test_app import app


@pytest.fixture()
def load_birth_names_dashboard_with_slices():
    dash_id_to_delete, slices_ids_to_delete = _load_data()
    yield
    with app.app_context():
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


@pytest.fixture(scope="module")
def load_birth_names_dashboard_with_slices_module_scope():
    dash_id_to_delete, slices_ids_to_delete = _load_data()
    yield
    with app.app_context():
        _cleanup(dash_id_to_delete, slices_ids_to_delete)


def _load_data():
    table_name = "birth_names"

    with app.app_context():
        database = get_example_database()
        df = _get_dataframe(database)
        dtype = {
            "ds": DateTime if database.backend != "presto" else String(255),
            "gender": String(16),
            "state": String(10),
            "name": String(255),
        }
        table = _create_table(
            df=df,
            table_name=table_name,
            database=database,
            dtype=dtype,
            fetch_values_predicate="123 = 123",
        )

        from superset.examples.birth_names import create_dashboard, create_slices

        slices, _ = create_slices(table, admin_owner=False)
        dash = create_dashboard(slices)
        slices_ids_to_delete = [slice.id for slice in slices]
        dash_id_to_delete = dash.id
        return dash_id_to_delete, slices_ids_to_delete


def _create_table(
    df: DataFrame,
    table_name: str,
    database: "Database",
    dtype: Dict[str, Any],
    fetch_values_predicate: Optional[str] = None,
):
    table = create_table_for_dashboard(
        df=df,
        table_name=table_name,
        database=database,
        dtype=dtype,
        fetch_values_predicate=fetch_values_predicate,
    )
    from superset.examples.birth_names import _add_table_metrics, _set_table_metadata

    _set_table_metadata(table, database)
    _add_table_metrics(table)
    db.session.commit()
    return table


def _cleanup(dash_id: int, slices_ids: List[int]) -> None:
    table_id = db.session.query(SqlaTable).filter_by(table_name="birth_names").one().id
    datasource = ConnectorRegistry.get_datasource("table", table_id, db.session)
    columns = [column for column in datasource.columns]
    metrics = [metric for metric in datasource.metrics]

    engine = get_example_database().get_sqla_engine()
    engine.execute("DROP TABLE IF EXISTS birth_names")
    for column in columns:
        db.session.delete(column)
    for metric in metrics:
        db.session.delete(metric)

    dash = db.session.query(Dashboard).filter_by(id=dash_id).first()

    db.session.delete(dash)
    for slice_id in slices_ids:
        db.session.query(Slice).filter_by(id=slice_id).delete()
    db.session.commit()


def _get_dataframe(database: Database) -> DataFrame:
    data = _get_birth_names_data()
    df = pd.DataFrame.from_dict(data)
    if database.backend == "presto":
        df.ds = df.ds.dt.strftime("%Y-%m-%d %H:%M:%S")
    return df


def _get_birth_names_data() -> List[Dict[Any, Any]]:
    data = []
    names = generate_names()
    for year in range(1960, 2020):
        ds = datetime(year, 1, 1, 0, 0, 0)
        for _ in range(20):
            gender = "boy" if choice([True, False]) else "girl"
            num = randint(1, 100000)
            data.append(
                {
                    "ds": ds,
                    "gender": gender,
                    "name": choice(names),
                    "num": num,
                    "state": choice(us_states),
                    "num_boys": num if gender == "boy" else 0,
                    "num_girls": num if gender == "girl" else 0,
                }
            )

    return data


def generate_names() -> List[str]:
    names = []
    for _ in range(250):
        names.append(
            "".join(choice(string.ascii_lowercase) for _ in range(randint(3, 12)))
        )
    return names


us_states = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
    "other",
]
