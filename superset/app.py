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

import logging
import os
from typing import cast, Iterable, Optional
from wsgiref.types import StartResponse, WSGIApplication, WSGIEnvironment

from flask import Flask
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
    pass


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
