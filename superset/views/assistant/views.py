# Sample Assiststant Page

from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView, SupersetModelView
from flask_appbuilder import expose


class AssistantView(BaseSupersetView):
    
    route_base = "/assistant"

    @expose("/")
    def index(self) -> FlaskResponse:
        return self.render_app_template()