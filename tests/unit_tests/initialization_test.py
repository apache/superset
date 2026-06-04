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

import os
from unittest.mock import MagicMock, patch

from sqlalchemy.exc import OperationalError

from superset.app import AppRootMiddleware, create_app, SupersetApp
from superset.initialization import SupersetAppInitializer


class TestSupersetApp:
    @patch("superset.app.logger")
    def test_sync_config_to_db_skips_when_no_tables(self, mock_logger):
        """Test that sync is skipped when database is not up-to-date."""
        # Setup
        app = SupersetApp(__name__)
        app.config = {"SQLALCHEMY_DATABASE_URI": "postgresql://user:pass@host:5432/db"}

        # Mock _is_database_up_to_date to return False
        with patch.object(app, "_is_database_up_to_date", return_value=False):
            # Execute
            app.sync_config_to_db()

        # Assert
        mock_logger.info.assert_called_once_with(
            "Pending database migrations: run 'superset db upgrade'"
        )

    @patch("superset.extensions.db")
    @patch("superset.app.logger")
    def test_sync_config_to_db_handles_operational_error(self, mock_logger, mock_db):
        """Test that OperationalError during migration check is handled gracefully."""
        # Setup
        app = SupersetApp(__name__)
        app.config = {"SQLALCHEMY_DATABASE_URI": "postgresql://user:pass@host:5432/db"}
        error_msg = "Cannot connect to database"

        # Mock db.engine.connect to raise an OperationalError
        mock_db.engine.connect.side_effect = OperationalError(error_msg, None, None)

        # Execute
        app.sync_config_to_db()

        # Assert - _is_database_up_to_date should catch the error and return False
        # which causes the info log about pending migrations
        mock_logger.info.assert_called_once_with(
            "Pending database migrations: run 'superset db upgrade'"
        )

    @patch("superset.extensions.feature_flag_manager")
    @patch("superset.app.logger")
    @patch("superset.commands.theme.seed.SeedSystemThemesCommand")
    def test_sync_config_to_db_initializes_when_tables_exist(
        self,
        mock_seed_themes_command,
        mock_logger,
        mock_feature_flag_manager,
    ):
        """Test that features are initialized when database is up-to-date."""
        # Setup
        app = SupersetApp(__name__)
        app.config = {"SQLALCHEMY_DATABASE_URI": "postgresql://user:pass@host:5432/db"}
        mock_feature_flag_manager.is_feature_enabled.return_value = True
        mock_seed_themes = MagicMock()
        mock_seed_themes_command.return_value = mock_seed_themes

        # Mock _is_database_up_to_date to return True
        with (
            patch.object(app, "_is_database_up_to_date", return_value=True),
            patch(
                "superset.tags.core.register_sqla_event_listeners"
            ) as mock_register_listeners,
        ):
            # Execute
            app.sync_config_to_db()

        # Assert
        mock_feature_flag_manager.is_feature_enabled.assert_called_with(
            "TAGGING_SYSTEM"
        )
        mock_register_listeners.assert_called_once()
        # Should seed themes
        mock_seed_themes_command.assert_called_once()
        mock_seed_themes.run.assert_called_once()
        # Should log successful completion
        mock_logger.info.assert_any_call("Syncing configuration to database...")
        mock_logger.info.assert_any_call(
            "Configuration sync to database completed successfully"
        )


class TestSupersetAppInitializer:
    @patch("superset.initialization.logger")
    def test_init_app_in_ctx_calls_sync_config_to_db(self, mock_logger):
        """Test that initialization calls app.sync_config_to_db()."""
        # Setup
        mock_app = MagicMock()
        mock_app.config = {
            "SQLALCHEMY_DATABASE_URI": "postgresql://user:pass@host:5432/db",
            "FLASK_APP_MUTATOR": None,
        }
        app_initializer = SupersetAppInitializer(mock_app)

        # Execute init_app_in_ctx which calls sync_config_to_db
        with (
            patch.object(app_initializer, "configure_fab"),
            patch.object(app_initializer, "configure_url_map_converters"),
            patch.object(app_initializer, "configure_data_sources"),
            patch.object(app_initializer, "configure_auth_provider"),
            patch.object(app_initializer, "configure_async_queries"),
            patch.object(app_initializer, "configure_ssh_manager"),
            patch.object(app_initializer, "configure_stats_manager"),
            patch.object(app_initializer, "init_views"),
        ):
            app_initializer.init_app_in_ctx()

        # Assert that sync_config_to_db was called on the app
        mock_app.sync_config_to_db.assert_called_once()

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


