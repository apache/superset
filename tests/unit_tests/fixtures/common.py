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

import csv
from datetime import datetime
from io import BytesIO, StringIO
from typing import Any, Generator

import pandas as pd
import pytest
from flask_appbuilder.security.sqla.models import Role, User
from werkzeug.datastructures import FileStorage

from superset import db


@pytest.fixture
def dttm() -> datetime:
    return datetime.strptime("2019-01-02 03:04:05.678900", "%Y-%m-%d %H:%M:%S.%f")


def create_csv_file(
    data: list[list[str]] | None = None, delimiter=",", filename="test.csv"
) -> FileStorage:
    data = (
        [
            ["Name", "Age", "City"],
            ["John", "30", "New York"],
        ]
        if not data
        else data
    )

    output = StringIO()
    writer = csv.writer(output, delimiter=delimiter)
    for row in data:
        writer.writerow(row)
    output.seek(0)
    buffer = BytesIO(output.getvalue().encode("utf-8"))
    return FileStorage(stream=buffer, filename=filename)


def create_excel_file(
    data: dict[str, list[Any]] | None = None, filename="test.xls"
) -> FileStorage:
    data = {"Name": ["John"], "Age": [30], "City": ["New York"]} if not data else data
    buffer = BytesIO()
    df = pd.DataFrame(data)
    df.to_excel(buffer, index=False)
    buffer.seek(0)
    return FileStorage(stream=buffer, filename=filename)


def create_columnar_file(
    data: dict[str, list[Any]] | None = None, filename="test.parquet"
) -> FileStorage:
    data = {"Name": ["John"], "Age": [30], "City": ["New York"]} if not data else data
    buffer = BytesIO()
    df = pd.DataFrame(data)
    df.to_parquet(buffer, index=False)
    buffer.seek(0)
    return FileStorage(stream=buffer, filename=filename)


@pytest.fixture
def admin_user() -> Generator[User, None, None]:
    role = db.session.query(Role).filter_by(name="Admin").one()
    user = User(
        first_name="Alice",
        last_name="Admin",
        email="alice_admin@example.org",
        username="alice_admin",
        roles=[role],
    )
    db.session.add(user)
    db.session.flush()
    yield user


@pytest.fixture
def after_each() -> Generator[None, None, None]:
    yield
    db.session.rollback()
