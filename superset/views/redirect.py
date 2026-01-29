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
from typing import Any
from urllib.parse import urlparse

from flask import abort, redirect, request
from flask_appbuilder import expose

from superset import is_feature_enabled
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.link_redirect import is_safe_redirect_url, is_valid_url_encoding
from superset.views.base import BaseSupersetView

logger = logging.getLogger(__name__)

DANGEROUS_SCHEMES: tuple[str, ...] = ("javascript:", "data:", "vbscript:", "file:")


def _normalize_url(url: str) -> str:
    """Normalize URL for comparison (remove trailing slashes and fragments)."""
    parsed = urlparse(url)
    path = parsed.path.rstrip("/") if parsed.path else ""
    normalized = f"{parsed.scheme}://{parsed.netloc}{path}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


def _get_validated_url() -> str:
    """
    Extract and validate the target URL from request parameters.

    Returns the decoded and validated URL, or aborts with appropriate error.
    """
    target_url = request.args.get("url", "")

    if not target_url or not target_url.strip():
        logger.warning("Redirect requested without URL parameter")
        abort(400, description="Missing URL parameter")

    target_url = target_url.strip()
    if not is_valid_url_encoding(target_url):
        logger.warning("Invalid URL encoding in redirect URL parameter")
        abort(400, description="Invalid URL parameter")

    if target_url.lower().startswith(DANGEROUS_SCHEMES):
        logger.warning("Blocked potentially dangerous URL scheme: %s", target_url[:50])
        abort(400, description="Invalid URL scheme")

    return target_url


def _is_url_in_trusted_cookie(target_url: str) -> bool:
    """Check if the URL is in the trusted URLs cookie."""
    try:
        trusted_urls_cookie = request.cookies.get("superset_trusted_urls", "[]")
        trusted_urls_raw: Any = json.loads(trusted_urls_cookie)
        if not isinstance(trusted_urls_raw, list):
            return False

        trusted_urls = [url for url in trusted_urls_raw if isinstance(url, str)]
        normalized_target = _normalize_url(target_url)

        return any(
            _normalize_url(trusted_url) == normalized_target
            for trusted_url in trusted_urls
        )
    except Exception as ex:
        logger.debug("Failed to parse trusted URLs cookie: %s", str(ex))
        return False


class RedirectView(BaseSupersetView):
    """
    View for handling external link redirects with warning page.

    This endpoint is publicly accessible (no authentication required)
    to support external link warnings in email reports sent to users
    who may not have active Superset sessions.
    """

    route_base = "/redirect"

    @expose("/")
    def redirect_warning(self) -> FlaskResponse:
        """
        Show a warning page before redirecting to an external URL.

        The React frontend handles the UI - this endpoint validates the URL
        and redirects trusted/internal URLs directly.
        """
        if not is_feature_enabled("ALERT_REPORTS"):
            abort(404)

        target_url = _get_validated_url()

        # Redirect directly for internal URLs
        if is_safe_redirect_url(target_url):
            logger.info("Redirecting to internal URL: %s", target_url)
            return redirect(target_url)

        # Redirect directly for trusted URLs from cookie
        if _is_url_in_trusted_cookie(target_url):
            logger.info("Redirecting to trusted URL: %s", target_url)
            return redirect(target_url)

        # Show the React warning page for external URLs
        logger.info("Showing warning for external URL: %s", target_url)
        return super().render_app_template()
