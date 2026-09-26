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
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose
from flask_appbuilder.security.decorators import has_access

from superset.superset_typing import FlaskResponse

from .base import BaseSupersetView


class UserInfoView(BaseSupersetView):
    """SPA shell for the signed-in user's own profile page.

    Uses ``can_userinfo on UserInfo`` rather than ``can_read on user`` /
    ``User``. The latter is Admin-only (``ADMIN_ONLY_VIEW_MENUS``), so
    Alpha/Gamma were redirected to ``/superset/welcome/`` when opening
    Settings → Info even though the menu link is shown to every
    authenticated user. ``can_userinfo`` is already in
    ``ACCESSIBLE_PERMS``, so stock Gamma and Alpha receive it on role sync.
    """

    route_base = "/"
    class_permission_name = "UserInfo"

    @expose("/user_info/")
    @has_access
    @permission_name("userinfo")
    def list(self) -> FlaskResponse:
        return super().render_app_template()
