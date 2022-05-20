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

from flask.ctx import AppContext

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from tests.unit_tests.fixtures.common import dttm

SYNTAX_ERROR_REGEX = re.compile(
    ": mismatched input '(?P<syntax_error>.*?)'. Expecting: "
)


def test_convert_dttm(app_context: AppContext, dttm: datetime) -> None:
    """
    Test that date objects are converted correctly.
    """

    from superset.db_engine_specs.athena import AthenaEngineSpec

    assert (
        AthenaEngineSpec.convert_dttm("DATE", dttm) == "from_iso8601_date('2019-01-02')"
    )

    assert (
        AthenaEngineSpec.convert_dttm("TIMESTAMP", dttm)
        == "from_iso8601_timestamp('2019-01-02T03:04:05.678900')"
    )


def test_extract_errors(app_context: AppContext) -> None:
    """
    Test that custom error messages are extracted correctly.
    """

    from superset.db_engine_specs.athena import AthenaEngineSpec

    msg = ": mismatched input 'fromm'. Expecting: "
    result = AthenaEngineSpec.extract_errors(Exception(msg))
    assert result == [
        SupersetError(
            message='Please check your query for syntax errors at or near "fromm". Then, try running your query again.',
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


def test_get_text_clause_with_colon(app_context: AppContext) -> None:
    """
    Make sure text clauses don't escape the colon character
    """

    from superset.db_engine_specs.athena import AthenaEngineSpec

    query = (
        "SELECT foo FROM tbl WHERE "
        "abc >= from_iso8601_timestamp('2021-11-26T00\:00\:00.000000')"
    )
    text_clause = AthenaEngineSpec.get_text_clause(query)
    assert text_clause.text == query
