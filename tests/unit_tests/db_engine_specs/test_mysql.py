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

from datetime import datetime
from typing import Optional
from unittest.mock import Mock, patch

import pytest

from tests.unit_tests.fixtures.common import dttm


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "STR_TO_DATE('2019-01-02', '%Y-%m-%d')"),
        (
            "DateTime",
            "STR_TO_DATE('2019-01-02 03:04:05.678900', '%Y-%m-%d %H:%i:%s.%f')",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str, expected_result: Optional[str], dttm: datetime
) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    for target in (target_type, target_type.upper(), target_type.lower()):
        assert MySQLEngineSpec.convert_dttm(target, dttm) == expected_result


@patch("sqlalchemy.engine.Engine.connect")
def test_get_cancel_query_id(engine_mock: Mock) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.return_value.__enter__.return_value
    cursor_mock.fetchone.return_value = ["123"]
    assert MySQLEngineSpec.get_cancel_query_id(cursor_mock, query) == "123"


@patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query(engine_mock: Mock) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.return_value.__enter__.return_value
    assert MySQLEngineSpec.cancel_query(cursor_mock, query, "123") is True


@patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query_failed(engine_mock: Mock) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.raiseError.side_effect = Exception()
    assert MySQLEngineSpec.cancel_query(cursor_mock, query, "123") is False
