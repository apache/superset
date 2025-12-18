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
from pytest_mock import MockerFixture

from superset.commands.database.exceptions import (
    ValidatorSQL400Error,
    ValidatorSQLError,
)
from superset.commands.database.validate_sql import ValidateSQLCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetSyntaxErrorException,
    SupersetTemplateException,
)


def test_validate_sql_with_jinja_templates(mocker: MockerFixture) -> None:
    """
    Test that Jinja templates are rendered before SQL validation.
    """
    # Mock the database
    database = mocker.MagicMock()
    database.id = 1
    database.db_engine_spec.engine = "postgresql"

    # Mock DatabaseDAO
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate_sql.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = database

    # Mock the validator
    validator = mocker.MagicMock()
    validator.name = "PostgreSQLValidator"
    validator.validate.return_value = []
    get_validator_by_name = mocker.patch(
        "superset.commands.database.validate_sql.get_validator_by_name"
    )
    get_validator_by_name.return_value = validator

    # Mock the template processor
    template_processor = mocker.MagicMock()
    template_processor.process_template.return_value = (
        "SELECT *\nFROM birth_names\nWHERE 1=1\nLIMIT 100"
    )
    get_template_processor = mocker.patch(
        "superset.commands.database.validate_sql.get_template_processor"
    )
    get_template_processor.return_value = template_processor

    # Mock the config
    mocker.patch(
        "superset.commands.database.validate_sql.app.config",
        {
            "SQL_VALIDATORS_BY_ENGINE": {"postgresql": "PostgreSQLValidator"},
            "SQLLAB_VALIDATION_TIMEOUT": 30,
        },
    )

    # Test SQL with Jinja templates
    sql_with_jinja = """SELECT *
        FROM birth_names
        WHERE 1=1
        {% if city_filter is defined %}
            AND city = '{{ city_filter }}'
        {% endif %}
        LIMIT {{ limit | default(100) }}"""

    data = {"sql": sql_with_jinja, "schema": "public", "template_params": {}}

    command = ValidateSQLCommand(model_id=1, data=data)
    result = command.run()

    # Verify template processor was called
    get_template_processor.assert_called_once_with(database)
    template_processor.process_template.assert_called_once_with(sql_with_jinja)

    # Verify validator was called with rendered SQL (not Jinja)
    validator.validate.assert_called_once()
    assert result == []


def test_validate_sql_with_jinja_templates_and_params(mocker: MockerFixture) -> None:
    """
    Test that Jinja templates are rendered with parameters before SQL validation.
    """
    # Mock the database
    database = mocker.MagicMock()
    database.id = 1
    database.db_engine_spec.engine = "postgresql"

    # Mock DatabaseDAO
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate_sql.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = database

    # Mock the validator
    validator = mocker.MagicMock()
    validator.name = "PostgreSQLValidator"
    validator.validate.return_value = []
    get_validator_by_name = mocker.patch(
        "superset.commands.database.validate_sql.get_validator_by_name"
    )
    get_validator_by_name.return_value = validator

    # Mock the template processor
    template_processor = mocker.MagicMock()
    template_processor.process_template.return_value = (
        "SELECT *\nFROM birth_names\nWHERE 1=1\n    AND city = 'New York'\nLIMIT 50"
    )
    get_template_processor = mocker.patch(
        "superset.commands.database.validate_sql.get_template_processor"
    )
    get_template_processor.return_value = template_processor

    # Mock the config
    mocker.patch(
        "superset.commands.database.validate_sql.app.config",
        {
            "SQL_VALIDATORS_BY_ENGINE": {"postgresql": "PostgreSQLValidator"},
            "SQLLAB_VALIDATION_TIMEOUT": 30,
        },
    )

    # Test SQL with Jinja templates
    sql_with_jinja = """SELECT *
        FROM birth_names
        WHERE 1=1
        {% if city_filter is defined %}
            AND city = '{{ city_filter }}'
        {% endif %}
        LIMIT {{ limit }}"""

    template_params = {"city_filter": "New York", "limit": 50}
    data = {
        "sql": sql_with_jinja,
        "schema": "public",
        "template_params": template_params,
    }

    command = ValidateSQLCommand(model_id=1, data=data)
    result = command.run()

    # Verify template processor was called with parameters
    get_template_processor.assert_called_once_with(database)
    template_processor.process_template.assert_called_once_with(
        sql_with_jinja, **template_params
    )

    # Verify validator was called with rendered SQL (not Jinja)
    validator.validate.assert_called_once()
    assert result == []


