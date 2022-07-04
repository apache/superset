import logging

from flask_appbuilder.models.sqla.interface import SQLAInterface
from superset.connectors.sqla.models import RowLevelSecurityFilter

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class RLSRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(RowLevelSecurityFilter)
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
    }
    class_permission_name = "rls"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "rls"
    allow_browser_login = True

    show_columns = [
        "clause",
        "group_key",
        "id",
        "roles",
        "tables",
        "filter_type",
    ]
    list_columns = [
        "clause",
        "group_key",
        "id",
        "roles.id",
        "tables.id",
        "filter_type",
    ]

    add_columns = [
        "clause",
        "group_key",
        "roles",
        "tables",
        "filter_type",
    ]

    edit_columns = add_columns
