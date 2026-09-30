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
import pytest
from sqlalchemy.exc import DBAPIError, StatementError

from superset.db_engine_specs.exasol import ExasolEngineSpec
from superset.errors import SupersetErrorType


@pytest.mark.parametrize(
    "message, expected",
    [
        (
            "syntax error, unexpected FROM_ [line 1, column 8]",
            SupersetErrorType.SYNTAX_ERROR,
        ),
        (
            "table DEMO.MISSING does not exist [line 1, column 12]",
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
        ),
        (
            "insufficient privileges: SELECT on table PRIVATE_TABLE",
            SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
        ),
        (
            "column not found [line 1, column 58]",
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
        ),
        (
            "column MISSING_COL not found [line 1, column 8]",
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
        ),
        (
            'column "Mixed.Case" not found [line 1, column 8]',
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
        ),
        (
            'column "T"."C" not found [line 1, column 8]',
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
        ),
        (
            'column MY."C" not found [line 1, column 8]',
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
        ),
        (
            "column MY.COL not found [line 1, column 8]",
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
        ),
        ("object AMBIGUOUS not found", SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
        ("object COLUMN not found", SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
        ("object MY_COLUMN not found", SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
        ('object "column" not found', SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
        ("function TO_COLUMN not found", SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
        (
            "object COLUMN_X not found [line 1, column 8]",
            SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
        ),
        ("another server failure", SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
    ],
)
def test_extract_errors(message: str, expected: SupersetErrorType) -> None:
    """Classify known messages without discarding the server diagnostic."""
    errors = ExasolEngineSpec.extract_errors(Exception(message))
    assert len(errors) == 1
    assert errors[0].error_type == expected
    assert errors[0].message == message


def test_server_message_templates_are_not_translatable() -> None:
    """A passthrough placeholder contains no text for translators."""
    for template, _, _ in ExasolEngineSpec.custom_errors.values():
        assert type(template) is str
        assert template == "%(message)s"


@pytest.mark.parametrize(
    "diagnostic, expected",
    [
        (
            "insufficient privileges: INSERT on table P",
            SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
        ),
        ("object COLUMN not found", SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
        ("another server failure", SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
    ],
)
@pytest.mark.parametrize(
    "sql",
    [
        "SELECT 'syntax error' FROM P",
        "SELECT 'table MISSING does not exist' FROM P",
        "SELECT 'column MISSING not found' FROM P",
        "SELECT 'insufficient privileges' FROM P",
        "SELECT '\nmessage => syntax error\n' FROM P",
    ],
)
@pytest.mark.parametrize(
    "envelope", ["verbose", "sqlalchemy", "parameters", "sqlalchemy_exception"]
)
def test_extract_errors_ignores_echoed_sql(
    diagnostic: str, expected: SupersetErrorType, sql: str, envelope: str
) -> None:
    """Only server diagnostics, not SQL or parameters, determine error types."""
    if envelope == "verbose":
        raw = (
            "exa error: \n(\n"
            f"    message      =>  {diagnostic}\n"
            "    dsn          =>  example:8563\n"
            "    user         =>  syntax error\n"
            "    code         =>  42000\n"
            f"    query        =>  {sql}\n"
            ")\n"
            f"[SQL: {sql}]\n"
        )
    elif envelope == "sqlalchemy":
        raw = f"{diagnostic}\n[SQL: {sql}]\n[parameters: ()]"
    else:
        raw = f"{diagnostic}\n[parameters: ({sql},)]"

    exception = (
        StatementError(diagnostic, sql, {}, Exception(diagnostic))
        if envelope == "sqlalchemy_exception"
        else Exception(raw)
    )
    errors = ExasolEngineSpec.extract_errors(exception)
    assert len(errors) == 1
    assert errors[0].error_type == expected
    assert errors[0].message == diagnostic


def test_extract_verbose_multiline_diagnostic() -> None:
    """Preserve multiline generic diagnostics without envelope fields."""
    diagnostic = "another server failure\nDetails: request could not be completed"
    raw = f"\n(\n    message => {diagnostic}\n)\n"
    errors = ExasolEngineSpec.extract_errors(Exception(raw))
    assert errors[0].error_type == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
    assert errors[0].message == diagnostic


def test_extract_verbose_diagnostic_keeps_arrow_lines() -> None:
    """Only PyExasol's envelope fields end the message field."""
    diagnostic = "another server failure\nhint => check the view definition"
    raw = (
        f"\n(\n    message     =>  {diagnostic}\n"
        "    dsn         =>  localhost:8563\n"
        "    user        =>  SYS\n"
        "    schema      =>  PUBLIC\n"
        "    session_id  =>  1\n"
        "    code        =>  42000\n"
        "    query       =>  SELECT 1\n)\n"
    )
    errors = ExasolEngineSpec.extract_errors(Exception(raw))
    assert errors[0].error_type == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
    assert errors[0].message == diagnostic


@pytest.mark.parametrize("diagnostic", ["", " \t", "\n \t\n"])
@pytest.mark.parametrize("wrapped", [False, True])
def test_extract_verbose_empty_diagnostic(diagnostic: str, wrapped: bool) -> None:
    """Keep the error code when the message is empty, without echoed SQL."""
    envelope = (
        "exa error: \n(\n"
        f"    message      =>  {diagnostic}\n"
        "    dsn          =>  example:8563\n"
        "    user         =>  SYS\n"
        "    code         =>  42000\n"
    )
    sql = "SELECT 'syntax error' FROM P"
    raw = f"{envelope}    query        =>  {sql}\n)\n[SQL: {sql}]\n"
    exception = DBAPIError(sql, {}, Exception(raw)) if wrapped else Exception(raw)
    errors = ExasolEngineSpec.extract_errors(exception)
    assert len(errors) == 1
    assert errors[0].error_type == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
    prefix = "(builtins.Exception) " if wrapped else ""
    assert errors[0].message == prefix + envelope.strip()
    assert "code         =>  42000" in errors[0].message
    assert sql not in errors[0].message