def test_validate_sql_without_jinja_templates(mocker: MockerFixture) -> None:
    """
    Test that regular SQL without Jinja templates still works.
    """
    # Mock the database
    database = mocker.MagicMock()
    database.id = 1
    database.db_engine_spec.engine = "postgresql"

    # Mock DatabaseDAO
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate_sql.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = database

    # Mock the validator
    validator = mocker.MagicMock()
    validator.name = "PostgreSQLValidator"
    validator.validate.return_value = []
    get_validator_by_name = mocker.patch(
        "superset.commands.database.validate_sql.get_validator_by_name"
    )
    get_validator_by_name.return_value = validator

    # Mock the template processor
    template_processor = mocker.MagicMock()
    simple_sql = "SELECT * FROM birth_names LIMIT 100"
    template_processor.process_template.return_value = simple_sql
    get_template_processor = mocker.patch(
        "superset.commands.database.validate_sql.get_template_processor"
    )
    get_template_processor.return_value = template_processor

    # Mock the config
    mocker.patch(
        "superset.commands.database.validate_sql.app.config",
        {
            "SQL_VALIDATORS_BY_ENGINE": {"postgresql": "PostgreSQLValidator"},
            "SQLLAB_VALIDATION_TIMEOUT": 30,
        },
    )

    data = {"sql": simple_sql, "schema": "public", "template_params": {}}

    command = ValidateSQLCommand(model_id=1, data=data)
    result = command.run()

    # Verify template processor was still called (even for non-Jinja SQL)
    get_template_processor.assert_called_once_with(database)
    template_processor.process_template.assert_called_once()

    # Verify validator was called
    validator.validate.assert_called_once()
    assert result == []


def test_validate_sql_template_syntax_error(mocker: MockerFixture) -> None:
    """
    Test that template syntax errors are properly surfaced to the client.

    When template processing raises a SupersetSyntaxErrorException (e.g.,
    invalid Jinja2 syntax, undefined variables), it should be caught and
    converted to a ValidatorSQL400Error with detailed error information
    including line numbers.
    """
    # Mock the database
    database = mocker.MagicMock()
    database.id = 1
    database.db_engine_spec.engine = "postgresql"

    # Mock DatabaseDAO
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate_sql.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = database

    # Mock the validator
    validator = mocker.MagicMock()
    validator.name = "PostgreSQLValidator"
    get_validator_by_name = mocker.patch(
        "superset.commands.database.validate_sql.get_validator_by_name"
    )
    get_validator_by_name.return_value = validator

    # Mock the template processor to raise a SupersetSyntaxErrorException
    template_processor = mocker.MagicMock()
    syntax_error = SupersetError(
        message="Jinja2 template error (UndefinedError): 'city_filter' is undefined",
        error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
        level=ErrorLevel.ERROR,
        extra={"template": "SELECT * FROM...", "line": 3},
    )
    template_processor.process_template.side_effect = SupersetSyntaxErrorException(
        [syntax_error]
    )
    get_template_processor = mocker.patch(
        "superset.commands.database.validate_sql.get_template_processor"
    )
    get_template_processor.return_value = template_processor

    # Mock the config
    mocker.patch(
        "superset.commands.database.validate_sql.app.config",
        {
            "SQL_VALIDATORS_BY_ENGINE": {"postgresql": "PostgreSQLValidator"},
            "SQLLAB_VALIDATION_TIMEOUT": 30,
        },
    )

    # SQL with undefined Jinja variable
    sql_with_undefined_var = """SELECT *
        FROM birth_names
        WHERE city = '{{ city_filter }}'
        LIMIT 100"""

    data = {
        "sql": sql_with_undefined_var,
        "schema": "public",
        "template_params": {},
    }

    command = ValidateSQLCommand(model_id=1, data=data)

    # Verify that syntax error is caught and surfaced as ValidatorSQL400Error
    with pytest.raises(ValidatorSQL400Error) as exc_info:
        command.run()

    # Verify the error contains detailed information
    error = exc_info.value
    assert error.error.message is not None
    assert "'city_filter' is undefined" in error.error.message

    # Verify the validator was never called (since template processing failed)
    validator.validate.assert_not_called()


