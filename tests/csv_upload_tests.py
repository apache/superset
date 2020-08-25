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
# isort:skip_file
"""Unit tests for Superset CSV upload"""
import json
import logging
import os
from typing import Dict, Optional

from unittest import mock

import pandas as pd
import pytest

from superset.sql_parse import Table
from tests.conftest import ADMIN_SCHEMA_NAME
from tests.test_app import app  # isort:skip
from superset import db
from superset.models.core import Database
from superset.utils import core as utils
from tests.base_tests import get_resp, login, SupersetTestCase

logger = logging.getLogger(__name__)


test_client = app.test_client()

CSV_UPLOAD_DATABASE = "csv_explore_db"
CSV_FILENAME1 = "testCSV1.csv"
CSV_FILENAME2 = "testCSV2.csv"
EXCEL_FILENAME = "testExcel.xlsx"

EXCEL_UPLOAD_TABLE = "excel_upload"
CSV_UPLOAD_TABLE = "csv_upload"
CSV_UPLOAD_TABLE_W_SCHEMA = "csv_upload_w_schema"
CSV_UPLOAD_TABLE_W_EXPLORE = "csv_upload_w_explore"


@pytest.fixture(scope="module")
def setup_csv_upload():
    with app.app_context():
        login(test_client, username="admin")

        upload_db = utils.get_or_create_db(
            CSV_UPLOAD_DATABASE, app.config["SQLALCHEMY_EXAMPLES_URI"]
        )
        extra = upload_db.get_extra()
        extra["explore_database_id"] = utils.get_example_database().id
        upload_db.extra = json.dumps(extra)
        upload_db.allow_csv_upload = True
        db.session.commit()

        yield

        upload_db = get_upload_db()
        engine = upload_db.get_sqla_engine()
        engine.execute(f"DROP TABLE IF EXISTS {EXCEL_UPLOAD_TABLE}")
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE}")
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE_W_SCHEMA}")
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE_W_EXPLORE}")
        db.session.delete(upload_db)
        db.session.commit()


@pytest.fixture(scope="module")
def create_csv_files():
    with open(CSV_FILENAME1, "w+") as test_file:
        for line in ["a,b", "john,1", "paul,2"]:
            test_file.write(f"{line}\n")

    with open(CSV_FILENAME2, "w+") as test_file:
        for line in ["b,c,d", "john,1,x", "paul,2,"]:
            test_file.write(f"{line}\n")
    yield
    os.remove(CSV_FILENAME1)
    os.remove(CSV_FILENAME2)


@pytest.fixture()
def create_excel_files():
    pd.DataFrame({"a": ["john", "paul"], "b": [1, 2]}).to_excel(EXCEL_FILENAME)
    yield
    os.remove(EXCEL_FILENAME)


def get_upload_db():
    return db.session.query(Database).filter_by(database_name=CSV_UPLOAD_DATABASE).one()


def upload_csv(filename: str, table_name: str, extra: Optional[Dict[str, str]] = None):
    csv_upload_db_id = get_upload_db().id
    form_data = {
        "csv_file": open(filename, "rb"),
        "sep": ",",
        "name": table_name,
        "con": csv_upload_db_id,
        "if_exists": "fail",
        "index_label": "test_label",
        "mangle_dupe_cols": False,
    }
    if extra:
        form_data.update(extra)
    return get_resp(test_client, "/csvtodatabaseview/form", data=form_data)


def upload_excel(
    filename: str, table_name: str, extra: Optional[Dict[str, str]] = None
):
    form_data = {
        "excel_file": open(filename, "rb"),
        "name": table_name,
        "con": get_upload_db().id,
        "sheet_name": "Sheet1",
        "if_exists": "fail",
        "index_label": "test_label",
        "mangle_dupe_cols": False,
    }
    if extra:
        form_data.update(extra)
    return get_resp(test_client, "/exceltodatabaseview/form", data=form_data)


