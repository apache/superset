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

import wtforms_json
from flask import Flask, redirect
from flask_appbuilder import expose, IndexView
from flask_compress import Compress
from flask_wtf import CSRFProtect

from superset.connectors.connector_registry import ConnectorRegistry
from superset.extensions import (
    _event_logger,
    APP_DIR,
    appbuilder,
    cache_manager,
    celery_app,
    db,
    feature_flag_manager,
    manifest_processor,
    migrate,
    results_backend_manager,
    talisman,
)
from superset.security import SupersetSecurityManager
from superset.utils.core import pessimistic_connection_handling
from superset.utils.log import DBEventLogger, get_event_logger_from_cfg_value

logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)

    try:
        # Allow user to override our config completely
        config_module = os.environ.get("SUPERSET_CONFIG", "superset.config")
        app.config.from_object(config_module)

        app_initializer = app.config.get("APP_INITIALIZER", SupersetAppInitializer)(app)
        app_initializer.init_app()

        return app

    # Make sure that bootstrap errors ALWAYS get logged
    except Exception as ex:
        logger.exception("Failed to create app")
        raise ex


class SupersetIndexView(IndexView):
    @expose("/")
    def index(self):
        return redirect("/superset/welcome")


class SupersetAppInitializer:
    def __init__(self, app: Flask) -> None:
        super().__init__()

        self.flask_app = app
        self.config = app.config
        self.manifest: dict = {}

    def pre_init(self) -> None:
        """
        Called after all other init tasks are complete
        """
        wtforms_json.init()

        if not os.path.exists(self.config["DATA_DIR"]):
            os.makedirs(self.config["DATA_DIR"])

    def post_init(self) -> None:
        """
        Called before any other init tasks
        """
        pass

    def configure_celery(self) -> None:
        celery_app.config_from_object(self.config["CELERY_CONFIG"])
        celery_app.set_default()
        flask_app = self.flask_app

        # Here, we want to ensure that every call into Celery task has an app context
        # setup properly
        task_base = celery_app.Task

        class AppContextTask(task_base):  # type: ignore
            # pylint: disable=too-few-public-methods
            abstract = True

            # Grab each call into the task and set up an app context
            def __call__(self, *args, **kwargs):
                with flask_app.app_context():
                    return task_base.__call__(self, *args, **kwargs)

        celery_app.Task = AppContextTask

    @staticmethod
    def init_views() -> None:
        # TODO - This should iterate over all views and register them with FAB...
        from superset import views  # noqa pylint: disable=unused-variable

    def init_app_in_ctx(self) -> None:
        """
        Runs init logic in the context of the app
        """
        self.configure_feature_flags()
        self.configure_fab()
        self.configure_data_sources()

        # Hook that provides administrators a handle on the Flask APP
        # after initialization
        flask_app_mutator = self.config["FLASK_APP_MUTATOR"]
        if flask_app_mutator:
            flask_app_mutator(self.flask_app)

        self.init_views()

    def init_app(self) -> None:
        """
        Main entry point which will delegate to other methods in
        order to fully init the app
        """
        self.pre_init()

        self.setup_db()

        self.configure_celery()

        self.setup_event_logger()

        self.setup_bundle_manifest()

        self.register_blueprints()

        self.configure_wtf()

        self.configure_logging()

        self.configure_middlewares()

        self.configure_cache()

        with self.flask_app.app_context():
            self.init_app_in_ctx()

        self.post_init()

    def setup_event_logger(self):
        _event_logger["event_logger"] = get_event_logger_from_cfg_value(
            self.flask_app.config.get("EVENT_LOGGER", DBEventLogger())
        )

    def configure_data_sources(self):
        # Registering sources
        module_datasource_map = self.config["DEFAULT_MODULE_DS_MAP"]
        module_datasource_map.update(self.config["ADDITIONAL_MODULE_DS_MAP"])
        ConnectorRegistry.register_sources(module_datasource_map)

    def configure_cache(self):
        cache_manager.init_app(self.flask_app)
        results_backend_manager.init_app(self.flask_app)

    def configure_feature_flags(self):
        feature_flag_manager.init_app(self.flask_app)

    def configure_fab(self):
        if self.config["SILENCE_FAB"]:
            logging.getLogger("flask_appbuilder").setLevel(logging.ERROR)

        custom_sm = self.config["CUSTOM_SECURITY_MANAGER"] or SupersetSecurityManager
        if not issubclass(custom_sm, SupersetSecurityManager):
            raise Exception(
                """Your CUSTOM_SECURITY_MANAGER must now extend SupersetSecurityManager,
                 not FAB's security manager.
                 See [4565] in UPDATING.md"""
            )

        appbuilder.indexview = SupersetIndexView
        appbuilder.base_template = "superset/base.html"
        appbuilder.security_manager_class = custom_sm
        appbuilder.update_perms = False
        appbuilder.init_app(self.flask_app, db.session)

    def configure_middlewares(self):
        if self.config["ENABLE_CORS"]:
            from flask_cors import CORS

            CORS(self.flask_app, **self.config["CORS_OPTIONS"])

        if self.config["ENABLE_PROXY_FIX"]:
            from werkzeug.middleware.proxy_fix import ProxyFix

            self.flask_app.wsgi_app = ProxyFix(
                self.flask_app.wsgi_app, **self.config["PROXY_FIX_CONFIG"]
            )

        if self.config["ENABLE_CHUNK_ENCODING"]:

            class ChunkedEncodingFix(object):  # pylint: disable=too-few-public-methods
                def __init__(self, app):
                    self.app = app

                def __call__(self, environ, start_response):
                    # Setting wsgi.input_terminated tells werkzeug.wsgi to ignore
                    # content-length and read the stream till the end.
                    if environ.get("HTTP_TRANSFER_ENCODING", "").lower() == "chunked":
                        environ["wsgi.input_terminated"] = True
                    return self.app(environ, start_response)

            self.flask_app.wsgi_app = ChunkedEncodingFix(self.flask_app.wsgi_app)

        if self.config["UPLOAD_FOLDER"]:
            try:
                os.makedirs(self.config["UPLOAD_FOLDER"])
            except OSError:
                pass

        for middleware in self.config["ADDITIONAL_MIDDLEWARE"]:
            self.flask_app.wsgi_app = middleware(self.flask_app.wsgi_app)

        # Flask-Compress
        if self.config["ENABLE_FLASK_COMPRESS"]:
            Compress(self.flask_app)

        if self.config["TALISMAN_ENABLED"]:
            talisman.init_app(self.flask_app, **self.config["TALISMAN_CONFIG"])

    def configure_logging(self):
        self.config["LOGGING_CONFIGURATOR"].configure_logging(
            self.config, self.flask_app.debug
        )

    def setup_db(self):
        db.init_app(self.flask_app)

        with self.flask_app.app_context():
            pessimistic_connection_handling(db.engine)

        migrate.init_app(self.flask_app, db=db, directory=APP_DIR + "/migrations")

    def configure_wtf(self):
        if self.config["WTF_CSRF_ENABLED"]:
            csrf = CSRFProtect(self.flask_app)
            csrf_exempt_list = self.config["WTF_CSRF_EXEMPT_LIST"]
            for ex in csrf_exempt_list:
                csrf.exempt(ex)

    def register_blueprints(self):
        for bp in self.config["BLUEPRINTS"]:
            try:
                logger.info(f"Registering blueprint: '{bp.name}'")
                self.flask_app.register_blueprint(bp)
            except Exception:  # pylint: disable=broad-except
                logger.exception("blueprint registration failed")

    def setup_bundle_manifest(self):
        manifest_processor.init_app(self.flask_app)