def test_validate_sql_template_processing_error(mocker: MockerFixture) -> None:
    """
    Test that internal template processing errors are properly surfaced to the client.

    When template processing raises a SupersetTemplateException (e.g., recursion,
    unexpected failures), it should be caught and converted to a ValidatorSQL400Error
    with an appropriate error message.
    """
    # Mock the database
    database = mocker.MagicMock()
    database.id = 1
    database.db_engine_spec.engine = "postgresql"

    # Mock DatabaseDAO
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate_sql.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = database

    # Mock the validator
    validator = mocker.MagicMock()
    validator.name = "PostgreSQLValidator"
    get_validator_by_name = mocker.patch(
        "superset.commands.database.validate_sql.get_validator_by_name"
    )
    get_validator_by_name.return_value = validator

    # Mock the template processor to raise a SupersetTemplateException
    template_processor = mocker.MagicMock()
    template_processor.process_template.side_effect = SupersetTemplateException(
        "Infinite recursion detected in template"
    )
    get_template_processor = mocker.patch(
        "superset.commands.database.validate_sql.get_template_processor"
    )
    get_template_processor.return_value = template_processor

    # Mock the config
    mocker.patch(
        "superset.commands.database.validate_sql.app.config",
        {
            "SQL_VALIDATORS_BY_ENGINE": {"postgresql": "PostgreSQLValidator"},
            "SQLLAB_VALIDATION_TIMEOUT": 30,
        },
    )

    # SQL that causes template recursion
    sql_with_recursion = """SELECT * FROM birth_names LIMIT 100"""

    data = {
        "sql": sql_with_recursion,
        "schema": "public",
        "template_params": {},
    }

    command = ValidateSQLCommand(model_id=1, data=data)

    # Verify that template error is caught and surfaced as ValidatorSQL400Error
    with pytest.raises(ValidatorSQL400Error) as exc_info:
        command.run()

    # Verify the error contains helpful information
    error = exc_info.value
    assert error.error.message is not None
    assert "Template processing failed" in error.error.message
    assert "Infinite recursion" in error.error.message

    # Verify the validator was never called (since template processing failed)
    validator.validate.assert_not_called()


def test_validate_sql_generic_exception(mocker: MockerFixture) -> None:
    """
    Test that unexpected exceptions are still caught and handled gracefully.

    When an unexpected exception occurs (not template-related), it should be caught
    and converted to a ValidatorSQLError with the validator name in the message.
    """
    # Mock the database
    database = mocker.MagicMock()
    database.id = 1
    database.db_engine_spec.engine = "postgresql"

    # Mock DatabaseDAO
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate_sql.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = database

    # Mock the validator
    validator = mocker.MagicMock()
    validator.name = "PostgreSQLValidator"
    get_validator_by_name = mocker.patch(
        "superset.commands.database.validate_sql.get_validator_by_name"
    )
    get_validator_by_name.return_value = validator

    # Mock the template processor to raise a generic exception
    template_processor = mocker.MagicMock()
    template_processor.process_template.side_effect = RuntimeError(
        "Unexpected error occurred"
    )
    get_template_processor = mocker.patch(
        "superset.commands.database.validate_sql.get_template_processor"
    )
    get_template_processor.return_value = template_processor

    # Mock the config
    mocker.patch(
        "superset.commands.database.validate_sql.app.config",
        {
            "SQL_VALIDATORS_BY_ENGINE": {"postgresql": "PostgreSQLValidator"},
            "SQLLAB_VALIDATION_TIMEOUT": 30,
        },
    )

    data = {
        "sql": "SELECT * FROM birth_names",
        "schema": "public",
        "template_params": {},
    }

    command = ValidateSQLCommand(model_id=1, data=data)

    # Verify that generic error is caught and surfaced as ValidatorSQLError
    with pytest.raises(ValidatorSQLError) as exc_info:
        command.run()

    # Verify the error contains the validator name and exception message
    error = exc_info.value
    assert error.error.message is not None
    assert "PostgreSQLValidator" in error.error.message
    assert "Unexpected error occurred" in error.error.message

    # Verify the validator was never called
    validator.validate.assert_not_called()
