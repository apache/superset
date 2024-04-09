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
from datetime import datetime

import pytest

from superset import db, security_manager
from superset.commands.database.csv_import import CSVImportCommand
from superset.commands.database.exceptions import (
    DatabaseNotFoundError,
    DatabaseSchemaUploadNotAllowed,
    DatabaseUploadFailed,
)
from superset.models.core import Database
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

CSV_FILE_2 = [
    ["name1", "30", "city1", "1-1-1980"],
    ["Name", "Age", "City", "Birth"],
    ["name2", "29", "city2", "1-1-1981"],
    ["name3", "28", "city3", "1-1-1982"],
]

CSV_FILE_3 = [
    ["Name", "Age", "City", "Birth"],
    ["name1", "N/A", "city1", "1-1-1980"],
    ["name2", "29", "None", "1-1-1981"],
    ["name3", "28", "city3", "1-1-1982"],
]

CSV_FILE_BROKEN = [
    ["Name", "Age", "City", "Birth"],
    ["name1", "30", "city1", "1-1-1980"],
    ["name2", "29"],
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
    with upload_db.get_sqla_engine_with_context() as engine:
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE}")
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE_W_SCHEMA}")
    db.session.delete(upload_db)
    db.session.commit()


def get_upload_db():
    return db.session.query(Database).filter_by(database_name=CSV_UPLOAD_DATABASE).one()


@pytest.fixture(scope="function")
def setup_csv_upload_with_context():
    with app.app_context():
        yield from _setup_csv_upload()


@pytest.fixture(scope="function")
def setup_csv_upload_with_context_schema():
    with app.app_context():
        yield from _setup_csv_upload(["public"])


@only_postgresql
@pytest.mark.parametrize(
    "csv_data,options, table_data",
    [
        (
            CSV_FILE_1,
            {},
            [
                ("name1", 30, "city1", "1-1-1980"),
                ("name2", 29, "city2", "1-1-1981"),
                ("name3", 28, "city3", "1-1-1982"),
            ],
        ),
        (
            CSV_FILE_1,
            {"columns_read": ["Name", "Age"]},
            [("name1", 30), ("name2", 29), ("name3", 28)],
        ),
        (
            CSV_FILE_1,
            {"columns_read": []},
            [
                ("name1", 30, "city1", "1-1-1980"),
                ("name2", 29, "city2", "1-1-1981"),
                ("name3", 28, "city3", "1-1-1982"),
            ],
        ),
        (
            CSV_FILE_1,
            {"rows_to_read": 1},
            [
                ("name1", 30, "city1", "1-1-1980"),
            ],
        ),
        (
            CSV_FILE_1,
            {"rows_to_read": 1, "columns_read": ["Name", "Age"]},
            [
                ("name1", 30),
            ],
        ),
        (
            CSV_FILE_1,
            {"skip_rows": 1},
            [("name2", 29, "city2", "1-1-1981"), ("name3", 28, "city3", "1-1-1982")],
        ),
        (
            CSV_FILE_1,
            {"rows_to_read": 2},
            [
                ("name1", 30, "city1", "1-1-1980"),
                ("name2", 29, "city2", "1-1-1981"),
            ],
        ),
        (
            CSV_FILE_1,
            {"column_dates": ["Birth"]},
            [
                ("name1", 30, "city1", datetime(1980, 1, 1, 0, 0)),
                ("name2", 29, "city2", datetime(1981, 1, 1, 0, 0)),
                ("name3", 28, "city3", datetime(1982, 1, 1, 0, 0)),
            ],
        ),
        (
            CSV_FILE_2,
            {"header_row": 1},
            [("name2", 29, "city2", "1-1-1981"), ("name3", 28, "city3", "1-1-1982")],
        ),
        (
            CSV_FILE_3,
            {"null_values": ["N/A", "None"]},
            [
                ("name1", None, "city1", "1-1-1980"),
                ("name2", 29, None, "1-1-1981"),
                ("name3", 28, "city3", "1-1-1982"),
            ],
        ),
        (
            CSV_FILE_3,
            {
                "null_values": ["N/A", "None"],
                "column_dates": ["Birth"],
                "columns_read": ["Name", "Age", "Birth"],
            },
            [
                ("name1", None, datetime(1980, 1, 1, 0, 0)),
                ("name2", 29, datetime(1981, 1, 1, 0, 0)),
                ("name3", 28, datetime(1982, 1, 1, 0, 0)),
            ],
        ),
        (
            CSV_FILE_BROKEN,
            {},
            [
                ("name1", 30, "city1", "1-1-1980"),
                ("name2", 29, None, None),
                ("name3", 28, "city3", "1-1-1982"),
            ],
        ),
    ],
)
@pytest.mark.usefixtures("setup_csv_upload_with_context")
def test_csv_upload_options(csv_data, options, table_data):
    admin_user = security_manager.find_user(username="admin")
    upload_database = get_upload_db()

    with override_user(admin_user):
        CSVImportCommand(
            upload_database.id,
            CSV_UPLOAD_TABLE,
            create_csv_file(csv_data),
            options=options,
        ).run()
        with upload_database.get_sqla_engine_with_context() as engine:
            data = engine.execute(f"SELECT * from {CSV_UPLOAD_TABLE}").fetchall()
            assert data == table_data


@only_postgresql
@pytest.mark.usefixtures("setup_csv_upload_with_context")
def test_csv_upload_database_not_found():
    admin_user = security_manager.find_user(username="admin")

    with override_user(admin_user):
        with pytest.raises(DatabaseNotFoundError):
            CSVImportCommand(
                1000,
                CSV_UPLOAD_TABLE,
                create_csv_file(CSV_FILE_1),
                options={},
            ).run()


@only_postgresql
@pytest.mark.usefixtures("setup_csv_upload_with_context_schema")
def test_csv_upload_schema_not_allowed():
    admin_user = security_manager.find_user(username="admin")
    upload_db_id = get_upload_db().id
    with override_user(admin_user):
        with pytest.raises(DatabaseSchemaUploadNotAllowed):
            CSVImportCommand(
                upload_db_id,
                CSV_UPLOAD_TABLE,
                create_csv_file(CSV_FILE_1),
                options={},
            ).run()

        with pytest.raises(DatabaseSchemaUploadNotAllowed):
            CSVImportCommand(
                upload_db_id,
                CSV_UPLOAD_TABLE,
                create_csv_file(CSV_FILE_1),
                options={"schema": "schema1"},
            ).run()

        CSVImportCommand(
            upload_db_id,
            CSV_UPLOAD_TABLE,
            create_csv_file(CSV_FILE_1),
            options={"schema": "public"},
        ).run()


@only_postgresql
@pytest.mark.usefixtures("setup_csv_upload_with_context")
def test_csv_upload_broken_file():
    admin_user = security_manager.find_user(username="admin")

    with override_user(admin_user):
        with pytest.raises(DatabaseUploadFailed):
            CSVImportCommand(
                get_upload_db().id,
                CSV_UPLOAD_TABLE,
                create_csv_file([""]),
                options={"column_dates": ["Birth"]},
            ).run()
