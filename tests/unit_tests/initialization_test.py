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
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

from sqlalchemy.exc import OperationalError
from werkzeug.test import Client
from werkzeug.wrappers import Response

from superset.app import AppRootMiddleware, create_app, SupersetApp
from superset.commands.database.exceptions import DatabaseInvalidError
from superset.config import CeleryConfig
from superset.initialization import SupersetAppInitializer
from superset.middleware.legacy_prefix_redirect import LegacyPrefixRedirectMiddleware


def _unwrap_to_app_root(app):
    """Walk the WSGI middleware chain past the outermost
    `LegacyPrefixRedirectMiddleware` (always installed) and return the
    next layer. Lets the existing AppRootMiddleware-shape assertions
    survive the outer-wrap change."""
    assert isinstance(app.wsgi_app, LegacyPrefixRedirectMiddleware)
    return app.wsgi_app.wsgi_app


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
    @patch("superset.initialization.os.makedirs")
    @patch("superset.initialization.wtforms_json.init")
    @patch("superset.initialization.validate_report_execution_config")
    def test_pre_init_validates_report_budget_at_boot(
        self,
        validate_report_config,
        wtforms_init,
        makedirs,
    ) -> None:
        mock_app = MagicMock()
        mock_app.config = {"DATA_DIR": "/var/lib/superset"}
        app_initializer = SupersetAppInitializer(mock_app)

        app_initializer.pre_init()

        validate_report_config.assert_called_once_with(mock_app.config)
        wtforms_init.assert_called_once_with()
        makedirs.assert_called_once_with("/var/lib/superset", exist_ok=True)

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

    def test_check_and_warn_database_connection_masks_password(self) -> None:
        mock_app = MagicMock()
        mock_app.app_context.return_value.__enter__.return_value = MagicMock()

        with patch("superset.initialization.db") as mock_db:
            mock_db.engine.connect.side_effect = Exception("Connection Failed")

            with patch.object(
                SupersetAppInitializer,
                "database_uri",
                new_callable=PropertyMock,
            ) as mock_uri:
                mock_uri.return_value = "postgresql://user:secretpass@localhost:5432/db"
                app_initializer = SupersetAppInitializer(mock_app)

                with patch("builtins.print") as mock_print:
                    app_initializer.check_and_warn_database_connection()

                mock_print.assert_called_once()
                output = mock_print.call_args[0][0]
                assert "secretpass" not in output
                assert "postgresql://user:***@localhost:5432/db" in output

    @patch("superset.initialization.logger")
    def test_configure_logging_installs_pkg_resources_filter_before_configurator(
        self, mock_logger
    ) -> None:
        """The pkg_resources warning filter must be installed before
        LOGGING_CONFIGURATOR.configure_logging() dispatches, so a deployment's
        custom configurator (which may skip DefaultLoggingConfigurator's own
        filter) still benefits from it."""
        import re
        import warnings

        def has_pkg_resources_filter() -> bool:
            return any(
                f[0] == "ignore"
                and isinstance(f[1], re.Pattern)
                and f[1].pattern == r"pkg_resources is deprecated as an API"
                and f[2] is UserWarning
                and isinstance(f[3], re.Pattern)
                and f[3].pattern == r"sqlalchemy_redshift(?:\..*)?"
                for f in warnings.filters
            )

        seen_during_dispatch = []

        class RecordingConfigurator:
            def configure_logging(self, app_config, debug_mode):
                seen_during_dispatch.append(has_pkg_resources_filter())

        mock_app = MagicMock()
        mock_app.config = {"LOGGING_CONFIGURATOR": RecordingConfigurator()}
        mock_app.debug = False
        app_initializer = SupersetAppInitializer(mock_app)

        with warnings.catch_warnings():
            # Isolate from filters registered by other tests/import side effects.
            warnings.resetwarnings()
            assert not has_pkg_resources_filter()

            app_initializer.configure_logging()

            assert seen_during_dispatch == [True], (
                "pkg_resources filter must already be installed by the time "
                "LOGGING_CONFIGURATOR.configure_logging() runs"
            )

    def test_check_and_warn_database_connection_invalid_uri(self) -> None:
        """Test that invalid URIs are handled safely without crashing."""
        mock_app = MagicMock()
        mock_app.app_context.return_value.__enter__.return_value = MagicMock()

        with patch("superset.initialization.db") as mock_db:
            mock_db.engine.connect.side_effect = Exception("Connection Failed")

            with patch.object(
                SupersetAppInitializer,
                "database_uri",
                new_callable=PropertyMock,
            ) as mock_uri:
                mock_uri.return_value = "sqlite://"
                app_initializer = SupersetAppInitializer(mock_app)

                with patch(
                    "superset.initialization.make_url_safe",
                    side_effect=DatabaseInvalidError(),
                ):
                    with patch("builtins.print") as mock_print:
                        app_initializer.check_and_warn_database_connection()

                mock_print.assert_called_once()
                output = mock_print.call_args[0][0]
                assert (
                    "ERROR: Cannot connect to database <invalid database URI>" in output
                )


