import json
import logging

import flask_login
from flask import Response, request
from flask_appbuilder.api import expose, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import protect
from flask_appbuilder.security.sqla.models import User

from superset import event_logger
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.users.schemas import UserResponse
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class UsersRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(User)

    resource_name = "users"

    class_permission_name = "Users"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    allow_browser_login = True
    include_route_methods = {
        RouteMethod.GET,
        RouteMethod.GET_LIST,
        'me'
    }

    list_columns = [
        "id",
        "last_name",
        "username",
        "first_name"
    ]

    show_columns = [
        "id",
        "last_name",
        "username",
        "first_name"
    ]

    # base_order = ("changed_on", "desc")

    openapi_spec_tag = "Users"
    openapi_spec_component_schemas = (
        UserResponse,
    )

    order_columns = [
        "first_name",
        "last_name"
    ]

    @expose("/me", methods=["get"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def me(self) -> Response:
        """ Returns logged in User
        ---
        get:
          responses:
            200:
              description: User object
              content:
                application/json:
                  schema:
                  schema:
                    $ref: "#/components/schemas/UserResponse"
            401:
              $ref: '#/components/responses/401'
        """

        request_user = flask_login.current_user
        user = {
            "id": request_user.id,
            "first_name": request_user.first_name,
            "last_name": request_user.last_name,
            "username": request_user.username,
        }
        return self.response(200, result=json.loads(json.dumps(user)))
