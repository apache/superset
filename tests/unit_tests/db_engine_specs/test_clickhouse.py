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
from unittest import mock

import pytest

from tests.unit_tests.fixtures.common import dttm


def test_convert_dttm(dttm: datetime) -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec

    assert ClickHouseEngineSpec.convert_dttm("DATE", dttm) == "toDate('2019-01-02')"
    assert (
        ClickHouseEngineSpec.convert_dttm("DATETIME", dttm)
        == "toDateTime('2019-01-02 03:04:05')"
    )


def test_execute_connection_error() -> None:
    from urllib3.exceptions import NewConnectionError

    from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec
    from superset.db_engine_specs.exceptions import SupersetDBAPIDatabaseError

    cursor = mock.Mock()
    cursor.execute.side_effect = NewConnectionError(
        "Dummypool", "Exception with sensitive data"
    )
    with pytest.raises(SupersetDBAPIDatabaseError) as ex:
        ClickHouseEngineSpec.execute(cursor, "SELECT col1 from table1")
