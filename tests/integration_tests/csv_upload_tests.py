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
import shutil
from typing import Optional, Union

from unittest import mock

import pandas as pd
import pytest

import superset.utils.database
from superset.sql_parse import Table
from tests.integration_tests.conftest import ADMIN_SCHEMA_NAME
from superset import db
from superset import security_manager
from superset.models.core import Database
from superset.utils import core as utils
from tests.integration_tests.test_app import app, login
from tests.integration_tests.base_tests import get_resp, SupersetTestCase

logger = logging.getLogger(__name__)


test_client = app.test_client()

CSV_UPLOAD_DATABASE = "csv_explore_db"
CSV_FILENAME1 = "testCSV1.csv"
CSV_FILENAME2 = "testCSV2.csv"
EXCEL_FILENAME = "testExcel.xlsx"
PARQUET_FILENAME1 = "testZip/testParquet1.parquet"
PARQUET_FILENAME2 = "testZip/testParquet2.parquet"
ZIP_DIRNAME = "testZip"
ZIP_FILENAME = "testZip.zip"

EXCEL_UPLOAD_TABLE = "excel_upload"
CSV_UPLOAD_TABLE = "csv_upload"
PARQUET_UPLOAD_TABLE = "parquet_upload"
CSV_UPLOAD_TABLE_W_SCHEMA = "csv_upload_w_schema"
CSV_UPLOAD_TABLE_W_EXPLORE = "csv_upload_w_explore"


def _setup_csv_upload():
    upload_db = superset.utils.database.get_or_create_db(
        CSV_UPLOAD_DATABASE, app.config["SQLALCHEMY_EXAMPLES_URI"]
    )
    extra = upload_db.get_extra()
    extra["explore_database_id"] = superset.utils.database.get_example_database().id
    upload_db.extra = json.dumps(extra)
    upload_db.allow_file_upload = True
    db.session.commit()

    yield

    upload_db = get_upload_db()
    with upload_db.get_sqla_engine_with_context() as engine:
        engine.execute(f"DROP TABLE IF EXISTS {EXCEL_UPLOAD_TABLE}")
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE}")
        engine.execute(f"DROP TABLE IF EXISTS {PARQUET_UPLOAD_TABLE}")
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE_W_SCHEMA}")
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE_W_EXPLORE}")
    db.session.delete(upload_db)
    db.session.commit()


@pytest.fixture(scope="module")
def setup_csv_upload(login_as_admin):
    yield from _setup_csv_upload()


@pytest.fixture(scope="module")
def setup_csv_upload_with_context():
    with app.app_context():
        login(test_client, username="admin")
        yield from _setup_csv_upload()


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


@pytest.fixture()
def create_columnar_files():
    os.mkdir(ZIP_DIRNAME)
    pd.DataFrame({"a": ["john", "paul"], "b": [1, 2]}).to_parquet(PARQUET_FILENAME1)
    pd.DataFrame({"a": ["max", "bob"], "b": [3, 4]}).to_parquet(PARQUET_FILENAME2)
    shutil.make_archive(ZIP_DIRNAME, "zip", ZIP_DIRNAME)
    yield
    os.remove(ZIP_FILENAME)
    shutil.rmtree(ZIP_DIRNAME)


def get_upload_db():
    return db.session.query(Database).filter_by(database_name=CSV_UPLOAD_DATABASE).one()


def upload_csv(
    filename: str,
    table_name: str,
    extra: Optional[dict[str, str]] = None,
    dtype: Union[str, None] = None,
):
    csv_upload_db_id = get_upload_db().id
    form_data = {
        "csv_file": open(filename, "rb"),
        "delimiter": ",",
        "table_name": table_name,
        "database": csv_upload_db_id,
        "if_exists": "fail",
        "index_label": "test_label",
        "overwrite_duplicate": False,
    }
    if schema := utils.get_example_default_schema():
        form_data["schema"] = schema
    if extra:
        form_data.update(extra)
    if dtype:
        form_data["dtype"] = dtype
    return get_resp(test_client, "/csvtodatabaseview/form", data=form_data)


