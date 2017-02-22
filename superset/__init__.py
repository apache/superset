"""Package's main module!"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging
import os
import json
from logging.handlers import TimedRotatingFileHandler

from flask import Flask, redirect
from flask_appbuilder import SQLA, AppBuilder, IndexView
from flask_appbuilder.baseviews import expose
from flask_migrate import Migrate
from superset.source_registry import SourceRegistry
from werkzeug.contrib.fixers import ProxyFix
from superset import utils


APP_DIR = os.path.dirname(__file__)
CONFIG_MODULE = os.environ.get('SUPERSET_CONFIG', 'superset.config')

with open(APP_DIR + '/static/assets/backendSync.json', 'r') as f:
    frontend_config = json.load(f)


app = Flask(__name__)
app.config.from_object(CONFIG_MODULE)
conf = app.config

if conf.get('SILENCE_FAB'):
    logging.getLogger('flask_appbuilder').setLevel(logging.ERROR)

if not app.debug:
    # In production mode, add log handler to sys.stderr.
    app.logger.addHandler(logging.StreamHandler())
    app.logger.setLevel(logging.INFO)
logging.getLogger('pyhive.presto').setLevel(logging.INFO)

db = SQLA(app)


utils.pessimistic_connection_handling(db.engine.pool)

cache = utils.setup_cache(app, conf.get('CACHE_CONFIG'))
tables_cache = utils.setup_cache(app, conf.get('TABLE_NAMES_CACHE_CONFIG'))

migrate = Migrate(app, db, directory=APP_DIR + "/migrations")

# Logging configuration
logging.basicConfig(format=app.config.get('LOG_FORMAT'))
logging.getLogger().setLevel(app.config.get('LOG_LEVEL'))

if app.config.get('ENABLE_TIME_ROTATE'):
    logging.getLogger().setLevel(app.config.get('TIME_ROTATE_LOG_LEVEL'))
    handler = TimedRotatingFileHandler(app.config.get('FILENAME'),
                                       when=app.config.get('ROLLOVER'),
                                       interval=app.config.get('INTERVAL'),
                                       backupCount=app.config.get('BACKUP_COUNT'))
    logging.getLogger().addHandler(handler)

if app.config.get('ENABLE_CORS'):
    from flask_cors import CORS
    CORS(app, **app.config.get('CORS_OPTIONS'))

if app.config.get('ENABLE_PROXY_FIX'):
    app.wsgi_app = ProxyFix(app.wsgi_app)

if app.config.get('UPLOAD_FOLDER'):
    try:
        os.makedirs(app.config.get('UPLOAD_FOLDER'))
    except OSError:
        pass

for middleware in app.config.get('ADDITIONAL_MIDDLEWARE'):
    app.wsgi_app = middleware(app.wsgi_app)


class MyIndexView(IndexView):
    @expose('/')
    def index(self):
        return redirect('/superset/welcome')

appbuilder = AppBuilder(
    app, db.session,
    base_template='superset/base.html',
    indexview=MyIndexView,
    security_manager_class=app.config.get("CUSTOM_SECURITY_MANAGER"))

sm = appbuilder.sm

get_session = appbuilder.get_session
results_backend = app.config.get("RESULTS_BACKEND")

# Registering sources
module_datasource_map = app.config.get("DEFAULT_MODULE_DS_MAP")
module_datasource_map.update(app.config.get("ADDITIONAL_MODULE_DS_MAP"))
SourceRegistry.register_sources(module_datasource_map)

from superset import views, config  # noqa
