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

import pytest
from flask.ctx import AppContext

from superset import db, security_manager
from superset.commands.database.exceptions import (
    DatabaseNotFoundError,
    DatabaseSchemaUploadNotAllowed,
    DatabaseUploadNotSupported,
)
from superset.commands.database.uploaders.base import UploadCommand
from superset.commands.database.uploaders.csv_reader import CSVReader
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.utils import json
from superset.utils.core import override_user
from superset.utils.database import get_or_create_db
from tests.integration_tests.conftest import only_postgresql
from tests.integration_tests.test_app import app
from tests.unit_tests.fixtures.common import create_csv_file

CSV_UPLOAD_DATABASE = "csv_explore_db"
CSV_UPLOAD_TABLE = "csv_upload"
CSV_UPLOAD_TABLE_W_SCHEMA = "csv_upload_w_schema"


CSV_FILE_1 = [
    ["Name", "Age", "City", "Birth"],
    ["name1", "30", "city1", "1-1-1980"],
    ["name2", "29", "city2", "1-1-1981"],
    ["name3", "28", "city3", "1-1-1982"],
]

CSV_FILE_WITH_NULLS = [
    ["Name", "Age", "City", "Birth"],
    ["name1", "N/A", "city1", "1-1-1980"],
    ["name2", "29", "None", "1-1-1981"],
    ["name3", "28", "city3", "1-1-1982"],
]


def _setup_csv_upload(allowed_schemas: list[str] | None = None):
    upload_db = get_or_create_db(
        CSV_UPLOAD_DATABASE, app.config["SQLALCHEMY_EXAMPLES_URI"]
    )
    upload_db.allow_file_upload = True
    extra = upload_db.get_extra()
    allowed_schemas = allowed_schemas or []
    extra["schemas_allowed_for_file_upload"] = allowed_schemas
    upload_db.extra = json.dumps(extra)

    db.session.commit()

    yield

    upload_db = get_upload_db()
    with upload_db.get_sqla_engine() as engine:
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE}")
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE_W_SCHEMA}")
    db.session.delete(upload_db)
    db.session.commit()


def get_upload_db():
    return db.session.query(Database).filter_by(database_name=CSV_UPLOAD_DATABASE).one()


@pytest.fixture()
def setup_csv_upload_with_context(app_context: AppContext):
    yield from _setup_csv_upload()


@pytest.fixture()
def setup_csv_upload_with_context_schema(app_context: AppContext):
    yield from _setup_csv_upload(["public"])


@pytest.mark.usefixtures("setup_csv_upload_with_context")
def test_csv_upload_with_nulls():
    admin_user = security_manager.find_user(username="admin")
    upload_database = get_upload_db()

    with override_user(admin_user):
        UploadCommand(
            upload_database.id,
            CSV_UPLOAD_TABLE,
            create_csv_file(CSV_FILE_WITH_NULLS),
            None,
            CSVReader({"null_values": ["N/A", "None"]}),
        ).run()
    with upload_database.get_sqla_engine() as engine:
        data = engine.execute(f"SELECT * from {CSV_UPLOAD_TABLE}").fetchall()
        assert data == [
            ("name1", None, "city1", "1-1-1980"),
            ("name2", 29, None, "1-1-1981"),
            ("name3", 28, "city3", "1-1-1982"),
        ]


@pytest.mark.usefixtures("setup_csv_upload_with_context")
def test_csv_upload_dataset():
    admin_user = security_manager.find_user(username="admin")
    upload_database = get_upload_db()

    with override_user(admin_user):
        UploadCommand(
            upload_database.id,
            CSV_UPLOAD_TABLE,
            create_csv_file(),
            None,
            CSVReader({}),
        ).run()
    dataset = (
        db.session.query(SqlaTable)
        .filter_by(database_id=upload_database.id, table_name=CSV_UPLOAD_TABLE)
        .one_or_none()
    )
    assert dataset is not None
    assert security_manager.find_user("admin") in dataset.owners


@pytest.mark.usefixtures("setup_csv_upload_with_context")
def test_csv_upload_with_index():
    admin_user = security_manager.find_user(username="admin")
    upload_database = get_upload_db()

    with override_user(admin_user):
        UploadCommand(
            upload_database.id,
            CSV_UPLOAD_TABLE,
            create_csv_file(CSV_FILE_1),
            None,
            CSVReader({"dataframe_index": True, "index_label": "id"}),
        ).run()
    with upload_database.get_sqla_engine() as engine:
        data = engine.execute(f"SELECT * from {CSV_UPLOAD_TABLE}").fetchall()
        assert data == [
            (0, "name1", 30, "city1", "1-1-1980"),
            (1, "name2", 29, "city2", "1-1-1981"),
            (2, "name3", 28, "city3", "1-1-1982"),
        ]
        # assert column names
        assert [
            col for col in engine.execute(f"SELECT * from {CSV_UPLOAD_TABLE}").keys()
        ] == [
            "id",
            "Name",
            "Age",
            "City",
            "Birth",
        ]


@only_postgresql
@pytest.mark.usefixtures("setup_csv_upload_with_context")
def test_csv_upload_database_not_found():
    admin_user = security_manager.find_user(username="admin")

    with override_user(admin_user):
        with pytest.raises(DatabaseNotFoundError):
            UploadCommand(
                1000,
                CSV_UPLOAD_TABLE,
                create_csv_file(CSV_FILE_1),
                None,
                CSVReader({}),
            ).run()


@only_postgresql
@pytest.mark.usefixtures("setup_csv_upload_with_context")
def test_csv_upload_database_not_supported():
    admin_user = security_manager.find_user(username="admin")
    upload_db: Database = get_upload_db()
    upload_db.db_engine_spec.supports_file_upload = False
    with override_user(admin_user):
        with pytest.raises(DatabaseUploadNotSupported):
            UploadCommand(
                upload_db.id,
                CSV_UPLOAD_TABLE,
                create_csv_file(CSV_FILE_1),
                None,
                CSVReader({}),
            ).run()
    upload_db.db_engine_spec.supports_file_upload = True


@only_postgresql
@pytest.mark.usefixtures("setup_csv_upload_with_context_schema")
def test_csv_upload_schema_not_allowed():
    admin_user = security_manager.find_user(username="admin")
    upload_db_id = get_upload_db().id
    with override_user(admin_user):
        with pytest.raises(DatabaseSchemaUploadNotAllowed):
            UploadCommand(
                upload_db_id,
                CSV_UPLOAD_TABLE,
                create_csv_file(CSV_FILE_1),
                None,
                CSVReader({}),
            ).run()
        with pytest.raises(DatabaseSchemaUploadNotAllowed):
            UploadCommand(
                upload_db_id,
                CSV_UPLOAD_TABLE,
                create_csv_file(CSV_FILE_1),
                "schema1",
                CSVReader({}),
            ).run()
        UploadCommand(
            upload_db_id,
            CSV_UPLOAD_TABLE_W_SCHEMA,
            create_csv_file(CSV_FILE_1),
            "public",
            CSVReader({}),
        ).run()
