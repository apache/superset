from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.connectors.sqla.models import RowLevelSecurityFilter
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.row_level_security.schemas import RLSPostSchema, RLSPutSchema
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_form_data,
    requires_json,
    statsd_metrics,
)


class RLSRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(RowLevelSecurityFilter)
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.IMPORT,
    }
    resource_name = "rls"
    class_permission_name = "Row Level Security"
    openapi_spec_tag = "Row Level Security"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True

    list_columns = [
        "name",
        "filter_type",
        "tables",
        "roles",
        "clause",
        "creator",
        "modified",
    ]
    order_columns = ["name", "filter_type", "clause", "modified"]
    add_columns = [
        "name",
        "description",
        "filter_type",
        "tables",
        "roles",
        "group_key",
        "clause",
    ]
    show_columns = add_columns
    search_columns = (
        "name",
        "description",
        "filter_type",
        "tables",
        "roles",
        "group_key",
        "clause",
    )
    edit_columns = add_columns

    add_model_schema = RLSPostSchema()
    edit_model_schema = RLSPutSchema()