class TestInitVersioning:
    """Structural coverage for the ``ENABLE_VERSIONING_CAPTURE`` gate.

    Drives ``init_versioning`` through the real config branch (rather than
    calling the detach helper directly) so a future inversion of the gate —
    or of its default — is caught cheaply, without a DB. The behavioral
    "zero rows when off" proof lives in
    ``tests/integration_tests/versioning/capture_disabled_tests.py``.
    """

    def test_capture_flag_off_detaches_and_skips_registration(self):
        """Flag explicitly False → detach Continuum, register nothing."""
        fake = MagicMock()
        fake.config = {"ENABLE_VERSIONING_CAPTURE": False}

        with (
            patch(
                "superset.versioning.baseline.register_baseline_listener"
            ) as reg_baseline,
            patch(
                "superset.versioning.changes.register_change_record_listener"
            ) as reg_changes,
        ):
            SupersetAppInitializer.init_versioning(fake)

        fake._remove_continuum_write_listeners.assert_called_once()
        reg_baseline.assert_not_called()
        reg_changes.assert_not_called()

    def test_capture_flag_absent_defaults_to_off(self):
        """Flag absent → fallback MUST be off, so any app-factory path that
        doesn't load ``superset.config`` stays inert rather than silently
        enabling capture."""
        fake = MagicMock()
        fake.config = {}

        SupersetAppInitializer.init_versioning(fake)

        fake._remove_continuum_write_listeners.assert_called_once()

    def test_capture_flag_on_registers_listeners_without_detaching(self):
        """Flag True → register both before-flush listeners, never detach."""
        fake = MagicMock()
        fake.config = {"ENABLE_VERSIONING_CAPTURE": True}

        with (
            patch(
                "superset.versioning.baseline.register_baseline_listener"
            ) as reg_baseline,
            patch("superset.versioning.baseline.VERSIONED_MODELS", []),
            patch(
                "superset.versioning.changes.register_change_record_listener"
            ) as reg_changes,
            patch("sqlalchemy_continuum.version_class"),
        ):
            SupersetAppInitializer.init_versioning(fake)

        reg_baseline.assert_called_once()
        reg_changes.assert_called_once()
        fake._remove_continuum_write_listeners.assert_not_called()
        # The ON path re-attaches Continuum's core writers so an off->on
        # toggle in one process restores capture (see round-trip test below).
        fake._add_continuum_write_listeners.assert_called_once()

    def test_remove_then_add_continuum_write_listeners_round_trips(self):
        """The off->on-in-one-process path: OFF detaches Continuum's core write
        listeners; ON must re-attach them — otherwise capture is silently dead
        after a toggle despite the flag reading "enabled". Exercises the real
        detach/attach helpers against Continuum's global event registrations."""
        import sqlalchemy as sa
        from sqlalchemy_continuum import versioning_manager

        def attached() -> bool:
            return sa.event.contains(
                sa.orm.Mapper, "after_insert", versioning_manager.track_inserts
            )

        orig_attached = attached()
        orig_option = versioning_manager.options.get("versioning")
        try:
            SupersetAppInitializer._remove_continuum_write_listeners()
            assert not attached(), "OFF must detach Continuum's write listeners"

            SupersetAppInitializer._add_continuum_write_listeners()
            assert attached(), "ON must re-attach Continuum's write listeners"

            # Idempotent: re-adding on an already-attached manager is a no-op.
            SupersetAppInitializer._add_continuum_write_listeners()
            assert attached()
        finally:
            # Restore Continuum's global state so sibling tests aren't polluted.
            if attached() and not orig_attached:
                SupersetAppInitializer._remove_continuum_write_listeners()
            elif not attached() and orig_attached:
                SupersetAppInitializer._add_continuum_write_listeners()
            versioning_manager.options["versioning"] = orig_option


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

        # The outermost `LegacyPrefixRedirectMiddleware` is now always
        # installed. Under root deployment, the next layer
        # should NOT be `AppRootMiddleware`.
        inner = _unwrap_to_app_root(app)
        assert not isinstance(inner, AppRootMiddleware)

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

        inner = _unwrap_to_app_root(app)
        assert isinstance(inner, AppRootMiddleware)
        assert inner.app_root == "/from-config"

    @patch("superset.initialization.SupersetAppInitializer.init_app")
    def test_env_var_activates_middleware(self, mock_init_app):
        """SUPERSET_APP_ROOT env var activates AppRootMiddleware."""
        env = os.environ.copy()
        env.pop("SUPERSET_CONFIG", None)
        env["SUPERSET_APP_ROOT"] = "/from-env"
        with patch.dict(os.environ, env, clear=True):
            app = create_app()

        inner = _unwrap_to_app_root(app)
        assert isinstance(inner, AppRootMiddleware)
        assert inner.app_root == "/from-env"

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

        inner = _unwrap_to_app_root(app)
        assert isinstance(inner, AppRootMiddleware)
        assert inner.app_root == "/from-env"

    @patch("superset.initialization.SupersetAppInitializer.init_app")
    def test_param_takes_precedence_over_env_var(self, mock_init_app):
        """superset_app_root param wins over SUPERSET_APP_ROOT env var."""
        env = os.environ.copy()
        env.pop("SUPERSET_CONFIG", None)
        env["SUPERSET_APP_ROOT"] = "/from-env"
        with patch.dict(os.environ, env, clear=True):
            app = create_app(superset_app_root="/from-param")

        inner = _unwrap_to_app_root(app)
        assert isinstance(inner, AppRootMiddleware)
        assert inner.app_root == "/from-param"

    @patch("superset.initialization.SupersetAppInitializer.init_app")
    def test_trailing_slash_normalized_at_source(self, mock_init_app):
        """A trailing slash in SUPERSET_APP_ROOT is stripped once in
        create_app, so derived config never sees "/myapp/": otherwise
        STATIC_ASSETS_PREFIX would build "/myapp//static/..." asset URLs
        and APPLICATION_ROOT (the session-cookie path) would keep the
        slash while SCRIPT_NAME drops it."""
        env = os.environ.copy()
        env.pop("SUPERSET_CONFIG", None)
        env["SUPERSET_APP_ROOT"] = "/myapp/"
        with patch.dict(os.environ, env, clear=True):
            app = create_app()

        inner = _unwrap_to_app_root(app)
        assert isinstance(inner, AppRootMiddleware)
        assert inner.app_root == "/myapp"
        assert app.config["STATIC_ASSETS_PREFIX"] == "/myapp"
        assert app.config["APPLICATION_ROOT"] == "/myapp"

    @patch("superset.initialization.SupersetAppInitializer.init_app")
    def test_bare_slash_app_root_stays_root(self, mock_init_app):
        """SUPERSET_APP_ROOT="/" normalizes to "/" (not ""), keeping the
        root-deployment fast path (no AppRootMiddleware)."""
        env = os.environ.copy()
        env.pop("SUPERSET_CONFIG", None)
        env["SUPERSET_APP_ROOT"] = "/"
        with patch.dict(os.environ, env, clear=True):
            app = create_app()

        inner = _unwrap_to_app_root(app)
        assert not isinstance(inner, AppRootMiddleware)
        assert app.config["APPLICATION_ROOT"] == "/"


