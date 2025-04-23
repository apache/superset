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

from flask_appbuilder import expose
from flask_appbuilder.security.views import no_cache

from superset.views.base import BaseSupersetView


class SupersetAuthView(BaseSupersetView):
    """
    This class is used to override the default authentication view in Flask AppBuilder.
    It is used to customize the login and logout views.
    """

    route_base = "/"

    @expose("/login/", methods=["GET"])
    @no_cache
    def login(self) -> str:
        """
        Override the default login view to return a 404 error.
        This is used to disable the login view in Flask AppBuilder.
        """
        return super().render_app_template()
