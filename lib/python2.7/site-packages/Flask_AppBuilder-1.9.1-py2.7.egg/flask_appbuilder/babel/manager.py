import os
from flask import session, has_request_context
from flask_babel import Babel
from ..basemanager import BaseManager
from .. import translations
from .views import LocaleView


class BabelManager(BaseManager):

    babel = None
    locale_view = None

    def __init__(self, appbuilder):
        super(BabelManager, self).__init__(appbuilder)
        app = appbuilder.get_app
        app.config.setdefault('BABEL_DEFAULT_LOCALE', 'en')
        appbuilder_parent_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir)
        appbuilder_translations_path = os.path.join(appbuilder_parent_dir, 'translations')
        if 'BABEL_TRANSLATION_DIRECTORIES' in app.config:
            current_translation_directories = app.config.get('BABEL_TRANSLATION_DIRECTORIES')
            translations_path = appbuilder_translations_path + ';' + current_translation_directories
        else:
            translations_path = appbuilder_translations_path + ';translations'
        app.config['BABEL_TRANSLATION_DIRECTORIES'] = translations_path
        self.babel = Babel(app)
        self.babel.locale_selector_func = self.get_locale

    def register_views(self):
        self.locale_view = LocaleView()
        self.appbuilder.add_view_no_menu(self.locale_view)

    @property
    def babel_default_locale(self):
        return self.appbuilder.get_app.config['BABEL_DEFAULT_LOCALE']

    def get_locale(self):
        if has_request_context():
            locale = session.get('locale')
            if locale:
                return locale
            session['locale'] = self.babel_default_locale
            return session['locale']