class TestAppRootMiddlewareBoundary:
    """Direct PATH_INFO handling tests for AppRootMiddleware."""

    @staticmethod
    def _make(app_root: str):
        captured: dict[str, str | None] = {}

        def inner_app(environ, start_response):
            captured["PATH_INFO"] = environ.get("PATH_INFO")
            captured["SCRIPT_NAME"] = environ.get("SCRIPT_NAME")
            start_response("200 OK", [("Content-Type", "text/plain")])
            return [b"OK"]

        return AppRootMiddleware(inner_app, app_root), captured

    @staticmethod
    def _call(middleware, path: str) -> str:
        client = Client(middleware, response_wrapper=Response)
        return str(client.get(path).status_code)

    def test_strips_prefix_and_sets_script_name(self):
        middleware, captured = self._make("/myapp")
        status = self._call(middleware, "/myapp/dashboard/1/")
        assert status.startswith("200")
        assert captured["PATH_INFO"] == "/dashboard/1/"
        assert captured["SCRIPT_NAME"] == "/myapp"

    def test_exact_app_root_path_is_accepted(self):
        middleware, captured = self._make("/myapp")
        status = self._call(middleware, "/myapp")
        assert status.startswith("200")
        assert captured["PATH_INFO"] == ""
        assert captured["SCRIPT_NAME"] == "/myapp"

    def test_shared_string_prefix_is_404_not_stripped(self):
        """Segment-boundary pin: "/myapparoo/..." merely shares a string
        prefix with app_root "/myapp" and must 404, not be mangled into
        PATH_INFO "aroo/..."."""
        middleware, captured = self._make("/myapp")
        status = self._call(middleware, "/myapparoo/dashboard/1/")
        assert status.startswith("404")
        assert "PATH_INFO" not in captured

    def test_path_outside_app_root_is_404(self):
        middleware, captured = self._make("/myapp")
        status = self._call(middleware, "/other/welcome/")
        assert status.startswith("404")
        assert "PATH_INFO" not in captured

    def test_trailing_slash_app_root_is_normalized(self):
        middleware, captured = self._make("/myapp/")
        status = self._call(middleware, "/myapp/welcome/")
        assert status.startswith("200")
        assert captured["PATH_INFO"] == "/welcome/"
        assert captured["SCRIPT_NAME"] == "/myapp"


