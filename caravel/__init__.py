"""Package's main module!"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging
import os
from logging.handlers import TimedRotatingFileHandler

from flask import Flask, redirect
from flask.ext.appbuilder import SQLA, AppBuilder, IndexView
from flask.ext.appbuilder.baseviews import expose
from flask.ext.cache import Cache
from flask.ext.migrate import Migrate

from caravel import version

VERSION = version.VERSION_STRING

APP_DIR = os.path.dirname(__file__)
CONFIG_MODULE = os.environ.get('CARAVEL_CONFIG', 'caravel.config')

app = Flask(__name__)
app.config.from_object(CONFIG_MODULE)
if not app.debug:
  # In production mode, add log handler to sys.stderr.
  app.logger.addHandler(logging.StreamHandler())
  app.logger.setLevel(logging.INFO)

db = SQLA(app)

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
from caravel import config, views  # noqa
