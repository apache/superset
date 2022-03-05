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
from typing import Any, Dict

import pytest
from sqlalchemy import Column, create_engine, Date, Integer, MetaData, String, Table

from superset.columns.models import Column as Sl_Column
from superset.extensions import db
from superset.models.core import Database
from superset.tables.models import Table as Sl_Table
from superset.utils.core import get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.test_app import app


@pytest.fixture()
def get_table_datasource():
    with app.app_context():
        engine = create_engine(app.config["SQLALCHEMY_DATABASE_URI"], echo=True)
        meta = MetaData()

        students = Table(
            "students",
            meta,
            Column("id", Integer, primary_key=True),
            Column("name", String),
            Column("lastname", String),
            Column("ds", Date),
        )
        meta.create_all(engine)

        students.insert().values(name="George", ds="2021-01-01")

        table = Sl_Table(
            database_id=db.session.query(Database).first().id, name="students"
        )
        table.columns = [Sl_Column(name="name", type="text", expression="name")]
        db.session.add(table)
        db.session.commit()
        yield table

        # rollback changes
        # todo
