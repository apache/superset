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
from textwrap import dedent

from superset.db_engine_specs.redshift import RedshiftEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec


class TestRedshiftDbEngineSpec(TestDbEngineSpec):
    def test_extract_errors(self):
        """
        Test that custom error messages are extracted correctly.
        """
        msg = 'FATAL:  password authentication failed for user "wronguser"'
        result = RedshiftEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
                message='Either the username "wronguser" or the password is incorrect.',
                level=ErrorLevel.ERROR,
                extra={
                    "invalid": ["username", "password"],
                    "engine_name": "Amazon Redshift",
                    "issue_codes": [
                        {
                            "code": 1014,
                            "message": "Issue 1014 - Either the username "
                            "or the password is wrong.",
                        },
                        {
                            "code": 1015,
                            "message": "Issue 1015 - Either the database is "
                            "spelled incorrectly or does not exist.",
                        },
                    ],
                },
            )
        ]

        msg = (
            'redshift: error: could not translate host name "badhost" '
            "to address: nodename nor servname provided, or not known"
        )
        result = RedshiftEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
                message='The hostname "badhost" cannot be resolved.',
                level=ErrorLevel.ERROR,
                extra={
                    "invalid": ["host"],
                    "engine_name": "Amazon Redshift",
                    "issue_codes": [
                        {
                            "code": 1007,
                            "message": "Issue 1007 - The hostname provided "
                            "can't be resolved.",
                        }
                    ],
                },
            )
        ]
        msg = dedent(
            """
psql: error: could not connect to server: Connection refused
        Is the server running on host "localhost" (::1) and accepting
        TCP/IP connections on port 12345?
could not connect to server: Connection refused
        Is the server running on host "localhost" (127.0.0.1) and accepting
        TCP/IP connections on port 12345?
            """
        )
        result = RedshiftEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
                message='Port 12345 on hostname "localhost" refused the connection.',
                level=ErrorLevel.ERROR,
                extra={
                    "invalid": ["host", "port"],
                    "engine_name": "Amazon Redshift",
                    "issue_codes": [
                        {"code": 1008, "message": "Issue 1008 - The port is closed."}
                    ],
                },
            )
        ]

        msg = dedent(
            """
psql: error: could not connect to server: Operation timed out
        Is the server running on host "example.com" (93.184.216.34) and accepting
        TCP/IP connections on port 12345?
            """
        )
        result = RedshiftEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
                message=(
                    'The host "example.com" might be down, '
                    "and can't be reached on port 12345."
                ),
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Amazon Redshift",
                    "issue_codes": [
                        {
                            "code": 1009,
                            "message": "Issue 1009 - The host might be down, "
                            "and can't be reached on the provided port.",
                        }
                    ],
                    "invalid": ["host", "port"],
                },
            )
        ]

        # response with IP only
        msg = dedent(
            """
psql: error: could not connect to server: Operation timed out
        Is the server running on host "93.184.216.34" and accepting
        TCP/IP connections on port 12345?
            """
        )
        result = RedshiftEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
                message=(
                    'The host "93.184.216.34" might be down, '
                    "and can't be reached on port 12345."
                ),
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Amazon Redshift",
                    "issue_codes": [
                        {
                            "code": 1009,
                            "message": "Issue 1009 - The host might be down, "
                            "and can't be reached on the provided port.",
                        }
                    ],
                    "invalid": ["host", "port"],
                },
            )
        ]

        msg = 'database "badDB" does not exist'
        result = RedshiftEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                error_type=SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
                message='We were unable to connect to your database named "badDB".'
                " Please verify your database name and try again.",
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Amazon Redshift",
                    "issue_codes": [
                        {
                            "code": 10015,
                            "message": "Issue 1015 - Either the database is "
                            "spelled incorrectly or does not exist.",
                        }
                    ],
                    "invalid": ["database"],
                },
            )
        ]
