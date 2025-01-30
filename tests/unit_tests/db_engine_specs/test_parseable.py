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

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.db_engine_specs.parseable import ParseableEngineSpec
from superset.models.core import Database
from tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestParseableEngineSpec(TestDbEngineSpec):
    def test_convert_dttm(self):
        """
        DB Eng Specs (parseable): Test conversion to date time
        """
        dttm = self.get_dttm()
        assert ParseableEngineSpec.convert_dttm("TIMESTAMP", dttm) == "to_timestamp('2019-01-02T03:04:05.678900')"

    def test_epoch_to_dttm(self):
        """
        DB Eng Specs (parseable): Test epoch to dttm
        """
        assert ParseableEngineSpec.epoch_to_dttm() == "to_timestamp({col})"

    def test_epoch_ms_to_dttm(self):
        """
        DB Eng Specs (parseable): Test epoch ms to dttm
        """
        assert ParseableEngineSpec.epoch_ms_to_dttm() == "to_timestamp({col} / 1000)"

    def test_alter_new_orm_column(self):
        """
        DB Eng Specs (parseable): Test alter orm column
        """
        database = Database(database_name="parseable", sqlalchemy_uri="parseable://db")
        tbl = SqlaTable(table_name="logs", database=database)
        col = TableColumn(column_name="p_timestamp", type="TIMESTAMP", table=tbl)
        ParseableEngineSpec.alter_new_orm_column(col)
        assert col.python_date_format == "epoch_ms"

    def test_time_grain_expressions(self):
        """
        DB Eng Specs (parseable): Test time grain expressions
        """
        col = "p_timestamp"
        sqls = ParseableEngineSpec.get_time_grain_expressions()
        
        # Test different time grains
        assert sqls["Second"] == f"date_trunc('second', {col})"
        assert sqls["Minute"] == f"date_trunc('minute', {col})"
        assert sqls["Hour"] == f"date_trunc('hour', {col})"
        assert sqls["Day"] == f"date_trunc('day', {col})"
        assert sqls["Week"] == f"date_trunc('week', {col})"
        assert sqls["Month"] == f"date_trunc('month', {col})"
        assert sqls["Quarter"] == f"date_trunc('quarter', {col})"
        assert sqls["Year"] == f"date_trunc('year', {col})"
