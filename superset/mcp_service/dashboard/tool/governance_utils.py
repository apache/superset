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

"""
Shared helpers for the dashboard governance tools
(``manage_dashboard_owners`` / ``manage_dashboard_roles`` /
``manage_dashboard_certification``).

``update_dashboard`` keeps its own variant of the lookup/authorization
helper because its not-found contract differs — it returns a
``DashboardError`` carrying an ``error_type`` rather than the tool's own
response schema; unifying that shape is left to a follow-up.
"""

import logging
from typing import Any, TypeVar

from sqlalchemy.exc import SQLAlchemyError

from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.dashboard.schemas import DashboardMutationErrorFields
from superset.mcp_service.utils.url_utils import get_superset_base_url

logger: logging.Logger = logging.getLogger(__name__)

ResponseT = TypeVar("ResponseT", bound=DashboardMutationErrorFields)


def find_and_authorize_dashboard(
    identifier: int | str,
    response_cls: type[ResponseT],
) -> tuple[Any, ResponseT | None]:
    """Return (dashboard, None) on success or (None, error_response) on failure.

    ``response_cls`` is the calling tool's response schema; every failure
    mode is reported through it so the caller has a single pre-condition
    branch. Mirrors the helper in ``update_dashboard``: avoids ImportError
    before Flask app initialisation by co-locating the imports it needs
    with the call site rather than importing them at module load time.
    """
    from superset import security_manager
    from superset.daos.dashboard import DashboardDAO

    try:
        dashboard = DashboardDAO.get_by_id_or_slug(identifier)
    except DashboardAccessDeniedError:
        # get_by_id_or_slug re-checks view access and raises access-denied
        # for dashboards the caller cannot see; surface it as the
        # structured permission_denied response instead of an unhandled
        # error.
        return None, response_cls(
            permission_denied=True,
            error=(
                "You do not have permission to access this dashboard. "
                "Ask the user to grant access; do not retry."
            ),
        )
    except DashboardNotFoundError:
        return None, response_cls(
            error=f"Dashboard not found: {identifier!r}",
        )
    except SQLAlchemyError:
        logger.exception("Database error looking up dashboard %r", identifier)
        return None, response_cls(
            error="Failed to look up dashboard due to a database error.",
        )

    if dashboard is None:
        return None, response_cls(
            error=f"Dashboard not found: {identifier!r}",
        )

    try:
        security_manager.raise_for_editorship(dashboard)
    except SupersetSecurityException:
        return None, response_cls(
            permission_denied=True,
            error=(
                f"You don't have permission to edit dashboard "
                f"'{dashboard.dashboard_title}' (ID: {dashboard.id})."
            ),
        )

    return dashboard, None


def dashboard_url(dashboard: Any) -> str:
    """Build the user-facing dashboard URL, preferring slug over id."""
    return f"{get_superset_base_url()}/dashboard/{dashboard.slug or dashboard.id}/"
