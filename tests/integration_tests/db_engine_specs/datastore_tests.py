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
import unittest.mock as mock
from datetime import datetime
from typing import Any

import pytest
from marshmallow.exceptions import ValidationError
from sqlalchemy import column

pytest.importorskip("sqlalchemy_datastore")

from sqlalchemy.engine.url import make_url

from superset.connectors.sqla.models import TableColumn
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.datastore import DatastoreEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.superset_typing import ResultSetColumnType
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)


class TestDatastoreDbEngineSpec(SupersetTestCase):
    def test_datastore_sqla_column_label(self):
        """
        DB Eng Specs (datastore): Test column label
        """
        # Expected labels with SHA-256 hash suffix (first 5 chars prefixed with _)
        test_cases = {
            "Col": "Col",
            "SUM(x)": "SUM_x__b681e",
            "SUM[x]": "SUM_x__ceaf6",
            "12345_col": "_12345_col_b1415",
        }
        for original, expected in test_cases.items():
            actual = DatastoreEngineSpec.make_label_compatible(column(original).name)
            assert actual == expected

    def test_timegrain_expressions(self):
        """
        DB Eng Specs (datastore): Test time grain expressions
        """
        col = column("temporal")
        test_cases = {
            "DATE": "DATE_TRUNC(temporal, HOUR)",
            "TIME": "TIME_TRUNC(temporal, HOUR)",
            "DATETIME": "DATETIME_TRUNC(temporal, HOUR)",
            "TIMESTAMP": "TIMESTAMP_TRUNC(temporal, HOUR)",
        }
        for type_, expected in test_cases.items():
            col.type = type_
            actual = DatastoreEngineSpec.get_timestamp_expr(
                col=col, pdf=None, time_grain="PT1H"
            )
            assert str(actual) == expected

    def test_custom_minute_timegrain_expressions(self):
        """
        DB Eng Specs (datastore): Test time grain expressions
        """
        col = column("temporal")
        test_cases = {
            "DATE": "CAST(TIMESTAMP_SECONDS("
            "5*60 * DIV(UNIX_SECONDS(CAST(temporal AS TIMESTAMP)), 5*60)"
            ") AS DATE)",
            "DATETIME": "CAST(TIMESTAMP_SECONDS("
            "5*60 * DIV(UNIX_SECONDS(CAST(temporal AS TIMESTAMP)), 5*60)"
            ") AS DATETIME)",
            "TIMESTAMP": "CAST(TIMESTAMP_SECONDS("
            "5*60 * DIV(UNIX_SECONDS(CAST(temporal AS TIMESTAMP)), 5*60)"
            ") AS TIMESTAMP)",
        }
        for type_, expected in test_cases.items():
            col.type = type_
            actual = DatastoreEngineSpec.get_timestamp_expr(
                col=col, pdf=None, time_grain="PT5M"
            )
            assert str(actual) == expected

    def test_fetch_data(self):
        """
        DB Eng Specs (datastore): Test fetch data
        """

        # Mock a google.cloud.datastore.table.Row
        class Row:
            def __init__(self, value):
                self._value = value

            def values(self):
                return (self._value,)

        data1 = [(1, "foo")]
        with mock.patch.object(BaseEngineSpec, "fetch_data", return_value=data1):
            result = DatastoreEngineSpec.fetch_data(None, 0)
        assert result == data1

        data2 = [Row(1), Row(2)]
        with mock.patch.object(BaseEngineSpec, "fetch_data", return_value=data2):
            result = DatastoreEngineSpec.fetch_data(None, 0)
        assert result == [(1,), (2,)]

    def test_extract_errors(self):
        msg = "403 POST https://datastore.googleapis.com/: Access Denied: Project my-project: User does not have datastore.databases.create permission in project my-project"  # noqa: E501
        result = DatastoreEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message="Unable to connect. Verify that the following roles are set "
                'on the service account: "Cloud Datastore Viewer", '
                '"Cloud Datastore User", "Cloud Datastore Creator"',
                error_type=SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Google Datastore",
                    "issue_codes": [
                        {
                            "code": 1017,
                            "message": "",
                        }
                    ],
                },
            )
        ]

        msg = "datastore error: 404 Not found: Dataset fakeDataset:bogusSchema was not found in location"  # noqa: E501
        result = DatastoreEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message='The schema "bogusSchema" does not exist. A valid schema must be used to run this query.',  # noqa: E501
                error_type=SupersetErrorType.SCHEMA_DOES_NOT_EXIST_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Google Datastore",
                    "issue_codes": [
                        {
                            "code": 1003,
                            "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",  # noqa: E501
                        },
                        {
                            "code": 1004,
                            "message": "Issue 1004 - The column was deleted or renamed in the database.",  # noqa: E501
                        },
                    ],
                },
            )
        ]

        msg = 'Table name "badtable" missing dataset while no default dataset is set in the request'  # noqa: E501
        result = DatastoreEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message='The table "badtable" does not exist. A valid table must be used to run this query.',  # noqa: E501
                error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Google Datastore",
                    "issue_codes": [
                        {
                            "code": 1003,
                            "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",  # noqa: E501
                        },
                        {
                            "code": 1005,
                            "message": "Issue 1005 - The table was deleted or renamed in the database.",  # noqa: E501
                        },
                    ],
                },
            )
        ]

        msg = "Unrecognized name: badColumn at [1:8]"
        result = DatastoreEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message='We can\'t seem to resolve column "badColumn" at line 1:8.',
                error_type=SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Google Datastore",
                    "issue_codes": [
                        {
                            "code": 1003,
                            "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",  # noqa: E501
                        },
                        {
                            "code": 1004,
                            "message": "Issue 1004 - The column was deleted or renamed in the database.",  # noqa: E501
                        },
                    ],
                },
            )
        ]

        msg = 'Syntax error: Expected end of input but got identifier "from_"'
        result = DatastoreEngineSpec.extract_errors(Exception(msg))
        assert result == [
            SupersetError(
                message='Please check your query for syntax errors at or near "from_". Then, try running your query again.',  # noqa: E501
                error_type=SupersetErrorType.SYNTAX_ERROR,
                level=ErrorLevel.ERROR,
                extra={
                    "engine_name": "Google Datastore",
                    "issue_codes": [
                        {
                            "code": 1030,
                            "message": "Issue 1030 - The query has a syntax error.",
                        }
                    ],
                },
            )
        ]

    @mock.patch("superset.models.core.Database.db_engine_spec", DatastoreEngineSpec)
    @mock.patch(
        "sqlalchemy_datastore.base.create_datastore_client",
        mock.Mock(return_value=(mock.Mock(), mock.Mock())),
    )
    @mock.patch(
        "sqlalchemy_datastore._helpers.create_datastore_client",
        mock.Mock(return_value=(mock.Mock(), mock.Mock())),
    )
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_calculated_column_in_order_by(self):
        table = self.get_table(name="birth_names")
        TableColumn(
            column_name="gender_cc",
            type="VARCHAR(255)",
            table=table,
            expression="""
            case
              when gender='boy' then 'male'
              else 'female'
            end
            """,
        )

        table.database.sqlalchemy_uri = "datastore://"
        query_obj = {
            "groupby": ["gender_cc"],
            "is_timeseries": False,
            "filter": [],
            "orderby": [["gender_cc", True]],
        }
        sql = table.get_query_str(query_obj)
        assert "ORDER BY gender_cc ASC" in sql

    def test_build_sqlalchemy_uri(self):
        """
        DB Eng Specs (datastore): Test building SQLAlchemy URI from parameters
        """
        parameters: dict[str, Any] = {"query": {}}
        encrypted_extra = {
            "credentials_info": {
                "project_id": "my-project",
                "private_key": "SECRET",
            }
        }
        result = DatastoreEngineSpec.build_sqlalchemy_uri(parameters, encrypted_extra)
        assert result == "datastore://my-project/?"

        # Test with query parameters
        parameters_with_query: dict[str, Any] = {"query": {"location": "US"}}
        result = DatastoreEngineSpec.build_sqlalchemy_uri(
            parameters_with_query, encrypted_extra
        )
        assert result == "datastore://my-project/?location=US"

        # Test missing encrypted_extra raises ValidationError
        with pytest.raises(ValidationError, match="Missing service credentials"):
            DatastoreEngineSpec.build_sqlalchemy_uri(parameters, None)

        # Test missing project_id raises ValidationError
        bad_extra = {"credentials_info": {"private_key": "SECRET"}}
        with pytest.raises(ValidationError, match="Invalid service credentials"):
            DatastoreEngineSpec.build_sqlalchemy_uri(parameters, bad_extra)

    def test_get_function_names(self):
        """
        DB Eng Specs (datastore): Test retrieving function names for autocomplete
        """
        database = mock.MagicMock()
        result = DatastoreEngineSpec.get_function_names(database)
        assert result == ["sum", "avg", "count"]

    def test_get_view_names(self):
        """
        DB Eng Specs (datastore): Test that Datastore returns no view names
        """
        database = mock.MagicMock()
        inspector = mock.MagicMock()
        result = DatastoreEngineSpec.get_view_names(database, inspector, "some_schema")
        assert result == set()

    def test_validate_parameters(self):
        """
        DB Eng Specs (datastore): Test parameter validation returns no errors
        """
        result = DatastoreEngineSpec.validate_parameters(
            {
                "host": "localhost",
                "port": 5432,
                "username": "",
                "password": "",
                "database": "",
                "query": {},
            }
        )
        assert result == []

    def test_get_allow_cost_estimate(self):
        """
        DB Eng Specs (datastore): Test that cost estimate is not supported
        """
        assert DatastoreEngineSpec.get_allow_cost_estimate({}) is False

    def test_parse_error_exception(self):
        """
        DB Eng Specs (datastore): Test error message parsing extracts first line
        """
        multiline_msg = (
            'datastore error: 400 Syntax error: Table "t" must be qualified.\n'
            "\n"
            "(job ID: abc-123)\n"
            "\n"
            "     -----Query Job SQL Follows-----\n"
            "   1:select * from t\n"
        )
        result = DatastoreEngineSpec.parse_error_exception(Exception(multiline_msg))
        assert str(result) == (
            'datastore error: 400 Syntax error: Table "t" must be qualified.'
        )

        # Simple single-line messages pass through unchanged
        simple_msg = "Some simple error"
        result = DatastoreEngineSpec.parse_error_exception(Exception(simple_msg))
        assert str(result) == simple_msg

    def test_convert_dttm(self):
        """
        DB Eng Specs (datastore): Test datetime conversion for all supported types
        """
        dttm = datetime(2019, 1, 2, 3, 4, 5, 678900)

        assert (
            DatastoreEngineSpec.convert_dttm("DATE", dttm)
            == "CAST('2019-01-02' AS DATE)"
        )
        assert (
            DatastoreEngineSpec.convert_dttm("DATETIME", dttm)
            == "CAST('2019-01-02T03:04:05.678900' AS DATETIME)"
        )
        assert (
            DatastoreEngineSpec.convert_dttm("TIMESTAMP", dttm)
            == "CAST('2019-01-02T03:04:05.678900' AS TIMESTAMP)"
        )
        assert (
            DatastoreEngineSpec.convert_dttm("TIME", dttm)
            == "CAST('03:04:05.678900' AS TIME)"
        )
        assert DatastoreEngineSpec.convert_dttm("UnknownType", dttm) is None

    def test_get_parameters_from_uri(self):
        """
        DB Eng Specs (datastore): Test extracting parameters from URI
        """
        encrypted_extra = {
            "credentials_info": {
                "project_id": "my-project",
                "private_key": "SECRET",
            }
        }
        result = DatastoreEngineSpec.get_parameters_from_uri(
            "datastore://my-project/", encrypted_extra
        )
        assert result == {
            "credentials_info": {
                "project_id": "my-project",
                "private_key": "SECRET",
            },
            "query": {},
        }

        # URI with query parameters
        result = DatastoreEngineSpec.get_parameters_from_uri(
            "datastore://my-project/?location=US", encrypted_extra
        )
        assert result["query"] == {"location": "US"}

        # Missing encrypted_extra raises ValidationError
        with pytest.raises(ValidationError, match="Invalid service credentials"):
            DatastoreEngineSpec.get_parameters_from_uri("datastore://my-project/", None)

    def test_get_dbapi_exception_mapping(self):
        """
        DB Eng Specs (datastore): Test DBAPI exception mapping includes
        DefaultCredentialsError
        """
        from superset.db_engine_specs.exceptions import SupersetDBAPIConnectionError

        pytest.importorskip("google.auth")

        mapping = DatastoreEngineSpec.get_dbapi_exception_mapping()
        assert len(mapping) == 1

        # Verify the mapping key is DefaultCredentialsError
        exception_class = list(mapping.keys())[0]
        assert exception_class.__name__ == "DefaultCredentialsError"
        assert mapping[exception_class] is SupersetDBAPIConnectionError

    def test_extract_errors_unmatched(self):
        """
        DB Eng Specs (datastore): Test that an unmatched error falls through
        to the base class handling
        """
        msg = "Some completely unknown error message"
        result = DatastoreEngineSpec.extract_errors(Exception(msg))
        assert len(result) == 1
        assert result[0].error_type == SupersetErrorType.GENERIC_DB_ENGINE_ERROR

    def test_build_sqlalchemy_uri_string_credentials(self):
        """
        DB Eng Specs (datastore): Test building URI when credentials_info is a
        JSON string instead of a dict
        """
        from superset.utils import json

        parameters: dict[str, Any] = {"query": {}}
        encrypted_extra = {
            "credentials_info": json.dumps(
                {
                    "project_id": "string-project",
                    "private_key": "SECRET",
                }
            )
        }
        result = DatastoreEngineSpec.build_sqlalchemy_uri(parameters, encrypted_extra)
        assert result == "datastore://string-project/?"

    def test_get_fields(self):
        """
        DB Eng Specs (datastore): Test that _get_fields labels struct columns
        with double-underscore separators
        """
        cols: list[ResultSetColumnType] = [
            {
                "column_name": "name",
                "name": "name",
                "type": "STRING",
                "is_dttm": False,
            },
            {
                "column_name": "project.name",
                "name": "project.name",
                "type": "STRING",
                "is_dttm": False,
            },
        ]
        fields = DatastoreEngineSpec._get_fields(cols)
        assert len(fields) == 2
        # First column: simple name, label unchanged
        assert fields[0].key == "name"
        # Second column: struct field, dot replaced with double underscore
        assert fields[1].key == "project__name"

    def test_adjust_engine_params(self):
        """
        DB Eng Specs (datastore): Test engine parameter adjustment with catalog
        """
        url = make_url("datastore://original-project")

        # Without catalog, URI is unchanged
        uri, connect_args = DatastoreEngineSpec.adjust_engine_params(url, {})
        assert str(uri) == "datastore://original-project"
        assert connect_args == {}

        # With catalog, host is replaced and database cleared
        uri, _ = DatastoreEngineSpec.adjust_engine_params(
            url, {}, catalog="new-project"
        )
        assert str(uri) == "datastore://new-project/"

        # Schema parameter is ignored (Datastore adjusts only catalog)
        uri, _ = DatastoreEngineSpec.adjust_engine_params(url, {}, schema="some_schema")
        assert str(uri) == "datastore://original-project"

    def test_class_attributes(self):
        """
        DB Eng Specs (datastore): Test key class attributes are set correctly
        """
        assert DatastoreEngineSpec.engine == "datastore"
        assert DatastoreEngineSpec.engine_name == "Google Datastore"
        assert DatastoreEngineSpec.max_column_name_length == 128
        assert DatastoreEngineSpec.disable_ssh_tunneling is True
        assert DatastoreEngineSpec.default_driver == "datastore"
        assert DatastoreEngineSpec.run_multiple_statements_as_one is True
        assert DatastoreEngineSpec.allows_hidden_cc_in_orderby is True
        assert DatastoreEngineSpec.supports_dynamic_schema is True
        assert DatastoreEngineSpec.supports_catalog is True
        assert DatastoreEngineSpec.supports_dynamic_catalog is True
        assert DatastoreEngineSpec.arraysize == 5000
        assert DatastoreEngineSpec.encrypted_extra_sensitive_fields == {
            "$.credentials_info.private_key"
        }
