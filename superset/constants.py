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
NULL_STRING = "<NULL>"


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

    # RestModelView specific
    EXPORT = "export"
    GET = "get"
    GET_LIST = "get_list"
    POST = "post"
    PUT = "put"
    RELATED = "related"

    # Commonly used sets
    CRUD_SET = {ADD, LIST, EDIT, DELETE, ACTION_POST}
    RELATED_VIEW_SET = {ADD, LIST, EDIT, DELETE}
    REST_MODEL_VIEW_CRUD_SET = {DELETE, GET, GET_LIST, POST, PUT}
