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
from superset.db_engine_specs.crate import CrateEngineSpec
from superset.models.core import Database
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestCrateDbEngineSpec(TestDbEngineSpec):
    def test_convert_dttm(self):
        """
        DB Eng Specs (crate): Test conversion to date time
        """
        dttm = self.get_dttm()
        assert CrateEngineSpec.convert_dttm("TIMESTAMP", dttm) == str(
            dttm.timestamp() * 1000
        )

    def test_epoch_to_dttm(self):
        """
        DB Eng Specs (crate): Test epoch to dttm
        """
        assert CrateEngineSpec.epoch_to_dttm() == "{col} * 1000"

    def test_epoch_ms_to_dttm(self):
        """
        DB Eng Specs (crate): Test epoch ms to dttm
        """
        assert CrateEngineSpec.epoch_ms_to_dttm() == "{col}"

    def test_alter_new_orm_column(self):
        """
        DB Eng Specs (crate): Test alter orm column
        """
        database = Database(database_name="crate", sqlalchemy_uri="crate://db")
        tbl = SqlaTable(table_name="druid_tbl", database=database)
        col = TableColumn(column_name="ts", type="TIMESTAMP", table=tbl)
        CrateEngineSpec.alter_new_orm_column(col)
        assert col.python_date_format == "epoch_ms"
