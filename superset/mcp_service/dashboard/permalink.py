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

"""Helpers for resolving dashboard permalink keys and shared URLs."""

import logging
from urllib.parse import urlparse

from flask import g, has_request_context

from superset.dashboards.permalink.exceptions import DashboardPermalinkGetFailedError
from superset.dashboards.permalink.types import DashboardPermalinkValue
from superset.mcp_service.auth import load_user_with_relationships

logger = logging.getLogger(__name__)


def extract_dashboard_permalink_key(value: str) -> str:
    """Return a key from a dashboard permalink URL, or the bare input."""
    path_parts = [part for part in urlparse(value).path.split("/") if part]
    if len(path_parts) >= 3 and path_parts[-3:-1] == ["dashboard", "p"]:
        return path_parts[-1]
    return value


def refresh_request_user_for_permalink_access() -> None:
    """Reload the request user before permalink access checks."""
    if not has_request_context() or not getattr(g, "user", None):
        return
    current_user = g.user
    if getattr(current_user, "is_anonymous", False):
        return
    username = getattr(current_user, "username", None)
    email = getattr(current_user, "email", None)
    if not username and not email:
        return
    refreshed_user = (
        load_user_with_relationships(username=username)
        if username
        else load_user_with_relationships(email=email)
    )
    if refreshed_user is not None:
        g.user = refreshed_user


def get_dashboard_permalink(
    key_or_url: str,
) -> tuple[str, DashboardPermalinkValue] | None:
    """Resolve a dashboard permalink key or shared URL, returning its state."""
    from superset.commands.dashboard.permalink.get import GetDashboardPermalinkCommand

    key = extract_dashboard_permalink_key(key_or_url)
    refresh_request_user_for_permalink_access()
    try:
        value = GetDashboardPermalinkCommand(key).run()
    except DashboardPermalinkGetFailedError as ex:
        logger.info("Dashboard permalink could not be resolved: %s", ex)
        return None
    return (key, value) if value else None
