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
from sqlalchemy.engine import Engine

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
    tbl_name = "unicode_test"
    df = _get_dataframe()
    with app.app_context():
        yield _create_unicode_dashboard(df, tbl_name, "Unicode Cloud", None)

        _cleanup()


@pytest.fixture()
def load_unicode_dashboard_with_position():
    tbl_name = "unicode_test"
    df = _get_dataframe()
    position = "{}"
    with app.app_context():
        yield _create_unicode_dashboard(df, tbl_name, "Unicode Cloud", position)

        _cleanup()


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
    df: DataFrame, tbl_name: str, slc_title: str, position: str
) -> Dashboard:
    database = get_example_database()
    schema = {
        "phrase": String(500),
    }
    obj = create_table_for_dashboard(df, tbl_name, database, schema)
    obj.fetch_metadata()

    tbl = obj

    if slc_title:
        slc = _create_and_commit_unicode_slice(tbl, slc_title)

    return create_dashboard("unicode-test", "Unicode Test", position, slc)


def _create_and_commit_unicode_slice(tbl: SqlaTable, title: str):
    slc = create_slice(title, "word_cloud", tbl, {})
    o = db.session.query(Slice).filter_by(slice_name=slc.slice_name).first()
    if o:
        db.session.delete(o)
    db.session.add(slc)
    db.session.commit()
    return slc


def _cleanup() -> None:
    engine = get_example_database().get_sqla_engine()
    engine.execute("DROP TABLE IF EXISTS unicode_test")
    db.session.commit()
