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
from flask import abort, g
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose
from flask_appbuilder.security.decorators import has_access

from superset import event_logger, security_manager
from superset.superset_typing import FlaskResponse

from .base import BaseSupersetView


class ProfileView(BaseSupersetView):
    route_base = "/profile"
    class_permission_name = "Profile"

    @expose("/")
    @has_access
    @permission_name("read")
    @event_logger.log_this
    def root(self) -> FlaskResponse:
        user = g.user if hasattr(g, "user") and g.user else None
        if not user or security_manager.is_guest_user(user) or user.is_anonymous:
            abort(404)
        return super().render_app_template()
