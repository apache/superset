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
import datetime

import pytest
from questdb_connect.types import QUESTDB_TYPES, Timestamp
from sqlalchemy.types import TypeEngine

from superset.db_engine_specs.questdb import QuestDbEngineSpec


def test_build_sqlalchemy_uri():
    request_uri = QuestDbEngineSpec.build_sqlalchemy_uri(
        {
            "host": "localhost",
            "port": "8812",
            "username": "admin",
            "password": "quest",
            "database": "main",
        }
    )
    assert request_uri == "questdb://admin:quest@localhost:8812/main"


def test_default_schema_for_query():
    assert QuestDbEngineSpec.get_default_schema_for_query("main", None) == None


def test_get_text_clause():
    sql_clause = "SELECT * FROM public.mytable t1"
    sql_clause += " JOIN public.myclient t2 ON t1.id = t2.id"
    expected_clause = "SELECT * FROM mytable t1 JOIN myclient t2 ON t1.id = t2.id"
    actual_clause = str(QuestDbEngineSpec.get_text_clause(sql_clause))
    print(f"sql: {sql_clause}, ex: {expected_clause}, ac: {actual_clause}")
    assert expected_clause == actual_clause


def test_epoch_to_dttm():
    assert QuestDbEngineSpec.epoch_to_dttm() == "{col} * 1000000"


@pytest.mark.parametrize(
    ("target_type", "expected_result", "dttm"),
    [
        (
            "Date",
            "TO_DATE('2023-04-28', 'YYYY-MM-DD')",
            datetime.datetime(2023, 4, 28, 23, 55, 59, 281567),
        ),
        (
            "DateTime",
            "TO_TIMESTAMP('2023-04-28T23:55:59.281567', 'yyyy-MM-ddTHH:mm:ss.SSSUUUZ')",
            datetime.datetime(2023, 4, 28, 23, 55, 59, 281567),
        ),
        (
            "TimeStamp",
            "TO_TIMESTAMP('2023-04-28T23:55:59.281567', 'yyyy-MM-ddTHH:mm:ss.SSSUUUZ')",
            datetime.datetime(2023, 4, 28, 23, 55, 59, 281567),
        ),
        ("UnknownType", None, datetime.datetime(2023, 4, 28, 23, 55, 59, 281567)),
    ],
)
def test_convert_dttm(target_type, expected_result, dttm) -> None:
    # datetime(year, month, day, hour, minute, second, microsecond)
    for target in (
        target_type,
        target_type.upper(),
        target_type.lower(),
        target_type.capitalize(),
    ):
        assert expected_result == QuestDbEngineSpec.convert_dttm(
            target_type=target, dttm=dttm
        )


def test_get_datatype():
    assert QuestDbEngineSpec.get_datatype("int") == "INT"
    assert QuestDbEngineSpec.get_datatype(["int"]) == "['int']"


def test_get_column_spec():
    for native_type in QUESTDB_TYPES:
        column_spec = QuestDbEngineSpec.get_column_spec(native_type.__visit_name__)
        assert native_type == column_spec.sqla_type
        assert native_type != Timestamp or column_spec.is_dttm


def test_get_sqla_column_type():
    for native_type in QUESTDB_TYPES:
        column_type = QuestDbEngineSpec.get_sqla_column_type(native_type.__visit_name__)
        assert isinstance(column_type, TypeEngine.__class__)


def test_get_allow_cost_estimate():
    assert not QuestDbEngineSpec.get_allow_cost_estimate(extra=None)


def test_get_view_names():
    assert set() == QuestDbEngineSpec.get_view_names("main", None, None)
