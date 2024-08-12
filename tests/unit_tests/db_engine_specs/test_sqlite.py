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
# pylint: disable=invalid-name, unused-argument, import-outside-toplevel, redefined-outer-name
from datetime import datetime
from typing import Optional

import pytest
from sqlalchemy.engine import create_engine

from superset.constants import TimeGrain
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Text", "'2019-01-02 03:04:05'"),
        ("DateTime", "'2019-01-02 03:04:05'"),
        ("TimeStamp", "'2019-01-02 03:04:05'"),
        ("Other", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.sqlite import SqliteEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "dttm,grain,expected",
    [
        ("2022-05-04T05:06:07.89Z", TimeGrain.SECOND, "2022-05-04 05:06:07"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.FIVE_SECONDS, "2022-05-04 05:06:05"),
        ("2022-05-04T05:06:37.89Z", TimeGrain.THIRTY_SECONDS, "2022-05-04 05:06:30"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.MINUTE, "2022-05-04 05:06:00"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.FIVE_MINUTES, "2022-05-04 05:05:00"),
        ("2022-05-04T05:36:07.89Z", TimeGrain.TEN_MINUTES, "2022-05-04 05:30:00"),
        ("2022-05-04T05:46:07.89Z", TimeGrain.FIFTEEN_MINUTES, "2022-05-04 05:45:00"),
        ("2022-05-04T05:36:07.89Z", TimeGrain.THIRTY_MINUTES, "2022-05-04 05:30:00"),
        ("2022-05-04T05:36:07.89Z", TimeGrain.HALF_HOUR, "2022-05-04 05:30:00"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.HOUR, "2022-05-04 05:00:00"),
        ("2022-05-04T07:06:07.89Z", TimeGrain.SIX_HOURS, "2022-05-04 06:00:00"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.DAY, "2022-05-04 00:00:00"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.WEEK, "2022-05-01 00:00:00"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.MONTH, "2022-05-01 00:00:00"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.YEAR, "2022-01-01 00:00:00"),
        #  ___________________________
        # |         May 2022          |
        # |---------------------------|
        # | S | M | T | W | T | F | S |
        # |---+---+---+---+---+---+---|
        # | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
        #  ---------------------------
        (
            "2022-05-04T05:06:07.89Z",
            TimeGrain.WEEK_ENDING_SATURDAY,
            "2022-05-07 00:00:00",
        ),
        (
            "2022-05-04T05:06:07.89Z",
            TimeGrain.WEEK_ENDING_SUNDAY,
            "2022-05-08 00:00:00",
        ),
        (
            "2022-05-04T05:06:07.89Z",
            TimeGrain.WEEK_STARTING_SUNDAY,
            "2022-05-01 00:00:00",
        ),
        (
            "2022-05-04T05:06:07.89Z",
            TimeGrain.WEEK_STARTING_MONDAY,
            "2022-05-02 00:00:00",
        ),
        ("2022-01-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-01-01 00:00:00"),
        ("2022-02-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-01-01 00:00:00"),
        ("2022-03-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-01-01 00:00:00"),
        ("2022-04-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-04-01 00:00:00"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-04-01 00:00:00"),
        ("2022-06-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-04-01 00:00:00"),
        ("2022-07-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-07-01 00:00:00"),
        ("2022-08-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-07-01 00:00:00"),
        ("2022-09-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-07-01 00:00:00"),
        ("2022-10-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-10-01 00:00:00"),
        ("2022-11-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-10-01 00:00:00"),
        ("2022-12-04T05:06:07.89Z", TimeGrain.QUARTER_YEAR, "2022-10-01 00:00:00"),
        ("2022-01-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-01-01 00:00:00"),
        ("2022-02-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-01-01 00:00:00"),
        ("2022-03-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-01-01 00:00:00"),
        ("2022-04-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-04-01 00:00:00"),
        ("2022-05-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-04-01 00:00:00"),
        ("2022-06-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-04-01 00:00:00"),
        ("2022-07-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-07-01 00:00:00"),
        ("2022-08-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-07-01 00:00:00"),
        ("2022-09-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-07-01 00:00:00"),
        ("2022-10-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-10-01 00:00:00"),
        ("2022-11-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-10-01 00:00:00"),
        ("2022-12-04T05:06:07.89Z", TimeGrain.QUARTER, "2022-10-01 00:00:00"),
    ],
)
def test_time_grain_expressions(dttm: str, grain: str, expected: str) -> None:  # noqa: F811
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    engine = create_engine("sqlite://")
    connection = engine.connect()
    connection.execute("CREATE TABLE t (dttm DATETIME)")
    connection.execute("INSERT INTO t VALUES (?)", dttm)

    # pylint: disable=protected-access
    expression = SqliteEngineSpec._time_grain_expressions[grain].format(col="dttm")
    sql = f"SELECT {expression} FROM t"
    result = connection.execute(sql).scalar()
    assert result == expected
