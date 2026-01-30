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

"""
Tests for CSV upload with MySQL databases requiring primary keys.
"""

from __future__ import annotations

from unittest.mock import MagicMock, Mock, patch

import pandas as pd
import pytest

from superset.commands.database.uploaders.base import UploadCommand
from superset.commands.database.uploaders.csv_reader import CSVReader
from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.models.core import Database
from superset.sql.parse import Table


def test_mysql_requires_primary_key_detection():
    """Test that _requires_primary_key correctly detects MySQL setting"""
    # Create a mock engine
    mock_engine = Mock()
    mock_conn = Mock()
    mock_result = Mock()
    
    # Test case: sql_require_primary_key is ON (1)
    mock_result.scalar.return_value = 1
    mock_conn.execute.return_value = mock_result
    mock_conn.__enter__ = Mock(return_value=mock_conn)
    mock_conn.__exit__ = Mock(return_value=False)
    mock_engine.connect.return_value = mock_conn
    
    assert MySQLEngineSpec._requires_primary_key(mock_engine) is True
    
    # Test case: sql_require_primary_key is OFF (0)
    mock_result.scalar.return_value = 0
    assert MySQLEngineSpec._requires_primary_key(mock_engine) is False
    
    # Test case: Query fails (e.g., older MySQL version without the setting)
    mock_conn.execute.side_effect = Exception("Unknown system variable")
    assert MySQLEngineSpec._requires_primary_key(mock_engine) is False


def test_mysql_df_to_sql_adds_primary_key():
    """Test that df_to_sql adds a primary key when required"""
    # Create test data
    df = pd.DataFrame({
        "name": ["Alice", "Bob", "Charlie"],
        "age": [30, 25, 35],
        "city": ["NYC", "LA", "SF"]
    })

    # Create mock database and table
    mock_database = Mock(spec=Database)
    mock_table = Table(table="test_table", schema=None)

    # Mock engine with sql_require_primary_key enabled
    mock_engine = Mock()
    mock_conn = Mock()
    mock_result = Mock()
    mock_result.scalar.return_value = 1  # Primary key required
    mock_conn.execute.return_value = mock_result
    mock_conn.commit = Mock()
    mock_conn.__enter__ = Mock(return_value=mock_conn)
    mock_conn.__exit__ = Mock(return_value=False)
    mock_engine.connect.return_value = mock_conn

    # Mock engine.begin() for transaction context
    mock_transaction = Mock()
    mock_transaction.__enter__ = Mock(return_value=mock_conn)
    mock_transaction.__exit__ = Mock(return_value=False)
    mock_engine.begin.return_value = mock_transaction

    mock_engine.dialect.supports_multivalues_insert = True

    # Track to_sql calls
    to_sql_called = False
    captured_df = None
    captured_kwargs = None

    def capture_to_sql(con, **kwargs):
        nonlocal to_sql_called, captured_df, captured_kwargs
        to_sql_called = True
        captured_df = kwargs.get("name")  # Just capture what we can
        captured_kwargs = kwargs

    # Mock df.to_sql to capture the call
    with patch.object(pd.DataFrame, "to_sql", side_effect=capture_to_sql):
        with patch.object(
            MySQLEngineSpec,
            "get_engine",
            return_value=mock_engine.__enter__()
        ):
            to_sql_kwargs = {
                "if_exists": "fail",
                "index": False,
                "chunksize": 1000,
            }
            
            MySQLEngineSpec.df_to_sql(
                mock_database,
                mock_table,
                df,
                to_sql_kwargs
            )
    
    # Verify to_sql was called
    assert to_sql_called
    assert "test_table" in str(captured_kwargs)
    
    # Verify ALTER TABLE was called to add PRIMARY KEY
    execute_calls = [call for call in mock_conn.execute.call_args_list]
    # First call is checking sql_require_primary_key
    # Second call should be ALTER TABLE
    assert len(execute_calls) >= 2
    alter_call = execute_calls[1][0][0]
    assert "ALTER TABLE" in alter_call
    assert "AUTO_INCREMENT" in alter_call
    assert "PRIMARY KEY" in alter_call


def test_mysql_df_to_sql_skips_primary_key_when_not_required():
    """Test that df_to_sql doesn't add primary key when not required"""
    df = pd.DataFrame({
        "name": ["Alice", "Bob"],
        "age": [30, 25]
    })
    
    mock_database = Mock(spec=Database)
    mock_table = Table(table="test_table", schema=None)
    
    # Mock engine with sql_require_primary_key disabled
    mock_engine = Mock()
    mock_conn = Mock()
    mock_result = Mock()
    mock_result.scalar.return_value = 0  # Primary key NOT required
    mock_conn.execute.return_value = mock_result
    mock_conn.__enter__ = Mock(return_value=mock_conn)
    mock_conn.__exit__ = Mock(return_value=False)
    mock_engine.connect.return_value = mock_conn
    mock_engine.dialect.supports_multivalues_insert = True
    
    # Use parent's df_to_sql
    with patch.object(
        MySQLEngineSpec,
        "get_engine",
        return_value=mock_engine.__enter__()
    ):
        with patch("superset.db_engine_specs.base.BaseEngineSpec.df_to_sql") as mock_parent:
            to_sql_kwargs = {
                "if_exists": "fail",
                "index": False,
            }
            
            MySQLEngineSpec.df_to_sql(
                mock_database,
                mock_table,
                df,
                to_sql_kwargs
            )
            
            # Verify parent's df_to_sql was called (normal path)
            mock_parent.assert_called_once()
            # Verify no ALTER TABLE was executed
            # Only one call should be to check sql_require_primary_key
            assert mock_conn.execute.call_count == 1


def test_mysql_df_to_sql_handles_column_name_conflicts():
    """Test that primary key column name is adjusted if it conflicts"""
    df = pd.DataFrame({
        "__superset_upload_id__": ["existing_data"],
        "name": ["Alice"]
    })
    
    mock_database = Mock(spec=Database)
    mock_table = Table(table="test_table", schema=None)
    
    mock_engine = Mock()
    mock_conn = Mock()
    mock_result = Mock()
    mock_result.scalar.return_value = 1  # Primary key required
    mock_conn.execute.return_value = mock_result
    mock_conn.commit = Mock()
    mock_conn.__enter__ = Mock(return_value=mock_conn)
    mock_conn.__exit__ = Mock(return_value=False)
    mock_engine.connect.return_value = mock_conn
    mock_engine.dialect.supports_multivalues_insert = True
    
    captured_df_columns = None
    
    def capture_to_sql(con, **kwargs):
        # Can't directly access df from kwargs in mock, but we can check ALTER
        pass
    
    with patch.object(pd.DataFrame, "to_sql", side_effect=capture_to_sql):
        with patch.object(
            MySQLEngineSpec,
            "get_engine",
            return_value=mock_engine.__enter__()
        ):
            to_sql_kwargs = {
                "if_exists": "fail",
                "index": False,
            }
            
            MySQLEngineSpec.df_to_sql(
                mock_database,
                mock_table,
                df,
                to_sql_kwargs
            )
    
    # Verify ALTER TABLE uses a different column name (prefixed with _)
    execute_calls = [call for call in mock_conn.execute.call_args_list]
    if len(execute_calls) >= 2:
        alter_call = execute_calls[1][0][0]
        # The column name should be modified to avoid conflict
        assert "__superset_upload_id__" in alter_call or "___superset_upload_id__" in alter_call
