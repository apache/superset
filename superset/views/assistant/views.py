# Sample Assiststant Page

from superset.superset_typing import FlaskResponse
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.views.base import BaseSupersetView, SupersetModelView
from flask_appbuilder import permission_name
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access


class AssistantView(BaseSupersetView):
    
    route_base = "/assistant"
    default_view = "root"

    @expose("/")
    def root(self) -> FlaskResponse:
        return self.render_app_template()