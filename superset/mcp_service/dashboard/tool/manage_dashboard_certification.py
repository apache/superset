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
Manage dashboard certification FastMCP tool

Sets or clears the ``certified_by`` / ``certification_details`` badge
fields. Split out from the generic ``update_dashboard`` tool because
certification is a distinct governance concern from layout/theme/metadata
edits.
"""

import logging

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger
from superset.mcp_service.dashboard.schemas import (
    ManageDashboardCertificationRequest,
    ManageDashboardCertificationResponse,
)
from superset.mcp_service.dashboard.tool.governance_utils import (
    dashboard_url,
    find_and_authorize_dashboard,
)

logger: logging.Logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Manage dashboard certification",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
def manage_dashboard_certification(
    request: ManageDashboardCertificationRequest, ctx: Context
) -> ManageDashboardCertificationResponse:
    """
    Set or clear a dashboard's certification badge.

    ``certified_by`` and ``certification_details`` are independent optional
    fields: omit (None) to leave a field unchanged, pass an empty string to
    clear it, or pass a value to set it. Certification surfaces as a badge
    next to the dashboard title in the UI.

    Example::

        manage_dashboard_certification(request={
            "identifier": 42,
            "certified_by": "Data Platform Team",
            "certification_details": "Verified against source-of-truth metrics.",
        })
    """
    ctx.info(f"Managing dashboard certification: identifier={request.identifier}")

    dashboard, auth_error = find_and_authorize_dashboard(
        request.identifier, ManageDashboardCertificationResponse
    )
    if auth_error is not None:
        return auth_error
    assert dashboard is not None  # narrows for mypy

    if request.certified_by is None and request.certification_details is None:
        return ManageDashboardCertificationResponse(
            certified_by=dashboard.certified_by,
            certification_details=dashboard.certification_details,
            dashboard_url=dashboard_url(dashboard),
            changed_fields=[],
            warnings=["No fields provided; dashboard unchanged."],
        )

    changed_fields: list[str] = []
    warnings: list[str] = []
    # Captured before commit so the final response never has to dereference
    # `dashboard` post-commit: SQLAlchemy expires ORM attributes on commit,
    # and a failed `refresh()` below would otherwise leave a later
    # `dashboard.certified_by`/`certification_details` read free to raise an
    # unhandled `SQLAlchemyError` from a broken session.
    final_certified_by: str | None = dashboard.certified_by
    final_certification_details: str | None = dashboard.certification_details

    try:
        with event_logger.log_context(
            action="mcp.manage_dashboard_certification.apply"
        ):
            if request.certified_by is not None:
                final_certified_by = request.certified_by or None
                dashboard.certified_by = final_certified_by
                changed_fields.append("certified_by")

            if request.certification_details is not None:
                final_certification_details = request.certification_details or None
                dashboard.certification_details = final_certification_details
                changed_fields.append("certification_details")

            db.session.commit()  # pylint: disable=consider-using-transaction
            try:
                db.session.refresh(dashboard)
            except SQLAlchemyError:
                logger.warning(
                    "Dashboard %s certification updated but refresh failed; "
                    "continuing with current values",
                    dashboard.id,
                    exc_info=True,
                )
                warnings.append(
                    "Dashboard updated but post-update refresh failed; "
                    "returned values may not reflect database state."
                )

    except SQLAlchemyError as db_err:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling",
                exc_info=True,
            )
        logger.error("Dashboard certification update failed: %s", db_err, exc_info=True)
        return ManageDashboardCertificationResponse(
            error="Failed to update dashboard certification due to a database error.",
        )

    ctx.info(
        f"Dashboard {dashboard.id} certification updated: changed={changed_fields}"
    )

    return ManageDashboardCertificationResponse(
        certified_by=final_certified_by,
        certification_details=final_certification_details,
        dashboard_url=dashboard_url(dashboard),
        changed_fields=changed_fields,
        warnings=warnings,
    )
