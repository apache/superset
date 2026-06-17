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
from werkzeug.test import Client
from werkzeug.wrappers import Response

from superset.app import AppRootMiddleware, create_app, SupersetApp
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
