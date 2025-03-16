import logging

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.sqla.models import User

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.user.filters import UserNameFilter
from superset.user.schemas import UserSchema
from superset.views.base_api import (
    BaseSupersetModelRestApi,
)

logger = logging.getLogger(__name__)


class DodoUserRestApi(BaseSupersetModelRestApi):
    """An api to get information about the user"""

    datamodel = SQLAInterface(User)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET
    resource_name = "dodo_user"
    allow_browser_login = True

    class_permission_name = "User"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    search_columns = ("first_name",)

    search_filters = {
        "first_name": [UserNameFilter],
    }

    list_columns = [
        "id",
        "first_name",
        "last_name",
        "teams.name",
        "email",
        "user_info.country_name",
    ]

    user_get_response_schema = UserSchema()
