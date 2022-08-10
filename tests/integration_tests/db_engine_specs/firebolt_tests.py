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
from superset.db_engine_specs.firebolt import FireboltEngineSpec
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestFireboltDbEngineSpec(TestDbEngineSpec):
    def test_convert_dttm(self):
        dttm = self.get_dttm()
        test_cases = {
            "DATE": "CAST('2019-01-02' AS DATE)",
            "DATETIME": "CAST('2019-01-02T03:04:05' AS DATETIME)",
            "TIMESTAMP": "CAST('2019-01-02T03:04:05' AS TIMESTAMP)",
            "UNKNOWNTYPE": None,
        }

        for target_type, expected in test_cases.items():
            actual = FireboltEngineSpec.convert_dttm(target_type, dttm)
            self.assertEqual(actual, expected)

    def test_epoch_to_dttm(self):
        assert (
            FireboltEngineSpec.epoch_to_dttm().format(col="timestamp_column")
            == "from_unixtime(timestamp_column)"
        )
