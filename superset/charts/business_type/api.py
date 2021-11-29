"""
API For Business Type REST requests
"""
from typing import Any, List

from flask.wrappers import Response
from flask_appbuilder.api import expose, rison
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset import app
from superset.charts.business_type.business_type_response import BusinessTypeResponse
from superset.charts.business_type.schemas import business_type_convert_schema
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import event_logger
from superset.utils.core import FilterOperator
from superset.views.base_api import BaseSupersetModelRestApi

config = app.config
BUSINESS_TYPE_ADDONS = config["BUSINESS_TYPE_ADDONS"]


class BusinessTypeRestApi(BaseSupersetModelRestApi):
    """
    Placeholder until we work out everything this class is going to do.
    """

    datamodel = SQLAInterface(SqlaTable)

    include_route_methods = {"get", "get_types"}
    resource_name = "chart"

    openapi_spec_tag = "Charts"
    apispec_parameter_schemas = {
        "business_type_convert_schema": business_type_convert_schema,
    }

    @expose("/business_type", methods=["GET"])
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,  # pylint: disable-arguments-renamed
    )
    @rison()
    def get(self, **kwargs: Any) -> Response:
        """Send a greeting
        ---
        get:
          description: >-
            Deletes multiple annotation layers in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/business_type_convert_schema'
          responses:
            200:
              description: a successful conversion has taken place
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                      value:
                        type: object
                      formatted_value:
                        type: string
                      valid_filter_operators:
                        type: list
        """
        items = kwargs["rison"]
        bus_resp: BusinessTypeResponse = BUSINESS_TYPE_ADDONS[items["type"]](
            {
                "values": items["values"],
            }
        )
        return self.response(200, result=bus_resp)

    @expose("/business_type/types", methods=["GET"])
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,  # pylint: disable-arguments-renamed
    )
    def get_types(self, **kwargs: Any) -> Response:
        """Returns a list of available business types
        ---
        get:
          description: >-
            Deletes multiple annotation layers in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/business_type_convert_schema'
          responses:
            200:
              description: a successful conversion has taken place
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                      value:
                        type: object
                      formatted_value:
                        type: string
                      valid_filter_operators:
                        type: list
        """

        return self.response(200, result=list(BUSINESS_TYPE_ADDONS.keys()))
