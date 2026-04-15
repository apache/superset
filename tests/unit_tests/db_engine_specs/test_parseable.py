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

import pytest

from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_epoch_to_dttm() -> None:
    """
    DB Eng Specs (parseable): Test epoch to dttm
    """
    from superset.db_engine_specs.parseable import ParseableEngineSpec

    assert ParseableEngineSpec.epoch_to_dttm() == "to_timestamp({col})"


def test_epoch_ms_to_dttm() -> None:
    """
    DB Eng Specs (parseable): Test epoch ms to dttm
    """
    from superset.db_engine_specs.parseable import ParseableEngineSpec

    assert ParseableEngineSpec.epoch_ms_to_dttm() == "to_timestamp({col} / 1000)"


def test_alter_new_orm_column() -> None:
    """
    DB Eng Specs (parseable): Test alter orm column
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.db_engine_specs.parseable import ParseableEngineSpec
    from superset.models.core import Database

    database = Database(database_name="parseable", sqlalchemy_uri="parseable://db")
    tbl = SqlaTable(table_name="tbl", database=database)
    col = TableColumn(column_name="p_timestamp", type="TIMESTAMP", table=tbl)
    ParseableEngineSpec.alter_new_orm_column(col)
    assert col.python_date_format == "epoch_ms"
    assert col.is_dttm is True


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("TIMESTAMP", "'2019-01-02T03:04:05.000'"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    """
    DB Eng Specs (parseable): Test conversion to date time
    """
    from superset.db_engine_specs.parseable import ParseableEngineSpec

    assert_convert_dttm(ParseableEngineSpec, target_type, expected_result, dttm)