def upload_excel(
    filename: str, table_name: str, extra: Optional[dict[str, str]] = None
):
    excel_upload_db_id = get_upload_db().id
    form_data = {
        "excel_file": open(filename, "rb"),
        "name": table_name,
        "database": excel_upload_db_id,
        "sheet_name": "Sheet1",
        "if_exists": "fail",
        "index_label": "test_label",
    }
    if schema := utils.get_example_default_schema():
        form_data["schema"] = schema
    if extra:
        form_data.update(extra)
    return get_resp(test_client, "/exceltodatabaseview/form", data=form_data)


def upload_columnar(
    filename: str, table_name: str, extra: Optional[dict[str, str]] = None
):
    columnar_upload_db_id = get_upload_db().id
    form_data = {
        "columnar_file": open(filename, "rb"),
        "name": table_name,
        "database": columnar_upload_db_id,
        "if_exists": "fail",
        "index_label": "test_label",
    }
    if schema := utils.get_example_default_schema():
        form_data["schema"] = schema
    if extra:
        form_data.update(extra)
    return get_resp(test_client, "/columnartodatabaseview/form", data=form_data)


def mock_upload_to_s3(filename: str, upload_prefix: str, table: Table) -> str:
    """
    HDFS is used instead of S3 for the unit tests.integration_tests.

    :param filename: The file to upload
    :param upload_prefix: The S3 prefix
    :param table: The table that will be created
    :returns: The HDFS path to the directory with external table files
    """
    # only needed for the hive tests
    import docker

    client = docker.from_env()  # type: ignore
    container = client.containers.get("namenode")
    # docker mounted volume that contains csv uploads
    src = os.path.join("/tmp/superset_uploads", os.path.basename(filename))
    # hdfs destination for the external tables
    dest_dir = os.path.join("/tmp/external/superset_uploads/", str(table))
    container.exec_run(f"hdfs dfs -mkdir -p {dest_dir}")
    dest = os.path.join(dest_dir, os.path.basename(filename))
    container.exec_run(f"hdfs dfs -put {src} {dest}")
    # hive external table expects a directory for the location
    return dest_dir


def escaped_double_quotes(text):
    return rf"\&#34;{text}\&#34;"


def escaped_parquet(text):
    return escaped_double_quotes(f"[&#39;{text}&#39;]")


