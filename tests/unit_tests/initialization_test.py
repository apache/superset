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

from sqlalchemy.exc import OperationalError

from superset.initialization import SupersetAppInitializer


class TestSupersetAppInitializer:
    @patch("superset.initialization.db")
    @patch("superset.initialization.inspect")
    @patch("superset.initialization.logger")
    def test_init_database_dependent_features_skips_when_no_tables(
        self, mock_logger, mock_inspect_func, mock_db
    ):
        """Test that initialization is skipped when core tables don't exist."""
        # Setup
        mock_app = MagicMock()
        app_initializer = SupersetAppInitializer(mock_app)
        mock_inspector = MagicMock()
        mock_inspector.has_table.return_value = False
        mock_inspect_func.return_value = mock_inspector
        mock_db.engine = MagicMock()

        # Execute
        app_initializer._init_database_dependent_features()

        # Assert
        mock_inspect_func.assert_called_once_with(mock_db.engine)
        mock_inspector.has_table.assert_called_once_with("dashboards")
        mock_logger.debug.assert_called_once_with(
            "Superset tables not yet created. Skipping database-dependent "
            "initialization. These features will be initialized after "
            "migration."
        )

    @patch("superset.initialization.db")
    @patch("superset.initialization.inspect")
    @patch("superset.initialization.logger")
    def test_init_database_dependent_features_handles_operational_error(
        self, mock_logger, mock_inspect_func, mock_db
    ):
        """Test that OperationalError during inspection is handled gracefully."""
        # Setup
        mock_app = MagicMock()
        app_initializer = SupersetAppInitializer(mock_app)
        error_msg = "Cannot connect to database"
        mock_inspect_func.side_effect = OperationalError(error_msg, None, None)
        mock_db.engine = MagicMock()

        # Execute
        app_initializer._init_database_dependent_features()

        # Assert
        mock_inspect_func.assert_called_once_with(mock_db.engine)
        mock_logger.debug.assert_called_once()
        call_args = mock_logger.debug.call_args
        assert "Error inspecting database tables" in call_args[0][0]
        # The error is passed as second argument with %s formatting
        assert str(call_args[0][1]) == str(OperationalError(error_msg, None, None))

    @patch("superset.initialization.db")
    @patch("superset.initialization.inspect")
    @patch("superset.initialization.feature_flag_manager")
    @patch("superset.initialization.register_sqla_event_listeners")
    @patch("superset.initialization.logger")
    @patch("superset.commands.theme.seed.SeedSystemThemesCommand")
    def test_init_database_dependent_features_initializes_when_tables_exist(
        self,
        mock_seed_themes_command,
        mock_logger,
        mock_register_listeners,
        mock_feature_flag_manager,
        mock_inspect_func,
        mock_db,
    ):
        """Test that features are initialized when database tables exist."""
        # Setup
        mock_app = MagicMock()
        app_initializer = SupersetAppInitializer(mock_app)
        mock_inspector = MagicMock()
        mock_inspector.has_table.return_value = True
        mock_inspect_func.return_value = mock_inspector
        mock_db.engine = MagicMock()
        mock_feature_flag_manager.is_feature_enabled.return_value = True
        mock_seed_themes = MagicMock()
        mock_seed_themes_command.return_value = mock_seed_themes

        # Execute
        app_initializer._init_database_dependent_features()

        # Assert
        mock_inspect_func.assert_called_once_with(mock_db.engine)
        # Check both tables are checked
        assert mock_inspector.has_table.call_count == 2
        mock_inspector.has_table.assert_any_call("dashboards")
        mock_inspector.has_table.assert_any_call("themes")
        mock_feature_flag_manager.is_feature_enabled.assert_called_with(
            "TAGGING_SYSTEM"
        )
        mock_register_listeners.assert_called_once()
        # Should seed themes
        mock_seed_themes_command.assert_called_once()
        mock_seed_themes.run.assert_called_once()
        # Should not log skip message when tables exist
        mock_logger.debug.assert_not_called()

    @patch("superset.initialization.db")
    @patch("superset.initialization.inspect")
    @patch("superset.initialization.feature_flag_manager")
    @patch("superset.initialization.register_sqla_event_listeners")
    @patch("superset.commands.theme.seed.SeedSystemThemesCommand")
    def test_init_database_dependent_features_skips_tagging_when_disabled(
        self,
        mock_seed_themes_command,
        mock_register_listeners,
        mock_feature_flag_manager,
        mock_inspect_func,
        mock_db,
    ):
        """Test that tagging system is not initialized when feature flag is disabled."""
        # Setup
        mock_app = MagicMock()
        app_initializer = SupersetAppInitializer(mock_app)
        mock_inspector = MagicMock()
        mock_inspector.has_table.return_value = True
        mock_inspect_func.return_value = mock_inspector
        mock_db.engine = MagicMock()
        mock_feature_flag_manager.is_feature_enabled.return_value = False
        mock_seed_themes = MagicMock()
        mock_seed_themes_command.return_value = mock_seed_themes

        # Execute
        app_initializer._init_database_dependent_features()

        # Assert
        mock_feature_flag_manager.is_feature_enabled.assert_called_with(
            "TAGGING_SYSTEM"
        )
        mock_register_listeners.assert_not_called()
        # Check both tables are checked
        assert mock_inspector.has_table.call_count == 2
        mock_inspector.has_table.assert_any_call("dashboards")
        mock_inspector.has_table.assert_any_call("themes")

    @patch("superset.initialization.db")
    @patch("superset.initialization.inspect")
    @patch("superset.initialization.logger")
    def test_init_database_dependent_features_handles_inspector_error_in_has_table(
        self, mock_logger, mock_inspect_func, mock_db
    ):
        """Test that OperationalError from has_table check is handled gracefully."""
        # Setup
        mock_app = MagicMock()
        app_initializer = SupersetAppInitializer(mock_app)
        mock_inspector = MagicMock()
        error_msg = "Table check failed"
        mock_inspector.has_table.side_effect = OperationalError(error_msg, None, None)
        mock_inspect_func.return_value = mock_inspector
        mock_db.engine = MagicMock()

        # Execute
        app_initializer._init_database_dependent_features()

        # Assert
        mock_inspect_func.assert_called_once_with(mock_db.engine)
        mock_inspector.has_table.assert_called_once_with("dashboards")
        # Should handle the error gracefully
        mock_logger.debug.assert_called_once()
        call_args = mock_logger.debug.call_args
        assert "Error inspecting database tables" in call_args[0][0]
