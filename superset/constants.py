# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

# ATTENTION: If you change any constants, make sure to also change utils/common.js

# string to use when None values *need* to be converted to/from strings
from enum import Enum

USER_AGENT = "Apache Superset"

NULL_STRING = "<NULL>"
EMPTY_STRING = "<empty string>"

CHANGE_ME_SECRET_KEY = "CHANGE_ME_TO_A_COMPLEX_RANDOM_SECRET"

# UUID for the examples database
EXAMPLES_DB_UUID = "a2dc77af-e654-49bb-b321-40f6b559a1ee"

PASSWORD_MASK = "X" * 10

NO_TIME_RANGE = "No filter"

QUERY_CANCEL_KEY = "cancel_query"
QUERY_EARLY_CANCEL_KEY = "early_cancel_query"

LRU_CACHE_MAX_SIZE = 256


class RouteMethod:  # pylint: disable=too-few-public-methods
    """
    Route methods are a FAB concept around ModelView and RestModelView
    classes in FAB. Derivatives can define `include_route_method` and
    `exclude_route_methods` class attribute as a set of methods that
    will or won't get exposed.

    This class is a collection of static constants to reference common
    route methods, namely the ones defined in the base classes in FAB
    """

    # ModelView specific
    ACTION = "action"
    ACTION_POST = "action_post"
    ADD = "add"
    API_CREATE = "api_create"
    API_DELETE = "api_delete"
    API_GET = "api_get"
    API_READ = "api_read"
    API_UPDATE = "api_update"
    DELETE = "delete"
    DOWNLOAD = "download"
    EDIT = "edit"
    LIST = "list"
    SHOW = "show"
    INFO = "info"

    # RestModelView specific
    EXPORT = "export"
    IMPORT = "import_"
    GET = "get"
    GET_LIST = "get_list"
    POST = "post"
    PUT = "put"
    RELATED = "related"
    DISTINCT = "distinct"

    # Commonly used sets
    API_SET = {API_CREATE, API_DELETE, API_GET, API_READ, API_UPDATE}
    CRUD_SET = {ADD, LIST, EDIT, DELETE, ACTION_POST, SHOW}
    RELATED_VIEW_SET = {ADD, LIST, EDIT, DELETE}
    REST_MODEL_VIEW_CRUD_SET = {DELETE, GET, GET_LIST, POST, PUT, INFO}


MODEL_VIEW_RW_METHOD_PERMISSION_MAP = {
    "add": "write",
    "api": "read",
    "api_column_add": "write",
    "api_column_edit": "write",
    "api_create": "write",
    "api_delete": "write",
    "api_get": "read",
    "api_read": "read",
    "api_readvalues": "read",
    "api_update": "write",
    "annotation": "read",
    "delete": "write",
    "download": "read",
    "download_dashboards": "read",
    "edit": "write",
    "list": "read",
    "muldelete": "write",
    "mulexport": "read",
    "show": "read",
    "new": "write",
    "yaml_export": "read",
    "refresh": "write",
}

MODEL_API_RW_METHOD_PERMISSION_MAP = {
    "bulk_delete": "write",
    "delete": "write",
    "distinct": "read",
    "get": "read",
    "get_list": "read",
    "info": "read",
    "post": "write",
    "put": "write",
    "related": "read",
    "related_objects": "read",
    "tables": "read",
    "schemas": "read",
    "select_star": "read",
    "table_metadata": "read",
    "table_extra_metadata": "read",
    "test_connection": "write",
    "validate_parameters": "write",
    "favorite_status": "read",
    "thumbnail": "read",
    "import_": "write",
    "refresh": "write",
    "cache_screenshot": "read",
    "screenshot": "read",
    "data": "read",
    "data_from_cache": "read",
    "get_charts": "read",
    "get_datasets": "read",
    "function_names": "read",
    "available": "read",
    "validate_sql": "read",
    "get_data": "read",
    "samples": "read",
    "delete_ssh_tunnel": "write",
    "get_updated_since": "read",
    "stop_query": "read",
}

EXTRA_FORM_DATA_APPEND_KEYS = {
    "adhoc_filters",
    "filters",
    "interactive_groupby",
    "interactive_highlight",
    "interactive_drilldown",
    "custom_form_data",
}

EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS = {
    "granularity": "granularity",
    "granularity_sqla": "granularity",
    "time_column": "time_column",
    "time_grain": "time_grain",
    "time_range": "time_range",
    "time_grain_sqla": "time_grain_sqla",
}

EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS = {
    "relative_start",
    "relative_end",
}

EXTRA_FORM_DATA_OVERRIDE_KEYS = (
    set(EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS.values())
    | EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS
)


class PandasAxis(int, Enum):
    ROW = 0
    COLUMN = 1


class PandasPostprocessingCompare(str, Enum):
    DIFF = "difference"
    PCT = "percentage"
    RAT = "ratio"


class CacheRegion(str, Enum):
    DEFAULT = "default"
    DATA = "data"
    THUMBNAIL = "thumbnail"
