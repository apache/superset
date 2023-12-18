from flask_appbuilder.security.views import AuthDBView
from flask_appbuilder.views import expose
from werkzeug.wrappers import Response as WerkzeugResponse


class DVTAuthDBView(AuthDBView):
    login_template = "superset/login.html"

    @expose("/login/", methods=["GET", "POST"])
    def login(self) -> WerkzeugResponse:
        # test comment
        return super().login()
