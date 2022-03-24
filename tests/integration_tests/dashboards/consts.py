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

QUERY_FORMAT = "?q={}"

DASHBOARDS_API_URL = "api/v1/dashboard/"
DASHBOARDS_API_URL_WITH_QUERY_FORMAT = DASHBOARDS_API_URL + QUERY_FORMAT
DASHBOARD_API_URL_FORMAT = DASHBOARDS_API_URL + "{}"
EXPORT_DASHBOARDS_API_URL = DASHBOARDS_API_URL + "export/"
EXPORT_DASHBOARDS_API_URL_WITH_QUERY_FORMAT = EXPORT_DASHBOARDS_API_URL + QUERY_FORMAT

GET_DASHBOARD_VIEW_URL_FORMAT = "/superset/dashboard/{}/"
SAVE_DASHBOARD_URL_FORMAT = "/superset/save_dash/{}/"
COPY_DASHBOARD_URL_FORMAT = "/superset/copy_dash/{}/"
ADD_SLICES_URL_FORMAT = "/superset/add_slices/{}/"

DELETE_DASHBOARD_VIEW_URL_FORMAT = "/dashboard/delete/{}"
GET_DASHBOARDS_LIST_VIEW = "/dashboard/list/"
NEW_DASHBOARD_URL = "/dashboard/new/"
GET_CHARTS_API_URL = "/api/v1/chart/"

GAMMA_ROLE_NAME = "Gamma"

ADMIN_USERNAME = "admin"
GAMMA_USERNAME = "gamma"

DASHBOARD_SLUG_OF_ACCESSIBLE_TABLE = "births"
DEFAULT_DASHBOARD_SLUG_TO_TEST = "births"
WORLD_HEALTH_SLUG = "world_health"
