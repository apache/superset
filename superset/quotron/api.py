from flask import g, request, Response
from flask_appbuilder.api import BaseApi, expose, protect, safe
import logging
from superset.charts.commands.exceptions import ChartNotFoundError
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.explore.commands.get import GetExploreCommand
from superset.explore.commands.parameters import CommandParameters
from superset.explore.exceptions import DatasetAccessDeniedError, WrongEndpointError
from superset.explore.permalink.exceptions import ExplorePermalinkGetFailedError
from superset.explore.schemas import ExploreContextSchema
from superset.extensions import event_logger
from superset.temporary_cache.commands.exceptions import (
    TemporaryCacheAccessDeniedError,
    TemporaryCacheResourceNotFoundError,
)

logger = logging.getLogger(__name__)

class QuotronRestApi(BaseApi):
    include_route_methods = {
        "auto_complete",
    }
    resource_name = "quotron"
    openapi_spec_tag = "Quotron"

    @expose("/auto_complete/", methods=["GET"])

    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
        log_to_statsd=False,
    )
    def auto_complete(self) -> Response:
        """
                ---
                get:
                  description: Compute and cache a screenshot.
                  responses:
                    202:
                      description: Chart async result

                    200:
                      description: Chart async result


                    400:
                      $ref: '#/components/responses/400'
                    401:
                      $ref: '#/components/responses/401'
                    404:
                      $ref: '#/components/responses/404'
                    500:
                      $ref: '#/components/responses/500'
                """
        return self.response(200,result="abc")



