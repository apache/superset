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

# pylint: disable=import-outside-toplevel, protected-access

from __future__ import annotations

import json  # noqa: TID251
import re
from textwrap import dedent
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import Boolean, Column, Integer, types
from sqlalchemy.dialects import sqlite
from sqlalchemy.engine.url import make_url, URL
from sqlalchemy.sql import sqltypes

from superset.db_engine_specs.base import BaseEngineSpec, convert_inspector_columns
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2RedirectError
from superset.sql.parse import Table
from superset.superset_typing import (
    OAuth2ClientConfig,
    OAuth2State,
    ResultSetColumnType,
    SQLAColumnType,
)
from superset.utils.core import FilterOperator, GenericDataType
from superset.utils.oauth2 import decode_oauth2_state
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


def create_expected_superset_error(
    message: str,
    error_type: SupersetErrorType = SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
    engine_name: str | None = None,
) -> SupersetError:
    """
    Helper function to create expected SupersetError objects for testing.
    """
    extra = {
        "engine_name": engine_name,
        "issue_codes": [
            {
                "code": 1002,
                "message": "Issue 1002 - The database returned an unexpected error.",
            }
        ],
    }

    return SupersetError(
        message=message,
        error_type=error_type,
        level=ErrorLevel.ERROR,
        extra=extra,
    )


def test_get_text_clause_with_colon() -> None:
    """
    Make sure text clauses are correctly escaped
    """
    text_clause = BaseEngineSpec.get_text_clause(
        "SELECT foo FROM tbl WHERE foo = '123:456')"
    )
    assert text_clause.text == "SELECT foo FROM tbl WHERE foo = '123\\:456')"


def test_validate_db_uri(mocker: MockerFixture) -> None:
    """
    Ensures that the `validate_database_uri` method invokes the validator correctly
    """

    def mock_validate(sqlalchemy_uri: URL) -> None:
        raise ValueError("Invalid URI")

    mocker.patch(
        "flask.current_app.config",
        {"DB_SQLA_URI_VALIDATOR": mock_validate},
    )

    with pytest.raises(ValueError):  # noqa: PT011
        BaseEngineSpec.validate_database_uri(URL.create("sqlite"))


