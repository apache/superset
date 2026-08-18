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
from dataclasses import dataclass
from typing import Callable, Generic, TypeVar
from urllib.parse import urlparse

from flask import g, has_request_context

from superset.commands.dashboard.exceptions import DashboardAccessDeniedError
from superset.commands.dashboard.permalink.get import GetDashboardPermalinkCommand
from superset.dashboards.permalink.exceptions import DashboardPermalinkGetFailedError
from superset.dashboards.permalink.types import DashboardPermalinkValue
from superset.mcp_service.auth import load_user_with_relationships
from superset.mcp_service.dashboard.schemas import (
    redact_filter_state_data_model_metadata,
)
from superset.mcp_service.privacy import user_can_view_data_model_metadata

logger = logging.getLogger(__name__)

LookupResultT = TypeVar("LookupResultT")


@dataclass(frozen=True)
class DashboardLookupResult(Generic[LookupResultT]):
    """Result of resolving either a dashboard identifier or permalink."""

    result: LookupResultT | None
    permalink_key: str | None = None
    permalink_value: DashboardPermalinkValue | None = None
    resolved_from_permalink: bool = False
    """True when the dashboard itself was selected from the permalink."""


@dataclass(frozen=True)
class DashboardPermalinkState:
    """Permalink state belonging to a resolved dashboard."""

    key: str
    state: dict[str, object]


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
    key = extract_dashboard_permalink_key(key_or_url)
    refresh_request_user_for_permalink_access()
    try:
        value = GetDashboardPermalinkCommand(key).run()
    except (DashboardAccessDeniedError, DashboardPermalinkGetFailedError) as ex:
        logger.info("Dashboard permalink could not be resolved: %s", ex)
        return None
    return (key, value) if value else None


def lookup_dashboard_reference(
    *,
    identifier: int | str | None,
    permalink_key: str | None,
    lookup: Callable[[int | str], LookupResultT],
    is_found: Callable[[LookupResultT], bool],
) -> DashboardLookupResult[LookupResultT]:
    """Look up a dashboard while preserving identifier precedence.

    A supplied identifier selects the dashboard and an explicit permalink only
    contributes state. Shared permalink URLs and permalink-only requests select
    the dashboard embedded in the permalink. Ambiguous bare strings use normal
    identifier lookup first, then fall back to permalink resolution.
    """
    key = permalink_key
    identifier_is_permalink_url = False
    if isinstance(identifier, str):
        extracted_key = extract_dashboard_permalink_key(identifier)
        identifier_is_permalink_url = extracted_key != identifier
        if identifier_is_permalink_url:
            key = extracted_key

    if identifier is not None and not identifier_is_permalink_url:
        result = lookup(identifier)
        if is_found(result):
            resolved = get_dashboard_permalink(key) if key else None
            return DashboardLookupResult(
                result=result,
                permalink_key=resolved[0] if resolved else key,
                permalink_value=resolved[1] if resolved else None,
            )
        if permalink_key is not None or not isinstance(identifier, str):
            return DashboardLookupResult(result=result, permalink_key=key)
    else:
        result = None

    reference = key or (identifier if isinstance(identifier, str) else None)
    resolved = get_dashboard_permalink(reference) if reference else None
    if resolved is None:
        return DashboardLookupResult(result=result, permalink_key=reference)
    key, value = resolved
    return DashboardLookupResult(
        result=lookup(value["dashboardId"]),
        permalink_key=key,
        permalink_value=value,
        resolved_from_permalink=True,
    )


def get_matching_dashboard_permalink_state(
    lookup_result: DashboardLookupResult[LookupResultT],
    dashboard_id: int | None,
    dashboard_uuid: str | None = None,
    dashboard_slug: str | None = None,
) -> DashboardPermalinkState | None:
    """Return the permalink state when it belongs to the dashboard.

    ``CreateDashboardPermalinkCommand`` stores ``dashboardId`` as the dashboard
    UUID string, while older permalinks may hold a numeric ID or a slug, so the
    reference is compared against every identifier the dashboard answers to.
    """
    value = lookup_result.permalink_value
    key = lookup_result.permalink_key
    if value is None or key is None:
        return None
    if not lookup_result.resolved_from_permalink:
        # The identifier selected the dashboard, so the permalink only
        # contributes state when it points at that same dashboard.
        reference = value.get("dashboardId")
        known_identifiers = {
            str(candidate)
            for candidate in (dashboard_id, dashboard_uuid, dashboard_slug)
            if candidate is not None
        }
        if reference is None or str(reference) not in known_identifiers:
            return None

    raw_state = value.get("state")
    state: dict[str, object] = dict(raw_state) if isinstance(raw_state, dict) else {}
    if not user_can_view_data_model_metadata():
        state = redact_filter_state_data_model_metadata(state)
    return DashboardPermalinkState(key=key, state=state)
