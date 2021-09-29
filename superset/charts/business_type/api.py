"""
A docstring
"""
import ipaddress
from typing import Callable, Dict
from flask.wrappers import Response
from flask_appbuilder.api import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from superset import app
from superset.charts.business_type.business_type_request import BusinessTypeRequest
from superset.charts.business_type.business_type_response import BusinessTypeResponse
from superset.extensions import event_logger
from superset.connectors.sqla.models import SqlaTable
from superset.views.base_api import BaseSupersetModelRestApi

config = app.config
BUSINESS_TYPE_ADDONS = config["BUSINESS_TYPE_ADDONS"]

class BusinessTypeRestApi(BaseSupersetModelRestApi):
    """
    A docstring
    """
    datamodel = SQLAInterface(SqlaTable)

    include_route_methods = {"get"}
    #class_permission_name = "Chart"

    resource_name = "chart"
    #allow_browser_login = True

    #openapi_spec_tag = "Chart"

    @expose("/business_type/<type>/<value>", methods=["GET"])
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False, # pylint: disable-arguments-renamed
    )
    def get(self, type: str, value: str) -> Response:
        """
        Gets a port response
        """
        print(value)
        if type not in BUSINESS_TYPE_ADDONS:
            return self.response(404)

        bus_resp: BusinessTypeResponse = BUSINESS_TYPE_ADDONS[type]({
           "business_type": "port",
           "value": value
        })
        
        return self.response(200, result=bus_resp)
