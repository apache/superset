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

from pytest_mock import MockerFixture

from superset.commands.database.validate_sql import ValidateSQLCommand


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
