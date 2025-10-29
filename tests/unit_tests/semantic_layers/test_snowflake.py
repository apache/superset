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

from contextlib import nullcontext
from typing import Iterator
from unittest.mock import MagicMock, patch

import pytest
from pandas import DataFrame
from pytest_mock import MockerFixture

from superset.semantic_layers.snowflake_ import (
    get_connection_parameters,
    SnowflakeConfiguration,
    SnowflakeSemanticLayer,
    SnowflakeSemanticView,
    substitute_parameters,
    validate_order_by,
)
from superset.semantic_layers.types import (
    AdhocFilter,
    DATE,
    Dimension,
    Filter,
    GroupLimit,
    INTEGER,
    Metric,
    NUMBER,
    Operator,
    OrderDirection,
    PredicateType,
    SemanticRequest,
    STRING,
)


@pytest.fixture
def configuration() -> SnowflakeConfiguration:
    return SnowflakeConfiguration.model_validate(
        {
            "account_identifier": "abcdefg-hij01234",
            "role": "ACCOUNTADMIN",
            "warehouse": "COMPUTE_WH",
            "database": "SAMPLE_DATA",
            "schema": "TPCDS_SF10TCL",
            "auth": {
                "auth_type": "user_password",
                "username": "SNOWFLAKE_USER",
                "password": "SNOWFLAKE_PASSWORD",
            },
            "allow_changing_database": True,
            "allow_changing_schema": True,
        }
    )


