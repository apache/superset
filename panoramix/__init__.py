import logging
from flask import Flask
from flask.ext.appbuilder import SQLA, AppBuilder, IndexView

"""
 Logging configuration
"""

logging.basicConfig(format='%(asctime)s:%(levelname)s:%(name)s:%(message)s')
logging.getLogger().setLevel(logging.DEBUG)

app = Flask(__name__)
app.config.from_object('panoramix.config')
db = SQLA(app)

class MyIndexView(IndexView):
    index_template = 'index.html'

appbuilder = AppBuilder(
    app, db.session, base_template='panoramix/base.html',
    indexview=MyIndexView)

get_session = appbuilder.get_session

from panoramix import views
