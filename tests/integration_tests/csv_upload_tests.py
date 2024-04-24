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
from typing import Optional

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
    with upload_db.get_sqla_engine() as engine:
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

    with test_db.get_sqla_engine() as engine:
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

    with test_db.get_sqla_engine() as engine:
        data = engine.execute(
            f"SELECT * from {PARQUET_UPLOAD_TABLE} ORDER BY b"
        ).fetchall()
        assert data == [("john", 1), ("paul", 2), ("max", 3), ("bob", 4)]
