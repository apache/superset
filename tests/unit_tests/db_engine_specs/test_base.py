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
from textwrap import dedent
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import types
from sqlalchemy.dialects import sqlite
from sqlalchemy.engine.url import make_url, URL
from sqlalchemy.sql import sqltypes

from superset.sql.parse import Table
from superset.superset_typing import ResultSetColumnType, SQLAColumnType
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


def test_get_text_clause_with_colon() -> None:
    """
    Make sure text clauses are correctly escaped
    """

    from superset.db_engine_specs.base import BaseEngineSpec

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

    from superset.db_engine_specs.base import BaseEngineSpec

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
    from superset.db_engine_specs.base import BaseEngineSpec

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
    from superset.db_engine_specs.base import convert_inspector_columns

    assert convert_inspector_columns(cols) == expected_result


def test_select_star(mocker: MockerFixture) -> None:
    """
    Test the ``select_star`` method.
    """
    from superset.db_engine_specs.base import BaseEngineSpec

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

    engine = mocker.MagicMock()
    engine.dialect = sqlite.dialect()

    sql = BaseEngineSpec.select_star(
        database=database,
        table=Table("my_table", "my_schema", "my_catalog"),
        engine=engine,
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
    from superset.db_engine_specs.base import BaseEngineSpec
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
    from superset.db_engine_specs.base import BaseEngineSpec

    database = mocker.MagicMock()
    assert BaseEngineSpec.get_default_catalog(database) is None


def test_quote_table() -> None:
    """
    Test the `quote_table` function.
    """
    from superset.db_engine_specs.base import BaseEngineSpec

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
    from superset.db_engine_specs.base import BaseEngineSpec

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
    from superset.db_engine_specs.base import BaseEngineSpec

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


def test_impersonate_user_backwards_compatible(mocker: MockerFixture) -> None:
    """
    Test that the `impersonate_user` method calls the original methods it replaced.
    """
    from superset.db_engine_specs.base import BaseEngineSpec

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
    from superset.db_engine_specs.base import BaseEngineSpec

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
    from sqlalchemy import Boolean, Column

    from superset.db_engine_specs.base import BaseEngineSpec

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
    from sqlalchemy import Boolean, Column

    from superset.db_engine_specs.base import BaseEngineSpec

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
    from sqlalchemy import Boolean, Column

    from superset.db_engine_specs.base import BaseEngineSpec

    bool_col = Column("test_col", Boolean)

    # Test IS_NULL - use actual FilterOperator values
    from superset.utils.core import FilterOperator

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
    from sqlalchemy import Column, Integer

    from superset.db_engine_specs.base import BaseEngineSpec

    int_col = Column("test_col", Integer)

    # Test all comparison operators - use actual FilterOperator values
    from superset.utils.core import FilterOperator

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
    from superset.db_engine_specs.base import BaseEngineSpec

    # Default should be False (use IS operators)
    assert BaseEngineSpec.use_equality_for_boolean_filters is False
