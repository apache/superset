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

from __future__ import annotations

from unittest.mock import MagicMock

from superset.sql_validators.sqlite import SQLiteSQLValidator


def test_valid_syntax() -> None:
    mock_database = MagicMock()
    annotations = SQLiteSQLValidator.validate(
        sql="SELECT 1, col FROM my_table",
        catalog=None,
        schema="",
        database=mock_database,
    )
    assert annotations == []


def test_invalid_syntax_single_error() -> None:
    mock_database = MagicMock()
    annotations = SQLiteSQLValidator.validate(
        sql="SELEC * FROM foo",
        catalog=None,
        schema="",
        database=mock_database,
    )
    assert len(annotations) == 1
    annotation = annotations[0]
    assert annotation.line_number == 1
    assert annotation.start_column == 1
    assert "SELEC" in annotation.message


def test_invalid_syntax_multiple_errors() -> None:
    mock_database = MagicMock()
    annotations = SQLiteSQLValidator.validate(
        sql="SELEC * FROM foo; SELEC * FROM bar",
        catalog=None,
        schema="",
        database=mock_database,
    )
    assert len(annotations) >= 1
    # First error should reference SELEC
    assert "SELEC" in annotations[0].message


def test_multiline_error_reports_correct_line() -> None:
    mock_database = MagicMock()
    annotations = SQLiteSQLValidator.validate(
        sql="SELECT 1;\nSELEC * FROM foo",
        catalog=None,
        schema="",
        database=mock_database,
    )
    assert len(annotations) == 1
    assert annotations[0].line_number == 2


def test_empty_sql() -> None:
    mock_database = MagicMock()
    annotations = SQLiteSQLValidator.validate(
        sql="",
        catalog=None,
        schema="",
        database=mock_database,
    )
    assert annotations == []


def test_valid_complex_query() -> None:
    mock_database = MagicMock()
    annotations = SQLiteSQLValidator.validate(
        sql=(
            "SELECT a, COUNT(*) AS cnt "
            "FROM my_table "
            "WHERE b > 10 "
            "GROUP BY a "
            "HAVING cnt > 1 "
            "ORDER BY cnt DESC "
            "LIMIT 100"
        ),
        catalog=None,
        schema="",
        database=mock_database,
    )
    assert annotations == []


def test_annotation_to_dict() -> None:
    mock_database = MagicMock()
    annotations = SQLiteSQLValidator.validate(
        sql="SELEC * FROM foo",
        catalog=None,
        schema="",
        database=mock_database,
    )
    assert len(annotations) == 1
    result = annotations[0].to_dict()
    assert "line_number" in result
    assert "start_column" in result
    assert "end_column" in result
    assert "message" in result


def test_get_validator_by_name() -> None:
    from superset.sql_validators import get_validator_by_name

    validator = get_validator_by_name("SQLiteSQLValidator")
    assert validator is SQLiteSQLValidator
