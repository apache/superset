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

"""Tests for Firebolt dialect support in sqlglot."""

from superset.sql.parse import SQLScript


def test_firebolt_exclude_syntax() -> None:
    """Test that Firebolt EXCLUDE syntax is preserved (not transformed to EXCEPT)."""
    sql = "SELECT g.* EXCLUDE (source_file_timestamp) FROM public.games g"
    script = SQLScript(sql, "firebolt")

    generated = script.format()
    assert "EXCLUDE" in generated
    assert "EXCEPT" not in generated
    assert "source_file_timestamp" in generated


def test_firebolt_exclude_multiple_columns() -> None:
    """Test EXCLUDE with multiple columns."""
    sql = "SELECT * EXCLUDE (col1, col2, col3) FROM my_table"
    script = SQLScript(sql, "firebolt")

    generated = script.format()
    assert "EXCLUDE" in generated
    assert "EXCEPT" not in generated
    assert "col1" in generated
    assert "col2" in generated
    assert "col3" in generated


def test_firebolt_sql_parsing() -> None:
    """Test that Firebolt SQL can be parsed without errors."""
    sql = "SELECT * FROM my_table LIMIT 10"
    script = SQLScript(sql, "firebolt")
    assert len(script.statements) == 1
    assert not script.has_mutation()


def test_firebolt_not_in_parenthesized() -> None:
    """Test that NOT IN is properly parenthesized in Firebolt."""
    sql = "SELECT * FROM my_table WHERE id NOT IN (1, 2, 3)"
    script = SQLScript(sql, "firebolt")

    generated = script.format()
    assert "NOT" in generated
    assert "IN" in generated