@pytest.mark.parametrize(
    "original,expected",
    [
        (
            dedent(
                """
with currency as
(
select 'INR' as cur
)
select * from currency
"""
            ),
            None,
        ),
        (
            "SELECT 1 as cnt",
            None,
        ),
        (
            dedent(
                """
select 'INR' as cur
union
select 'AUD' as cur
union
select 'USD' as cur
"""
            ),
            None,
        ),
    ],
)
def test_cte_query_parsing(original: types.TypeEngine, expected: str) -> None:
    actual = BaseEngineSpec.get_cte_query(original)
    assert actual == expected


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("SMALLINT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("INTEGER", types.Integer, None, GenericDataType.NUMERIC, False),
        ("BIGINT", types.BigInteger, None, GenericDataType.NUMERIC, False),
        ("DECIMAL", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("NUMERIC", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("REAL", types.REAL, None, GenericDataType.NUMERIC, False),
        ("DOUBLE PRECISION", types.Float, None, GenericDataType.NUMERIC, False),
        ("MONEY", types.Numeric, None, GenericDataType.NUMERIC, False),
        # String
        ("CHAR", types.String, None, GenericDataType.STRING, False),
        ("VARCHAR", types.String, None, GenericDataType.STRING, False),
        ("TEXT", types.String, None, GenericDataType.STRING, False),
        # Temporal
        ("DATE", types.Date, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, None, GenericDataType.TEMPORAL, True),
        # Boolean
        ("BOOLEAN", types.Boolean, None, GenericDataType.BOOLEAN, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: dict[str, Any] | None,
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.databricks import (
        DatabricksNativeEngineSpec as spec,  # noqa: N813
    )

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "cols, expected_result",
    [
        (
            [SQLAColumnType(name="John", type="integer", is_dttm=False)],
            [
                ResultSetColumnType(
                    column_name="John", name="John", type="integer", is_dttm=False
                )
            ],
        ),
        (
            [SQLAColumnType(name="hugh", type="integer", is_dttm=False)],
            [
                ResultSetColumnType(
                    column_name="hugh", name="hugh", type="integer", is_dttm=False
                )
            ],
        ),
    ],
)
def test_convert_inspector_columns(
    cols: list[SQLAColumnType], expected_result: list[ResultSetColumnType]
):
    assert convert_inspector_columns(cols) == expected_result


def test_select_star(mocker: MockerFixture) -> None:
    """
    Test the ``select_star`` method.
    """
    cols: list[ResultSetColumnType] = [
        {
            "column_name": "a",
            "name": "a",
            "type": sqltypes.String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
            "is_dttm": False,
        },
    ]

    # mock the database so we can compile the query
    database = mocker.MagicMock()
    database.compile_sqla_query = lambda query, catalog, schema: str(
        query.compile(dialect=sqlite.dialect())
    )

    dialect = sqlite.dialect()

    sql = BaseEngineSpec.select_star(
        database=database,
        table=Table("my_table", "my_schema", "my_catalog"),
        dialect=dialect,
        limit=100,
        show_cols=True,
        indent=True,
        latest_partition=False,
        cols=cols,
    )
    assert sql == "SELECT\n  a\nFROM my_schema.my_table\nLIMIT ?\nOFFSET ?"


def test_extra_table_metadata(mocker: MockerFixture) -> None:
    """
    Test the deprecated `extra_table_metadata` method.
    """
    from superset.models.core import Database

    class ThirdPartyDBEngineSpec(BaseEngineSpec):
        @classmethod
        def extra_table_metadata(
            cls,
            database: Database,
            table_name: str,
            schema_name: str | None,
        ) -> dict[str, Any]:
            return {"table": table_name, "schema": schema_name}

    database = mocker.MagicMock()
    warnings = mocker.patch("superset.db_engine_specs.base.warnings")

    assert ThirdPartyDBEngineSpec.get_extra_table_metadata(
        database,
        Table("table", "schema"),
    ) == {"table": "table", "schema": "schema"}

    assert (
        ThirdPartyDBEngineSpec.get_extra_table_metadata(
            database,
            Table("table", "schema", "catalog"),
        )
        == {}
    )

    warnings.warn.assert_called()


def test_get_default_catalog(mocker: MockerFixture) -> None:
    """
    Test the `get_default_catalog` method.
    """
    database = mocker.MagicMock()
    assert BaseEngineSpec.get_default_catalog(database) is None


def test_quote_table() -> None:
    """
    Test the `quote_table` function.
    """

    dialect = sqlite.dialect()

    assert BaseEngineSpec.quote_table(Table("table"), dialect) == '"table"'
    assert (
        BaseEngineSpec.quote_table(Table("table", "schema"), dialect)
        == 'schema."table"'
    )
    assert (
        BaseEngineSpec.quote_table(Table("table", "schema", "catalog"), dialect)
        == 'catalog.schema."table"'
    )
    assert (
        BaseEngineSpec.quote_table(Table("ta ble", "sche.ma", 'cata"log'), dialect)
        == '"cata""log"."sche.ma"."ta ble"'
    )


def test_mask_encrypted_extra() -> None:
    """
    Test that the private key is masked when the database is edited.
    """
    config = json.dumps(
        {
            "foo": "bar",
            "service_account_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )

    assert BaseEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "foo": "XXXXXXXXXX",
            "service_account_info": "XXXXXXXXXX",
        }
    )


def test_unmask_encrypted_extra() -> None:
    """
    Test that the private key can be reused from the previous `encrypted_extra`.
    """
    old = json.dumps(
        {
            "foo": "bar",
            "service_account_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )
    new = json.dumps(
        {
            "foo": "XXXXXXXXXX",
            "service_account_info": "XXXXXXXXXX",
        }
    )

    assert BaseEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {
            "foo": "bar",
            "service_account_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )


@pytest.mark.parametrize(
    "masked_encrypted_extra,expected_result",
    [
        (
            {
                "$.credentials_info.private_key": "Private Key",
                "$.access_token": "Access Token",
            },
            {
                "$.credentials_info.private_key",
                "$.access_token",
            },
        ),
        (
            {
                "$.credentials_info.private_key",
                "$.access_token",
            },
            {
                "$.credentials_info.private_key",
                "$.access_token",
            },
        ),
        (
            None,
            {"$.*"},
        ),
    ],
)
def test_encrypted_extra_sensitive_field_paths_from_dict(
    masked_encrypted_extra: set[str] | dict[str, str] | None,
    expected_result: set[str],
) -> None:
    """
    Test that `encrypted_extra_sensitive_field_paths` extracts the keys
    when `encrypted_extra_sensitive_fields` is a dict.
    """

    class DictFieldsSpec(BaseEngineSpec):
        if masked_encrypted_extra:
            encrypted_extra_sensitive_fields = masked_encrypted_extra

    assert DictFieldsSpec.encrypted_extra_sensitive_field_paths() == expected_result


def test_impersonate_user_backwards_compatible(mocker: MockerFixture) -> None:
    """
    Test that the `impersonate_user` method calls the original methods it replaced.
    """
    database = mocker.MagicMock()
    url = make_url("sqlite://foo.db")
    new_url = make_url("sqlite://bar.db")
    engine_kwargs = {"connect_args": {"user": "alice"}}

    get_url_for_impersonation = mocker.patch.object(
        BaseEngineSpec,
        "get_url_for_impersonation",
        return_value=new_url,
    )
    update_impersonation_config = mocker.patch.object(
        BaseEngineSpec,
        "update_impersonation_config",
    )
    signature = mocker.patch("superset.db_engine_specs.base.signature")
    signature().parameters = [
        "cls",
        "database",
        "connect_args",
        "uri",
        "username",
        "access_token",
    ]

    BaseEngineSpec.impersonate_user(database, "alice", "SECRET", url, engine_kwargs)

    get_url_for_impersonation.assert_called_once_with(url, True, "alice", "SECRET")
    update_impersonation_config.assert_called_once_with(
        database,
        {"user": "alice"},
        new_url,
        "alice",
        "SECRET",
    )


def test_impersonate_user_no_database(mocker: MockerFixture) -> None:
    """
    Test `impersonate_user` when `update_impersonation_config` has an old signature.
    """
    database = mocker.MagicMock()
    url = make_url("sqlite://foo.db")
    new_url = make_url("sqlite://bar.db")
    engine_kwargs = {"connect_args": {"user": "alice"}}

    get_url_for_impersonation = mocker.patch.object(
        BaseEngineSpec,
        "get_url_for_impersonation",
        return_value=new_url,
    )
    update_impersonation_config = mocker.patch.object(
        BaseEngineSpec,
        "update_impersonation_config",
    )
    signature = mocker.patch("superset.db_engine_specs.base.signature")
    signature().parameters = [
        "cls",
        "connect_args",
        "uri",
        "username",
        "access_token",
    ]

    BaseEngineSpec.impersonate_user(database, "alice", "SECRET", url, engine_kwargs)

    get_url_for_impersonation.assert_called_once_with(url, True, "alice", "SECRET")
    update_impersonation_config.assert_called_once_with(
        {"user": "alice"},
        new_url,
        "alice",
        "SECRET",
    )


def test_handle_boolean_filter_default_behavior() -> None:
    """
    Test that BaseEngineSpec uses IS operators for boolean filters by default.
    """
    # Create a mock SQLAlchemy column
    bool_col = Column("test_col", Boolean)

    # Test IS_TRUE filter - should use IS operator by default
    result_true = BaseEngineSpec.handle_boolean_filter(bool_col, "IS TRUE", True)
    assert hasattr(result_true, "left")  # IS comparison has left/right attributes
    assert hasattr(result_true, "right")

    # Test IS_FALSE filter - should use IS operator by default
    result_false = BaseEngineSpec.handle_boolean_filter(bool_col, "IS FALSE", False)
    assert hasattr(result_false, "left")
    assert hasattr(result_false, "right")


def test_handle_boolean_filter_with_equality() -> None:
    """
    Test that BaseEngineSpec can use equality operators when configured.
    """

    # Create a test engine spec that uses equality
    class TestEngineSpec(BaseEngineSpec):
        use_equality_for_boolean_filters = True

    bool_col = Column("test_col", Boolean)

    # Test with equality enabled
    result_true = TestEngineSpec.handle_boolean_filter(bool_col, "IS TRUE", True)
    # Equality comparison should have different structure than IS comparison
    assert str(type(result_true)).endswith("BinaryExpression'>")

    result_false = TestEngineSpec.handle_boolean_filter(bool_col, "IS FALSE", False)
    assert str(type(result_false)).endswith("BinaryExpression'>")


def test_handle_null_filter() -> None:
    """
    Test null/not null filter handling.
    """
    bool_col = Column("test_col", Boolean)

    # Test IS_NULL - use actual FilterOperator values
    result_null = BaseEngineSpec.handle_null_filter(bool_col, FilterOperator.IS_NULL)
    assert hasattr(result_null, "left")
    assert hasattr(result_null, "right")

    # Test IS_NOT_NULL
    result_not_null = BaseEngineSpec.handle_null_filter(
        bool_col, FilterOperator.IS_NOT_NULL
    )
    assert hasattr(result_not_null, "left")
    assert hasattr(result_not_null, "right")

    # Test invalid operator
    with pytest.raises(ValueError, match="Invalid null filter operator"):
        BaseEngineSpec.handle_null_filter(bool_col, "INVALID")  # type: ignore[arg-type]


def test_handle_comparison_filter() -> None:
    """
    Test comparison filter handling for all operators.
    """
    int_col = Column("test_col", Integer)

    # Test all comparison operators - use actual FilterOperator values
    operators_and_values = [
        (FilterOperator.EQUALS, 5),
        (FilterOperator.NOT_EQUALS, 5),
        (FilterOperator.GREATER_THAN, 5),
        (FilterOperator.LESS_THAN, 5),
        (FilterOperator.GREATER_THAN_OR_EQUALS, 5),
        (FilterOperator.LESS_THAN_OR_EQUALS, 5),
    ]

    for op, value in operators_and_values:
        result = BaseEngineSpec.handle_comparison_filter(int_col, op, value)
        # All comparison operators should return binary expressions
        assert str(type(result)).endswith("BinaryExpression'>")

    # Test invalid operator
    with pytest.raises(ValueError, match="Invalid comparison filter operator"):
        BaseEngineSpec.handle_comparison_filter(int_col, "INVALID", 5)  # type: ignore[arg-type]


def test_use_equality_for_boolean_filters_property() -> None:
    """
    Test that BaseEngineSpec has the correct default value for boolean filter property.
    """
    # Default should be False (use IS operators)
    assert BaseEngineSpec.use_equality_for_boolean_filters is False


def test_extract_errors(mocker: MockerFixture) -> None:
    """
    Test that error is extracted correctly when no custom error message is provided.
    """
    mocker.patch(
        "flask.current_app.config",
        {},
    )

    msg = "This connector does not support roles"
    result = BaseEngineSpec.extract_errors(Exception(msg))

    expected = create_expected_superset_error(
        message="This connector does not support roles",
        engine_name=None,
    )
    assert result == [expected]


def test_extract_errors_from_config(mocker: MockerFixture) -> None:
    """
    Test that custom error messages are extracted correctly from app config
    using database_name.
    """

    class TestEngineSpec(BaseEngineSpec):
        engine_name = "ExampleEngine"

    mocker.patch(
        "flask.current_app.config",
        {
            "CUSTOM_DATABASE_ERRORS": {
                "examples": {
                    re.compile("This connector does not support roles"): (
                        "Custom error message",
                        SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                        {},
                    )
                }
            }
        },
    )

    msg = "This connector does not support roles"
    result = TestEngineSpec.extract_errors(Exception(msg), database_name="examples")

    expected = create_expected_superset_error(
        message="Custom error message",
        engine_name="ExampleEngine",
    )
    assert result == [expected]


def test_extract_errors_only_to_specified_database(mocker: MockerFixture) -> None:
    """
    Test that custom error messages are only applied to the specified database_name.
    """

    class TestEngineSpec(BaseEngineSpec):
        engine_name = "ExampleEngine"

    mocker.patch(
        "flask.current_app.config",
        {
            "CUSTOM_DATABASE_ERRORS": {
                "examples": {
                    re.compile("This connector does not support roles"): (
                        "Custom error message",
                        SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                        {},
                    )
                }
            }
        },
    )

    msg = "This connector does not support roles"
    # database_name doesn't match configured one, so default message is used
    result = TestEngineSpec.extract_errors(Exception(msg), database_name="examples_2")

    expected = create_expected_superset_error(
        message="This connector does not support roles",
        engine_name="ExampleEngine",
    )
    assert result == [expected]


def test_extract_errors_from_config_with_regex(mocker: MockerFixture) -> None:
    """
    Test that custom error messages with regex, custom_doc_links,
    and show_issue_info are extracted correctly from config.
    """

    class TestEngineSpec(BaseEngineSpec):
        engine_name = "ExampleEngine"

    mocker.patch(
        "flask.current_app.config",
        {
            "CUSTOM_DATABASE_ERRORS": {
                "examples": {
                    re.compile(r'message="(?P<message>[^"]*)"'): (
                        'Unexpected error: "%(message)s"',
                        SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                        {
                            "custom_doc_links": [
                                {
                                    "url": "https://example.com/docs",
                                    "label": "Check documentation",
                                },
                            ],
                            "show_issue_info": False,
                        },
                    )
                }
            }
        },
    )

    msg = (
        "db error: SomeUserError(type=USER_ERROR, name=TABLE_NOT_FOUND, "
        'message="line 3:6: Table '
        "'example_catalog.example_schema.example_table' does not exist"
        '", '
        "query_id=20250812_074513_00084_kju62)"
    )
    result = TestEngineSpec.extract_errors(Exception(msg), database_name="examples")

    assert result == [
        SupersetError(
            message=(
                'Unexpected error: "line 3:6: Table '
                "'example_catalog.example_schema.example_table' does not exist"
                '"'
            ),
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "ExampleEngine",
                "issue_codes": [
                    {
                        "code": 1002,
                        "message": "Issue 1002 - The database returned an unexpected error.",  # noqa: E501
                    }
                ],
                "custom_doc_links": [
                    {
                        "url": "https://example.com/docs",
                        "label": "Check documentation",
                    },
                ],
                "show_issue_info": False,
            },
        )
    ]


def test_extract_errors_with_non_dict_custom_errors(mocker: MockerFixture):
    """
    Test that extract_errors doesn't fail when custom database errors
    are in wrong format.
    """

    class TestEngineSpec(BaseEngineSpec):
        engine_name = "ExampleEngine"

    mocker.patch(
        "flask.current_app.config",
        {"CUSTOM_DATABASE_ERRORS": "not a dict"},
    )

    msg = "This connector does not support roles"
    result = TestEngineSpec.extract_errors(Exception(msg))

    expected = create_expected_superset_error(
        message="This connector does not support roles",
        engine_name="ExampleEngine",
    )
    assert result == [expected]


def test_extract_errors_with_non_dict_engine_custom_errors(mocker: MockerFixture):
    """
    Test that extract_errors doesn't fail when database-specific custom errors
    are in wrong format.
    """

    class TestEngineSpec(BaseEngineSpec):
        engine_name = "ExampleEngine"

    mocker.patch(
        "flask.current_app.config",
        {"CUSTOM_DATABASE_ERRORS": {"examples": "not a dict"}},
    )

    msg = "This connector does not support roles"
    result = TestEngineSpec.extract_errors(Exception(msg), database_name="examples")

    expected = create_expected_superset_error(
        message="This connector does not support roles",
        engine_name="ExampleEngine",
    )
    assert result == [expected]


def test_extract_errors_with_empty_custom_error_message(mocker: MockerFixture):
    """
    Test that when the custom error message is empty,
    the original error message is preserved.
    """

    class TestEngineSpec(BaseEngineSpec):
        engine_name = "ExampleEngine"

    mocker.patch(
        "flask.current_app.config",
        {
            "CUSTOM_DATABASE_ERRORS": {
                "examples": {
                    re.compile("This connector does not support roles"): (
                        "",
                        SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                        {},
                    )
                }
            }
        },
    )

    msg = "This connector does not support roles"
    result = TestEngineSpec.extract_errors(Exception(msg), database_name="examples")

    expected = create_expected_superset_error(
        message="This connector does not support roles",
        engine_name="ExampleEngine",
    )
    assert result == [expected]


def test_extract_errors_matches_database_name_selection(mocker: MockerFixture) -> None:
    """
    Test that custom error messages are matched by database_name.
    """

    class TestEngineSpec(BaseEngineSpec):
        engine_name = "ExampleEngine"

    mocker.patch(
        "flask.current_app.config",
        {
            "CUSTOM_DATABASE_ERRORS": {
                "examples": {
                    re.compile("connection error"): (
                        "Examples DB error message",
                        SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                        {},
                    )
                },
                "examples_2": {
                    re.compile("connection error"): (
                        "Examples_2 DB error message",
                        SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                        {},
                    )
                },
            }
        },
    )

    msg = "connection error occurred"
    # When database_name is examples_2 we should get that specific message
    result = TestEngineSpec.extract_errors(Exception(msg), database_name="examples_2")

    expected = create_expected_superset_error(
        message="Examples_2 DB error message",
        engine_name="ExampleEngine",
    )
    assert result == [expected]


def test_extract_errors_no_match_falls_back(mocker: MockerFixture) -> None:
    """
    Test that when database_name has no match, the original error message is preserved.
    """

    class TestEngineSpec(BaseEngineSpec):
        engine_name = "ExampleEngine"

    mocker.patch(
        "flask.current_app.config",
        {
            "CUSTOM_DATABASE_ERRORS": {
                "examples": {
                    re.compile("connection error"): (
                        "Examples DB error message",
                        SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                        {},
                    )
                },
            }
        },
    )

    msg = "some other error"
    result = TestEngineSpec.extract_errors(Exception(msg), database_name="examples_2")

    expected = create_expected_superset_error(
        message="some other error",
        engine_name="ExampleEngine",
    )
    assert result == [expected]


def test_get_oauth2_authorization_uri_standard_params(mocker: MockerFixture) -> None:
    """
    Test that BaseEngineSpec.get_oauth2_authorization_uri uses standard OAuth 2.0
    parameters only and does not include provider-specific params like prompt=consent.
    """
    config: OAuth2ClientConfig = {
        "id": "client-id",
        "secret": "client-secret",
        "scope": "read write",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "https://oauth.example.com/authorize",
        "token_request_uri": "https://oauth.example.com/token",
        "request_content_type": "json",
    }

    state: OAuth2State = {
        "database_id": 1,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
        "tab_id": "1234",
    }

    url = BaseEngineSpec.get_oauth2_authorization_uri(config, state)
    parsed = urlparse(url)
    assert parsed.netloc == "oauth.example.com"
    assert parsed.path == "/authorize"

    query = parse_qs(parsed.query)

    # Verify standard OAuth 2.0 parameters are included
    assert query["scope"][0] == "read write"
    assert query["response_type"][0] == "code"
    assert query["client_id"][0] == "client-id"
    assert query["redirect_uri"][0] == "http://localhost:8088/api/v1/database/oauth2/"
    encoded_state = query["state"][0].replace("%2E", ".")
    assert decode_oauth2_state(encoded_state) == state

    # Verify Google-specific parameters are NOT included (standard OAuth 2.0)
    assert "prompt" not in query
    assert "access_type" not in query
    assert "include_granted_scopes" not in query

    # Verify PKCE parameters are NOT included when code_verifier is not provided
    assert "code_challenge" not in query
    assert "code_challenge_method" not in query


def test_get_oauth2_authorization_uri_with_pkce(mocker: MockerFixture) -> None:
    """
    Test that BaseEngineSpec.get_oauth2_authorization_uri includes PKCE parameters
    when code_verifier is passed as a parameter (RFC 7636).
    """
    from urllib.parse import parse_qs, urlparse

    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.utils.oauth2 import generate_code_challenge, generate_code_verifier

    config: OAuth2ClientConfig = {
        "id": "client-id",
        "secret": "client-secret",
        "scope": "read write",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "https://oauth.example.com/authorize",
        "token_request_uri": "https://oauth.example.com/token",
        "request_content_type": "json",
    }

    code_verifier = generate_code_verifier()
    state: OAuth2State = {
        "database_id": 1,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
        "tab_id": "1234",
    }

    url = BaseEngineSpec.get_oauth2_authorization_uri(
        config, state, code_verifier=code_verifier
    )
    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    # Verify PKCE parameters are included (RFC 7636)
    assert "code_challenge" in query
    assert query["code_challenge_method"][0] == "S256"
    # Verify the code_challenge matches the expected value
    expected_challenge = generate_code_challenge(code_verifier)
    assert query["code_challenge"][0] == expected_challenge


def test_get_oauth2_token_without_pkce(mocker: MockerFixture) -> None:
    """
    Test that BaseEngineSpec.get_oauth2_token works without PKCE code_verifier.
    """
    from superset.db_engine_specs.base import BaseEngineSpec

    mocker.patch(
        "flask.current_app.config",
        {"DATABASE_OAUTH2_TIMEOUT": mocker.MagicMock(total_seconds=lambda: 30)},
    )
    mock_post = mocker.patch("superset.db_engine_specs.base.requests.post")
    mock_post.return_value.json.return_value = {
        "access_token": "test-access-token",  # noqa: S105
        "expires_in": 3600,
    }

    config: OAuth2ClientConfig = {
        "id": "client-id",
        "secret": "client-secret",
        "scope": "read write",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "https://oauth.example.com/authorize",
        "token_request_uri": "https://oauth.example.com/token",
        "request_content_type": "json",
    }

    result = BaseEngineSpec.get_oauth2_token(config, "auth-code")

    assert result["access_token"] == "test-access-token"  # noqa: S105
    # Verify code_verifier is NOT in the request body
    call_kwargs = mock_post.call_args
    request_body = call_kwargs.kwargs.get("json") or call_kwargs.kwargs.get("data")
    assert "code_verifier" not in request_body


def test_get_oauth2_token_with_pkce(mocker: MockerFixture) -> None:
    """
    Test BaseEngineSpec.get_oauth2_token includes code_verifier when provided.
    """
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.utils.oauth2 import generate_code_verifier

    mocker.patch(
        "flask.current_app.config",
        {"DATABASE_OAUTH2_TIMEOUT": mocker.MagicMock(total_seconds=lambda: 30)},
    )
    mock_post = mocker.patch("superset.db_engine_specs.base.requests.post")
    mock_post.return_value.json.return_value = {
        "access_token": "test-access-token",  # noqa: S105
        "expires_in": 3600,
    }

    config: OAuth2ClientConfig = {
        "id": "client-id",
        "secret": "client-secret",
        "scope": "read write",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "https://oauth.example.com/authorize",
        "token_request_uri": "https://oauth.example.com/token",
        "request_content_type": "json",
    }

    code_verifier = generate_code_verifier()
    result = BaseEngineSpec.get_oauth2_token(config, "auth-code", code_verifier)

    assert result["access_token"] == "test-access-token"  # noqa: S105
    # Verify code_verifier IS in the request body (PKCE)
    call_kwargs = mock_post.call_args
    request_body = call_kwargs.kwargs.get("json") or call_kwargs.kwargs.get("data")
    assert request_body["code_verifier"] == code_verifier


def test_start_oauth2_dance_uses_config_redirect_uri(mocker: MockerFixture) -> None:
    """
    Test that start_oauth2_dance uses DATABASE_OAUTH2_REDIRECT_URI config if set.
    """
    custom_redirect_uri = "https://proxy.example.com/oauth2/"

    mocker.patch(
        "flask.current_app.config",
        {
            "DATABASE_OAUTH2_REDIRECT_URI": custom_redirect_uri,
            "SECRET_KEY": "test-secret-key",
            "DATABASE_OAUTH2_JWT_ALGORITHM": "HS256",
        },
    )
    mocker.patch("superset.daos.key_value.KeyValueDAO")
    mocker.patch("superset.db_engine_specs.base.db")

    g = mocker.patch("superset.db_engine_specs.base.g")
    g.user.id = 1

    database = mocker.MagicMock()
    database.id = 1
    database.get_oauth2_config.return_value = {
        "id": "client-id",
        "secret": "client-secret",
        "scope": "read write",
        "redirect_uri": "https://another-link.com",
        "authorization_request_uri": "https://oauth.example.com/authorize",
        "token_request_uri": "https://oauth.example.com/token",
    }

    with pytest.raises(OAuth2RedirectError) as exc_info:
        BaseEngineSpec.start_oauth2_dance(database)

    error = exc_info.value.error

    assert error.extra["redirect_uri"] == custom_redirect_uri


def test_start_oauth2_dance_falls_back_to_url_for(mocker: MockerFixture) -> None:
    """
    Test that start_oauth2_dance falls back to url_for when no config is set.
    """
    fallback_uri = "http://localhost:8088/api/v1/database/oauth2/"

    mocker.patch(
        "flask.current_app.config",
        {
            "SECRET_KEY": "test-secret-key",
            "DATABASE_OAUTH2_JWT_ALGORITHM": "HS256",
        },
    )
    mocker.patch(
        "superset.db_engine_specs.base.url_for",
        return_value=fallback_uri,
    )
    mocker.patch("superset.daos.key_value.KeyValueDAO")
    mocker.patch("superset.db_engine_specs.base.db")

    g = mocker.patch("superset.db_engine_specs.base.g")
    g.user.id = 1

    database = mocker.MagicMock()
    database.id = 1
    database.get_oauth2_config.return_value = {
        "id": "client-id",
        "secret": "client-secret",
        "scope": "read write",
        "redirect_uri": "https://another-link.com",
        "authorization_request_uri": "https://oauth.example.com/authorize",
        "token_request_uri": "https://oauth.example.com/token",
        "request_content_type": "json",
    }

    with pytest.raises(OAuth2RedirectError) as exc_info:
        BaseEngineSpec.start_oauth2_dance(database)

    error = exc_info.value.error

    assert error.extra["redirect_uri"] == fallback_uri
