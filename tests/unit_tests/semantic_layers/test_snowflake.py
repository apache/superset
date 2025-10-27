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

from contextlib import nullcontext

import pytest

from superset.semantic_layers.snowflake_ import (
    get_connection_parameters,
    SnowflakeConfiguration,
    substitute_parameters,
    validate_order_by,
)


@pytest.mark.parametrize(
    "query, parameters, expected",
    [
        # No parameters
        (
            "SELECT * FROM table",
            None,
            "SELECT * FROM table",
        ),
        (
            "SELECT * FROM table",
            [],
            "SELECT * FROM table",
        ),
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
    "config_params, expected_keys",
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
    config_params: dict,
    expected_keys: dict,
) -> None:
    """
    Test connection parameter generation for various configurations.
    """
    # Create configuration from params
    config = SnowflakeConfiguration(**config_params)

    # Get connection parameters
    result = get_connection_parameters(config)

    # Check that all expected keys are present with correct values
    for key, value in expected_keys.items():
        assert key in result, f"Expected key '{key}' not found in result"
        assert result[key] == value, f"Expected {key}={value}, got {result[key]}"

    # Verify no unexpected keys
    assert set(result.keys()) == set(expected_keys.keys())
