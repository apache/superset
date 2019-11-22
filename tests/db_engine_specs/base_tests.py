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

from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.models.core import Database
from tests.base_tests import SupersetTestCase


class DbEngineSpecTestCase(SupersetTestCase):
    def sql_limit_regex(
        self, sql, expected_sql, engine_spec_class=MySQLEngineSpec, limit=1000
    ):
        main = Database(database_name="test_database", sqlalchemy_uri="sqlite://")
        limited = engine_spec_class.apply_limit_to_sql(sql, limit, main)
        self.assertEqual(expected_sql, limited)

    def get_dttm(self):
        return datetime.strptime("2019-01-02 03:04:05.678900", "%Y-%m-%d %H:%M:%S.%f")