def mock_upload_to_s3(f: str, p: str, t: Table) -> str:
    """ HDFS is used instead of S3 for the unit tests.

    :param f: filepath
    :param p: unused parameter
    :param t: table that will be created
    :return: hdfs path to the directory with external table files
    """
    # only needed for the hive tests
    import docker

    client = docker.from_env()
    container = client.containers.get("namenode")
    # docker mounted volume that contains csv uploads
    src = os.path.join("/tmp/superset_uploads", os.path.basename(f))
    # hdfs destination for the external tables
    dest_dir = os.path.join("/tmp/external/superset_uploads/", str(t))
    container.exec_run(f"hdfs dfs -mkdir -p {dest_dir}")
    dest = os.path.join(dest_dir, os.path.basename(f))
    container.exec_run(f"hdfs dfs -put {src} {dest}")
    # hive external table expectes a directory for the location
    return dest_dir


@mock.patch(
    "superset.models.core.config",
    {**app.config, "ALLOWED_USER_CSV_SCHEMA_FUNC": lambda d, u: ["admin_database"]},
)
@mock.patch("superset.db_engine_specs.hive.upload_to_s3", mock_upload_to_s3)
def test_import_csv_enforced_schema(setup_csv_upload, create_csv_files):
    if utils.backend() == "sqlite":
        pytest.skip("Sqlite doesn't support schema / database creation")

    full_table_name = f"admin_database.{CSV_UPLOAD_TABLE_W_SCHEMA}"

    # no schema specified, fail upload
    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE_W_SCHEMA)
    assert (
        f'Database "{CSV_UPLOAD_DATABASE}" schema "None" is not allowed for csv uploads'
        in resp
    )

    success_msg = f'CSV file "{CSV_FILENAME1}" uploaded to table "{full_table_name}"'
    resp = upload_csv(
        CSV_FILENAME1,
        CSV_UPLOAD_TABLE_W_SCHEMA,
        extra={"schema": "admin_database", "if_exists": "replace"},
    )
    assert success_msg in resp

    engine = get_upload_db().get_sqla_engine()
    data = engine.execute(
        f"SELECT * from {ADMIN_SCHEMA_NAME}.{CSV_UPLOAD_TABLE_W_SCHEMA}"
    ).fetchall()
    assert data == [("john", 1), ("paul", 2)]

    # user specified schema doesn't match, fail
    resp = upload_csv(
        CSV_FILENAME1, CSV_UPLOAD_TABLE_W_SCHEMA, extra={"schema": "gold"}
    )
    assert (
        f'Database "{CSV_UPLOAD_DATABASE}" schema "gold" is not allowed for csv uploads'
        in resp
    )

    # user specified schema matches the expected schema, append
    if utils.backend() == "hive":
        pytest.skip("Hive database doesn't support append csv uploads.")
    resp = upload_csv(
        CSV_FILENAME1,
        CSV_UPLOAD_TABLE_W_SCHEMA,
        extra={"schema": "admin_database", "if_exists": "append"},
    )
    assert success_msg in resp


@mock.patch("superset.db_engine_specs.hive.upload_to_s3", mock_upload_to_s3)
def test_import_csv_explore_database(setup_csv_upload, create_csv_files):
    if utils.backend() == "sqlite":
        pytest.skip("Sqlite doesn't support schema / database creation")

    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE_W_EXPLORE)
    assert (
        f'CSV file "{CSV_FILENAME1}" uploaded to table "{CSV_UPLOAD_TABLE_W_EXPLORE}"'
        in resp
    )
    table = SupersetTestCase.get_table_by_name(CSV_UPLOAD_TABLE_W_EXPLORE)
    assert table.database_id == utils.get_example_database().id


