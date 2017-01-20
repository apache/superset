from flask_appbuilder.baseviews import BaseView
import os

class BasePluginView(BaseView):
    base_dir = os.path.abspath(os.path.dirname(__file__))
    template_folder = base_dir + '/templates'
    static_folder = base_dir + '/static'