class TestCreateAppRoot:
    """Test app root resolution precedence in create_app."""

    @patch("superset.initialization.SupersetAppInitializer.init_app")
    def test_default_app_root_no_middleware(self, mock_init_app):
        """No param, no config, no env var: app_root is '/', no middleware."""
        env = os.environ.copy()
        env.pop("SUPERSET_APP_ROOT", None)
        env.pop("SUPERSET_CONFIG", None)
        with patch.dict(os.environ, env, clear=True):
            app = create_app()

        assert not isinstance(app.wsgi_app, AppRootMiddleware)

    @patch("superset.initialization.SupersetAppInitializer.init_app")
    def test_application_root_config_activates_middleware(self, mock_init_app):
        """APPLICATION_ROOT in config activates AppRootMiddleware."""
        env = os.environ.copy()
        env.pop("SUPERSET_APP_ROOT", None)
        env.pop("SUPERSET_CONFIG", None)
        with (
            patch.dict(os.environ, env, clear=True),
            patch("superset.config.APPLICATION_ROOT", "/from-config", create=True),
        ):
            app = create_app()

        assert isinstance(app.wsgi_app, AppRootMiddleware)
        assert app.wsgi_app.app_root == "/from-config"

    @patch("superset.initialization.SupersetAppInitializer.init_app")
    def test_env_var_activates_middleware(self, mock_init_app):
        """SUPERSET_APP_ROOT env var activates AppRootMiddleware."""
        env = os.environ.copy()
        env.pop("SUPERSET_CONFIG", None)
        env["SUPERSET_APP_ROOT"] = "/from-env"
        with patch.dict(os.environ, env, clear=True):
            app = create_app()

        assert isinstance(app.wsgi_app, AppRootMiddleware)
        assert app.wsgi_app.app_root == "/from-env"

    @patch("superset.initialization.SupersetAppInitializer.init_app")
    def test_env_var_takes_precedence_over_config(self, mock_init_app):
        """SUPERSET_APP_ROOT env var wins over APPLICATION_ROOT config."""
        env = os.environ.copy()
        env.pop("SUPERSET_CONFIG", None)
        env["SUPERSET_APP_ROOT"] = "/from-env"
        with (
            patch.dict(os.environ, env, clear=True),
            patch("superset.config.APPLICATION_ROOT", "/from-config", create=True),
        ):
            app = create_app()

        assert isinstance(app.wsgi_app, AppRootMiddleware)
        assert app.wsgi_app.app_root == "/from-env"

    @patch("superset.initialization.SupersetAppInitializer.init_app")
    def test_param_takes_precedence_over_env_var(self, mock_init_app):
        """superset_app_root param wins over SUPERSET_APP_ROOT env var."""
        env = os.environ.copy()
        env.pop("SUPERSET_CONFIG", None)
        env["SUPERSET_APP_ROOT"] = "/from-env"
        with patch.dict(os.environ, env, clear=True):
            app = create_app(superset_app_root="/from-param")

        assert isinstance(app.wsgi_app, AppRootMiddleware)
        assert app.wsgi_app.app_root == "/from-param"


