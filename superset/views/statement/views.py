# это все нужно для вкладки на странице
import logging

from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access

from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models.statement import Statement as StatementModel
from superset.superset_typing import FlaskResponse
from superset.views.base import SupersetModelView
from superset.views.statement.mixin import StatementMixin

logger = logging.getLogger(__name__)


class StatementModelView(StatementMixin, SupersetModelView):  # pylint: disable=too-many-ancestors
    route_base = "/onboarding/request"
    datamodel = SQLAInterface(StatementModel)
    class_permission_name = "Statement"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    include_route_methods = RouteMethod.CRUD_SET | {RouteMethod.API_READ}

    @has_access
    @expose("/list")
    def list(self) -> FlaskResponse:
        return super().render_app_template()

    @has_access
    @expose("/edit/<pk>", methods=("GET",))
    def edit(self, pk: int) -> FlaskResponse:
        return super().render_app_template()
