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

    def test_database_uri_lazy_property(self):
        """Test database_uri property uses lazy initialization with smart caching."""
        # Setup
        mock_app = MagicMock()
        test_uri = "postgresql://user:pass@host:5432/testdb"
        mock_app.config = {"SQLALCHEMY_DATABASE_URI": test_uri}
        app_initializer = SupersetAppInitializer(mock_app)

        # Ensure cache is None initially
        assert app_initializer._db_uri_cache is None

        # First access should set the cache (valid URI)
        uri = app_initializer.database_uri
        assert uri == test_uri
        assert app_initializer._db_uri_cache is not None
        assert app_initializer._db_uri_cache == test_uri

        # Second access should use cache (not call config.get again)
        # Change the config to verify cache is being used
        mock_app.config["SQLALCHEMY_DATABASE_URI"] = "different_uri"
        uri2 = app_initializer.database_uri
        assert (
            uri2 == test_uri
        )  # Should still return cached value (not "different_uri")

    def test_database_uri_lazy_property_with_missing_config(self):
        """Test that database_uri property returns empty string when config missing."""
        # Setup
        mock_app = MagicMock()
        mock_app.config = {}  # Empty config
        app_initializer = SupersetAppInitializer(mock_app)

        # Should return empty string when config key doesn't exist
        uri = app_initializer.database_uri
        assert uri == ""
        # Empty string is a fallback value, so it should NOT be cached
        assert app_initializer._db_uri_cache is None

    def test_database_uri_prevents_nouser_fallback(self):
        """Test that lazy initialization prevents nouser fallback during deployment."""
        # Setup - simulate deployment scenario where config is loaded properly
        mock_app = MagicMock()

        # Config is properly loaded with real database URI (not nouser)
        mock_app.config = {
            "SQLALCHEMY_DATABASE_URI": "postgresql://realuser:realpass@realhost:5432/realdb"
        }
        app_initializer = SupersetAppInitializer(mock_app)

        # Access the database URI - should get the real URI, not nouser
        uri = app_initializer.database_uri
        assert uri == "postgresql://realuser:realpass@realhost:5432/realdb"
        assert "nouser" not in uri
        assert "nopassword" not in uri
        assert "nohost" not in uri
        assert "nodb" not in uri

        # Verify cache is working
        assert app_initializer._db_uri_cache is not None
        assert (
            app_initializer._db_uri_cache
            == "postgresql://realuser:realpass@realhost:5432/realdb"
        )

    @patch("superset.initialization.make_url_safe")
    @patch("superset.initialization.db")
    def test_set_db_default_isolation_uses_lazy_property(
        self, mock_db, mock_make_url_safe
    ):
        """Test that set_db_default_isolation uses the lazy database_uri property."""
        # Setup
        mock_app = MagicMock()
        test_uri = "postgresql://user:pass@host:5432/testdb"
        mock_app.config = {
            "SQLALCHEMY_DATABASE_URI": test_uri,
            "SQLALCHEMY_ENGINE_OPTIONS": {},
        }
        app_initializer = SupersetAppInitializer(mock_app)

        # Mock make_url_safe to return a URL with postgresql backend
        mock_url = MagicMock()
        mock_url.get_backend_name.return_value = "postgresql"
        mock_make_url_safe.return_value = mock_url

        # Mock db.engine
        mock_engine = MagicMock()
        mock_db.engine = mock_engine

        # Execute
        app_initializer.set_db_default_isolation()

        # Assert that make_url_safe was called with the lazy property value
        mock_make_url_safe.assert_called_once_with(test_uri)

        # Should set isolation level to READ COMMITTED for postgresql
        mock_engine.execution_options.assert_called_once_with(
            isolation_level="READ COMMITTED"
        )

        # Verify the cache was created
        assert app_initializer._db_uri_cache is not None
        assert app_initializer._db_uri_cache == test_uri

    @patch("superset.initialization.make_url_safe")
    @patch("superset.initialization.db")
    def test_set_db_default_isolation_with_empty_uri(self, mock_db, mock_make_url_safe):
        """Test that set_db_default_isolation handles empty URI gracefully."""
        # Setup
        mock_app = MagicMock()
        mock_app.config = {
            "SQLALCHEMY_DATABASE_URI": "",  # Empty URI
            "SQLALCHEMY_ENGINE_OPTIONS": {},
        }
        app_initializer = SupersetAppInitializer(mock_app)

        # Mock make_url_safe to return a URL with no backend
        mock_url = MagicMock()
        mock_url.get_backend_name.return_value = None
        mock_make_url_safe.return_value = mock_url

        # Execute
        app_initializer.set_db_default_isolation()

        # Should handle empty URI gracefully
        mock_make_url_safe.assert_called_once_with("")

        # Should not set isolation level for empty/unknown backend
        mock_db.engine.execution_options.assert_not_called()

    def test_database_uri_doesnt_cache_fallback_values(self):
        """Test that fallback values like 'nouser' are not cached."""
        # Setup
        mock_app = MagicMock()

        # Initially return the fallback nouser URI
        config_dict = {
            "SQLALCHEMY_DATABASE_URI": "postgresql://nouser:nopassword@nohost:5432/nodb"
        }
        mock_app.config = config_dict
        app_initializer = SupersetAppInitializer(mock_app)

        # First access returns fallback but shouldn't cache it
        uri1 = app_initializer.database_uri
        assert uri1 == "postgresql://nouser:nopassword@nohost:5432/nodb"
        assert app_initializer._db_uri_cache is None  # Should NOT be cached

        # Now config is properly loaded - update the same dict
        config_dict["SQLALCHEMY_DATABASE_URI"] = (
            "postgresql://realuser:realpass@realhost:5432/realdb"
        )

        # Second access should get the new value since fallback wasn't cached
        uri2 = app_initializer.database_uri
        assert uri2 == "postgresql://realuser:realpass@realhost:5432/realdb"
        assert app_initializer._db_uri_cache is not None  # Now it should be cached
        assert (
            app_initializer._db_uri_cache
            == "postgresql://realuser:realpass@realhost:5432/realdb"
        )

        # Third access should use cache even if config changes again
        config_dict["SQLALCHEMY_DATABASE_URI"] = (
            "postgresql://different:uri@host:5432/db"
        )
        uri3 = app_initializer.database_uri
        assert (
            uri3 == "postgresql://realuser:realpass@realhost:5432/realdb"
        )  # Still cached value

    def test_database_uri_caches_valid_uri(self):
        """Test that valid URIs are properly cached."""
        # Setup
        mock_app = MagicMock()
        valid_uri = "postgresql://validuser:validpass@validhost:5432/validdb"
        mock_app.config = {"SQLALCHEMY_DATABASE_URI": valid_uri}
        app_initializer = SupersetAppInitializer(mock_app)

        # First access should cache valid URI
        uri1 = app_initializer.database_uri
        assert uri1 == valid_uri
        assert app_initializer._db_uri_cache is not None
        assert app_initializer._db_uri_cache == valid_uri

        # Change config
        mock_app.config = {
            "SQLALCHEMY_DATABASE_URI": "postgresql://changed:uri@host:5432/db"
        }

        # Second access should still return cached value
        uri2 = app_initializer.database_uri
        assert uri2 == valid_uri  # Still the cached value, not the changed one

    def test_database_uri_fallback_patterns(self):
        """Test that various fallback patterns are not cached."""
        # Test various fallback patterns
        fallback_uris = [
            "postgresql://nouser:nopassword@nohost:5432/nodb",
            "mysql://NOUSER:NOPASSWORD@NOHOST:3306/NODB",
            "postgresql://noUser:pass@host:5432/db",  # Contains 'nouser' (case insens.)
            "sqlite:///nohost.db",  # Contains 'nohost'
            "",  # Empty string
        ]

        for fallback_uri in fallback_uris:
            # Create a fresh initializer for each test
            mock_app = MagicMock()
            mock_app.config = {"SQLALCHEMY_DATABASE_URI": fallback_uri}
            app_initializer = SupersetAppInitializer(mock_app)

            uri = app_initializer.database_uri

            # Should return the value but not cache it
            assert uri == fallback_uri
            assert app_initializer._db_uri_cache is None, (
                f"Should not cache: {fallback_uri}"
            )

    @patch("superset.initialization.logger")
    @patch("superset.initialization.inspect")
    @patch("superset.initialization.db")
    def test_init_database_dependent_features_skips_with_fallback_uri(
        self, mock_db, mock_inspect, mock_logger
    ):
        """Test that database-dependent features are skipped when URI is a fallback."""
        # Setup
        mock_app = MagicMock()
        # Set a fallback URI that would cause connection to fail
        mock_app.config = {
            "SQLALCHEMY_DATABASE_URI": "postgresql://nouser:nopassword@nohost:5432/nodb"
        }
        app_initializer = SupersetAppInitializer(mock_app)

        # Execute
        app_initializer._init_database_dependent_features()

        # Assert - should not try to inspect database
        mock_inspect.assert_not_called()
        # Should log warning about fallback URI
        mock_logger.warning.assert_called_once()
        warning_message = mock_logger.warning.call_args[0][0]
        assert "fallback value" in warning_message
        assert "workspace context" in warning_message
