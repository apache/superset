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
from pytest_mock import MockFixture

from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod


def test_ParsedQuery_tds(app_context: AppContext) -> None:
    """
    Test the custom ``ParsedQuery_td`` that calls  ``_extract_limit_from_query_td(``

    The CLass looks for Teradata limit keywords TOP and SAMPLE vs LIMIT in
    other dialects. and
    """
    from superset.db_engine_specs.teradata.TeradataEngineSpec import apply_limit_to_sql

    from superset.db_engine_specs.teradata import ParsedQuery_td, TeradataEngineSpec

    sql2 = "SEL TOP 1000 * FROM My_table;"
    limit = 100

    assert str(apply_limit_to_sql("teradata", sql2, limit, "Database")) == (
        "SEL TOP 100 * FROM My_table "
    )
