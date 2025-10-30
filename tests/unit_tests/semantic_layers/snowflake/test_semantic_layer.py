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

# flake8: noqa: E501

from unittest.mock import MagicMock, patch

import pytest

from superset.semantic_layers.snowflake import (
    SnowflakeConfiguration,
    SnowflakeSemanticLayer,
)


@pytest.mark.parametrize(
    "configuration, databases, schemas, expected_db_enum, expected_schema_enum",
    [
        # No configuration - empty enums
        (
            None,
            None,
            None,
            [],
            [],
        ),
        # Configuration with account + auth - populates databases
        (
            {
                "account_identifier": "test_account",
                "auth": {
                    "auth_type": "user_password",
                    "username": "test_user",
                    "password": "test_password",
                },
                "allow_changing_database": True,
                "allow_changing_schema": True,
            },
            ["ANALYTICS_DB", "SALES_DB", "MARKETING_DB"],
            None,
            ["ANALYTICS_DB", "SALES_DB", "MARKETING_DB"],
            [],
        ),
        # Configuration with account + auth + database - populates both
        (
            {
                "account_identifier": "test_account",
                "database": "ANALYTICS_DB",
                "auth": {
                    "auth_type": "user_password",
                    "username": "test_user",
                    "password": "test_password",
                },
                "allow_changing_schema": True,
            },
            ["ANALYTICS_DB", "SALES_DB", "MARKETING_DB"],
            ["PUBLIC", "STAGING", "DEV"],
            ["ANALYTICS_DB", "SALES_DB", "MARKETING_DB"],
            ["PUBLIC", "STAGING", "DEV"],
        ),
        # Configuration with account + auth, single database
        (
            {
                "account_identifier": "prod_account",
                "auth": {
                    "auth_type": "user_password",
                    "username": "admin",
                    "password": "secret",
                },
                "allow_changing_database": True,
                "allow_changing_schema": True,
            },
            ["PRODUCTION"],
            None,
            ["PRODUCTION"],
            [],
        ),
    ],
)
def test_get_configuration_schema(
    configuration: dict | None,
    databases: list[str] | None,
    schemas: list[str] | None,
    expected_db_enum: list[str],
    expected_schema_enum: list[str],
) -> None:
    """
    Test configuration schema generation with dynamic database/schema enums.
    """
    if configuration is None:
        # Test without configuration
        schema = SnowflakeSemanticLayer.get_configuration_schema()

        assert "properties" in schema
        assert "database" in schema["properties"]
        assert "schema" in schema["properties"]
        assert schema["properties"]["database"]["enum"] == expected_db_enum
        assert schema["properties"]["schema"]["enum"] == expected_schema_enum
    else:
        # Create configuration
        config = SnowflakeConfiguration(**configuration)

        # Mock the connection and cursor
        mock_cursor = MagicMock()
        mock_connection = MagicMock()
        mock_connection.cursor.return_value = mock_cursor

        # Setup cursor responses
        if databases:
            # SHOW DATABASES returns (name, name, ...)
            mock_cursor.__iter__.return_value = iter(
                [(i, db, "", "", "", "", "") for i, db in enumerate(databases)]
            )

        if schemas:
            # SELECT SCHEMA_NAME returns (schema_name,)
            mock_cursor.execute.return_value = iter([(schema,) for schema in schemas])

        # Mock connect to return our mock connection
        with patch("superset.semantic_layers.snowflake.semantic_layer.connect") as mock_connect:
            mock_connect.return_value.__enter__.return_value = mock_connection

            # Get the schema
            schema = SnowflakeSemanticLayer.get_configuration_schema(config)

            # Verify connect was called
            mock_connect.assert_called_once()

            # Verify schema structure
            assert "properties" in schema
            assert "database" in schema["properties"]
            assert "schema" in schema["properties"]

            # Verify database enum (compare as sets since order isn't guaranteed)
            assert set(schema["properties"]["database"]["enum"]) == set(
                expected_db_enum
            )

            # Verify schema enum (may not have 'enum' key if database not set)
            if expected_schema_enum:
                assert set(schema["properties"]["schema"]["enum"]) == set(
                    expected_schema_enum
                )
            else:
                # When no schemas are expected, enum key may not exist
                # or may be an empty list
                schema_enum = schema["properties"]["schema"].get("enum", [])
                assert set(schema_enum) == set(expected_schema_enum)


