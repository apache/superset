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


def test_build_sqlalchemy_uri_full() -> None:
    """
    Test ``build_sqlalchemy_uri`` with every parameter supplied.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    uri = AthenaEngineSpec.build_sqlalchemy_uri(
        {
            "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
            "aws_secret_access_key": "secret/with+special=chars",
            "region_name": "us-east-1",
            "s3_staging_dir": "s3://my-bucket/staging/",
            "schema_name": "default",
            "work_group": "primary",
        }
    )
    assert uri == (
        "awsathena+rest://AKIAIOSFODNN7EXAMPLE:secret%2Fwith+special%3Dchars@"
        "athena.us-east-1.amazonaws.com/default"
        "?s3_staging_dir=s3%3A%2F%2Fmy-bucket%2Fstaging%2F&work_group=primary"
    )


def test_build_sqlalchemy_uri_minimal() -> None:
    """
    Test ``build_sqlalchemy_uri`` with only the required parameters.

    Without explicit credentials (e.g. IAM role based auth) the URI has no
    user/password, no schema, and no work group.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    uri = AthenaEngineSpec.build_sqlalchemy_uri(
        {
            "region_name": "eu-west-1",
            "s3_staging_dir": "s3://another-bucket/",
        }
    )
    assert uri == (
        "awsathena+rest://athena.eu-west-1.amazonaws.com"
        "?s3_staging_dir=s3%3A%2F%2Fanother-bucket%2F"
    )


def test_get_parameters_from_uri() -> None:
    """
    Test ``get_parameters_from_uri`` extracts each parameter back out.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    parameters = AthenaEngineSpec.get_parameters_from_uri(
        "awsathena+rest://AKIAIOSFODNN7EXAMPLE:secret%2Fkey@"
        "athena.us-east-1.amazonaws.com/default"
        "?s3_staging_dir=s3%3A%2F%2Fmy-bucket%2Fstaging%2F&work_group=primary"
    )
    assert parameters == {
        "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "aws_secret_access_key": "secret/key",
        "region_name": "us-east-1",
        "s3_staging_dir": "s3://my-bucket/staging/",
        "schema_name": "default",
        "work_group": "primary",
    }


def test_parameters_round_trip() -> None:
    """
    Building a URI and parsing it back should yield the original parameters.
    """
    from superset.db_engine_specs.athena import (
        AthenaEngineSpec,
        AthenaParametersType,
    )

    parameters: AthenaParametersType = {
        "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "aws_secret_access_key": "secret/with+special=chars",
        "region_name": "us-east-1",
        "s3_staging_dir": "s3://my-bucket/staging/",
        "schema_name": "default",
        "work_group": "primary",
    }
    uri = AthenaEngineSpec.build_sqlalchemy_uri(parameters)
    assert AthenaEngineSpec.get_parameters_from_uri(uri) == parameters


def test_get_parameters_from_uri_non_standard_host() -> None:
    """
    A host that doesn't match the ``athena.<region>.amazonaws.com`` shape is
    returned verbatim as ``region_name``.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    parameters = AthenaEngineSpec.get_parameters_from_uri(
        "awsathena+rest://vpce-1234.athena.us-east-1.vpce.amazonaws.com/default"
        "?s3_staging_dir=s3%3A%2F%2Fbucket%2F"
    )
    assert parameters["region_name"] == "vpce-1234.athena.us-east-1.vpce.amazonaws.com"
    assert parameters["s3_staging_dir"] == "s3://bucket/"


def test_parameters_json_schema() -> None:
    """
    Test that the OpenAPI schema exposes the expected fields.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    schema = AthenaEngineSpec.parameters_json_schema()
    assert set(schema["properties"]) == {
        "aws_access_key_id",
        "aws_secret_access_key",
        "region_name",
        "s3_staging_dir",
        "schema_name",
        "work_group",
    }
    assert sorted(schema["required"]) == ["region_name", "s3_staging_dir"]


def test_validate_parameters_missing_required() -> None:
    """
    Test that ``validate_parameters`` flags missing required parameters.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    errors = AthenaEngineSpec.validate_parameters(
        {"parameters": {"region_name": "us-east-1"}}  # type: ignore
    )
    assert len(errors) == 1
    assert errors[0].error_type == (
        SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR
    )
    assert errors[0].extra is not None
    assert errors[0].extra["missing"] == ["s3_staging_dir"]


def test_validate_parameters_valid() -> None:
    """
    Test that ``validate_parameters`` passes when required parameters exist.
    """
    from superset.db_engine_specs.athena import AthenaEngineSpec

    errors = AthenaEngineSpec.validate_parameters(
        {
            "parameters": {  # type: ignore
                "region_name": "us-east-1",
                "s3_staging_dir": "s3://my-bucket/staging/",
            }
        }
    )
    assert errors == []
