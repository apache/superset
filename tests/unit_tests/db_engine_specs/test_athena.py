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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access
import re
from datetime import datetime
from typing import Optional

import pytest
from sqlalchemy.engine.url import make_url

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa

SYNTAX_ERROR_REGEX = re.compile(
    ": mismatched input '(?P<syntax_error>.*?)'. Expecting: "
)


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "DATE '2019-01-02'"),
        ("TimeStamp", "TIMESTAMP '2019-01-02 03:04:05.678'"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.athena import AthenaEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_extract_errors() -> None:
    """
    Test that custom error messages are extracted correctly.
    """

    from superset.db_engine_specs.athena import AthenaEngineSpec

    msg = ": mismatched input 'from_'. Expecting: "
    result = AthenaEngineSpec.extract_errors(Exception(msg))
    assert result == [
        SupersetError(
            message='Please check your query for syntax errors at or near "from_". Then, try running your query again.',  # noqa: E501
            error_type=SupersetErrorType.SYNTAX_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Amazon Athena",
                "issue_codes": [
                    {
                        "code": 1030,
                        "message": "Issue 1030 - The query has a syntax error.",
                    }
                ],
            },
        )
    ]


def test_get_text_clause_with_colon() -> None:
    """
    Make sure text clauses don't escape the colon character
    """

    from superset.db_engine_specs.athena import AthenaEngineSpec

    query = (
        "SELECT foo FROM tbl WHERE " r"abc >= TIMESTAMP '2021-11-26T00\:00\:00.000000'"
    )
    text_clause = AthenaEngineSpec.get_text_clause(query)
    assert text_clause.text == query


def test_handle_boolean_filter() -> None:
    """
    Test that Athena uses equality operators for boolean filters instead of IS.
    """
    from sqlalchemy import Boolean, Column

    from superset.db_engine_specs.athena import AthenaEngineSpec

    # Create a mock SQLAlchemy column
    bool_col = Column("test_col", Boolean)

    # Test IS_TRUE filter - use actual FilterOperator values
    from superset.utils.core import FilterOperator

    result_true = AthenaEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_TRUE, True
    )
    # The result should be a equality comparison, not an IS comparison
    assert (
        str(result_true.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = true"
    )

    # Test IS_FALSE filter
    result_false = AthenaEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_FALSE, False
    )
    assert (
        str(result_false.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = false"
    )


def test_adjust_engine_params() -> None:
    """
    Test `adjust_engine_params`.

    The method can be used to adjust the schema dynamically.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    url = make_url("awsathena+rest://athena.us-east-1.amazonaws.com:443/default")

    uri = AthenaEngineSpec.adjust_engine_params(url, {})[0]
    assert str(uri) == "awsathena+rest://athena.us-east-1.amazonaws.com:443/default"

    uri = AthenaEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert str(uri) == "awsathena+rest://athena.us-east-1.amazonaws.com:443/new_schema"

    uri = AthenaEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert (
        str(uri)
        == "awsathena+rest://athena.us-east-1.amazonaws.com:443/default?catalog_name=new_catalog"
    )

    uri = AthenaEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert (
        str(uri)
        == "awsathena+rest://athena.us-east-1.amazonaws.com:443/new_schema?catalog_name=new_catalog"
    )


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    assert (
        AthenaEngineSpec.get_schema_from_engine_params(
            make_url(
                "awsathena+rest://athena.us-east-1.amazonaws.com:443/default?s3_staging_dir=s3%3A%2F%2Fathena-staging"
            ),
            {},
        )
        == "default"
    )

    assert (
        AthenaEngineSpec.get_schema_from_engine_params(
            make_url(
                "awsathena+rest://athena.us-east-1.amazonaws.com:443?s3_staging_dir=s3%3A%2F%2Fathena-staging"
            ),
            {},
        )
        is None
    )


def test_adjust_engine_params_with_schema_in_connect_args() -> None:
    """
    Test that schema is properly passed to connect_args for PyAthena metadata discovery.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    url = make_url("awsathena+rest://athena.us-east-1.amazonaws.com:443/default")
    connect_args: dict[str, str] = {}

    # When schema is provided, it should be in both URI and connect_args
    uri, updated_connect_args = AthenaEngineSpec.adjust_engine_params(
        url,
        connect_args,
        schema="my_schema",
    )

    assert str(uri) == "awsathena+rest://athena.us-east-1.amazonaws.com:443/my_schema"
    assert updated_connect_args["schema_name"] == "my_schema"


def test_adjust_engine_params_with_catalog_and_schema() -> None:
    """
    Test that both catalog and schema are properly configured.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    url = make_url("awsathena+rest://athena.us-east-1.amazonaws.com:443/default")
    connect_args: dict[str, str] = {}

    uri, updated_connect_args = AthenaEngineSpec.adjust_engine_params(
        url,
        connect_args,
        catalog="my_catalog",
        schema="my_schema",
    )

    assert (
        str(uri)
        == "awsathena+rest://athena.us-east-1.amazonaws.com:443/my_schema?catalog_name=my_catalog"
    )
    assert updated_connect_args["schema_name"] == "my_schema"


def test_iam_role_authentication_uri() -> None:
    """
    Test that URIs without explicit credentials are valid for IAM role authentication.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    # URI without credentials (for IAM role auth)
    url = make_url(
        "awsathena+rest://@athena.us-east-1.amazonaws.com:443/default?s3_staging_dir=s3%3A%2F%2Fmy-bucket"
    )

    # Should work without errors
    uri, connect_args = AthenaEngineSpec.adjust_engine_params(url, {})

    assert uri.username is None or uri.username == ""
    assert uri.password is None or uri.password == ""
    assert str(uri.database) == "default"


def test_schema_override_from_ui() -> None:
    """
    Test that schema provided from UI properly overrides URI schema.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    # Original URI with 'default' schema
    url = make_url(
        "awsathena+rest://key:secret@athena.us-east-1.amazonaws.com:443/default?s3_staging_dir=s3%3A%2F%2Fmy-bucket"
    )
    connect_args: dict[str, str] = {}

    # UI provides different schema
    uri, updated_connect_args = AthenaEngineSpec.adjust_engine_params(
        url,
        connect_args,
        schema="production_schema",
    )

    # Should use UI schema, not URI schema
    assert str(uri.database) == "production_schema"
    assert updated_connect_args["schema_name"] == "production_schema"


def test_catalog_parameter_in_query_string() -> None:
    """
    Test that catalog is properly added to query string.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    url = make_url(
        "awsathena+rest://athena.us-east-1.amazonaws.com:443/default?s3_staging_dir=s3%3A%2F%2Fmy-bucket"
    )
    connect_args: dict[str, str] = {}

    uri, _ = AthenaEngineSpec.adjust_engine_params(
        url,
        connect_args,
        catalog="my_data_catalog",
    )

    # Catalog should be in query parameters
    assert "catalog_name=my_data_catalog" in str(uri)
    # Original s3_staging_dir should be preserved
    assert "s3_staging_dir" in str(uri)

