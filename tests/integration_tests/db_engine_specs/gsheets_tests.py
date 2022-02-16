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
from superset.db_engine_specs.gsheets import GSheetsEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestGsheetsDbEngineSpec(TestDbEngineSpec):
    def test_extract_errors(self):
        """
        Test that custom error messages are extracted correctly.
        """
        msg = 'SQLError: near "fromm": syntax error'
        result = GSheetsEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message='Please check your query for syntax errors near "fromm". Then, try running your query again.',
                error_type=SupersetErrorType.SYNTAX_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Google Sheets",
                    "issue_codes": [
                        {
                            "code": 1030,
                            "message": "Issue 1030 - The query has a syntax error.",
                        }
                    ],
                },
            )
        ]
