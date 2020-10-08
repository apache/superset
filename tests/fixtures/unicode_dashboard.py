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
import pandas as pd
import pytest
from pandas import DataFrame
from sqlalchemy import String

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.core import get_example_database
from tests.dashboard_utils import (
    create_dashboard,
    create_slice,
    create_table_for_dashboard,
)
from tests.test_app import app


@pytest.fixture()
def load_unicode_dashboard_with_slice():
    table_name = "unicode_test"
    slice_name = "Unicode Cloud"
    df = _get_dataframe()
    with app.app_context():
        dash = _create_unicode_dashboard(df, table_name, slice_name, None)
        yield

        _cleanup(dash, slice_name)


@pytest.fixture()
def load_unicode_dashboard_with_position():
    table_name = "unicode_test"
    slice_name = "Unicode Cloud"
    df = _get_dataframe()
    position = "{}"
    with app.app_context():
        dash = _create_unicode_dashboard(df, table_name, slice_name, position)
        yield
        _cleanup(dash, slice_name)


def _get_dataframe():
    data = _get_unicode_data()
    return pd.DataFrame.from_dict(data)


def _get_unicode_data():
    return [
        {"phrase": "Под"},
        {"phrase": "řšž"},
        {"phrase": "視野無限廣"},
        {"phrase": "微風"},
        {"phrase": "中国智造"},
        {"phrase": "æøå"},
        {"phrase": "ëœéè"},
        {"phrase": "いろはにほ"},
    ]


def _create_unicode_dashboard(
    df: DataFrame, table_name: str, slice_title: str, position: str
) -> Dashboard:
    database = get_example_database()
    dtype = {
        "phrase": String(500),
    }
    table = create_table_for_dashboard(df, table_name, database, dtype)
    table.fetch_metadata()

    if slice_title:
        slice = _create_and_commit_unicode_slice(table, slice_title)

    return create_dashboard("unicode-test", "Unicode Test", position, slice)


def _create_and_commit_unicode_slice(table: SqlaTable, title: str):
    slice = create_slice(title, "word_cloud", table, {})
    o = db.session.query(Slice).filter_by(slice_name=slice.slice_name).one_or_none()
    if o:
        db.session.delete(o)
    db.session.add(slice)
    db.session.commit()
    return slice


def _cleanup(dash: Dashboard, slice_name: str) -> None:
    engine = get_example_database().get_sqla_engine()
    engine.execute("DROP TABLE IF EXISTS unicode_test")
    db.session.delete(dash)
    if slice_name:
        slice = db.session.query(Slice).filter_by(slice_name=slice_name).one_or_none()
        db.session.delete(slice)
    db.session.commit()
