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
from pytest_mock import MockerFixture
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.engine.url import make_url

from superset.sql.parse import Table
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        (
            "TimeStamp",
            "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.hive import HiveEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    assert (
        HiveEngineSpec.get_schema_from_engine_params(
            make_url("hive://localhost:10000/default"), {}
        )
        == "default"
    )


def test_select_star(mocker: MockerFixture) -> None:
    """
    Test the ``select_star`` method.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    database = mocker.MagicMock()
    engine = mocker.MagicMock()

    def quote_table(table: Table, dialect: Dialect) -> str:
        return ".".join(
            part for part in (table.catalog, table.schema, table.table) if part
        )

    mocker.patch.object(HiveEngineSpec, "quote_table", quote_table)

    HiveEngineSpec.select_star(
        database=database,
        table=Table("my_table", "my_schema", "my_catalog"),
        engine=engine,
        limit=100,
        show_cols=False,
        indent=True,
        latest_partition=False,
        cols=None,
    )

    query = database.compile_sqla_query.mock_calls[0][1][0]
    assert (
        str(query)
        == """
SELECT * \nFROM my_schema.my_table
 LIMIT :param_1
    """.strip()
    )
