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
"""Tests for generic_loader.py UUID threading functionality."""

from unittest.mock import MagicMock, patch


@patch("superset.examples.generic_loader.get_example_database")
@patch("superset.examples.generic_loader.db")
def test_load_parquet_table_sets_uuid_on_new_table(mock_db, mock_get_db):
    """Test that load_parquet_table sets UUID on newly created SqlaTable."""
    from superset.examples.generic_loader import load_parquet_table

    mock_database = MagicMock()
    mock_database.id = 1
    mock_database.has_table.return_value = True
    mock_get_db.return_value = mock_database

    mock_engine = MagicMock()
    mock_inspector = MagicMock()
    mock_inspector.default_schema_name = "public"
    mock_database.get_sqla_engine.return_value.__enter__ = MagicMock(
        return_value=mock_engine
    )
    mock_database.get_sqla_engine.return_value.__exit__ = MagicMock(return_value=False)

    # Simulate table not found in metadata
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

    test_uuid = "12345678-1234-1234-1234-123456789012"

    with patch("superset.examples.generic_loader.inspect") as mock_inspect:
        mock_inspect.return_value = mock_inspector

        tbl = load_parquet_table(
            parquet_file="test_data",
            table_name="test_table",
            database=mock_database,
            only_metadata=True,
            uuid=test_uuid,
        )

    assert tbl.uuid == test_uuid


@patch("superset.examples.generic_loader.get_example_database")
@patch("superset.examples.generic_loader.db")
def test_load_parquet_table_early_return_does_not_modify_existing_uuid(
    mock_db, mock_get_db
):
    """Test early return path when table exists - UUID is not modified.

    When the physical table exists and force=False, the function returns early
    without going through the full load path. The existing table's UUID is
    preserved as-is (not modified even if different from the provided uuid).
    """
    from superset.examples.generic_loader import load_parquet_table

    mock_database = MagicMock()
    mock_database.id = 1
    mock_database.has_table.return_value = True  # Triggers early return
    mock_get_db.return_value = mock_database

    mock_engine = MagicMock()
    mock_inspector = MagicMock()
    mock_inspector.default_schema_name = "public"
    mock_database.get_sqla_engine.return_value.__enter__ = MagicMock(
        return_value=mock_engine
    )
    mock_database.get_sqla_engine.return_value.__exit__ = MagicMock(return_value=False)

    # Simulate existing table without UUID
    existing_table = MagicMock()
    existing_table.uuid = None
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing_table
    )

    test_uuid = "12345678-1234-1234-1234-123456789012"

    with patch("superset.examples.generic_loader.inspect") as mock_inspect:
        mock_inspect.return_value = mock_inspector

        tbl = load_parquet_table(
            parquet_file="test_data",
            table_name="test_table",
            database=mock_database,
            only_metadata=True,
            uuid=test_uuid,
        )

    # Early return path returns existing table as-is
    assert tbl is existing_table
    # UUID was not modified (still None)
    assert tbl.uuid is None


@patch("superset.examples.generic_loader.get_example_database")
@patch("superset.examples.generic_loader.db")
def test_load_parquet_table_preserves_existing_uuid(mock_db, mock_get_db):
    """Test that load_parquet_table does not overwrite existing UUID."""
    from superset.examples.generic_loader import load_parquet_table

    mock_database = MagicMock()
    mock_database.id = 1
    mock_database.has_table.return_value = True
    mock_get_db.return_value = mock_database

    mock_engine = MagicMock()
    mock_inspector = MagicMock()
    mock_inspector.default_schema_name = "public"
    mock_database.get_sqla_engine.return_value.__enter__ = MagicMock(
        return_value=mock_engine
    )
    mock_database.get_sqla_engine.return_value.__exit__ = MagicMock(return_value=False)

    # Simulate existing table with different UUID
    existing_uuid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    existing_table = MagicMock()
    existing_table.uuid = existing_uuid
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing_table
    )

    new_uuid = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    with patch("superset.examples.generic_loader.inspect") as mock_inspect:
        mock_inspect.return_value = mock_inspector

        tbl = load_parquet_table(
            parquet_file="test_data",
            table_name="test_table",
            database=mock_database,
            only_metadata=True,
            uuid=new_uuid,
        )

    # Should preserve original UUID
    assert tbl.uuid == existing_uuid


@patch("superset.examples.generic_loader.get_example_database")
@patch("superset.examples.generic_loader.db")
def test_load_parquet_table_works_without_uuid(mock_db, mock_get_db):
    """Test that load_parquet_table works correctly when no UUID is provided."""
    from superset.examples.generic_loader import load_parquet_table

    mock_database = MagicMock()
    mock_database.id = 1
    mock_database.has_table.return_value = True
    mock_get_db.return_value = mock_database

    mock_engine = MagicMock()
    mock_inspector = MagicMock()
    mock_inspector.default_schema_name = "public"
    mock_database.get_sqla_engine.return_value.__enter__ = MagicMock(
        return_value=mock_engine
    )
    mock_database.get_sqla_engine.return_value.__exit__ = MagicMock(return_value=False)

    # Simulate table not found
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

    with patch("superset.examples.generic_loader.inspect") as mock_inspect:
        mock_inspect.return_value = mock_inspector

        tbl = load_parquet_table(
            parquet_file="test_data",
            table_name="test_table",
            database=mock_database,
            only_metadata=True,
            # No uuid parameter
        )

    # UUID should remain None
    assert tbl.uuid is None


def test_create_generic_loader_passes_uuid():
    """Test that create_generic_loader passes UUID to load_parquet_table."""
    from superset.examples.generic_loader import create_generic_loader

    test_uuid = "12345678-1234-1234-1234-123456789012"
    loader = create_generic_loader(
        parquet_file="test_data",
        table_name="test_table",
        uuid=test_uuid,
    )

    # Verify loader was created with UUID in closure
    with patch("superset.examples.generic_loader.load_parquet_table") as mock_load:
        mock_load.return_value = MagicMock()

        loader(only_metadata=True)

        # Verify UUID was passed through
        mock_load.assert_called_once()
        call_kwargs = mock_load.call_args[1]
        assert call_kwargs["uuid"] == test_uuid


def test_create_generic_loader_without_uuid():
    """Test that create_generic_loader works without UUID (backward compat)."""
    from superset.examples.generic_loader import create_generic_loader

    loader = create_generic_loader(
        parquet_file="test_data",
        table_name="test_table",
        # No uuid
    )

    with patch("superset.examples.generic_loader.load_parquet_table") as mock_load:
        mock_load.return_value = MagicMock()

        loader(only_metadata=True)

        mock_load.assert_called_once()
        call_kwargs = mock_load.call_args[1]
        assert call_kwargs["uuid"] is None
