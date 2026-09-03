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
from typing import Callable

from flask import abort, current_app, request
from flask_appbuilder import expose
from flask_login import AnonymousUserMixin, login_user
from flask_wtf.csrf import same_origin

from superset import event_logger, is_feature_enabled
from superset.daos.chart import EmbeddedChartDAO
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.views.base import (
    BaseSupersetView,
    common_bootstrap_payload,
    get_language_pack_template_context,
)


class EmbeddedView(BaseSupersetView):
    """The views for embedded resources to be rendered in an iframe"""

    route_base = "/embedded"

    @expose("/<uuid>")
    @event_logger.log_this_with_extra_payload
    def embedded(
        self,
        uuid: str,
        add_extra_log_payload: Callable[..., None] = lambda **kwargs: None,
    ) -> FlaskResponse:
        """
        Server side rendering for the embedded dashboard or chart page
        :param uuid: identifier for the embedded dashboard or chart
        :param add_extra_log_payload: added by `log_this_with_manual_updates`, set a
            default value to appease pylint
        """
        if not is_feature_enabled("EMBEDDED_SUPERSET"):
            abort(404)

        # A uuid identifies either an embedded dashboard or an embedded chart.
        # Dashboards are looked up first since they are the older, more common
        # resource; the two id spaces are distinct so ordering is not ambiguous.
        resource_type = "dashboard"
        embedded = EmbeddedDashboardDAO.find_by_id(uuid)

        if not embedded:
            embedded = EmbeddedChartDAO.find_by_id(uuid)
            resource_type = "chart"

        if not embedded:
            abort(404)

        assert embedded is not None
        resource = (
            embedded.dashboard if resource_type == "dashboard" else embedded.slice
        )

        # validate request referrer in allowed domains
        is_referrer_allowed = not embedded.allowed_domains
        for domain in embedded.allowed_domains:
            try:
                if same_origin(request.referrer, domain):
                    is_referrer_allowed = True
                    break
            except ValueError:
                # The referrer is attacker-controlled and same_origin parses it
                # eagerly, so a malformed authority (e.g. a host that looks like
                # it carries a non-numeric port) raises rather than returning
                # False. Treat it as a non-match instead of a 500.
                continue

        if not is_referrer_allowed:
            abort(403)

        # Defense in depth: when the browser sends a Sec-Fetch-Dest header,
        # require an embeddable destination (iframe/frame) or a direct
        # document/fetch load, rather than e.g. an <img>/<script>/<object> tag.
        # The header is unforgeable by page script; an absent header (older
        # browsers / non-browser clients) is allowed for compatibility.
        sec_fetch_dest = request.headers.get("Sec-Fetch-Dest")
        if sec_fetch_dest and sec_fetch_dest not in {
            "iframe",
            "frame",
            "document",
            "empty",
        }:
            abort(403)

        # Log in as an anonymous user, just for this view.
        # This view needs to be visible to all users,
        # and building the page fails if g.user and/or ctx.user aren't present.
        login_user(AnonymousUserMixin(), force=True)

        add_extra_log_payload(
            embedded_id=uuid,
            resource_type=resource_type,
            dashboard_version="v2",
        )

        bootstrap_data = {
            "config": {
                "GUEST_TOKEN_HEADER_NAME": current_app.config["GUEST_TOKEN_HEADER_NAME"]
            },
            "common": common_bootstrap_payload(),
            "embedded": {
                "resource_type": resource_type,
                "dashboard_id": (
                    embedded.dashboard_id if resource_type == "dashboard" else None
                ),
                "chart_id": embedded.slice_id if resource_type == "chart" else None,
                # The list of domains allowed to embed this dashboard. An empty
                # list means any domain is allowed (no restriction). The frontend
                # uses this to validate the origin of incoming postMessage events.
                "allowed_domains": embedded.allowed_domains,
            },
        }

        return self.render_template(
            "superset/spa.html",
            entry="embedded",
            title=(
                resource.dashboard_title
                if resource_type == "dashboard"
                else resource.slice_name
            ),
            dashboard_description=resource.description,
            bootstrap_data=json.dumps(
                bootstrap_data, default=json.pessimistic_json_iso_dttm_ser
            ),
            **get_language_pack_template_context(bootstrap_data["common"]),
        )
