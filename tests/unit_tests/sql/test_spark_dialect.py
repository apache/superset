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

"""Tests for Spark dialect support in sqlglot.

Verifies that a spark:// SQLAlchemy connection resolves to SparkEngineSpec,
which uses the sqlglot Spark dialect and preserves Spark SQL functions like
BOOL_OR (instead of rewriting them to LOGICAL_OR as the Hive dialect does).
"""

import pytest
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs import get_engine_spec
from superset.db_engine_specs.spark import SparkEngineSpec
from superset.sql.parse import LimitMethod, SQLScript, SQLStatement


def test_spark_url_resolves_to_spark_engine_spec() -> None:
    """A spark:// SQLAlchemy URI should resolve to SparkEngineSpec."""
    url = make_url("spark://localhost:10009/default")
    backend = url.get_backend_name()
    engine_spec = get_engine_spec(backend)
    assert engine_spec is SparkEngineSpec


def test_spark_engine_spec_engine_attribute() -> None:
    """SparkEngineSpec.engine should be 'spark', not inherited 'hive'."""
    assert SparkEngineSpec.engine == "spark"


@pytest.mark.parametrize(
    ("sql", "expected"),
    [
        (
            "SELECT BOOL_OR(col) FROM my_table",
            "SELECT\n  BOOL_OR(col)\nFROM my_table",
        ),
        (
            "SELECT BOOL_OR('test_value' IN ('test', 'test_value'))",
            "SELECT\n  BOOL_OR('test_value' IN ('test', 'test_value'))",
        ),
    ],
)
def test_spark_preserves_bool_or(sql: str, expected: str) -> None:
    """BOOL_OR should be preserved when using the Spark engine.

    The Hive dialect rewrites BOOL_OR to LOGICAL_OR via sqlglot, but Spark SQL
    supports BOOL_OR natively so it must remain unchanged.
    """
    script = SQLScript(sql, SparkEngineSpec.engine)
    result = script.statements[0].format()
    assert result == expected


def test_spark_preserves_bool_or_with_limit() -> None:
    """BOOL_OR should be preserved after applying a LIMIT (the SQLLab flow).

    In SQLLab, Superset parses the user's SQL, applies a LIMIT, and regenerates
    the SQL using the engine's sqlglot dialect. This test replicates that full
    flow for a spark:// connection.
    """
    sql = "SELECT BOOL_OR('test_value' IN ('test', 'test_value'))"
    statement = SQLStatement(sql, SparkEngineSpec.engine)
    statement.set_limit_value(1001, LimitMethod.FORCE_LIMIT)
    result = statement.format()

    expected = "SELECT\n  BOOL_OR('test_value' IN ('test', 'test_value'))\nLIMIT 1001"
    assert result == expected


def test_hive_rewrites_bool_or_to_logical_or() -> None:
    """Contrast: the Hive dialect rewrites BOOL_OR to LOGICAL_OR."""
    sql = "SELECT BOOL_OR('test_value' IN ('test', 'test_value'))"
    statement = SQLStatement(sql, "hive")
    statement.set_limit_value(1001, LimitMethod.FORCE_LIMIT)
    result = statement.format()

    assert "LOGICAL_OR" in result
    assert "BOOL_OR" not in result
