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
from urllib.parse import unquote

from flask import abort, redirect, request
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access

from superset import is_feature_enabled
from superset.superset_typing import FlaskResponse
from superset.utils.link_redirect import is_safe_redirect_url
from superset.views.base import SupersetModelView

logger = logging.getLogger(__name__)


class RedirectView(SupersetModelView):
    """
    View for handling external link redirects with warning page
    """

    route_base = "/redirect"
    class_permission_name = "RedirectView"

    @expose("/")
    @has_access
    def redirect_warning(self) -> FlaskResponse:
        """
        Show a warning page before redirecting to an external URL
        """
        # Check if ALERT_REPORTS feature is enabled
        if not is_feature_enabled("ALERT_REPORTS"):
            abort(404, description="Feature not enabled")

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

        # Log external redirect attempt for monitoring
        logger.info("Showing warning for external URL: %s", target_url)

        # Otherwise, show the warning page
        return self.render_template(
            "superset/redirect_warning.html",
            target_url=target_url,
        )
