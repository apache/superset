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
from flask import redirect, request
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose
from flask_appbuilder.security.decorators import has_access

from superset import event_logger
from superset.superset_typing import FlaskResponse
from superset.views.utils import loads_request_json

from .base import BaseSupersetView


class ExploreView(BaseSupersetView):
    route_base = "/explore"
    class_permission_name = "Explore"

    @expose("/")
    @has_access
    @permission_name("read")
    @event_logger.log_this
    def root(self) -> FlaskResponse:
        # After `Superset.route_base = ""`, both `Superset.explore` and this
        # view register at `/explore/`; this view wins. Preserve the legacy
        # form_data → form_data_key cache-and-redirect contract here so
        # callers passing `?form_data=...` with a datasource still get the
        # short cache-key URL. Form_data without a datasource (e.g. legacy
        # `slice_url` payloads carrying only `slice_id`) cannot be cached,
        # so `get_redirect_url` would return the same URL — falling back to
        # SPA rendering avoids a 302 loop.
        if request_form_data := request.args.get("form_data"):
            parsed_form_data = loads_request_json(request_form_data)
            if isinstance(parsed_form_data, dict) and parsed_form_data.get(
                "datasource"
            ):
                from superset.views.core import Superset  # avoid circular import

                return redirect(Superset.get_redirect_url())
        return super().render_app_template()


class ExplorePermalinkView(BaseSupersetView):
    # Mirror `Superset.route_base = ""` (see `views/core.py`): Flask-AppBuilder
    # auto-derives `/explorepermalink` from the class name, but the rule pattern
    # already encodes the full path. Leaving the auto-derived value collides
    # with `AppRootMiddleware` under subdirectory deployments and doubles the
    # prefix emitted by `url_for("ExplorePermalinkView.permalink")`.
    route_base = ""
    class_permission_name = "Explore"

    @expose("/explore/p/<key>/")
    @has_access
    @permission_name("read")
    @event_logger.log_this
    # pylint: disable=unused-argument
    def permalink(self, key: str) -> FlaskResponse:
        return super().render_app_template()
