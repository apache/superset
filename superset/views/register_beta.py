from flask_appbuilder import expose
from superset.views.base import BaseSupersetView

class RegisterBetaView(BaseSupersetView):
    default_view = 'register_beta'
    route_base = "/register"

    @expose('/beta')
    def register_beta(self):
        self.update_redirect()
        return self.render_template('appbuilder/general/security/register_beta.html')