class TestInitVersioning:
    """Cover the operational instrumentation added to ``init_versioning``
    in the v4→v5 cycle: the ``ENABLE_VERSIONING_CAPTURE`` kill-switch
    and the ``_warn_if_retention_beat_missing`` startup check.

    The happy path (capture on, listeners attach, retention beat entry
    present) is exercised by the integration tests; this file pins the
    behavioural contract on the misconfiguration / kill-switch branches
    that the v5 continuous-delivery review surfaced as load-bearing for
    operator alerting and recovery."""

    def _initializer(self, config: dict) -> SupersetAppInitializer:
        """Build a ``SupersetAppInitializer`` against a minimal mock app
        whose only meaningful attribute is the config dict. The methods
        under test (`_warn_if_retention_beat_missing` and the kill-switch
        branch of `init_versioning`) only read from ``self.config``;
        nothing about the full Flask app lifecycle is needed."""
        app = MagicMock()
        app.config = config
        return SupersetAppInitializer(app)

    @patch("superset.initialization.logger")
    @patch("superset.versioning.changes.register_change_record_listener")
    @patch("superset.versioning.baseline.register_baseline_listener")
    def test_kill_switch_off_skips_listener_registration(
        self, mock_baseline, mock_change, mock_logger
    ):
        """``ENABLE_VERSIONING_CAPTURE=False`` MUST short-circuit
        ``init_versioning`` before either listener registers. The
        operator's 30-second recovery story relies on this."""
        initializer = self._initializer(
            {
                "ENABLE_VERSIONING_CAPTURE": False,
                "CELERY_CONFIG": None,  # avoid the warn-log noise
            }
        )

        initializer.init_versioning()

        mock_baseline.assert_not_called()
        mock_change.assert_not_called()
        # One WARNING explaining the skip — operator-visible in deploy log.
        assert any(
            "ENABLE_VERSIONING_CAPTURE is False" in str(call)
            for call in mock_logger.warning.call_args_list
        ), (
            "Expected a WARNING log when ENABLE_VERSIONING_CAPTURE=False; "
            f"got {mock_logger.warning.call_args_list}"
        )

    @patch("superset.initialization.logger")
    def test_warn_when_celery_beat_schedule_missing_retention_entry(
        self, mock_logger
    ):
        """When ``CELERY_CONFIG.beat_schedule`` is present but lacks the
        ``version_history.prune_old_versions`` entry, the helper emits
        a WARNING. This is the silent-failure mode the v4 CD review
        called out: capture writes rows; the prune never fires."""

        class _PartialCeleryConfig:
            beat_schedule = {"reports.scheduler": {"task": "reports.scheduler"}}

        initializer = self._initializer({"CELERY_CONFIG": _PartialCeleryConfig})
        initializer._warn_if_retention_beat_missing()

        assert any(
            "version_history.prune_old_versions" in str(call)
            for call in mock_logger.warning.call_args_list
        ), (
            "Expected a WARNING naming the missing retention entry; "
            f"got {mock_logger.warning.call_args_list}"
        )

    @patch("superset.initialization.logger")
    def test_no_warn_when_celery_beat_schedule_includes_retention_entry(
        self, mock_logger
    ):
        """When the default ``CeleryConfig`` (or any class with the
        entry) is in play, no warning fires. The happy path."""

        class _CompleteCeleryConfig:
            beat_schedule = {
                "version_history.prune_old_versions": {
                    "task": "version_history.prune_old_versions",
                },
            }

        initializer = self._initializer({"CELERY_CONFIG": _CompleteCeleryConfig})
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_no_warn_when_celery_config_is_none(self, mock_logger):
        """``CELERY_CONFIG = None`` is the documented "disable Celery
        entirely" path. The warn-log MUST NOT fire — the operator made
        a deliberate choice; complaining about a missing retention entry
        on a Celery-disabled deployment trains operators to ignore the
        warning."""
        initializer = self._initializer({"CELERY_CONFIG": None})
        initializer._warn_if_retention_beat_missing()
        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_dict_form_celery_config_with_entry_does_not_warn(self, mock_logger):
        """Celery accepts a dict-shaped config via
        ``config_from_object``. The warn-log MUST discriminate by
        ``isinstance(dict)`` so an operator who supplies a dict with the
        entry doesn't see a false-positive warning."""
        initializer = self._initializer(
            {
                "CELERY_CONFIG": {
                    "broker_url": "redis://localhost",
                    "beat_schedule": {
                        "version_history.prune_old_versions": {
                            "task": "version_history.prune_old_versions",
                        },
                    },
                },
            }
        )
        initializer._warn_if_retention_beat_missing()
        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_dict_form_celery_config_without_entry_warns(self, mock_logger):
        """The dict-shape symmetry of the previous test: a dict without
        the entry MUST emit the warning, same as a class without it."""
        initializer = self._initializer(
            {
                "CELERY_CONFIG": {
                    "broker_url": "redis://localhost",
                    "beat_schedule": {
                        "reports.scheduler": {"task": "reports.scheduler"},
                    },
                },
            }
        )
        initializer._warn_if_retention_beat_missing()

        assert any(
            "version_history.prune_old_versions" in str(call)
            for call in mock_logger.warning.call_args_list
        ), (
            "Expected a WARNING for dict-form CELERY_CONFIG missing the "
            f"entry; got {mock_logger.warning.call_args_list}"
        )
