"""Package's main module!"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging
import os
from logging.handlers import TimedRotatingFileHandler

from flask import Flask, redirect
from flask_appbuilder import SQLA, AppBuilder, IndexView
from sqlalchemy import event, exc
from flask_appbuilder.baseviews import expose
from flask_cache import Cache
from flask_migrate import Migrate
from caravel.source_registry import SourceRegistry
from werkzeug.contrib.fixers import ProxyFix


APP_DIR = os.path.dirname(__file__)
CONFIG_MODULE = os.environ.get('CARAVEL_CONFIG', 'caravel.config')

app = Flask(__name__)
app.config.from_object(CONFIG_MODULE)
if not app.debug:
    # In production mode, add log handler to sys.stderr.
    app.logger.addHandler(logging.StreamHandler())
    app.logger.setLevel(logging.INFO)

db = SQLA(app)


@event.listens_for(db.engine, 'checkout')
def checkout(dbapi_con, con_record, con_proxy):
    """
    Making sure the connection is live, and preventing against:
    'MySQL server has gone away'

    Copied from:
    http://stackoverflow.com/questions/30630120/mysql-keeps-losing-connection-during-celery-tasks
    """
    try:
        try:
            if hasattr(dbapi_con, 'ping'):
                dbapi_con.ping(False)
            else:
                cursor = dbapi_con.cursor()
                cursor.execute("SELECT 1")
        except TypeError:
            app.logger.debug('MySQL connection died. Restoring...')
            dbapi_con.ping()
    except dbapi_con.OperationalError as e:
        app.logger.warning(e)
        if e.args[0] in (2006, 2013, 2014, 2045, 2055):
            raise exc.DisconnectionError()
        else:
            raise
    return db


cache = Cache(app, config=app.config.get('CACHE_CONFIG'))

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


class MyIndexView(IndexView):
    @expose('/')
    def index(self):
        return redirect('/caravel/welcome')

appbuilder = AppBuilder(
    app, db.session,
    base_template='caravel/base.html',
    indexview=MyIndexView,
    security_manager_class=app.config.get("CUSTOM_SECURITY_MANAGER"))

sm = appbuilder.sm

get_session = appbuilder.get_session

# Registering sources
module_datasource_map = app.config.get("DEFAULT_MODULE_DS_MAP")
module_datasource_map.update(app.config.get("ADDITIONAL_MODULE_DS_MAP"))
SourceRegistry.register_sources(module_datasource_map)

from caravel import views, config  # noqa