# These fixtures reproduce the semantic view from
# https://quickstarts.snowflake.com/guide/snowflake-semantic-view/index.html
@pytest.fixture
def dimension_rows() -> list[dict[str, str]]:
    return [
        dict(
            zip(
                ["object_name", "property", "property_value"],
                row,
                strict=False,
            )
        )
        for row in [
            ("BIRTHYEAR", "TABLE", "CUSTOMER"),
            ("BIRTHYEAR", "EXPRESSION", "C_BIRTH_YEAR"),
            ("BIRTHYEAR", "DATA_TYPE", "NUMBER(38,0)"),
            ("COUNTRY", "TABLE", "CUSTOMER"),
            ("COUNTRY", "EXPRESSION", "C_BIRTH_COUNTRY"),
            ("COUNTRY", "DATA_TYPE", "VARCHAR(20)"),
            ("C_CUSTOMER_SK", "TABLE", "CUSTOMER"),
            ("C_CUSTOMER_SK", "EXPRESSION", "c_customer_sk"),
            ("C_CUSTOMER_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("DATE", "TABLE", "DATE"),
            ("DATE", "EXPRESSION", "D_DATE"),
            ("DATE", "DATA_TYPE", "DATE"),
            ("D_DATE_SK", "TABLE", "DATE"),
            ("D_DATE_SK", "EXPRESSION", "d_date_sk"),
            ("D_DATE_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("MONTH", "TABLE", "DATE"),
            ("MONTH", "EXPRESSION", "D_MOY"),
            ("MONTH", "DATA_TYPE", "NUMBER(38,0)"),
            ("WEEK", "TABLE", "DATE"),
            ("WEEK", "EXPRESSION", "D_WEEK_SEQ"),
            ("WEEK", "DATA_TYPE", "NUMBER(38,0)"),
            ("YEAR", "TABLE", "DATE"),
            ("YEAR", "EXPRESSION", "D_YEAR"),
            ("YEAR", "DATA_TYPE", "NUMBER(38,0)"),
            ("CD_DEMO_SK", "TABLE", "DEMO"),
            ("CD_DEMO_SK", "EXPRESSION", "cd_demo_sk"),
            ("CD_DEMO_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("CREDIT_RATING", "TABLE", "DEMO"),
            ("CREDIT_RATING", "EXPRESSION", "CD_CREDIT_RATING"),
            ("CREDIT_RATING", "DATA_TYPE", "VARCHAR(10)"),
            ("MARITAL_STATUS", "TABLE", "DEMO"),
            ("MARITAL_STATUS", "EXPRESSION", "CD_MARITAL_STATUS"),
            ("MARITAL_STATUS", "DATA_TYPE", "VARCHAR(1)"),
            ("BRAND", "TABLE", "ITEM"),
            ("BRAND", "EXPRESSION", "I_BRAND"),
            ("BRAND", "DATA_TYPE", "VARCHAR(50)"),
            ("CATEGORY", "TABLE", "ITEM"),
            ("CATEGORY", "EXPRESSION", "I_CATEGORY"),
            ("CATEGORY", "DATA_TYPE", "VARCHAR(50)"),
            ("CLASS", "TABLE", "ITEM"),
            ("CLASS", "EXPRESSION", "I_CLASS"),
            ("CLASS", "DATA_TYPE", "VARCHAR(50)"),
            ("I_ITEM_SK", "TABLE", "ITEM"),
            ("I_ITEM_SK", "EXPRESSION", "i_item_sk"),
            ("I_ITEM_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("MARKET", "TABLE", "STORE"),
            ("MARKET", "EXPRESSION", "S_MARKET_ID"),
            ("MARKET", "DATA_TYPE", "NUMBER(38,0)"),
            ("SQUAREFOOTAGE", "TABLE", "STORE"),
            ("SQUAREFOOTAGE", "EXPRESSION", "S_FLOOR_SPACE"),
            ("SQUAREFOOTAGE", "DATA_TYPE", "NUMBER(38,0)"),
            ("STATE", "TABLE", "STORE"),
            ("STATE", "EXPRESSION", "S_STATE"),
            ("STATE", "DATA_TYPE", "VARCHAR(2)"),
            ("STORECOUNTRY", "TABLE", "STORE"),
            ("STORECOUNTRY", "EXPRESSION", "S_COUNTRY"),
            ("STORECOUNTRY", "DATA_TYPE", "VARCHAR(20)"),
            ("S_STORE_SK", "TABLE", "STORE"),
            ("S_STORE_SK", "EXPRESSION", "s_store_sk"),
            ("S_STORE_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_CDEMO_SK", "TABLE", "STORESALES"),
            ("SS_CDEMO_SK", "EXPRESSION", "ss_cdemo_sk"),
            ("SS_CDEMO_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_CUSTOMER_SK", "TABLE", "STORESALES"),
            ("SS_CUSTOMER_SK", "EXPRESSION", "ss_customer_sk"),
            ("SS_CUSTOMER_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_ITEM_SK", "TABLE", "STORESALES"),
            ("SS_ITEM_SK", "EXPRESSION", "ss_item_sk"),
            ("SS_ITEM_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_SOLD_DATE_SK", "TABLE", "STORESALES"),
            ("SS_SOLD_DATE_SK", "EXPRESSION", "ss_sold_date_sk"),
            ("SS_SOLD_DATE_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_STORE_SK", "TABLE", "STORESALES"),
            ("SS_STORE_SK", "EXPRESSION", "ss_store_sk"),
            ("SS_STORE_SK", "DATA_TYPE", "NUMBER(38,0)"),
        ]
    ]


@pytest.fixture
def metric_rows() -> list[dict[str, str]]:
    return [
        dict(
            zip(
                ["object_name", "property", "property_value"],
                row,
                strict=False,
            )
        )
        for row in [
            ("TOTALCOST", "TABLE", "STORESALES"),
            ("TOTALCOST", "EXPRESSION", "SUM(item.cost)"),
            ("TOTALCOST", "DATA_TYPE", "NUMBER(19,2)"),
            ("TOTALSALESPRICE", "TABLE", "STORESALES"),
            ("TOTALSALESPRICE", "EXPRESSION", "SUM(SS_SALES_PRICE)"),
            ("TOTALSALESPRICE", "DATA_TYPE", "NUMBER(19,2)"),
            ("TOTALSALESQUANTITY", "TABLE", "STORESALES"),
            ("TOTALSALESQUANTITY", "EXPRESSION", "SUM(SS_QUANTITY)"),
            ("TOTALSALESQUANTITY", "DATA_TYPE", "NUMBER(38,0)"),
        ]
    ]


@pytest.fixture
def connection(mocker: MockerFixture) -> Iterator[MagicMock]:
    """
    Mock the Snowflake connect function to return a mock connection.
    """
    connect = mocker.patch("superset.semantic_layers.snowflake_.connect")
    with connect() as connection:
        yield connection


@pytest.fixture
def semantic_view(
    mocker: MockerFixture,
    connection: MagicMock,
    configuration: SnowflakeConfiguration,
    dimension_rows: list[dict[str, str]],
    metric_rows: list[dict[str, str]],
) -> SnowflakeSemanticView:
    """
    Mock the SnowflakeSemanticView to return predefined dimensions and metrics.
    """
    connection.cursor().execute().fetchall.side_effect = [
        dimension_rows,
        metric_rows,
    ]

    return SnowflakeSemanticView(configuration, "TPCDS_SEMANTIC_VIEW_SM")


@pytest.mark.parametrize(
    "query, parameters, expected",
    [
        # No parameters
        ("SELECT * FROM table", None, "SELECT * FROM table"),
        ("SELECT * FROM table", [], "SELECT * FROM table"),
        # NULL values
        (
            "SELECT * FROM table WHERE id = ?",
            [None],
            "SELECT * FROM table WHERE id = NULL",
        ),
        # Integer values
        (
            "SELECT * FROM table WHERE id = ?",
            [123],
            "SELECT * FROM table WHERE id = 123",
        ),
        (
            "SELECT * FROM table WHERE id = ? AND status = ?",
            [123, 456],
            "SELECT * FROM table WHERE id = 123 AND status = 456",
        ),
        # Float values
        (
            "SELECT * FROM table WHERE price = ?",
            [99.99],
            "SELECT * FROM table WHERE price = 99.99",
        ),
        (
            "SELECT * FROM table WHERE price BETWEEN ? AND ?",
            [10.5, 99.99],
            "SELECT * FROM table WHERE price BETWEEN 10.5 AND 99.99",
        ),
        # Boolean values
        (
            "SELECT * FROM table WHERE active = ?",
            [True],
            "SELECT * FROM table WHERE active = TRUE",
        ),
        (
            "SELECT * FROM table WHERE active = ? AND deleted = ?",
            [True, False],
            "SELECT * FROM table WHERE active = TRUE AND deleted = FALSE",
        ),
        # String values
        (
            "SELECT * FROM table WHERE name = ?",
            ["John"],
            "SELECT * FROM table WHERE name = 'John'",
        ),
        (
            "SELECT * FROM table WHERE name = ? OR name = ?",
            ["John", "Jane"],
            "SELECT * FROM table WHERE name = 'John' OR name = 'Jane'",
        ),
        # String with single quotes (should be escaped)
        (
            "SELECT * FROM table WHERE name = ?",
            ["O'Brien"],
            "SELECT * FROM table WHERE name = 'O''Brien'",
        ),
        (
            "SELECT * FROM table WHERE text = ?",
            ["It's a test"],
            "SELECT * FROM table WHERE text = 'It''s a test'",
        ),
        # Mixed types
        (
            (
                "SELECT * FROM table WHERE name = ? "
                "AND age = ? AND active = ? AND salary = ?"
            ),
            ["John", 30, True, 50000.5],
            (
                "SELECT * FROM table WHERE name = 'John' "
                "AND age = 30 AND active = TRUE AND salary = 50000.5"
            ),
        ),
        (
            "SELECT * FROM table WHERE col1 = ? AND col2 = ? AND col3 = ?",
            [None, "test", 42],
            "SELECT * FROM table WHERE col1 = NULL AND col2 = 'test' AND col3 = 42",
        ),
    ],
)
def test_substitute_parameters(
    query: str,
    parameters: list | None,
    expected: str,
) -> None:
    """
    Test parameter substitution for various types and combinations.
    """
    assert substitute_parameters(query, parameters) == expected


@pytest.mark.parametrize(
    "definition, should_raise",
    [
        # Valid simple cases
        ("column_name", False),
        ("COUNT(*)", False),
        ("SUM(amount)", False),
        ("table.column", False),
        ("schema.table.column", False),
        # Valid with direction
        ("column_name ASC", False),
        ("column_name DESC", False),
        ("COUNT(*) DESC", False),
        ("SUM(revenue) ASC", False),
        # Valid with NULLS handling
        ("column_name NULLS FIRST", False),
        ("column_name NULLS LAST", False),
        ("column_name ASC NULLS FIRST", False),
        ("column_name DESC NULLS LAST", False),
        ("COUNT(*) DESC NULLS FIRST", False),
        # Valid complex expressions
        ("gender ASC, COUNT(*)", False),
        ("gender ASC, COUNT(*) DESC", False),
        ("col1 ASC, col2 DESC, col3", False),
        ("CASE WHEN x > 0 THEN 1 ELSE 0 END", False),
        ("CAST(column AS INTEGER)", False),
        ("UPPER(name)", False),
        ("CONCAT(first_name, ' ', last_name)", False),
        # Valid with mixed complexity
        ("table.column ASC NULLS FIRST, COUNT(*) DESC", False),
        ("schema.table.col1, func(col2) DESC NULLS LAST", False),
        # Invalid - SQL injection attempts with semicolons
        ("column_name; DROP TABLE users;", True),
        ("column_name; DELETE FROM data; --", True),
        ("name; UPDATE users SET admin=1; --", True),
        # Invalid - SQL injection with multiple statements
        ("col1; SELECT * FROM passwords", True),
        ("col1; INSERT INTO logs VALUES(1)", True),
        # Edge cases - incomplete syntax
        ("column/*", True),
    ],
)
def test_validate_order_by(definition: str, should_raise: bool) -> None:
    """
    Test ORDER BY validation for valid expressions and SQL injection prevention.
    """
    context = (
        pytest.raises(ValueError, match="Invalid ORDER BY")
        if should_raise
        else nullcontext()
    )
    with context:
        validate_order_by(definition)


@pytest.mark.parametrize(
    "configuration, expected",
    [
        # Minimal UserPasswordAuth configuration
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
            {
                "account": "test_account",
                "application": "Apache Superset",
                "paramstyle": "qmark",
                "insecure_mode": True,
                "user": "test_user",
                "password": "test_password",
            },
        ),
        # Full UserPasswordAuth configuration
        (
            {
                "account_identifier": "test_account",
                "role": "ACCOUNTADMIN",
                "warehouse": "COMPUTE_WH",
                "database": "TEST_DB",
                "schema": "PUBLIC",
                "auth": {
                    "auth_type": "user_password",
                    "username": "admin",
                    "password": "secret123",
                },
            },
            {
                "account": "test_account",
                "application": "Apache Superset",
                "paramstyle": "qmark",
                "insecure_mode": True,
                "role": "ACCOUNTADMIN",
                "warehouse": "COMPUTE_WH",
                "database": "TEST_DB",
                "schema": "PUBLIC",
                "user": "admin",
                "password": "secret123",
            },
        ),
        # UserPasswordAuth with some optional fields
        (
            {
                "account_identifier": "mycompany.us-east-1",
                "warehouse": "ETL_WH",
                "database": "ANALYTICS",
                "auth": {
                    "auth_type": "user_password",
                    "username": "analyst",
                    "password": "p@ssw0rd",
                },
                "allow_changing_schema": True,
            },
            {
                "account": "mycompany.us-east-1",
                "application": "Apache Superset",
                "paramstyle": "qmark",
                "insecure_mode": True,
                "warehouse": "ETL_WH",
                "database": "ANALYTICS",
                "user": "analyst",
                "password": "p@ssw0rd",
            },
        ),
    ],
)
def test_get_connection_parameters(
    configuration: dict,
    expected: dict,
) -> None:
    """
    Test connection parameter generation for various configurations.
    """
    # Create configuration from params
    config = SnowflakeConfiguration(**configuration)

    # Get connection parameters
    result = get_connection_parameters(config)

    # Check that all expected keys are present with correct values
    for key, value in expected.items():
        assert key in result, f"Expected key '{key}' not found in result"
        assert result[key] == value, f"Expected {key}={value}, got {result[key]}"

    # Verify no unexpected keys
    assert set(result.keys()) == set(expected.keys())


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
        with patch("superset.semantic_layers.snowflake_.connect") as mock_connect:
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
    with patch("superset.semantic_layers.snowflake_.connect") as mock_connect:
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


def test_get_dimensions(
    mocker: MockerFixture,
    connection: MagicMock,
    semantic_view: SnowflakeSemanticView,
) -> None:
    """
    Test dimension retrieval and parsing from Snowflake semantic layer.
    """
    assert semantic_view.dimensions == {
        Dimension(
            id="CUSTOMER.C_CUSTOMER_SK",
            name="C_CUSTOMER_SK",
            type=INTEGER,
            definition=None,
            description="c_customer_sk",
            grain=None,
        ),
        Dimension(
            id="STORE.SQUAREFOOTAGE",
            name="SQUAREFOOTAGE",
            type=INTEGER,
            definition=None,
            description="S_FLOOR_SPACE",
            grain=None,
        ),
        Dimension(
            id="ITEM.BRAND",
            name="BRAND",
            type=STRING,
            definition=None,
            description="I_BRAND",
            grain=None,
        ),
        Dimension(
            id="ITEM.CATEGORY",
            name="CATEGORY",
            type=STRING,
            definition=None,
            description="I_CATEGORY",
            grain=None,
        ),
        Dimension(
            id="STORE.S_STORE_SK",
            name="S_STORE_SK",
            type=INTEGER,
            definition=None,
            description="s_store_sk",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_CUSTOMER_SK",
            name="SS_CUSTOMER_SK",
            type=INTEGER,
            definition=None,
            description="ss_customer_sk",
            grain=None,
        ),
        Dimension(
            id="DATE.DATE",
            name="DATE",
            type=DATE,
            definition=None,
            description="D_DATE",
            grain=None,
        ),
        Dimension(
            id="DEMO.CD_DEMO_SK",
            name="CD_DEMO_SK",
            type=INTEGER,
            definition=None,
            description="cd_demo_sk",
            grain=None,
        ),
        Dimension(
            id="DATE.MONTH",
            name="MONTH",
            type=INTEGER,
            definition=None,
            description="D_MOY",
            grain=None,
        ),
        Dimension(
            id="STORE.MARKET",
            name="MARKET",
            type=INTEGER,
            definition=None,
            description="S_MARKET_ID",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_ITEM_SK",
            name="SS_ITEM_SK",
            type=INTEGER,
            definition=None,
            description="ss_item_sk",
            grain=None,
        ),
        Dimension(
            id="STORE.STORECOUNTRY",
            name="STORECOUNTRY",
            type=STRING,
            definition=None,
            description="S_COUNTRY",
            grain=None,
        ),
        Dimension(
            id="ITEM.CLASS",
            name="CLASS",
            type=STRING,
            definition=None,
            description="I_CLASS",
            grain=None,
        ),
        Dimension(
            id="CUSTOMER.COUNTRY",
            name="COUNTRY",
            type=STRING,
            definition=None,
            description="C_BIRTH_COUNTRY",
            grain=None,
        ),
        Dimension(
            id="DEMO.CREDIT_RATING",
            name="CREDIT_RATING",
            type=STRING,
            definition=None,
            description="CD_CREDIT_RATING",
            grain=None,
        ),
        Dimension(
            id="DATE.WEEK",
            name="WEEK",
            type=INTEGER,
            definition=None,
            description="D_WEEK_SEQ",
            grain=None,
        ),
        Dimension(
            id="DATE.D_DATE_SK",
            name="D_DATE_SK",
            type=INTEGER,
            definition=None,
            description="d_date_sk",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_SOLD_DATE_SK",
            name="SS_SOLD_DATE_SK",
            type=INTEGER,
            definition=None,
            description="ss_sold_date_sk",
            grain=None,
        ),
        Dimension(
            id="CUSTOMER.BIRTHYEAR",
            name="BIRTHYEAR",
            type=INTEGER,
            definition=None,
            description="C_BIRTH_YEAR",
            grain=None,
        ),
        Dimension(
            id="DEMO.MARITAL_STATUS",
            name="MARITAL_STATUS",
            type=STRING,
            definition=None,
            description="CD_MARITAL_STATUS",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_CDEMO_SK",
            name="SS_CDEMO_SK",
            type=INTEGER,
            definition=None,
            description="ss_cdemo_sk",
            grain=None,
        ),
        Dimension(
            id="DATE.YEAR",
            name="YEAR",
            type=INTEGER,
            definition=None,
            description="D_YEAR",
            grain=None,
        ),
        Dimension(
            id="ITEM.I_ITEM_SK",
            name="I_ITEM_SK",
            type=INTEGER,
            definition=None,
            description="i_item_sk",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_STORE_SK",
            name="SS_STORE_SK",
            type=INTEGER,
            definition=None,
            description="ss_store_sk",
            grain=None,
        ),
        Dimension(
            id="STORE.STATE",
            name="STATE",
            type=STRING,
            definition=None,
            description="S_STATE",
            grain=None,
        ),
    }

    connection.cursor().execute.assert_any_call(
        """
DESC SEMANTIC VIEW "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    ->> SELECT "object_name", "property", "property_value"
        FROM $1
        WHERE
            "object_kind" = 'DIMENSION' AND
            "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
        """.strip()
    )


def test_get_metrics(
    mocker: MockerFixture,
    connection: MagicMock,
    semantic_view: SnowflakeSemanticView,
) -> None:
    """
    Test metric retrieval and parsing from Snowflake semantic layer.
    """
    assert semantic_view.metrics == {
        Metric(
            id="STORESALES.TOTALCOST",
            name="TOTALCOST",
            type=NUMBER,
            definition="SUM(item.cost)",
            description=None,
        ),
        Metric(
            id="STORESALES.TOTALSALESQUANTITY",
            name="TOTALSALESQUANTITY",
            type=INTEGER,
            definition="SUM(SS_QUANTITY)",
            description=None,
        ),
        Metric(
            id="STORESALES.TOTALSALESPRICE",
            name="TOTALSALESPRICE",
            type=NUMBER,
            definition="SUM(SS_SALES_PRICE)",
            description=None,
        ),
    }

    connection.cursor().execute.assert_any_call(
        """
DESC SEMANTIC VIEW "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    ->> SELECT "object_name", "property", "property_value"
        FROM $1
        WHERE
            "object_kind" = 'METRIC' AND
            "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
        """.strip()
    )


def test_get_values(
    mocker: MockerFixture,
    connection: MagicMock,
    semantic_view: SnowflakeSemanticView,
) -> None:
    connection.cursor().execute().fetch_pandas_all.return_value = DataFrame(
        {
            "CATEGORY": [
                "Music",
                "Women",
                "Home",
                "Children",
                "Men",
                "Electronics",
                "Sports",
                "Shoes",
                "Jewelry",
                "Books",
                None,
            ]
        }
    )

    dimension = Dimension(
        id="ITEM.CATEGORY",
        name="CATEGORY",
        type=STRING,
        description=None,
        definition="I_CATEGORY",
        grain=None,
    )

    result = semantic_view.get_values(dimension)

    assert result.requests == [
        SemanticRequest(
            type="snowflake",
            definition="""
SELECT "CATEGORY"
FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    DIMENSIONS ITEM.CATEGORY

)
            """.strip(),
        )
    ]
    assert result.results["CATEGORY"].tolist() == [
        "Music",
        "Women",
        "Home",
        "Children",
        "Men",
        "Electronics",
        "Sports",
        "Shoes",
        "Jewelry",
        "Books",
        None,
    ]


def test_get_values_with_filters(
    mocker: MockerFixture,
    connection: MagicMock,
    semantic_view: SnowflakeSemanticView,
) -> None:
    connection.cursor().execute().fetch_pandas_all.return_value = DataFrame(
        {
            "CATEGORY": [
                "Music",
                "Women",
                "Home",
                "Children",
                "Men",
                "Electronics",
                "Sports",
                "Shoes",
                "Jewelry",
            ]
        }
    )

    dimension = Dimension(
        id="ITEM.CATEGORY",
        name="CATEGORY",
        type=STRING,
        description=None,
        definition="I_CATEGORY",
        grain=None,
    )
    filters = {
        Filter(PredicateType.WHERE, dimension, Operator.NOT_EQUALS, "Books"),
        Filter(PredicateType.WHERE, dimension, Operator.IS_NOT_NULL, None),
    }

    result = semantic_view.get_values(dimension, filters)

    assert result.requests == [
        SemanticRequest(
            type="snowflake",
            definition="""
SELECT "CATEGORY"
FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    DIMENSIONS ITEM.CATEGORY
    WHERE ("CATEGORY" != 'Books') AND ("CATEGORY" IS NOT NULL)
)
            """.strip(),
        )
    ]
    assert result.results["CATEGORY"].tolist() == [
        "Music",
        "Women",
        "Home",
        "Children",
        "Men",
        "Electronics",
        "Sports",
        "Shoes",
        "Jewelry",
    ]


@pytest.mark.parametrize(
    "metrics, dimensions, filters, order, limit, offset, sql",
    [
        (
            ["TOTALSALESPRICE"],
            [],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            10,
            10,
            """
SELECT * FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"

    METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
    WHERE (Month = '12') AND (Year = '2002')
)

LIMIT 10
OFFSET 10
            """,
        ),
        (
            [],
            ["CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            20,
            None,
            """
SELECT * FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"

    WHERE (Month = '12') AND (Year = '2002')
)

LIMIT 20
            """,
        ),
        (
            ["TOTALSALESPRICE"],
            ["CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            [
                ("TOTALSALESPRICE", OrderDirection.DESC),
                ("CATEGORY", OrderDirection.ASC),
            ],
            10,
            10,
            """
SELECT * FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
    METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
    WHERE (Month = '12') AND (Year = '2002')
)
ORDER BY "STORESALES.TOTALSALESPRICE" DESC, "ITEM.CATEGORY" ASC
LIMIT 10
OFFSET 10
            """,
        ),
    ],
)
def test_get_query(
    semantic_view: SnowflakeSemanticView,
    metrics: list[str],
    dimensions: list[str],
    filters: set[Filter | AdhocFilter] | None,
    order: list[tuple[str, OrderDirection]] | None,
    limit: int | None,
    offset: int | None,
    sql: str,
) -> None:
    """
    Tests for query generation.
    """
    metric_map = {metric.name: metric for metric in semantic_view.metrics}
    dimension_map = {dim.name: dim for dim in semantic_view.dimensions}

    result_sql, _ = semantic_view._get_query(
        [metric_map[name] for name in metrics],
        [dimension_map[name] for name in dimensions],
        filters,
        [
            (metric_map.get(name) or dimension_map.get(name), direction)
            for name, direction in (order or [])
        ],
        limit,
        offset,
    )

    assert result_sql.strip() == sql.strip()


@pytest.mark.parametrize(
    "metrics, dimensions, filters, order, limit, offset, group_limit_config, sql",
    [
        # Test 1: Basic group limit without group_others
        (
            ["TOTALSALESPRICE"],
            ["YEAR", "CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            None,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 3,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": False,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"
        WHERE (Month = '12') AND (Year = '2002')
    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 3
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS DATE.YEAR AS "DATE.YEAR", ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
                WHERE (Month = '12') AND (Year = '2002')
            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)
            """,
        ),
        # Test 2: Group limit with group_others
        (
            ["TOTALSALESPRICE"],
            ["YEAR", "CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            None,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 3,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": True,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"
        WHERE (Month = '12') AND (Year = '2002')
    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 3
),
            raw_data AS (
    SELECT * FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS DATE.YEAR AS "DATE.YEAR", ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
        WHERE (Month = '12') AND (Year = '2002')
    )
)
            SELECT
                CASE
            WHEN "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups) THEN "ITEM.CATEGORY"
            ELSE CAST('Other' AS VARCHAR)
        END AS "ITEM.CATEGORY",
    "DATE.YEAR" AS "DATE.YEAR",
    SUM("STORESALES.TOTALSALESPRICE") AS "STORESALES.TOTALSALESPRICE"
            FROM raw_data
            GROUP BY CASE
            WHEN "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups) THEN "ITEM.CATEGORY"
            ELSE CAST('Other' AS VARCHAR)
        END, "DATE.YEAR"
            """,
        ),
        # Test 3: Group limit with custom filters (different from main query)
        (
            ["TOTALSALESPRICE"],
            ["YEAR", "CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            None,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 5,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": False,
                "filters": {AdhocFilter(PredicateType.WHERE, "Year = '2001'")},
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"
        WHERE (Year = '2001')
    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 5
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS DATE.YEAR AS "DATE.YEAR", ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
                WHERE (Month = '12') AND (Year = '2002')
            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)
            """,
        ),
        # Test 4: Group limit with ASC direction
        (
            ["TOTALSALESPRICE"],
            ["CATEGORY"],
            None,
            None,
            10,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 5,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.ASC,
                "group_others": False,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"

    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" ASC
    LIMIT 5
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"

            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)

            LIMIT 10
            """,
        ),
        # Test 5: Group limit with order clause
        (
            ["TOTALSALESPRICE"],
            ["YEAR", "CATEGORY"],
            {AdhocFilter(PredicateType.WHERE, "Year = '2002'")},
            [
                ("YEAR", OrderDirection.DESC),
                ("TOTALSALESPRICE", OrderDirection.ASC),
            ],
            None,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 10,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": False,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"
        WHERE (Year = '2002')
    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 10
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS DATE.YEAR AS "DATE.YEAR", ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
                WHERE (Year = '2002')
            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)
            ORDER BY "DATE.YEAR" DESC, "STORESALES.TOTALSALESPRICE" ASC
            """,
        ),
        # Test 6: Group limit with limit and offset
        (
            ["TOTALSALESPRICE"],
            ["CATEGORY"],
            None,
            None,
            20,
            5,
            {
                "dimensions": ["CATEGORY"],
                "top": 3,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": False,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"

    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 3
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"

            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)

            LIMIT 20
            OFFSET 5
            """,
        ),
    ],
)
def test_get_query_with_group_limit(
    semantic_view: SnowflakeSemanticView,
    metrics: list[str],
    dimensions: list[str],
    filters: set[Filter | AdhocFilter] | None,
    order: list[tuple[str, OrderDirection]] | None,
    limit: int | None,
    offset: int | None,
    group_limit_config: dict,
    sql: str,
) -> None:
    """
    Tests for query generation with GroupLimit.
    """
    metric_map = {metric.name: metric for metric in semantic_view.metrics}
    dimension_map = {dim.name: dim for dim in semantic_view.dimensions}

    # Build GroupLimit object from config
    group_limit = GroupLimit(
        dimensions=[dimension_map[name] for name in group_limit_config["dimensions"]],
        top=group_limit_config["top"],
        metric=metric_map[group_limit_config["metric"]],
        direction=group_limit_config["direction"],
        group_others=group_limit_config["group_others"],
        filters=group_limit_config["filters"],
    )

    result_sql, _ = semantic_view._get_query(
        [metric_map[name] for name in metrics],
        [dimension_map[name] for name in dimensions],
        filters,
        [
            (metric_map.get(name) or dimension_map.get(name), direction)
            for name, direction in (order or [])
        ],
        limit,
        offset,
        group_limit=group_limit,
    )

    assert result_sql == sql.strip()
