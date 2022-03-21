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
from typing import Dict, Optional

from unittest import mock

import pandas as pd
import pytest

import superset.utils.database
from superset.sql_parse import Table
from superset import security_manager
from tests.integration_tests.conftest import ADMIN_SCHEMA_NAME
from tests.integration_tests.test_app import app  # isort:skip
from superset import db
from superset.models.core import Database
from superset.utils import core as utils
from tests.integration_tests.base_tests import get_resp, login, SupersetTestCase

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


@pytest.fixture(scope="module")
def setup_csv_upload():
    with app.app_context():
        login(test_client, username="admin")

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
        engine = upload_db.get_sqla_engine()
        engine.execute(f"DROP TABLE IF EXISTS {EXCEL_UPLOAD_TABLE}")
        engine.execute(f"DROP TABLE IF EXISTS {CSV_UPLOAD_TABLE}")
        engine.execute(f"DROP TABLE IF EXISTS {PARQUET_UPLOAD_TABLE}")
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


def upload_csv(filename: str, table_name: str, extra: Optional[Dict[str, str]] = None):
    csv_upload_db_id = get_upload_db().id
    schema = utils.get_example_default_schema()
    form_data = {
        "csv_file": open(filename, "rb"),
        "sep": ",",
        "name": table_name,
        "con": csv_upload_db_id,
        "if_exists": "fail",
        "index_label": "test_label",
        "mangle_dupe_cols": False,
    }
    if schema:
        form_data["schema"] = schema
    if extra:
        form_data.update(extra)
    return get_resp(test_client, "/csvtodatabaseview/form", data=form_data)


def upload_excel(
    filename: str, table_name: str, extra: Optional[Dict[str, str]] = None
):
    excel_upload_db_id = get_upload_db().id
    schema = utils.get_example_default_schema()
    form_data = {
        "excel_file": open(filename, "rb"),
        "name": table_name,
        "con": excel_upload_db_id,
        "sheet_name": "Sheet1",
        "if_exists": "fail",
        "index_label": "test_label",
        "mangle_dupe_cols": False,
    }
    if schema:
        form_data["schema"] = schema
    if extra:
        form_data.update(extra)
    return get_resp(test_client, "/exceltodatabaseview/form", data=form_data)


def upload_columnar(
    filename: str, table_name: str, extra: Optional[Dict[str, str]] = None
):
    columnar_upload_db_id = get_upload_db().id
    schema = utils.get_example_default_schema()
    form_data = {
        "columnar_file": open(filename, "rb"),
        "name": table_name,
        "con": columnar_upload_db_id,
        "if_exists": "fail",
        "index_label": "test_label",
    }
    if schema:
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

    client = docker.from_env()
    container = client.containers.get("namenode")
    # docker mounted volume that contains csv uploads
    src = os.path.join("/tmp/superset_uploads", os.path.basename(filename))
    # hdfs destination for the external tables
    dest_dir = os.path.join("/tmp/external/superset_uploads/", str(table))
    container.exec_run(f"hdfs dfs -mkdir -p {dest_dir}")
    dest = os.path.join(dest_dir, os.path.basename(filename))
    container.exec_run(f"hdfs dfs -put {src} {dest}")
    # hive external table expectes a directory for the location
    return dest_dir