@pytest.mark.usefixtures("setup_csv_upload_with_context")
@pytest.mark.usefixtures("create_csv_files")
@mock.patch(
    "superset.models.core.config",
    {**app.config, "ALLOWED_USER_CSV_SCHEMA_FUNC": lambda d, u: ["admin_database"]},
)
@mock.patch("superset.db_engine_specs.hive.upload_to_s3", mock_upload_to_s3)
@mock.patch("superset.views.database.views.event_logger.log_with_context")
def test_import_csv_enforced_schema(mock_event_logger):
    if utils.backend() == "sqlite":
        pytest.skip("Sqlite doesn't support schema / database creation")

    if utils.backend() == "mysql":
        pytest.skip("This test is flaky on MySQL")

    full_table_name = f"admin_database.{CSV_UPLOAD_TABLE_W_SCHEMA}"

    # Invalid table name
    resp = upload_csv(CSV_FILENAME1, full_table_name)
    assert "Table name cannot contain a schema" in resp

    # no schema specified, fail upload
    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE_W_SCHEMA, extra={"schema": None})
    assert (
        f"Database {escaped_double_quotes(CSV_UPLOAD_DATABASE)} schema"
        f" {escaped_double_quotes('None')} is not allowed for csv uploads" in resp
    )

    success_msg = f"CSV file {escaped_double_quotes(CSV_FILENAME1)} uploaded to table {escaped_double_quotes(full_table_name)}"

    resp = upload_csv(
        CSV_FILENAME1,
        CSV_UPLOAD_TABLE_W_SCHEMA,
        extra={"schema": "admin_database", "if_exists": "replace"},
    )

    assert success_msg in resp
    mock_event_logger.assert_called_with(
        action="successful_csv_upload",
        database=get_upload_db().name,
        schema="admin_database",
        table=CSV_UPLOAD_TABLE_W_SCHEMA,
    )

    with get_upload_db().get_sqla_engine_with_context() as engine:
        data = engine.execute(
            f"SELECT * from {ADMIN_SCHEMA_NAME}.{CSV_UPLOAD_TABLE_W_SCHEMA} ORDER BY b"
        ).fetchall()
        assert data == [("john", 1), ("paul", 2)]

    # user specified schema doesn't match, fail
    resp = upload_csv(
        CSV_FILENAME1, CSV_UPLOAD_TABLE_W_SCHEMA, extra={"schema": "gold"}
    )
    assert (
        f'Database {escaped_double_quotes(CSV_UPLOAD_DATABASE)} schema {escaped_double_quotes("gold")} is not allowed for csv uploads'
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

    # Clean up
    with get_upload_db().get_sqla_engine_with_context() as engine:
        engine.execute(f"DROP TABLE {full_table_name}")


@mock.patch("superset.db_engine_specs.hive.upload_to_s3", mock_upload_to_s3)
def test_import_csv_explore_database(setup_csv_upload_with_context, create_csv_files):
    schema = utils.get_example_default_schema()
    full_table_name = (
        f"{schema}.{CSV_UPLOAD_TABLE_W_EXPLORE}"
        if schema
        else CSV_UPLOAD_TABLE_W_EXPLORE
    )

    if utils.backend() == "sqlite":
        pytest.skip("Sqlite doesn't support schema / database creation")

    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE_W_EXPLORE)
    assert (
        f"CSV file {escaped_double_quotes(CSV_FILENAME1)} uploaded to table {escaped_double_quotes(full_table_name)}"
        in resp
    )
    table = SupersetTestCase.get_table(name=CSV_UPLOAD_TABLE_W_EXPLORE)
    assert table.database_id == superset.utils.database.get_example_database().id


