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

from sqlalchemy.engine.url import make_url
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import sqltypes
from trino.sqlalchemy import datatype

from superset.databases.utils import get_col_type, make_url_safe


def test_make_url_safe_string(session: Session) -> None:
    """
    Test converting a string to a safe uri
    """
    uri_string = "postgresql+psycopg2://superset:***@127.0.0.1:5432/superset"
    uri_safe = make_url_safe(uri_string)
    assert str(uri_safe) == uri_string
    assert uri_safe == make_url(uri_string)


def test_make_url_safe_url(session: Session) -> None:
    """
    Test converting a url to a safe uri
    """
    uri = make_url("postgresql+psycopg2://superset:***@127.0.0.1:5432/superset")
    uri_safe = make_url_safe(uri)
    assert uri_safe == uri


def test_get_col_type_primary(session: Session) -> None:
    """
    Test getting a column type
    """
    col = {
        "name": "id",
        "type": sqltypes.INTEGER(),
        "nullable": False,
        "default": None,
        "comment": None,
    }
    assert get_col_type(col) == "INTEGER()"


def test_get_col_type_row_and_map(session: Session) -> None:
    """
    Test getting a column type
    """
    col = {
        "name": "id",
        "type": datatype.ROW(
            [
                ("name", sqltypes.VARCHAR()),
                ("age", sqltypes.INTEGER()),
            ]
        ),
        "nullable": False,
        "default": None,
        "comment": None,
    }
    assert get_col_type(col) == "ROW([('name', VARCHAR()), ('age', INTEGER())])"
