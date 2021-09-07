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
from flask_appbuilder.models.sqla.interface import SQLAInterface

import superset.models.core as models
from superset.views.base_api import BaseSupersetModelRestApi

from ...constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from . import LogMixin


class LogRestApi(LogMixin, BaseSupersetModelRestApi):
    datamodel = SQLAInterface(models.Log)
    include_route_methods = {"get_list", "get", "post"}
    class_permission_name = "Log"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    resource_name = "log"
    allow_browser_login = True
    list_columns = [
        "user.username",
        "action",
        "dttm",
        "json",
        "slice_id",
        "dashboard_id",
        "user_id",
        "duration_ms",
        "referrer",
    ]
    show_columns = list_columns
