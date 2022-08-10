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
"""Fixtures for test_datasource.py"""
from typing import Any, Dict, Generator

import pytest
from sqlalchemy import Column, create_engine, Date, Integer, MetaData, String, Table
from sqlalchemy.ext.declarative import declarative_base

from superset.columns.models import Column as Sl_Column
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.extensions import db
from superset.models.core import Database
from superset.tables.models import Table as Sl_Table
from superset.utils.core import get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.test_app import app


def get_datasource_post() -> Dict[str, Any]:
    schema = get_example_default_schema()

    return {
        "id": None,
        "column_formats": {"ratio": ".2%"},
        "database": {"id": 1},
        "description": "Adding a DESCRip",
        "default_endpoint": "",
        "filter_select_enabled": True,
        "name": f"{schema}.birth_names" if schema else "birth_names",
        "table_name": "birth_names",
        "datasource_name": "birth_names",
        "type": "table",
        "schema": schema,
        "offset": 66,
        "cache_timeout": 55,
        "sql": "",
        "columns": [
            {
                "id": 504,
                "column_name": "ds",
                "verbose_name": "",
                "description": None,
                "expression": "",
                "filterable": True,
                "groupby": True,
                "is_dttm": True,
                "type": "DATETIME",
            },
            {
                "id": 505,
                "column_name": "gender",
                "verbose_name": None,
                "description": None,
                "expression": "",
                "filterable": True,
                "groupby": True,
                "is_dttm": False,
                "type": "VARCHAR(16)",
            },
            {
                "id": 506,
                "column_name": "name",
                "verbose_name": None,
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "is_dttm": None,
                "type": "VARCHAR(255)",
            },
            {
                "id": 508,
                "column_name": "state",
                "verbose_name": None,
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "is_dttm": None,
                "type": "VARCHAR(10)",
            },
            {
                "id": 509,
                "column_name": "num_boys",
                "verbose_name": None,
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "is_dttm": None,
                "type": "BIGINT(20)",
            },
            {
                "id": 510,
                "column_name": "num_girls",
                "verbose_name": None,
                "description": None,
                "expression": "",
                "filterable": False,
                "groupby": False,
                "is_dttm": False,
                "type": "BIGINT(20)",
            },
            {
                "id": 532,
                "column_name": "num",
                "verbose_name": None,
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "is_dttm": None,
                "type": "BIGINT(20)",
            },
            {
                "id": 522,
                "column_name": "num_california",
                "verbose_name": None,
                "description": None,
                "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                "filterable": False,
                "groupby": False,
                "is_dttm": False,
                "type": "NUMBER",
            },
        ],
        "metrics": [
            {
                "id": 824,
                "metric_name": "sum__num",
                "verbose_name": "Babies",
                "description": "",
                "expression": "SUM(num)",
                "warning_text": "",
                "d3format": "",
            },
            {
                "id": 836,
                "metric_name": "count",
                "verbose_name": "",
                "description": None,
                "expression": "count(1)",
                "warning_text": None,
                "d3format": None,
            },
            {
                "id": 843,
                "metric_name": "ratio",
                "verbose_name": "Ratio Boys/Girls",
                "description": "This represents the ratio of boys/girls",
                "expression": "sum(num_boys) / sum(num_girls)",
                "warning_text": "no warning",
                "d3format": ".2%",
            },
        ],
    }


@pytest.fixture()
def load_dataset_with_columns() -> Generator[SqlaTable, None, None]:
    with app.app_context():
        engine = create_engine(app.config["SQLALCHEMY_DATABASE_URI"], echo=True)
        meta = MetaData()
        session = db.session

        students = Table(
            "students",
            meta,
            Column("id", Integer, primary_key=True),
            Column("name", String(255)),
            Column("lastname", String(255)),
            Column("ds", Date),
        )
        meta.create_all(engine)

        students.insert().values(name="George", ds="2021-01-01")

        dataset = SqlaTable(
            database_id=db.session.query(Database).first().id, table_name="students"
        )
        column = TableColumn(table_id=dataset.id, column_name="name")
        dataset.columns = [column]
        session.add(dataset)
        session.commit()
        yield dataset

        # cleanup
        students_table = meta.tables.get("students")
        if students_table is not None:
            base = declarative_base()
            # needed for sqlite
            session.commit()
            base.metadata.drop_all(engine, [students_table], checkfirst=True)
        session.delete(dataset)
        session.delete(column)
        session.commit()
