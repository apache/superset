"""Package's main module!"""

import logging
import os
from flask import Flask, redirect
from flask.ext.appbuilder import SQLA, AppBuilder, IndexView
from flask.ext.appbuilder.baseviews import expose
from flask.ext.migrate import Migrate
from flask.ext.cache import Cache


APP_DIR = os.path.dirname(__file__)
CONFIG_MODULE = os.environ.get('DASHED_CONFIG', 'dashed.config')

# Logging configuration
logging.basicConfig(format='%(asctime)s:%(levelname)s:%(name)s:%(message)s')
logging.getLogger().setLevel(logging.DEBUG)

app = Flask(__name__)
app.config.from_object(CONFIG_MODULE)
db = SQLA(app)

cache = Cache(app, config=app.config.get('CACHE_CONFIG'))

migrate = Migrate(app, db, directory=APP_DIR + "/migrations")


class MyIndexView(IndexView):
    @expose('/')
    def index(self):
        return redirect('/dashed/featured')

appbuilder = AppBuilder(
    app, db.session,
    base_template='dashed/base.html',
    indexview=MyIndexView,
    security_manager_class=app.config.get("CUSTOM_SECURITY_MANAGER"))

sm = appbuilder.sm

get_session = appbuilder.get_session
from dashed import config, views  # noqa
