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
from typing import Callable
from urllib.parse import urlparse

from flask import abort, current_app, request
from flask_appbuilder import expose
from flask_login import AnonymousUserMixin, login_user

from superset import event_logger
from superset.daos.key_value import KeyValueDAO
from superset.explore.permalink.schemas import ExplorePermalinkSchema
from superset.key_value.shared_entries import get_permalink_salt
from superset.key_value.types import (
    KeyValueResource,
    MarshmallowKeyValueCodec,
    SharedKey,
)
from superset.key_value.utils import decode_permalink_id
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.views.base import BaseSupersetView, common_bootstrap_payload

logger = logging.getLogger(__name__)


def same_origin(url1: str | None, url2: str | None) -> bool:
    """Check if two URLs have the same origin (scheme + netloc)."""
    if not url1 or not url2:
        return False
    parsed1 = urlparse(url1)
    parsed2 = urlparse(url2)
    # For domain matching, we just check if the host matches
    # url2 might just be a domain like "example.com"
    if not parsed2.scheme:
        # url2 is just a domain, check if it matches url1's netloc
        return parsed1.netloc == url2 or parsed1.netloc.endswith(f".{url2}")
    return (parsed1.scheme, parsed1.netloc) == (parsed2.scheme, parsed2.netloc)


class EmbeddedChartView(BaseSupersetView):
    """Server-side rendering for embedded chart pages."""

    route_base = "/embedded/chart"

    @expose("/")
    @event_logger.log_this_with_extra_payload
    def embedded_chart(
        self,
        add_extra_log_payload: Callable[..., None] = lambda **kwargs: None,
    ) -> FlaskResponse:
        """
        Server side rendering for the embedded chart page.
        Expects ?permalink_key=xxx query parameter.
        """
        # Get permalink_key from query params
        permalink_key = request.args.get("permalink_key")
        if not permalink_key:
            logger.warning("Missing permalink_key in embedded chart request")
            abort(404)

        # Get permalink value to check allowed domains
        try:
            salt = get_permalink_salt(SharedKey.EXPLORE_PERMALINK_SALT)
            codec = MarshmallowKeyValueCodec(ExplorePermalinkSchema())
            key = decode_permalink_id(permalink_key, salt=salt)
            permalink_value = KeyValueDAO.get_value(
                KeyValueResource.EXPLORE_PERMALINK,
                key,
                codec,
            )
        except Exception:
            logger.exception("Error fetching permalink for referrer validation")
            permalink_value = None

        # Validate request referrer against allowed domains (if configured)
        if permalink_value:
            state = permalink_value.get("state", {})
            allowed_domains = state.get("allowedDomains", [])

            if allowed_domains:
                is_referrer_allowed = False
                for domain in allowed_domains:
                    if same_origin(request.referrer, domain):
                        is_referrer_allowed = True
                        break

                if not is_referrer_allowed:
                    logger.warning(
                        "Embedded chart referrer not in allowed domains: %s",
                        request.referrer,
                    )
                    abort(403)

        # Log in as anonymous user for page rendering
        # This view needs to be visible to all users,
        # and building the page fails if g.user and/or ctx.user aren't present.
        login_user(AnonymousUserMixin(), force=True)

        add_extra_log_payload(
            embedded_type="chart",
            permalink_key=permalink_key,
        )

        bootstrap_data = {
            "config": {
                "GUEST_TOKEN_HEADER_NAME": current_app.config.get(
                    "GUEST_TOKEN_HEADER_NAME", "X-GuestToken"
                ),
            },
            "common": common_bootstrap_payload(),
            "embedded_chart": True,
        }

        return self.render_template(
            "superset/spa.html",
            entry="embeddedChart",
            bootstrap_data=json.dumps(
                bootstrap_data, default=json.pessimistic_json_iso_dttm_ser
            ),
        )
