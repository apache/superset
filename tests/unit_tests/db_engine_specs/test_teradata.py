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
import pytest


@pytest.mark.parametrize(
    "limit,original,expected",
    [
        (100, "SEL TOP 1000 * FROM My_table", "SEL TOP 100 * FROM My_table"),
        (100, "SEL TOP 1000 * FROM My_table;", "SEL TOP 100 * FROM My_table"),
        (10000, "SEL TOP 1000 * FROM My_table;", "SEL TOP 1000 * FROM My_table"),
        (1000, "SEL TOP 1000 * FROM My_table;", "SEL TOP 1000 * FROM My_table"),
        (100, "SELECT TOP 1000 * FROM My_table", "SELECT TOP 100 * FROM My_table"),
        (100, "SEL SAMPLE 1000 * FROM My_table", "SEL SAMPLE 100 * FROM My_table"),
        (10000, "SEL SAMPLE 1000 * FROM My_table", "SEL SAMPLE 1000 * FROM My_table"),
    ],
)
def test_apply_top_to_sql_limit(
    limit: int,
    original: str,
    expected: str,
) -> None:
    """
    Ensure limits are applied to the query correctly
    """
    from superset.db_engine_specs.teradata import TeradataEngineSpec

    assert TeradataEngineSpec.apply_top_to_sql(original, limit) == expected
