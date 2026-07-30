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
"""MCP tool: generate_canvas."""

import logging

from fastmcp import Context
from flask import g
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger
from superset.mcp_service.canvas.schemas import (
    CanvasInfo,
    GenerateCanvasRequest,
    GenerateCanvasResponse,
)
from superset.mcp_service.canvas.validation import validate_cdl
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Canvas",
    annotations=ToolAnnotations(
        title="Create canvas",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
def generate_canvas(
    request: GenerateCanvasRequest,
    ctx: Context,  # noqa: ARG001
) -> GenerateCanvasResponse:
    """Create a NEW AI-native canvas (v2 dashboard) from a CDL definition.

    Call get_canvas_schema first for the contract, and list_datasets /
    get_dataset_info to resolve real datasetId/columns/metrics for bound
    charts. The definition is validated server-side; on failure the response
    carries ``validation_errors`` to fix and retry (no canvas is created).

    Returns the canvas id and URL on success.
    """
    definition = request.definition

    if validation_errors := validate_cdl(definition):
        return GenerateCanvasResponse(
            error="CDL validation failed; fix validation_errors and retry.",
            validation_errors=validation_errors,
        )

    try:
        # Imported lazily to avoid encrypted-column init before app setup,
        # matching generate_dashboard.
        from superset.extensions import security_manager
        from superset.models.canvas import Canvas
        from superset.subjects.utils import get_user_subject

        with event_logger.log_context(action="mcp.generate_canvas.db_write"):
            canvas = Canvas()
            canvas.name = request.name
            canvas.definition = json.dumps(definition)

            # Re-query the user in this session (g.user may be bound to a
            # torn-down session in the MCP context; see generate_dashboard).
            current_user = (
                db.session.query(security_manager.user_model)
                .filter_by(id=g.user.id)
                .first()
            )
            if current_user:
                subject = get_user_subject(current_user.id)
                if subject:
                    canvas.editors = [subject]

            db.session.add(canvas)
            db.session.commit()  # pylint: disable=consider-using-transaction
            try:
                db.session.refresh(canvas)
            except SQLAlchemyError:
                logger.warning(
                    "Canvas %s created but refresh failed", canvas.id, exc_info=True
                )

        canvas_url = f"{get_superset_base_url()}/canvas/{canvas.id}/"
        logger.info("Created canvas %s", canvas.id)
        return GenerateCanvasResponse(
            canvas=CanvasInfo(
                id=canvas.id,
                name=canvas.name,
                url=canvas_url,
                uuid=str(canvas.uuid) if canvas.uuid else None,
            ),
            canvas_url=canvas_url,
        )
    except (SQLAlchemyError, ValueError, AttributeError) as ex:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning("Rollback failed during error handling", exc_info=True)
        logger.error("Error creating canvas: %s", ex, exc_info=True)
        return GenerateCanvasResponse(
            error="Failed to create canvas due to an internal error."
        )
