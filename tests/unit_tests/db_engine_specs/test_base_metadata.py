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
from unittest import mock

import pytest
from sqlalchemy.exc import SQLAlchemyError

from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils.core import QuerySource
from tests.integration_tests.base_tests import SupersetTestCase


class TestBaseEngineSpecMetadata(SupersetTestCase):
    @mock.patch.object(BaseEngineSpec, "get_engine")
    def test_execute_metadata_query_basic(self, mock_get_engine):
        """Test basic metadata query execution"""
        database = mock.Mock()
        mock_engine = mock.Mock()
        mock_connection = mock.Mock()
        mock_result = mock.Mock()

        # Setup mock chain
        mock_get_engine.return_value.__enter__ = mock.Mock(return_value=mock_engine)
        mock_get_engine.return_value.__exit__ = mock.Mock(return_value=None)

        mock_engine.connect.return_value.__enter__ = mock.Mock(
            return_value=mock_connection
        )
        mock_engine.connect.return_value.__exit__ = mock.Mock(return_value=None)

        expected_results = [("catalog1",), ("catalog2",)]
        mock_result.fetchall.return_value = expected_results
        mock_connection.execute.return_value = mock_result

        # Execute the method
        query = "SHOW CATALOGS"
        results = BaseEngineSpec.execute_metadata_query(database, query)

        # Verify results
        assert results == expected_results

        # Verify call chain
        mock_get_engine.assert_called_once_with(
            database, catalog=None, schema=None, source=QuerySource.METADATA
        )
        mock_connection.execute.assert_called_once()
        executed_query = mock_connection.execute.call_args[0][0]
        assert str(executed_query) == query

    @mock.patch.object(BaseEngineSpec, "get_engine")
    def test_execute_metadata_query_with_catalog_schema(self, mock_get_engine):
        """Test metadata query with catalog and schema parameters"""
        database = mock.Mock()
        mock_engine = mock.Mock()
        mock_connection = mock.Mock()
        mock_result = mock.Mock()

        # Setup mock chain
        mock_get_engine.return_value.__enter__ = mock.Mock(return_value=mock_engine)
        mock_get_engine.return_value.__exit__ = mock.Mock(return_value=None)

        mock_engine.connect.return_value.__enter__ = mock.Mock(
            return_value=mock_connection
        )
        mock_engine.connect.return_value.__exit__ = mock.Mock(return_value=None)

        expected_results = [("table1",), ("table2",)]
        mock_result.fetchall.return_value = expected_results
        mock_connection.execute.return_value = mock_result

        # Execute with catalog and schema
        query = "SHOW TABLES"
        catalog = "my_catalog"
        schema = "my_schema"
        results = BaseEngineSpec.execute_metadata_query(
            database, query, catalog=catalog, schema=schema
        )

        # Verify results
        assert results == expected_results

        # Verify catalog and schema were passed to get_engine
        mock_get_engine.assert_called_once_with(
            database, catalog=catalog, schema=schema, source=QuerySource.METADATA
        )

    @mock.patch.object(BaseEngineSpec, "get_engine")
    def test_execute_metadata_query_uses_correct_query_source(self, mock_get_engine):
        """Test that QuerySource.METADATA is used correctly"""
        database = mock.Mock()
        mock_engine = mock.Mock()
        mock_connection = mock.Mock()
        mock_result = mock.Mock()

        # Setup mock chain
        mock_get_engine.return_value.__enter__ = mock.Mock(return_value=mock_engine)
        mock_get_engine.return_value.__exit__ = mock.Mock(return_value=None)

        mock_engine.connect.return_value.__enter__ = mock.Mock(
            return_value=mock_connection
        )
        mock_engine.connect.return_value.__exit__ = mock.Mock(return_value=None)

        mock_result.fetchall.return_value = []
        mock_connection.execute.return_value = mock_result

        # Execute the method
        BaseEngineSpec.execute_metadata_query(database, "SELECT 1")

        # Verify QuerySource.METADATA was used
        mock_get_engine.assert_called_once_with(
            database, catalog=None, schema=None, source=QuerySource.METADATA
        )

    @mock.patch.object(BaseEngineSpec, "get_engine")
    def test_execute_metadata_query_handles_sql_error(self, mock_get_engine):
        """Test proper exception handling for SQL errors"""
        database = mock.Mock()
        mock_engine = mock.Mock()
        mock_connection = mock.Mock()

        # Setup mock chain
        mock_get_engine.return_value.__enter__ = mock.Mock(return_value=mock_engine)
        mock_get_engine.return_value.__exit__ = mock.Mock(return_value=None)

        mock_engine.connect.return_value.__enter__ = mock.Mock(
            return_value=mock_connection
        )
        mock_engine.connect.return_value.__exit__ = mock.Mock(return_value=None)

        # Mock connection to raise SQLAlchemyError
        mock_connection.execute.side_effect = SQLAlchemyError("Database error")

        # Execute and verify exception is propagated
        with pytest.raises(SQLAlchemyError):
            BaseEngineSpec.execute_metadata_query(database, "INVALID QUERY")

    @mock.patch.object(BaseEngineSpec, "get_engine")
    def test_execute_metadata_query_empty_results(self, mock_get_engine):
        """Test handling of queries that return no results"""
        database = mock.Mock()
        mock_engine = mock.Mock()
        mock_connection = mock.Mock()
        mock_result = mock.Mock()

        # Setup mock chain
        mock_get_engine.return_value.__enter__ = mock.Mock(return_value=mock_engine)
        mock_get_engine.return_value.__exit__ = mock.Mock(return_value=None)

        mock_engine.connect.return_value.__enter__ = mock.Mock(
            return_value=mock_connection
        )
        mock_engine.connect.return_value.__exit__ = mock.Mock(return_value=None)

        # Empty results
        mock_result.fetchall.return_value = []
        mock_connection.execute.return_value = mock_result

        # Execute the method
        results = BaseEngineSpec.execute_metadata_query(database, "SELECT 1 WHERE 1=0")

        # Verify empty results are handled correctly
        assert results == []

    def test_execute_metadata_query_query_source_enum_value(self):
        """Test QuerySource.METADATA enum has correct value"""
        # This is a simple enum test that doesn't require complex mocking
        assert QuerySource.METADATA.value == 3
        assert QuerySource.METADATA.name == "METADATA"
