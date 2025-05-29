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

from typing import Optional

from flask import g, redirect
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import no_cache
from flask_appbuilder.security.views import AuthView, WerkzeugResponse

from superset.views.base import BaseSupersetView


class SupersetAuthView(BaseSupersetView, AuthView):
    route_base = "/login"

    @expose("/")
    @no_cache
    def login(self, provider: Optional[str] = None) -> WerkzeugResponse:
        if g.user is not None and g.user.is_authenticated:
            return redirect(self.appbuilder.get_url_for_index)

        return super().render_app_template()


class SupersetRegisterUserView(BaseSupersetView):
    route_base = "/register"

    @expose("/")
    @no_cache
    def register(self) -> WerkzeugResponse:
        return super().render_app_template()
