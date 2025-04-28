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

from urllib.parse import urlencode

from flask import g, redirect, request
from flask_appbuilder import expose
from flask_appbuilder.security.views import AuthView
from werkzeug import Response


class AuthRedirectView(AuthView):
    route_base = ""

    @expose("/login/", methods=["GET"])
    def login(self) -> Response:
        if g.user is not None and g.user.is_authenticated:
            return redirect(self.appbuilder.get_url_for_index)

        next_url = request.args.get("next")
        query_params = {"next": next_url} if next_url else {}
        signin_url = f"/signin/?{urlencode(query_params)}"

        return redirect(signin_url)

    @expose("/logout/", methods=["GET"])
    def logout(self) -> Response:
        return redirect("/signout/")