@pytest.mark.usefixtures("setup_csv_upload_with_context")
@pytest.mark.usefixtures("create_csv_files")
@mock.patch("superset.db_engine_specs.hive.upload_to_s3", mock_upload_to_s3)
@mock.patch("superset.views.database.views.event_logger.log_with_context")
def test_import_csv(mock_event_logger):
    schema = utils.get_example_default_schema()
    full_table_name = f"{schema}.{CSV_UPLOAD_TABLE}" if schema else CSV_UPLOAD_TABLE
    success_msg_f1 = f"CSV file {escaped_double_quotes(CSV_FILENAME1)} uploaded to table {escaped_double_quotes(full_table_name)}"

    test_db = get_upload_db()

    # initial upload with fail mode
    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE)
    assert success_msg_f1 in resp

    # upload again with fail mode; should fail
    fail_msg = f"Unable to upload CSV file {escaped_double_quotes(CSV_FILENAME1)} to table {escaped_double_quotes(CSV_UPLOAD_TABLE)}"
    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE)
    assert fail_msg in resp

    if utils.backend() != "hive":
        # upload again with append mode
        resp = upload_csv(
            CSV_FILENAME1, CSV_UPLOAD_TABLE, extra={"if_exists": "append"}
        )
        assert success_msg_f1 in resp
        mock_event_logger.assert_called_with(
            action="successful_csv_upload",
            database=test_db.name,
            schema=schema,
            table=CSV_UPLOAD_TABLE,
        )

    # upload again with replace mode
    resp = upload_csv(CSV_FILENAME1, CSV_UPLOAD_TABLE, extra={"if_exists": "replace"})
    assert success_msg_f1 in resp

    # try to append to table from file with different schema
    resp = upload_csv(CSV_FILENAME2, CSV_UPLOAD_TABLE, extra={"if_exists": "append"})
    fail_msg_f2 = f"Unable to upload CSV file {escaped_double_quotes(CSV_FILENAME2)} to table {escaped_double_quotes(CSV_UPLOAD_TABLE)}"
    assert fail_msg_f2 in resp

    # replace table from file with different schema
    resp = upload_csv(CSV_FILENAME2, CSV_UPLOAD_TABLE, extra={"if_exists": "replace"})
    success_msg_f2 = f"CSV file {escaped_double_quotes(CSV_FILENAME2)} uploaded to table {escaped_double_quotes(full_table_name)}"
    assert success_msg_f2 in resp

    table = SupersetTestCase.get_table(name=CSV_UPLOAD_TABLE)
    # make sure the new column name is reflected in the table metadata
    assert "d" in table.column_names

    # ensure user is assigned as an owner
    assert security_manager.find_user("admin") in table.owners

    # null values are set
    upload_csv(
        CSV_FILENAME2,
        CSV_UPLOAD_TABLE,
        extra={"null_values": '["", "john"]', "if_exists": "replace"},
    )
    # make sure that john and empty string are replaced with None
    with test_db.get_sqla_engine_with_context() as engine:
        data = engine.execute(f"SELECT * from {CSV_UPLOAD_TABLE} ORDER BY c").fetchall()
        assert data == [(None, 1, "x"), ("paul", 2, None)]
        # default null values
        upload_csv(CSV_FILENAME2, CSV_UPLOAD_TABLE, extra={"if_exists": "replace"})
        # make sure that john and empty string are replaced with None
        data = engine.execute(f"SELECT * from {CSV_UPLOAD_TABLE} ORDER BY c").fetchall()
        assert data == [("john", 1, "x"), ("paul", 2, None)]

    # cleanup
    with get_upload_db().get_sqla_engine_with_context() as engine:
        engine.execute(f"DROP TABLE {full_table_name}")

    # with dtype
    upload_csv(
        CSV_FILENAME1,
        CSV_UPLOAD_TABLE,
        dtype='{"a": "string", "b": "float64"}',
    )

    # you can change the type to something compatible, like an object to string
    # or an int to a float
    # file upload should work as normal
    with test_db.get_sqla_engine_with_context() as engine:
        data = engine.execute(f"SELECT * from {CSV_UPLOAD_TABLE} ORDER BY b").fetchall()
        assert data == [("john", 1), ("paul", 2)]

    # cleanup
    with get_upload_db().get_sqla_engine_with_context() as engine:
        engine.execute(f"DROP TABLE {full_table_name}")

    # with dtype - wrong type
    resp = upload_csv(
        CSV_FILENAME1,
        CSV_UPLOAD_TABLE,
        dtype='{"a": "int"}',
    )

    # you cannot pass an incompatible dtype
    fail_msg = f"Unable to upload CSV file {escaped_double_quotes(CSV_FILENAME1)} to table {escaped_double_quotes(CSV_UPLOAD_TABLE)}"
    assert fail_msg in resp


@pytest.mark.usefixtures("setup_csv_upload_with_context")
@pytest.mark.usefixtures("create_excel_files")
@mock.patch("superset.db_engine_specs.hive.upload_to_s3", mock_upload_to_s3)
@mock.patch("superset.views.database.views.event_logger.log_with_context")
def test_import_excel(mock_event_logger):
    if utils.backend() == "hive":
        pytest.skip("Hive doesn't excel upload.")

    schema = utils.get_example_default_schema()
    full_table_name = f"{schema}.{EXCEL_UPLOAD_TABLE}" if schema else EXCEL_UPLOAD_TABLE
    test_db = get_upload_db()

    success_msg = f"Excel file {escaped_double_quotes(EXCEL_FILENAME)} uploaded to table {escaped_double_quotes(full_table_name)}"

    # initial upload with fail mode
    resp = upload_excel(EXCEL_FILENAME, EXCEL_UPLOAD_TABLE)
    assert success_msg in resp
    mock_event_logger.assert_called_with(
        action="successful_excel_upload",
        database=test_db.name,
        schema=schema,
        table=EXCEL_UPLOAD_TABLE,
    )

    # ensure user is assigned as an owner
    table = SupersetTestCase.get_table(name=EXCEL_UPLOAD_TABLE)
    assert security_manager.find_user("admin") in table.owners

    # upload again with fail mode; should fail
    fail_msg = f"Unable to upload Excel file {escaped_double_quotes(EXCEL_FILENAME)} to table {escaped_double_quotes(EXCEL_UPLOAD_TABLE)}"
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
    mock_event_logger.assert_called_with(
        action="successful_excel_upload",
        database=test_db.name,
        schema=schema,
        table=EXCEL_UPLOAD_TABLE,
    )

    with test_db.get_sqla_engine_with_context() as engine:
        data = engine.execute(
            f"SELECT * from {EXCEL_UPLOAD_TABLE} ORDER BY b"
        ).fetchall()
        assert data == [(0, "john", 1), (1, "paul", 2)]


