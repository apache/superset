from flask import redirect, session
from flask_babel import refresh
from ..baseviews import BaseView, expose


class LocaleView(BaseView):
    route_base = '/lang'

    default_view = 'index'

    @expose('/<string:locale>')
    def index(self, locale):
        session['locale'] = locale
        refresh()
        self.update_redirect()
        return redirect(self.get_redirect())
