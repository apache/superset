"""
A docstring
"""
from flask.wrappers import Response
from flask_appbuilder.api import expose, safe
from flask_appbuilder.security.decorators import protect
from superset.constants import RouteMethod
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from superset.extensions import event_logger
from flask_appbuilder.models.sqla.interface import SQLAInterface
from superset.connectors.sqla.models import SqlaTable

class BusinessTypeRestApi(BaseSupersetModelRestApi):
    """
    A docstring
    """
    datamodel = SQLAInterface(SqlaTable)
    #include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET
    resource_name = "business_type"

    @expose("/", methods=["GET"])
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False, # pylint: disable-arguments-renamed
    )
    def get_hello(self) -> Response:
        """Gets a Hello
        """
        resp: Response = {
            "output": "Hello",
        }
        return self.response(200, result=resp)
