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
# pylint: disable=R
import json

from flask import g, request
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access_api

from superset import appbuilder, security_manager
from superset.common.query_context import QueryContext
from superset.models.core import Log
from .base import api, BaseSupersetView, data_payload_response, handle_api_exception


class Api(BaseSupersetView):
    @Log.log_this
    @api
    @handle_api_exception
    @has_access_api
    @expose('/v1/query/', methods=['POST'])
    def query(self):
        """
        Takes a query_obj constructed in the client and returns payload data response
        for the given query_obj.
        """
        query_context = QueryContext(**json.loads(request.form.get('query_context')))
        security_manager.assert_datasource_permission(query_context.datasource, g.user)
        payload_json = query_context.get_data()
        return data_payload_response(payload_json)


appbuilder.add_view_no_menu(Api)
