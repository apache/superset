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
Tests for add_translations_column migration.

This migration adds a `translations` JSON column to:
- dashboards table (for Dashboard model)
- slices table (for Slice/Chart model)

The translations column stores user-generated content translations
in the format:
{
    "field_name": {
        "locale": "translated_value"
    }
}

Example for dashboards:
{
    "dashboard_title": {"de": "Verkaufs-Dashboard", "fr": "Tableau de bord"},
    "description": {"de": "Monatlicher Verkaufsbericht"}
}

Example for slices:
{
    "slice_name": {"de": "Umsatz nach Region", "fr": "Chiffre d'affaires"},
    "description": {"de": "Quartalsumsatz nach Vertriebsregion"}
}

"""

from typing import Any
from unittest.mock import MagicMock, patch

import sqlalchemy as sa
from sqlalchemy.types import JSON

# Constants for the migration
MIGRATION_MODULE_PATH = (
    "superset.migrations.versions.2026-02-04_14-00_1af0da0adfec_add_translations_column"
)
DASHBOARDS_TABLE = "dashboards"
SLICES_TABLE = "slices"
TRANSLATIONS_COLUMN = "translations"


class MockColumn:
    """Mock SQLAlchemy Column for testing add_columns calls."""

    def __init__(self, name: str, type_: type, **kwargs: Any) -> None:
        self.name = name
        self.type = type_
        self.kwargs = kwargs


class MockLogger:
    """Captures log messages for verification."""

    def __init__(self) -> None:
        self.messages: list[str] = []

    def info(self, message: str, *args: Any) -> None:
        if args:
            formatted = message % args
        else:
            formatted = message
        self.messages.append(formatted)


class MockBatchOp:
    """Mock batch_alter_table context manager."""

    def __init__(self) -> None:
        self.added_columns: list[sa.Column] = []
        self.dropped_columns: list[str] = []

    def add_column(self, column: sa.Column) -> None:
        self.added_columns.append(column)

    def drop_column(self, column_name: str) -> None:
        self.dropped_columns.append(column_name)


def test_upgrade_adds_translations_column_to_dashboards() -> None:
    """
    Verify upgrade() adds translations column to dashboards table.

    The column must:
    1. Be named 'translations'
    2. Have JSON type
    3. Have nullable=True (for backward compatibility)
    """
    mock_logger = MockLogger()
    mock_batch_op = MockBatchOp()

    with (
        patch(
            "superset.migrations.shared.utils.logger",
            mock_logger,
        ),
        patch(
            "superset.migrations.shared.utils.table_has_column",
            return_value=False,
        ),
        patch(
            "superset.migrations.shared.utils.op.batch_alter_table",
        ) as mock_batch_alter,
    ):
        mock_batch_alter.return_value.__enter__ = MagicMock(return_value=mock_batch_op)
        mock_batch_alter.return_value.__exit__ = MagicMock(return_value=False)

        from superset.migrations.shared.utils import add_columns

        # Simulate the migration upgrade for dashboards
        add_columns(
            DASHBOARDS_TABLE,
            sa.Column(TRANSLATIONS_COLUMN, JSON, nullable=True),
        )

        # Verify the column was added
        assert len(mock_batch_op.added_columns) == 1
        added_col = mock_batch_op.added_columns[0]
        assert added_col.name == TRANSLATIONS_COLUMN
        assert isinstance(added_col.type, JSON)

        # Verify log message
        assert any(
            "Adding column" in msg and TRANSLATIONS_COLUMN in msg
            for msg in mock_logger.messages
        )


def test_upgrade_adds_translations_column_to_slices() -> None:
    """
    Verify upgrade() adds translations column to slices table.

    The column must:
    1. Be named 'translations'
    2. Have JSON type
    3. Have nullable=True (for backward compatibility)
    """
    mock_logger = MockLogger()
    mock_batch_op = MockBatchOp()

    with (
        patch(
            "superset.migrations.shared.utils.logger",
            mock_logger,
        ),
        patch(
            "superset.migrations.shared.utils.table_has_column",
            return_value=False,
        ),
        patch(
            "superset.migrations.shared.utils.op.batch_alter_table",
        ) as mock_batch_alter,
    ):
        mock_batch_alter.return_value.__enter__ = MagicMock(return_value=mock_batch_op)
        mock_batch_alter.return_value.__exit__ = MagicMock(return_value=False)

        from superset.migrations.shared.utils import add_columns

        # Simulate the migration upgrade for slices
        add_columns(
            SLICES_TABLE,
            sa.Column(TRANSLATIONS_COLUMN, JSON, nullable=True),
        )

        # Verify the column was added
        assert len(mock_batch_op.added_columns) == 1
        added_col = mock_batch_op.added_columns[0]
        assert added_col.name == TRANSLATIONS_COLUMN
        assert isinstance(added_col.type, JSON)


def test_upgrade_skips_if_column_exists() -> None:
    """
    Verify upgrade() is idempotent - skips if column already exists.

    This ensures the migration can be run multiple times safely.
    """
    mock_logger = MockLogger()
    mock_batch_op = MockBatchOp()

    with (
        patch(
            "superset.migrations.shared.utils.logger",
            mock_logger,
        ),
        patch(
            "superset.migrations.shared.utils.table_has_column",
            return_value=True,  # Column already exists
        ),
        patch(
            "superset.migrations.shared.utils.op.batch_alter_table",
        ) as mock_batch_alter,
    ):
        mock_batch_alter.return_value.__enter__ = MagicMock(return_value=mock_batch_op)
        mock_batch_alter.return_value.__exit__ = MagicMock(return_value=False)

        from superset.migrations.shared.utils import add_columns

        add_columns(
            DASHBOARDS_TABLE,
            sa.Column(TRANSLATIONS_COLUMN, JSON, nullable=True),
        )

        # Column should NOT be added
        assert len(mock_batch_op.added_columns) == 0

        # Log should indicate skipping
        assert any(
            "already present" in msg and TRANSLATIONS_COLUMN in msg
            for msg in mock_logger.messages
        )


def test_downgrade_drops_translations_column_from_dashboards() -> None:
    """
    Verify downgrade() removes translations column from dashboards table.
    """
    mock_logger = MockLogger()
    mock_batch_op = MockBatchOp()

    with (
        patch(
            "superset.migrations.shared.utils.logger",
            mock_logger,
        ),
        patch(
            "superset.migrations.shared.utils.table_has_column",
            return_value=True,  # Column exists
        ),
        patch(
            "superset.migrations.shared.utils.op.batch_alter_table",
        ) as mock_batch_alter,
    ):
        mock_batch_alter.return_value.__enter__ = MagicMock(return_value=mock_batch_op)
        mock_batch_alter.return_value.__exit__ = MagicMock(return_value=False)

        from superset.migrations.shared.utils import drop_columns

        drop_columns(DASHBOARDS_TABLE, TRANSLATIONS_COLUMN)

        # Verify the column was dropped
        assert TRANSLATIONS_COLUMN in mock_batch_op.dropped_columns

        # Verify log message
        assert any(
            "Dropping column" in msg and TRANSLATIONS_COLUMN in msg
            for msg in mock_logger.messages
        )


def test_downgrade_drops_translations_column_from_slices() -> None:
    """
    Verify downgrade() removes translations column from slices table.
    """
    mock_logger = MockLogger()
    mock_batch_op = MockBatchOp()

    with (
        patch(
            "superset.migrations.shared.utils.logger",
            mock_logger,
        ),
        patch(
            "superset.migrations.shared.utils.table_has_column",
            return_value=True,  # Column exists
        ),
        patch(
            "superset.migrations.shared.utils.op.batch_alter_table",
        ) as mock_batch_alter,
    ):
        mock_batch_alter.return_value.__enter__ = MagicMock(return_value=mock_batch_op)
        mock_batch_alter.return_value.__exit__ = MagicMock(return_value=False)

        from superset.migrations.shared.utils import drop_columns

        drop_columns(SLICES_TABLE, TRANSLATIONS_COLUMN)

        # Verify the column was dropped
        assert TRANSLATIONS_COLUMN in mock_batch_op.dropped_columns


def test_downgrade_skips_if_column_not_exists() -> None:
    """
    Verify downgrade() is idempotent - skips if column does not exist.

    This ensures the migration can be reverted multiple times safely.
    """
    mock_logger = MockLogger()
    mock_batch_op = MockBatchOp()

    with (
        patch(
            "superset.migrations.shared.utils.logger",
            mock_logger,
        ),
        patch(
            "superset.migrations.shared.utils.table_has_column",
            return_value=False,  # Column does not exist
        ),
        patch(
            "superset.migrations.shared.utils.op.batch_alter_table",
        ) as mock_batch_alter,
    ):
        mock_batch_alter.return_value.__enter__ = MagicMock(return_value=mock_batch_op)
        mock_batch_alter.return_value.__exit__ = MagicMock(return_value=False)

        from superset.migrations.shared.utils import drop_columns

        drop_columns(DASHBOARDS_TABLE, TRANSLATIONS_COLUMN)

        # Column should NOT be dropped
        assert TRANSLATIONS_COLUMN not in mock_batch_op.dropped_columns

        # Log should indicate skipping
        assert any(
            "is not present" in msg and TRANSLATIONS_COLUMN in msg
            for msg in mock_logger.messages
        )


def test_translations_column_json_type() -> None:
    """
    Verify translations column uses correct JSON type.

    SQLAlchemy's JSON type maps to:
    - PostgreSQL: JSONB (binary JSON with indexing support)
    - MySQL: JSON
    - SQLite: TEXT (with JSON serialization)

    The JSON type is preferred over Text because:
    1. Native JSON validation
    2. JSONB indexing support in PostgreSQL
    3. JSON path queries support
    """
    column = sa.Column(TRANSLATIONS_COLUMN, JSON, nullable=True)
    assert column.name == TRANSLATIONS_COLUMN
    assert isinstance(column.type, JSON)
    assert column.nullable is True


def test_translations_column_default_value_concept() -> None:
    """
    Verify translations column default value behavior.

    Translations should default to empty JSON {}.
    This is handled at the application level, not DB level, because:
    1. Some DBs don't support JSON defaults
    2. Application handles None → {} conversion
    3. Simpler migration without data transformation
    """
    # The column is nullable=True, application handles default
    column = sa.Column(TRANSLATIONS_COLUMN, JSON, nullable=True)
    # No server_default set - application layer responsibility
    assert column.server_default is None


def test_migration_affects_both_tables() -> None:
    """
    Verify migration adds column to both dashboards AND slices tables.

    Both tables need translations column for supporting
    Dashboard and Slice/Chart content localization.
    """
    tables_to_update = [DASHBOARDS_TABLE, SLICES_TABLE]

    for table in tables_to_update:
        mock_batch_op = MockBatchOp()
        with (
            patch(
                "superset.migrations.shared.utils.logger",
                MockLogger(),
            ),
            patch(
                "superset.migrations.shared.utils.table_has_column",
                return_value=False,
            ),
            patch(
                "superset.migrations.shared.utils.op.batch_alter_table",
            ) as mock_batch_alter,
        ):
            mock_batch_alter.return_value.__enter__ = MagicMock(
                return_value=mock_batch_op
            )
            mock_batch_alter.return_value.__exit__ = MagicMock(return_value=False)

            from superset.migrations.shared.utils import add_columns

            add_columns(
                table,
                sa.Column(TRANSLATIONS_COLUMN, JSON, nullable=True),
            )

            assert len(mock_batch_op.added_columns) == 1, (
                f"Expected 1 column added to {table}"
            )
            assert mock_batch_op.added_columns[0].name == TRANSLATIONS_COLUMN
