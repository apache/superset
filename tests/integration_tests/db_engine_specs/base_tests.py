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
# isort:skip_file
from datetime import datetime
from typing import Tuple, Type

from tests.integration_tests.test_app import app
from tests.integration_tests.base_tests import SupersetTestCase
from superset.db_engine_specs.base import BaseEngineSpec
from superset.models.core import Database
from superset.utils.core import GenericDataType


class TestDbEngineSpec(SupersetTestCase):
    def sql_limit_regex(
        self,
        sql,
        expected_sql,
        engine_spec_class=BaseEngineSpec,
        limit=1000,
        force=False,
    ):
        main = Database(database_name="test_database", sqlalchemy_uri="sqlite://")
        limited = engine_spec_class.apply_limit_to_sql(sql, limit, main, force)
        self.assertEqual(expected_sql, limited)


def assert_generic_types(
    spec: Type[BaseEngineSpec],
    type_expectations: Tuple[Tuple[str, GenericDataType], ...],
) -> None:
    for type_str, expected_type in type_expectations:
        column_spec = spec.get_column_spec(type_str)
        assert column_spec is not None
        actual_type = column_spec.generic_type
        assert (
            actual_type == expected_type
        ), f"{type_str} should be {expected_type.name} but is {actual_type.name}"