@mock.patch("superset.db_engine_specs.hive.upload_to_s3", mock_upload_to_s3)
def test_import_csv(setup_csv_upload, create_csv_files):
    success_msg_f1 = (
        f'CSV file "{CSV_FILENAME1}" uploaded to table "{CSV_UPLOAD_TABLE}"'
    )

    # initial upload with fail mode
    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE)
    assert success_msg_f1 in resp

    # upload again with fail mode; should fail
    fail_msg = (
        f'Unable to upload CSV file "{CSV_FILENAME1}" to table "{CSV_UPLOAD_TABLE}"'
    )
    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE)
    assert fail_msg in resp

    if utils.backend() != "hive":
        # upload again with append mode
        resp = upload_csv(
            CSV_FILENAME1, CSV_UPLOAD_TABLE, extra={"if_exists": "append"}
        )
        assert success_msg_f1 in resp

    # upload again with replace mode
    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE, extra={"if_exists": "replace"})
    assert success_msg_f1 in resp

    # try to append to table from file with different schema
    resp = upload_csv(CSV_FILENAME2, CSV_UPLOAD_TABLE, extra={"if_exists": "append"})
    fail_msg_f2 = (
        f'Unable to upload CSV file "{CSV_FILENAME2}" to table "{CSV_UPLOAD_TABLE}"'
    )
    assert fail_msg_f2 in resp

    # replace table from file with different schema
    resp = upload_csv(CSV_FILENAME2, CSV_UPLOAD_TABLE, extra={"if_exists": "replace"})
    success_msg_f2 = (
        f'CSV file "{CSV_FILENAME2}" uploaded to table "{CSV_UPLOAD_TABLE}"'
    )
    assert success_msg_f2 in resp

    table = SupersetTestCase.get_table_by_name(CSV_UPLOAD_TABLE)
    # make sure the new column name is reflected in the table metadata
    assert "d" in table.column_names

    # null values are set
    upload_csv(
        CSV_FILENAME2,
        CSV_UPLOAD_TABLE,
        extra={"null_values": '["", "john"]', "if_exists": "replace"},
    )
    # make sure that john and empty string are replaced with None
    engine = get_upload_db().get_sqla_engine()
    data = engine.execute(f"SELECT * from {CSV_UPLOAD_TABLE}").fetchall()
    if utils.backend() == "hive":
        # Be aware that hive only uses first value from the null values list.
        # It is hive database engine limitation.
        # TODO(bkyryliuk): preprocess csv file for hive upload to match default engine capabilities.
        assert data == [("john", 1, "x"), ("paul", 2, None)]
    else:
        assert data == [(None, 1, "x"), ("paul", 2, None)]

    # default null values
    upload_csv(CSV_FILENAME2, CSV_UPLOAD_TABLE, extra={"if_exists": "replace"})
    # make sure that john and empty string are replaced with None
    data = engine.execute(f"SELECT * from {CSV_UPLOAD_TABLE}").fetchall()
    if utils.backend() == "hive":
        # By default hive does not convert values to null vs other databases.
        assert data == [("john", 1, "x"), ("paul", 2, "")]
    else:
        assert data == [("john", 1, "x"), ("paul", 2, None)]


@mock.patch("superset.db_engine_specs.hive.upload_to_s3", mock_upload_to_s3)
def test_import_excel(setup_csv_upload, create_excel_files):
    if utils.backend() == "hive":
        pytest.skip("Hive doesn't excel upload.")

    success_msg = (
        f'Excel file "{EXCEL_FILENAME}" uploaded to table "{EXCEL_UPLOAD_TABLE}"'
    )

    # initial upload with fail mode
    resp = upload_excel(EXCEL_FILENAME, EXCEL_UPLOAD_TABLE)
    assert success_msg in resp

    # upload again with fail mode; should fail
    fail_msg = f'Unable to upload Excel file "{EXCEL_FILENAME}" to table "{EXCEL_UPLOAD_TABLE}"'
    resp = upload_excel(EXCEL_FILENAME, EXCEL_UPLOAD_TABLE)
    assert fail_msg in resp

    if utils.backend() != "hive":
        # upload again with append mode
        resp = upload_excel(
            EXCEL_FILENAME, EXCEL_UPLOAD_TABLE, extra={"if_exists": "append"}
        )
        assert success_msg in resp

    # upload again with replace mode
    resp = upload_excel(
        EXCEL_FILENAME, EXCEL_UPLOAD_TABLE, extra={"if_exists": "replace"}
    )
    assert success_msg in resp

    # make sure that john and empty string are replaced with None
    data = (
        get_upload_db()
        .get_sqla_engine()
        .execute(f"SELECT * from {EXCEL_UPLOAD_TABLE}")
        .fetchall()
    )
    assert data == [(0, "john", 1), (1, "paul", 2)]
