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
from urllib.parse import unquote, urlparse

from flask import abort, redirect, request
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access

from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.link_redirect import is_safe_redirect_url
from superset.views.base import BaseSupersetView

logger = logging.getLogger(__name__)


class RedirectView(BaseSupersetView):
    """
    View for handling external link redirects with warning page
    """

    route_base = "/redirect"

    @expose("/")
    @has_access
    def redirect_warning(self) -> FlaskResponse:
        """
        Show a warning page before redirecting to an external URL
        """
        # Get the target URL from query parameters
        target_url = request.args.get("url", "")

        if not target_url or not target_url.strip():
            logger.warning("Redirect requested without URL parameter")
            abort(400, description="Missing URL parameter")

        # Decode the URL
        try:
            target_url = unquote(target_url).strip()
        except Exception as ex:
            logger.error("Failed to decode URL parameter: %s", str(ex))
            abort(400, description="Invalid URL parameter")

        # Additional validation - prevent certain dangerous schemes
        target_url_lower = target_url.lower()
        if target_url_lower.startswith(("javascript:", "data:", "vbscript:", "file:")):
            logger.warning(
                "Blocked potentially dangerous URL scheme: %s", target_url[:50]
            )
            abort(400, description="Invalid URL scheme")

        # Check if this is actually an external URL
        if is_safe_redirect_url(target_url):
            # If it's a safe/internal URL, redirect directly
            logger.info("Redirecting to internal URL: %s", target_url)
            return redirect(target_url)

        # Check if URL is in trusted URLs cookie
        try:
            trusted_urls_cookie = request.cookies.get("superset_trusted_urls", "[]")
            trusted_urls = json.loads(trusted_urls_cookie)

            # Normalize URL for comparison (remove trailing slashes and fragments)
            def normalize_url(url: str) -> str:
                parsed = urlparse(url)
                # Remove fragment and trailing slash from path
                path = parsed.path.rstrip("/") if parsed.path else ""
                normalized = f"{parsed.scheme}://{parsed.netloc}{path}"
                if parsed.query:
                    normalized += f"?{parsed.query}"
                return normalized

            normalized_target = normalize_url(target_url)

            # Check if this exact URL is trusted
            for trusted_url in trusted_urls:
                if normalize_url(trusted_url) == normalized_target:
                    logger.info("Redirecting to trusted URL: %s", target_url)
                    return redirect(target_url)
        except Exception as ex:
            # If cookie parsing fails, continue to warning page
            logger.debug("Failed to parse trusted URLs cookie: %s", str(ex))

        # Log external redirect attempt for monitoring
        logger.info("Showing warning for external URL: %s", target_url)

        # Otherwise, show the warning page
        return self.render_template(
            "superset/redirect_warning.html",
            target_url=target_url,
        )
