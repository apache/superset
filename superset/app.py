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
from __future__ import annotations

import logging
import os
import sys
from typing import cast, Iterable, Optional

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

if sys.version_info >= (3, 11):
    from wsgiref.types import StartResponse, WSGIApplication, WSGIEnvironment
else:
    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from _typeshed.wsgi import StartResponse, WSGIApplication, WSGIEnvironment


from flask import Flask, Response
from werkzeug.exceptions import NotFound

from superset.initialization import SupersetAppInitializer

logger = logging.getLogger(__name__)


def create_app(
    superset_config_module: Optional[str] = None,
    superset_app_root: Optional[str] = None,
) -> Flask:
    app = SupersetApp(__name__)

    try:
        # Allow user to override our config completely
        config_module = superset_config_module or os.environ.get(
            "SUPERSET_CONFIG", "superset.config"
        )
        app.config.from_object(config_module)

        # Allow application to sit on a non-root path
        # *Please be advised that this feature is in BETA.*
        app_root = cast(
            str, superset_app_root or os.environ.get("SUPERSET_APP_ROOT", "/")
        )
        if app_root != "/":
            app.wsgi_app = AppRootMiddleware(app.wsgi_app, app_root)
            # If not set, manually configure options that depend on the
            # value of app_root so things work out of the box
            if not app.config["STATIC_ASSETS_PREFIX"]:
                app.config["STATIC_ASSETS_PREFIX"] = app_root
            if app.config["APPLICATION_ROOT"] == "/":
                app.config["APPLICATION_ROOT"] = app_root

        app_initializer = app.config.get("APP_INITIALIZER", SupersetAppInitializer)(app)
        app_initializer.init_app()

        return app

    # Make sure that bootstrap errors ALWAYS get logged
    except Exception:
        logger.exception("Failed to create app")
        raise


class SupersetApp(Flask):
    def send_static_file(self, filename: str) -> Response:
        """Override to prevent webpack hot-update 404s from spamming logs.

        Webpack HMR can create race conditions where the browser requests
        hot-update files that no longer exist. Return 204 instead of 404
        for these files to keep logs clean.
        """
        if ".hot-update." in filename:
            # First try to serve it normally - it might exist
            try:
                return super().send_static_file(filename)
            except NotFound:
                logger.debug(
                    "Webpack hot-update file not found (likely HMR "
                    f"race condition): {filename}"
                )
                return Response("", status=204)  # No Content
        return super().send_static_file(filename)

    def _is_database_up_to_date(self) -> bool:
        """
        Check if database migrations are up to date.
        Returns False if there are pending migrations or unable to determine.
        """
        try:
            # Import here to avoid circular import issues
            from superset.extensions import db

            # Get current revision from database
            with db.engine.connect() as connection:
                context = MigrationContext.configure(connection)
                current_rev = context.get_current_revision()

            # Get head revision from migration files
            alembic_cfg = Config()
            alembic_cfg.set_main_option("script_location", "superset:migrations")
            script = ScriptDirectory.from_config(alembic_cfg)
            head_rev = script.get_current_head()

            # Database is up-to-date if current revision matches head
            is_current = current_rev == head_rev
            if not is_current:
                logger.debug(
                    "Pending migrations. Current: %s, Head: %s",
                    current_rev,
                    head_rev,
                )
            return is_current
        except Exception as e:
            logger.debug("Could not check migration status: %s", e)
            return False

    def sync_config_to_db(self) -> None:
        """
        Synchronize configuration to database.
        This method handles database-dependent features that need to be synced
        after the app is initialized and database connection is available.

        This is separated from app initialization to support multi-tenant
        environments where database connection might not be available during
        app startup.
        """
        try:
            # Import here to avoid circular import issues
            from superset.extensions import feature_flag_manager

            # Check if database is up-to-date with migrations
            if not self._is_database_up_to_date():
                logger.info("Pending database migrations: run 'superset db upgrade'")
                return

            logger.info("Syncing configuration to database...")

            # Register SQLA event listeners for tagging system
            if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
                from superset.tags.core import register_sqla_event_listeners

                register_sqla_event_listeners()

            # Seed system themes from configuration
            from superset.commands.theme.seed import SeedSystemThemesCommand

            SeedSystemThemesCommand().run()

            logger.info("Configuration sync to database completed successfully")

        except Exception as e:
            logger.error("Failed to sync configuration to database: %s", e)
            # Don't raise the exception to avoid breaking app startup
            # in multi-tenant environments


class AppRootMiddleware:
    """A middleware that attaches the application to a fixed prefix location.

    See https://wsgi.readthedocs.io/en/latest/definitions.html for definitions
    of SCRIPT_NAME and PATH_INFO.
    """

    def __init__(
        self,
        wsgi_app: WSGIApplication,
        app_root: str,
    ):
        self.wsgi_app = wsgi_app
        self.app_root = app_root

    def __call__(
        self, environ: WSGIEnvironment, start_response: StartResponse
    ) -> Iterable[bytes]:
        original_path_info = environ.get("PATH_INFO", "")
        if original_path_info.startswith(self.app_root):
            environ["PATH_INFO"] = original_path_info.removeprefix(self.app_root)
            environ["SCRIPT_NAME"] = self.app_root
            return self.wsgi_app(environ, start_response)
        else:
            return NotFound()(environ, start_response)
