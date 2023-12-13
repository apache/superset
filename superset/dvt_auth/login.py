from flask_appbuilder.views import expose
from flask_appbuilder.security.views import AuthDBView


class DVTAuthDBView(AuthDBView):
    login_template = 'superset/login.html'

    @expose("/login/", methods=["GET", "POST"])
    def login(self):
        return super().login()
