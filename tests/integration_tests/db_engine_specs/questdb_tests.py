#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from unittest import mock

from sqlalchemy import column, literal_column
from sqlalchemy.dialects import postgresql

from superset.db_engine_specs import load_engine_specs
from superset.db_engine_specs.questdb import QuestDbEngineSpec
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestQuestDbEngineSpec(TestDbEngineSpec):
    def test_get_table_names(self):
        """
        DB Eng Specs (QuestDB): Test get table names
        """
        inspector = mock.Mock()
        inspector.get_table_names = mock.Mock(
            return_value=["public.table", "table_2", '"public.table_3"']
        )
        pg_result = QuestDbEngineSpec.get_table_names(
            database=mock.ANY, schema="public", inspector=inspector
        )
        self.assertEqual(pg_result, {"table", '"public.table_3"', "table_2"})

    def test_time_exp_literal_no_grain(self):
        """
        DB Eng Specs (QuestDB): Test no grain literal column
        """
        col = literal_column("COALESCE(a, b)")
        expr = QuestDbEngineSpec.get_timestamp_expr(col, None, None)
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(result, "COALESCE(a, b)")

    def test_time_exp_literal_1y_grain(self):
        """
        DB Eng Specs (QuestDB): Test grain literal column 1 YEAR
        """
        col = literal_column("COALESCE(a, b)")
        expr = QuestDbEngineSpec.get_timestamp_expr(col, None, "P1Y")
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(result, "DATE_TRUNC('year', COALESCE(a, b))")

    def test_time_ex_lowr_col_no_grain(self):
        """
        DB Eng Specs (QuestDB): Test no grain expr lower case
        """
        col = column("lower_case")
        expr = QuestDbEngineSpec.get_timestamp_expr(col, None, None)
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(result, "lower_case")

    def test_time_exp_lowr_col_sec_1y(self):
        """
        DB Eng Specs (QuestDB): Test grain expr lower case 1 YEAR
        """
        col = column("lower_case")
        expr = QuestDbEngineSpec.get_timestamp_expr(col, "epoch_s", "P1Y")
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(
            result,
            "DATE_TRUNC('year', lower_case * 1000000)",
        )

    def test_time_exp_mixd_case_col_1y(self):
        """
        DB Eng Specs (QuestDB): Test grain expr mixed case 1 YEAR
        """
        col = column("MixedCase")
        expr = QuestDbEngineSpec.get_timestamp_expr(col, None, "P1Y")
        result = str(expr.compile(None, dialect=postgresql.dialect()))
        self.assertEqual(result, "DATE_TRUNC('year', \"MixedCase\")")

    def test_engine_alias_name(self):
        """
        DB Eng Specs (QuestDB): Test "QuestDB" in engine spec
        """
        backends = set()
        for engine in load_engine_specs():
            backends.add(engine.engine)
            backends.update(engine.engine_aliases)
        self.assertTrue("questdb" in backends)


def test_base_parameters_mixin():
    sqlalchemy_uri = QuestDbEngineSpec.build_sqlalchemy_uri(
        {
            "username": "admin",
            "password": "quest",
            "host": "localhost",
            "port": 8812,
            "database": "main",
        }
    )
    assert sqlalchemy_uri == "questdb://admin:quest@localhost:8812/main"

    assert QuestDbEngineSpec.get_parameters_from_uri(sqlalchemy_uri) == {
        "database": "main",
        "encryption": False,
        "host": "localhost",
        "password": "quest",
        "port": 8812,
        "query": {},
        "username": "admin",
    }

    assert QuestDbEngineSpec.parameters_json_schema() == {
        "properties": {
            "database": {
                "default": "main",
                "description": "database",
                "type": "string",
            },
            "host": {
                "default": "host.docker.internal",
                "description": "host",
                "type": "string",
            },
            "password": {
                "default": "quest",
                "description": "password",
                "type": "string",
            },
            "port": {
                "default": 8812,
                "description": "port",
                "format": "int32",
                "type": "integer",
            },
            "username": {"default": "admin", "description": "user", "type": "string"},
        },
        "type": "object",
    }
