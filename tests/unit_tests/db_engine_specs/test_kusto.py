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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access
from datetime import datetime
from typing import Optional

import pytest

from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("DateTime", "datetime(2019-01-02T03:04:05.678900)"),
        ("TimeStamp", "datetime(2019-01-02T03:04:05.678900)"),
        ("Date", "datetime(2019-01-02)"),
        ("UnknownType", None),
    ],
)
def test_kql_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.kusto import KustoKqlEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CONVERT(DATE, '2019-01-02', 23)"),
        ("DateTime", "CONVERT(DATETIME, '2019-01-02T03:04:05.678', 126)"),
        ("SmallDateTime", "CONVERT(SMALLDATETIME, '2019-01-02 03:04:05', 20)"),
        ("TimeStamp", "CONVERT(TIMESTAMP, '2019-01-02 03:04:05', 20)"),
        ("UnknownType", None),
    ],
)
def test_sql_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.kusto import KustoSqlEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)
