"""Used to initialize and store the app"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging
import os
from logging.handlers import TimedRotatingFileHandler

from flask import Flask, redirect
from flask_appbuilder import SQLA, AppBuilder, IndexView
from flask_appbuilder.baseviews import expose
from flask_cache import Cache
from flask_migrate import Migrate
from werkzeug.contrib.fixers import ProxyFix
from superset import utils

APP_DIR = os.path.dirname(__file__)
CONFIG_MODULE = os.environ.get('SUPERSET_CONFIG', 'superset.config')

# the app is cached in this var
app = None

def get_app():
    """Returns the app object, inits it if needed"""
    global app
    if app:
        return app
    app = init_app()
    return app

def init_app():
    app = Flask(__name__)
    app.config.from_object(CONFIG_MODULE)

    if not app.debug:
        # In production mode, add log handler to sys.stderr.
        app.logger.addHandler(logging.StreamHandler())
        app.logger.setLevel(logging.INFO)

    db = SQLA(app)

    utils.pessimistic_connection_handling(db.engine.pool)

    CACHE_CONFIG = app.config.get('CACHE_CONFIG')
    if CACHE_CONFIG and CACHE_CONFIG.get('CACHE_TYPE') != 'null':
        Cache(app, config=CACHE_CONFIG)

    Migrate(app, db, directory=APP_DIR + "/migrations")

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

    AppBuilder(
        app, db.session,
        base_template='superset/base.html',
        indexview=MyIndexView,
        security_manager_class=app.config.get("CUSTOM_SECURITY_MANAGER"))

    return app