@pytest.mark.usefixtures("setup_csv_upload_with_context")
@pytest.mark.usefixtures("create_columnar_files")
@mock.patch("superset.db_engine_specs.hive.upload_to_s3", mock_upload_to_s3)
@mock.patch("superset.views.database.views.event_logger.log_with_context")
def test_import_parquet(mock_event_logger):
    if utils.backend() == "hive":
        pytest.skip("Hive doesn't allow parquet upload.")

    schema = utils.get_example_default_schema()
    full_table_name = (
        f"{schema}.{PARQUET_UPLOAD_TABLE}" if schema else PARQUET_UPLOAD_TABLE
    )
    test_db = get_upload_db()

    success_msg_f1 = f"Columnar file {escaped_parquet(PARQUET_FILENAME1)} uploaded to table {escaped_double_quotes(full_table_name)}"

    # initial upload with fail mode
    resp = upload_columnar(PARQUET_FILENAME1, PARQUET_UPLOAD_TABLE)
    assert success_msg_f1 in resp

    # upload again with fail mode; should fail
    fail_msg = f"Unable to upload Columnar file {escaped_parquet(PARQUET_FILENAME1)} to table {escaped_double_quotes(PARQUET_UPLOAD_TABLE)}"
    resp = upload_columnar(PARQUET_FILENAME1, PARQUET_UPLOAD_TABLE)
    assert fail_msg in resp

    if utils.backend() != "hive":
        # upload again with append mode
        resp = upload_columnar(
            PARQUET_FILENAME1, PARQUET_UPLOAD_TABLE, extra={"if_exists": "append"}
        )
        assert success_msg_f1 in resp
        mock_event_logger.assert_called_with(
            action="successful_columnar_upload",
            database=test_db.name,
            schema=schema,
            table=PARQUET_UPLOAD_TABLE,
        )

    # upload again with replace mode and specific columns
    resp = upload_columnar(
        PARQUET_FILENAME1,
        PARQUET_UPLOAD_TABLE,
        extra={"if_exists": "replace", "usecols": '["a"]'},
    )
    assert success_msg_f1 in resp

    table = SupersetTestCase.get_table(name=PARQUET_UPLOAD_TABLE, schema=None)
    # make sure only specified column name was read
    assert "b" not in table.column_names

    # ensure user is assigned as an owner
    assert security_manager.find_user("admin") in table.owners

    # upload again with replace mode
    resp = upload_columnar(
        PARQUET_FILENAME1, PARQUET_UPLOAD_TABLE, extra={"if_exists": "replace"}
    )
    assert success_msg_f1 in resp

    with test_db.get_sqla_engine_with_context() as engine:
        data = engine.execute(
            f"SELECT * from {PARQUET_UPLOAD_TABLE} ORDER BY b"
        ).fetchall()
        assert data == [("john", 1), ("paul", 2)]

    # replace table with zip file
    resp = upload_columnar(
        ZIP_FILENAME, PARQUET_UPLOAD_TABLE, extra={"if_exists": "replace"}
    )
    success_msg_f2 = f"Columnar file {escaped_parquet(ZIP_FILENAME)} uploaded to table {escaped_double_quotes(full_table_name)}"
    assert success_msg_f2 in resp

    with test_db.get_sqla_engine_with_context() as engine:
        data = engine.execute(
            f"SELECT * from {PARQUET_UPLOAD_TABLE} ORDER BY b"
        ).fetchall()
        assert data == [("john", 1), ("paul", 2), ("max", 3), ("bob", 4)]