@pytest.mark.parametrize(
    "configuration, runtime_data, databases, schemas, expect_database, expect_schema",
    [
        # Database + schema configured, no changing allowed -> empty runtime schema
        (
            {
                "account_identifier": "test_account",
                "database": "ANALYTICS_DB",
                "schema": "PUBLIC",
                "auth": {
                    "auth_type": "user_password",
                    "username": "test_user",
                    "password": "test_password",
                },
                "allow_changing_database": False,
                "allow_changing_schema": False,
            },
            None,
            None,
            None,
            False,
            False,
        ),
        # Database configured, schema not configured -> shows schemas
        (
            {
                "account_identifier": "test_account",
                "database": "ANALYTICS_DB",
                "auth": {
                    "auth_type": "user_password",
                    "username": "test_user",
                    "password": "test_password",
                },
                "allow_changing_schema": True,
            },
            None,
            None,
            ["PUBLIC", "STAGING", "DEV"],
            False,
            True,
        ),
        # Database configured, allow_changing_schema=True -> shows schemas
        (
            {
                "account_identifier": "test_account",
                "database": "ANALYTICS_DB",
                "schema": "PUBLIC",
                "auth": {
                    "auth_type": "user_password",
                    "username": "test_user",
                    "password": "test_password",
                },
                "allow_changing_schema": True,
            },
            None,
            None,
            ["PUBLIC", "STAGING", "DEV"],
            False,
            True,
        ),
        # Database not configured -> shows databases
        (
            {
                "account_identifier": "test_account",
                "auth": {
                    "auth_type": "user_password",
                    "username": "test_user",
                    "password": "test_password",
                },
                "allow_changing_database": True,
                "allow_changing_schema": True,
            },
            None,
            ["ANALYTICS_DB", "SALES_DB"],
            None,
            True,
            True,
        ),
        # Database configured, allow_changing_database=True -> shows databases
        (
            {
                "account_identifier": "test_account",
                "database": "ANALYTICS_DB",
                "schema": "PUBLIC",
                "auth": {
                    "auth_type": "user_password",
                    "username": "test_user",
                    "password": "test_password",
                },
                "allow_changing_database": True,
                "allow_changing_schema": False,
            },
            None,
            ["ANALYTICS_DB", "SALES_DB"],
            None,
            True,
            False,
        ),
        # Runtime data provides database -> shows schemas for that database
        (
            {
                "account_identifier": "test_account",
                "auth": {
                    "auth_type": "user_password",
                    "username": "test_user",
                    "password": "test_password",
                },
                "allow_changing_database": True,
                "allow_changing_schema": True,
            },
            {"database": "SALES_DB"},
            ["ANALYTICS_DB", "SALES_DB"],
            ["SALES_SCHEMA", "CUSTOMER_SCHEMA"],
            True,
            True,
        ),
    ],
)
def test_get_runtime_schema(
    configuration: dict,
    runtime_data: dict | None,
    databases: list[str] | None,
    schemas: list[str] | None,
    expect_database: bool,
    expect_schema: bool,
) -> None:
    """
    Test runtime schema generation with various configuration combinations.

    The runtime schema should only include fields that the user can change:
    - database field if database is not configured or changing is allowed
    - schema field if schema is not configured or changing is allowed
    """
    # Create configuration
    config = SnowflakeConfiguration(**configuration)

    # Mock the connection and cursor
    mock_cursor = MagicMock()
    mock_connection = MagicMock()
    mock_connection.cursor.return_value = mock_cursor

    # Setup cursor responses
    if databases:
        # SHOW DATABASES returns (name, name, ...)
        mock_cursor.__iter__.return_value = iter(
            [(i, db, "", "", "", "", "") for i, db in enumerate(databases)]
        )

    if schemas:
        # SELECT SCHEMA_NAME returns (schema_name,)
        mock_cursor.execute.return_value = iter([(schema,) for schema in schemas])

    # Mock connect to return our mock connection
    with patch("superset.semantic_layers.snowflake.semantic_layer.connect") as mock_connect:
        mock_connect.return_value.__enter__.return_value = mock_connection

        # Get the runtime schema
        schema = SnowflakeSemanticLayer.get_runtime_schema(config, runtime_data)

        # Verify connect was called
        mock_connect.assert_called_once()

        # Verify schema structure
        assert "properties" in schema

        # Verify database field presence
        if expect_database:
            assert "database" in schema["properties"]
            # Should have enum with available databases
            if databases:
                db_enum = schema["properties"]["database"].get("enum", [])
                assert set(db_enum) == set(databases)
        else:
            assert "database" not in schema["properties"]

        # Verify schema field presence
        if expect_schema:
            assert "schema" in schema["properties"]
            # Should have enum with available schemas if we have a database
            if schemas and (
                configuration.get("database")
                or (runtime_data and runtime_data.get("database"))
            ):
                schema_enum = schema["properties"]["schema"].get("enum", [])
                assert set(schema_enum) == set(schemas)
        else:
            assert "schema" not in schema["properties"]
