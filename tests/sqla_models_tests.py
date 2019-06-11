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
from superset.connectors.sqla.models import TableColumn
from superset.db_engine_specs.druid import DruidEngineSpec
from .base_tests import SupersetTestCase


class DatabaseModelTestCase(SupersetTestCase):

    def test_is_time_druid_time_col(self):
        """Druid has a special __time column"""
        col = TableColumn(column_name='__time', type='INTEGER')
        self.assertEquals(col.is_dttm, None)
        DruidEngineSpec.alter_new_orm_column(col)
        self.assertEquals(col.is_dttm, True)

        col = TableColumn(column_name='__not_time', type='INTEGER')
        self.assertEquals(col.is_time, False)

    def test_is_time_by_type(self):
        col = TableColumn(column_name='foo', type='DATE')
        self.assertEquals(col.is_time, True)

        col = TableColumn(column_name='foo', type='DATETIME')
        self.assertEquals(col.is_time, True)

        col = TableColumn(column_name='foo', type='STRING')
        self.assertEquals(col.is_time, False)
