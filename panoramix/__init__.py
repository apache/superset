import logging
import os
from flask import Flask, redirect
from flask.ext.appbuilder import SQLA, AppBuilder, IndexView
from flask.ext.appbuilder.baseviews import expose
from flask.ext.migrate import Migrate
from panoramix import config


APP_DIR = os.path.dirname(__file__)
CONFIG_MODULE = os.environ.get('PANORAMIX_CONFIG', 'panoramix.config')

# Logging configuration
logging.basicConfig(format='%(asctime)s:%(levelname)s:%(name)s:%(message)s')
logging.getLogger().setLevel(logging.DEBUG)

app = Flask(__name__)
app.config.from_object(CONFIG_MODULE)
db = SQLA(app)
migrate = Migrate(app, db, directory=APP_DIR + "/migrations")


class MyIndexView(IndexView):
    @expose('/')
    def index(self):
        return redirect('/panoramix/featured')

appbuilder = AppBuilder(
    app, db.session,
    base_template='panoramix/base.html',
    indexview=MyIndexView,
    security_manager_class=app.config.get("CUSTOM_SECURITY_MANAGER"))

sm = appbuilder.sm

get_session = appbuilder.get_session
from panoramix import views
