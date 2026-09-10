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

import pytest

from superset.constants import TimeGrain


def test_epoch_to_dttm() -> None:
    """
    Test the `epoch_to_dttm` method.
    """
    from superset.db_engine_specs.ibmi import IBMiEngineSpec

    assert (
        IBMiEngineSpec.epoch_to_dttm().format(col="epoch_dttm")
        == "(DAYS(epoch_dttm) - DAYS('1970-01-01')) * 86400"
        " + MIDNIGHT_SECONDS(epoch_dttm)"
    )


@pytest.mark.parametrize(
    ("grain", "expected_expression"),
    [
        (None, "my_col"),
        (
            TimeGrain.SECOND,
            "CAST(my_col as TIMESTAMP) - MICROSECOND(my_col) MICROSECONDS",
        ),
        (
            TimeGrain.MINUTE,
            "CAST(my_col as TIMESTAMP)"
            " - SECOND(my_col) SECONDS - MICROSECOND(my_col) MICROSECONDS",
        ),
        (
            TimeGrain.HOUR,
            "CAST(my_col as TIMESTAMP)"
            " - MINUTE(my_col) MINUTES"
            " - SECOND(my_col) SECONDS - MICROSECOND(my_col) MICROSECONDS ",
        ),
        (TimeGrain.DAY, "DATE(my_col)"),
        (TimeGrain.WEEK, "my_col - (DAYOFWEEK_ISO(my_col)-1) DAYS"),
        (TimeGrain.MONTH, "my_col - (DAY(my_col)-1) DAYS"),
        (
            TimeGrain.QUARTER,
            "my_col - (DAY(my_col)-1) DAYS"
            " - (MONTH(my_col)-1) MONTHS + ((QUARTER(my_col)-1) * 3) MONTHS",
        ),
        (
            TimeGrain.YEAR,
            "my_col - (DAY(my_col)-1) DAYS - (MONTH(my_col)-1) MONTHS",
        ),
    ],
)
def test_time_grain_expressions(grain: TimeGrain, expected_expression: str) -> None:
    """
    Test that time grain expressions generate the expected SQL.
    """
    from superset.db_engine_specs.ibmi import IBMiEngineSpec

    actual = IBMiEngineSpec._time_grain_expressions[grain].format(col="my_col")
    assert actual == expected_expression