class TestRetentionBeatWarning:
    """Cover ``_warn_if_retention_beat_missing`` — the startup check that
    surfaces a missing ``version_history.prune_old_versions`` beat entry.
    (The ``ENABLE_VERSIONING_CAPTURE`` kill-switch branch of
    ``init_versioning`` is covered by ``TestInitVersioning`` above.)

    Operators who redefine ``CeleryConfig`` instead of subclassing or
    merging the default silently lose the retention task; this pins that
    the misconfiguration is logged at startup rather than discovered when
    disk fills."""

    def _initializer(self, config: dict[str, Any]) -> SupersetAppInitializer:
        """Build a ``SupersetAppInitializer`` against a minimal mock app
        whose only meaningful attribute is the config dict.
        ``_warn_if_retention_beat_missing`` reads ``CELERY_CONFIG`` and the
        static feature-flag dictionaries from this config."""
        config.setdefault("DEFAULT_FEATURE_FLAGS", {"SOFT_DELETE": False})
        config.setdefault("FEATURE_FLAGS", {})
        app = MagicMock()
        app.config = config
        return SupersetAppInitializer(app)

    @patch("superset.initialization.logger")
    def test_warn_when_celery_beat_schedule_missing_retention_entry(
        self, mock_logger: MagicMock
    ) -> None:
        """When ``CELERY_CONFIG.beat_schedule`` is present but lacks the
        ``version_history.prune_old_versions`` entry, the helper emits
        a WARNING. This guards the silent-failure mode where capture writes
        rows but the prune never fires."""

        class _PartialCeleryConfig:
            imports: tuple[str, ...] = (
                "superset.tasks.version_history_retention",
                "superset.tasks.deletion_retention",
            )
            beat_schedule: dict[str, dict[str, str]] = {
                "reports.scheduler": {"task": "reports.scheduler"}
            }

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
        self, mock_logger: MagicMock
    ) -> None:
        """When the default ``CeleryConfig`` (or any class with the
        entry) is in play, no warning fires. The happy path."""

        class _CompleteCeleryConfig:
            imports: tuple[str, ...] = (
                "superset.tasks.version_history_retention",
                "superset.tasks.deletion_retention",
            )
            beat_schedule: dict[str, dict[str, str]] = {
                "version_history.prune_old_versions": {
                    "task": "version_history.prune_old_versions",
                },
            }

        initializer = self._initializer({"CELERY_CONFIG": _CompleteCeleryConfig})
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_no_warn_when_retention_task_registered_under_other_key(
        self, mock_logger: MagicMock
    ) -> None:
        """The retention task registered under a non-matching schedule key
        (a valid Celery config) MUST NOT warn: the check matches on each
        entry's ``task``, not the schedule key."""

        class _RenamedKeyCeleryConfig:
            imports: tuple[str, ...] = (
                "superset.tasks.version_history_retention",
                "superset.tasks.deletion_retention",
            )
            beat_schedule: dict[str, dict[str, str]] = {
                "prune_versions": {
                    "task": "version_history.prune_old_versions",
                },
            }

        initializer = self._initializer({"CELERY_CONFIG": _RenamedKeyCeleryConfig})
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_no_warn_when_celery_config_is_none(self, mock_logger: MagicMock) -> None:
        """``CELERY_CONFIG = None`` is the documented "disable Celery
        entirely" path. The warn-log MUST NOT fire — the operator made
        a deliberate choice; complaining about a missing retention entry
        on a Celery-disabled deployment trains operators to ignore the
        warning."""
        initializer = self._initializer({"CELERY_CONFIG": None})
        initializer._warn_if_retention_beat_missing()
        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_dict_form_celery_config_with_entry_does_not_warn(
        self, mock_logger: MagicMock
    ) -> None:
        """Celery accepts a dict-shaped config via
        ``config_from_object``. The warn-log MUST discriminate by
        ``isinstance(dict)`` so an operator who supplies a dict with the
        entry doesn't see a false-positive warning."""
        initializer = self._initializer(
            {
                "CELERY_CONFIG": {
                    "broker_url": "redis://localhost",
                    "imports": (
                        "superset.tasks.version_history_retention",
                        "superset.tasks.deletion_retention",
                    ),
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
    def test_dict_form_celery_config_without_entry_warns(
        self, mock_logger: MagicMock
    ) -> None:
        """The dict-shape symmetry of the previous test: a dict without
        the entry MUST emit the warning, same as a class without it."""
        initializer = self._initializer(
            {
                "CELERY_CONFIG": {
                    "broker_url": "redis://localhost",
                    "imports": (
                        "superset.tasks.version_history_retention",
                        "superset.tasks.deletion_retention",
                    ),
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

    @patch("superset.initialization.logger")
    def test_string_celery_config_reference_does_not_warn(
        self, mock_logger: MagicMock
    ) -> None:
        """Dotted config references are resolved by Celery's own loader.

        The startup diagnostic must not treat an unresolved reference as an
        empty schedule and emit a false warning.
        """
        initializer = self._initializer(
            {"CELERY_CONFIG": "custom_celery_config:CeleryConfig"}
        )
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_warn_when_soft_delete_on_and_purge_entry_missing(
        self, mock_logger: MagicMock
    ) -> None:
        """With ``SOFT_DELETE`` on and the beat schedule carrying the
        version-history entry but not the purge entry, a WARNING naming
        ``deletion_retention.purge_soft_deleted`` fires — otherwise a
        hand-rolled ``CeleryConfig`` silently accumulates archived
        objects forever."""

        class _NoPurgeCeleryConfig:
            imports: tuple[str, ...] = (
                "superset.tasks.version_history_retention",
                "superset.tasks.deletion_retention",
            )
            beat_schedule: dict[str, dict[str, str]] = {
                "version_history.prune_old_versions": {
                    "task": "version_history.prune_old_versions",
                },
            }

        initializer = self._initializer(
            {
                "CELERY_CONFIG": _NoPurgeCeleryConfig,
                "FEATURE_FLAGS": {"SOFT_DELETE": True},
            }
        )
        initializer._warn_if_retention_beat_missing()

        assert any(
            "deletion_retention.purge_soft_deleted" in str(call)
            for call in mock_logger.warning.call_args_list
        ), (
            "Expected a WARNING naming the missing purge entry; "
            f"got {mock_logger.warning.call_args_list}"
        )

    @patch("superset.initialization.logger")
    def test_no_purge_warn_when_soft_delete_off(self, mock_logger: MagicMock) -> None:
        """With ``SOFT_DELETE`` off, a missing purge entry MUST NOT warn:
        the purge task itself no-ops while the flag is off, so the
        warning would be noise the operator cannot act on."""

        class _NoPurgeCeleryConfig:
            imports: tuple[str, ...] = (
                "superset.tasks.version_history_retention",
                "superset.tasks.deletion_retention",
            )
            beat_schedule: dict[str, dict[str, str]] = {
                "version_history.prune_old_versions": {
                    "task": "version_history.prune_old_versions",
                },
            }

        initializer = self._initializer(
            {
                "CELERY_CONFIG": _NoPurgeCeleryConfig,
            }
        )
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_purge_gate_ignores_dynamic_feature_flag_resolvers(
        self, mock_logger: MagicMock
    ) -> None:
        """Dynamic feature resolvers do not affect startup diagnostics."""

        class _NoPurgeCeleryConfig:
            imports: tuple[str, ...] = (
                "superset.tasks.version_history_retention",
                "superset.tasks.deletion_retention",
            )
            beat_schedule: dict[str, dict[str, str]] = {
                "version_history.prune_old_versions": {
                    "task": "version_history.prune_old_versions",
                },
            }

        # Static config says off while the dynamic hook says on. Startup
        # diagnostics intentionally use only the static deployment config.
        config: dict[str, Any] = {
            "CELERY_CONFIG": _NoPurgeCeleryConfig,
            "DEFAULT_FEATURE_FLAGS": {"SOFT_DELETE": False},
            "FEATURE_FLAGS": {"SOFT_DELETE": False},
            "IS_FEATURE_ENABLED_FUNC": lambda feature, default: True,
            "GET_FEATURE_FLAGS_FUNC": None,
        }
        initializer = self._initializer(config)
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_no_warn_when_soft_delete_on_and_both_entries_present(
        self, mock_logger: MagicMock
    ) -> None:
        """The **shipped** ``CeleryConfig`` with soft delete enabled must
        be silent. Asserting against the real class — rather than a
        hand-built stand-in repeating the same literals — is what pins
        ``_RETENTION_TASK_NAME`` and ``_PURGE_TASK_NAME`` to the entries
        that actually ship. Rename the shipped entry in ``superset.config``
        without updating the constants and this test goes red, instead of
        every default deployment warning at boot with no test failing.
        (The check matches a schedule key *or* an entry's ``task``, so a
        rename of only one of the two is tolerated by design and stays
        green — it is the genuine rename, where both move, that fires.)"""
        initializer = self._initializer(
            {
                "CELERY_CONFIG": CeleryConfig,
                "FEATURE_FLAGS": {"SOFT_DELETE": True},
            }
        )
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_warn_when_retention_module_missing_from_imports(
        self, mock_logger: MagicMock
    ) -> None:
        """A scheduled task whose module is absent from ``imports`` fails
        with Celery ``NotRegistered`` when it fires — the same silent
        non-execution the beat check guards, one layer down. UPDATING.md
        asks operators for both; the check must too."""

        class _NoImportCeleryConfig:
            imports: tuple[str, ...] = ("superset.tasks.deletion_retention",)
            beat_schedule: dict[str, dict[str, str]] = {
                "version_history.prune_old_versions": {
                    "task": "version_history.prune_old_versions",
                },
            }

        initializer = self._initializer({"CELERY_CONFIG": _NoImportCeleryConfig})
        initializer._warn_if_retention_beat_missing()

        assert any(
            "superset.tasks.version_history_retention" in str(call)
            for call in mock_logger.warning.call_args_list
        ), (
            "Expected a WARNING naming the missing retention module; "
            f"got {mock_logger.warning.call_args_list}"
        )

    @patch("superset.initialization.logger")
    def test_no_import_warning_when_imports_is_not_configured(
        self, mock_logger: MagicMock
    ) -> None:
        """Do not assume how a worker registers tasks when imports is absent."""

        class _AutodiscoveredCeleryConfig:
            beat_schedule: dict[str, dict[str, str]] = {
                "version_history.prune_old_versions": {
                    "task": "version_history.prune_old_versions",
                },
            }

        initializer = self._initializer({"CELERY_CONFIG": _AutodiscoveredCeleryConfig})
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_warn_when_purge_module_missing_from_imports(
        self, mock_logger: MagicMock
    ) -> None:
        """Same for the purge task, and gated on ``SOFT_DELETE`` like its
        beat counterpart: the schedule can name the task while the worker
        never imported it."""

        class _NoPurgeImportCeleryConfig:
            imports: tuple[str, ...] = ("superset.tasks.version_history_retention",)
            beat_schedule: dict[str, dict[str, str]] = {
                "version_history.prune_old_versions": {
                    "task": "version_history.prune_old_versions",
                },
                "deletion_retention.purge_soft_deleted": {
                    "task": "deletion_retention.purge_soft_deleted",
                },
            }

        initializer = self._initializer(
            {
                "CELERY_CONFIG": _NoPurgeImportCeleryConfig,
                "FEATURE_FLAGS": {"SOFT_DELETE": True},
            }
        )
        initializer._warn_if_retention_beat_missing()

        assert any(
            "superset.tasks.deletion_retention" in str(call)
            for call in mock_logger.warning.call_args_list
        ), (
            "Expected a WARNING naming the missing purge module; "
            f"got {mock_logger.warning.call_args_list}"
        )

    @patch("superset.initialization.logger")
    def test_no_purge_import_warn_when_soft_delete_off(
        self, mock_logger: MagicMock
    ) -> None:
        """The purge import check is gated like the purge beat check: with
        the flag off the task no-ops, so a missing module is not yet
        actionable and must not warn."""

        class _NoPurgeImportCeleryConfig:
            imports: tuple[str, ...] = ("superset.tasks.version_history_retention",)
            beat_schedule: dict[str, dict[str, str]] = {
                "version_history.prune_old_versions": {
                    "task": "version_history.prune_old_versions",
                },
            }

        initializer = self._initializer({"CELERY_CONFIG": _NoPurgeImportCeleryConfig})
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()

    @patch("superset.initialization.logger")
    def test_no_purge_warn_when_task_registered_under_other_key(
        self, mock_logger: MagicMock
    ) -> None:
        """Parity with the version-history check: the purge task
        registered under a non-matching schedule key is still correctly
        scheduled and MUST NOT warn."""

        class _RenamedKeysCeleryConfig:
            imports: tuple[str, ...] = (
                "superset.tasks.version_history_retention",
                "superset.tasks.deletion_retention",
            )
            beat_schedule: dict[str, dict[str, str]] = {
                "prune_versions": {
                    "task": "version_history.prune_old_versions",
                },
                "purge_archived": {
                    "task": "deletion_retention.purge_soft_deleted",
                },
            }

        initializer = self._initializer(
            {
                "CELERY_CONFIG": _RenamedKeysCeleryConfig,
                "FEATURE_FLAGS": {"SOFT_DELETE": True},
            }
        )
        initializer._warn_if_retention_beat_missing()

        mock_logger.warning.assert_not_called()
