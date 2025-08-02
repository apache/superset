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
from unittest.mock import MagicMock, patch

import pytest

from superset.commands.theme.resolve import ResolveAndUpsertThemeCommand
from superset.models.core import Theme
from superset.utils import json


@pytest.fixture
def mock_theme_dao():
    with patch("superset.commands.theme.resolve.ThemeDAO") as mock:
        yield mock


@pytest.fixture
def mock_db():
    with patch("superset.commands.theme.resolve.db") as mock:
        yield mock


class TestResolveAndUpsertThemeCommand:
    def test_resolve_uuid_reference_found(self, mock_theme_dao, mock_db):
        """Test resolving a UUID reference when theme is found."""
        # Setup
        uuid = "test-uuid-123"
        theme_config = {"uuid": uuid}
        expected_config = {"algorithm": "dark", "token": {"colorPrimary": "#1890ff"}}

        mock_theme = MagicMock(spec=Theme)
        mock_theme.json_data = json.dumps(expected_config)
        mock_theme_dao.find_by_uuid.return_value = mock_theme

        # Execute
        command = ResolveAndUpsertThemeCommand(theme_config, "THEME_DEFAULT")
        result = command.run()

        # Assert
        assert result == expected_config
        mock_theme_dao.find_by_uuid.assert_called_once_with(uuid)

    def test_resolve_uuid_reference_not_found(self, mock_theme_dao, mock_db):
        """Test resolving a UUID reference when theme is not found."""
        # Setup
        uuid = "missing-uuid-123"
        theme_config = {"uuid": uuid}
        mock_theme_dao.find_by_uuid.return_value = None

        # Execute
        command = ResolveAndUpsertThemeCommand(theme_config, "THEME_DEFAULT")
        result = command.run()

        # Assert - should return empty dict fallback
        assert result == {}
        mock_theme_dao.find_by_uuid.assert_called_once_with(uuid)

    def test_resolve_uuid_reference_invalid_json(self, mock_theme_dao, mock_db):
        """Test resolving a UUID reference with invalid JSON data."""
        # Setup
        uuid = "test-uuid-123"
        theme_config = {"uuid": uuid}

        mock_theme = MagicMock(spec=Theme)
        mock_theme.json_data = "invalid json"
        mock_theme_dao.find_by_uuid.return_value = mock_theme

        # Execute
        command = ResolveAndUpsertThemeCommand(theme_config, "THEME_DEFAULT")
        result = command.run()

        # Assert - should return empty dict fallback
        assert result == {}

    def test_resolve_non_uuid_config(self, mock_theme_dao, mock_db):
        """Test resolving a regular theme config (not UUID reference)."""
        # Setup
        theme_config = {"algorithm": "default", "token": {"colorPrimary": "#ff0000"}}

        # Execute
        command = ResolveAndUpsertThemeCommand(theme_config, "THEME_DEFAULT")
        result = command.run()

        # Assert - should return config as-is
        assert result == theme_config
        mock_theme_dao.find_by_uuid.assert_not_called()

    def test_upsert_creates_new_system_theme(self, mock_theme_dao, mock_db):
        """Test upserting creates a new system theme when none exists."""
        # Setup
        theme_config = {"algorithm": "default"}
        mock_db.session.query.return_value.filter.return_value.first.return_value = None

        # Execute
        command = ResolveAndUpsertThemeCommand(theme_config, "THEME_DEFAULT")
        command.run()

        # Assert
        mock_db.session.add.assert_called_once()
        added_theme = mock_db.session.add.call_args[0][0]
        assert added_theme.theme_name == "THEME_DEFAULT"
        assert added_theme.is_system is True
        assert added_theme.json_data == json.dumps(theme_config)

    def test_upsert_updates_existing_system_theme(self, mock_theme_dao, mock_db):
        """Test upserting updates an existing system theme."""
        # Setup
        theme_config = {"algorithm": "dark"}
        existing_theme = MagicMock(spec=Theme)
        mock_db.session.query.return_value.filter.return_value.first.return_value = (
            existing_theme
        )

        # Execute
        command = ResolveAndUpsertThemeCommand(theme_config, "THEME_DARK")
        command.run()

        # Assert
        assert existing_theme.json_data == json.dumps(theme_config)
        mock_db.session.add.assert_not_called()

    def test_fallback_for_theme_default(self, mock_theme_dao, mock_db):
        """Test fallback returns empty dict for THEME_DEFAULT."""
        # Setup - simulate UUID lookup failure
        theme_config = {"uuid": "non-existent-uuid"}
        mock_theme_dao.find_by_uuid.return_value = None

        # Execute
        command = ResolveAndUpsertThemeCommand(theme_config, "THEME_DEFAULT")
        result = command.run()

        # Assert
        assert result == {}

    def test_fallback_for_theme_dark(self, mock_theme_dao, mock_db):
        """Test fallback returns dark algorithm for THEME_DARK."""
        # Setup - simulate UUID lookup failure
        theme_config = {"uuid": "non-existent-uuid"}
        mock_theme_dao.find_by_uuid.return_value = None

        # Execute
        command = ResolveAndUpsertThemeCommand(theme_config, "THEME_DARK")
        result = command.run()

        # Assert
        assert result == {"algorithm": "dark"}

    def test_uuid_with_additional_fields(self, mock_theme_dao, mock_db):
        """Test that UUID takes precedence even with additional fields."""
        # Setup
        uuid = "test-uuid-123"
        theme_config = {
            "uuid": uuid,
            "algorithm": "ignored",  # This should be ignored
            "token": {"ignored": True},  # This should be ignored
        }
        expected_config = {"algorithm": "dark", "token": {"colorPrimary": "#1890ff"}}

        mock_theme = MagicMock(spec=Theme)
        mock_theme.json_data = json.dumps(expected_config)
        mock_theme_dao.find_by_uuid.return_value = mock_theme

        # Execute
        command = ResolveAndUpsertThemeCommand(theme_config, "THEME_DEFAULT")
        result = command.run()

        # Assert - should return the resolved config, not the input
        assert result == expected_config
        mock_theme_dao.find_by_uuid.assert_called_once_with(uuid)
