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

from flask.ctx import AppContext


def test_ParsedQueryTeradata_lower_limit(app_context: AppContext) -> None:
    """
    Test the custom ``ParsedQueryTeradata`` that calls ``_extract_limit_from_query_td(``

    The CLass looks for Teradata limit keywords TOP and SAMPLE vs LIMIT in
    other dialects.
    """
    from superset.db_engine_specs.teradata import TeradataEngineSpec

    sql = "SEL TOP 1000 * FROM My_table;"
    limit = 100

    assert str(TeradataEngineSpec.apply_limit_to_sql(sql, limit, "Database")) == (
        "SEL TOP 100 * FROM My_table"
    )


def test_ParsedQueryTeradata_higher_limit(app_context: AppContext) -> None:
    """
    Test the custom ``ParsedQueryTeradata`` that calls ``_extract_limit_from_query_td(``

    The CLass looks for Teradata limit keywords TOP and SAMPLE vs LIMIT in
    other dialects.
    """
    from superset.db_engine_specs.teradata import TeradataEngineSpec

    sql = "SEL TOP 1000 * FROM My_table;"
    limit = 10000

    assert str(TeradataEngineSpec.apply_limit_to_sql(sql, limit, "Database")) == (
        "SEL TOP 1000 * FROM My_table"
    )


def test_ParsedQueryTeradata_equal_limit(app_context: AppContext) -> None:
    """
    Test the custom ``ParsedQueryTeradata`` that calls ``_extract_limit_from_query_td(``

    The CLass looks for Teradata limit keywords TOP and SAMPLE vs LIMIT in
    other dialects.
    """
    from superset.db_engine_specs.teradata import TeradataEngineSpec

    sql = "SEL TOP 1000 * FROM My_table;"
    limit = 1000

    assert str(TeradataEngineSpec.apply_limit_to_sql(sql, limit, "Database")) == (
        "SEL TOP 1000 * FROM My_table"
    )


def test_ParsedQueryTeradata_no_limit(app_context: AppContext) -> None:
    """
    Test the custom ``ParsedQueryTeradata`` that calls ``_extract_limit_from_query_td(``

    The CLass looks for Teradata limit keywords TOP and SAMPLE vs LIMIT in
    other dialects.
    """
    from superset.db_engine_specs.teradata import TeradataEngineSpec

    sql = "SEL * FROM My_table;"
    limit = 1000

    assert str(TeradataEngineSpec.apply_limit_to_sql(sql, limit, "Database")) == (
        "SEL TOP 1000 * FROM My_table"
    )
