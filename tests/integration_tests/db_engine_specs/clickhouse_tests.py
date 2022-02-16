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
from unittest import mock

import pytest

from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec
from superset.db_engine_specs.exceptions import SupersetDBAPIDatabaseError
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestClickHouseDbEngineSpec(TestDbEngineSpec):
    def test_convert_dttm(self):
        dttm = self.get_dttm()

        self.assertEqual(
            ClickHouseEngineSpec.convert_dttm("DATE", dttm), "toDate('2019-01-02')"
        )

        self.assertEqual(
            ClickHouseEngineSpec.convert_dttm("DATETIME", dttm),
            "toDateTime('2019-01-02 03:04:05')",
        )

    def test_execute_connection_error(self):
        from urllib3.exceptions import NewConnectionError

        cursor = mock.Mock()
        cursor.execute.side_effect = NewConnectionError(
            "Dummypool", message="Exception with sensitive data"
        )
        with pytest.raises(SupersetDBAPIDatabaseError) as ex:
            ClickHouseEngineSpec.execute(cursor, "SELECT col1 from table1")
