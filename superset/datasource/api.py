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
import logging

from flask_appbuilder.api import BaseApi, expose, protect, safe

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP

logger = logging.getLogger(__name__)


class DatasourceRestApi(BaseApi):
    include_route_methods = {}
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    class_permission_name = "Datasource"
    resource_name = "datasource"
    openapi_spec_tag = "Datasources"

