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
"""Independently authenticated, installation-only Teams bot callback."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from flask import Blueprint, current_app, Flask, request, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset.extensions import csrf, db, feature_flag_manager
from superset.integrations.teams.config import (
    parse_teams_config,
    TeamsConfig,
    TeamsConfigError,
)
from superset.integrations.teams.store import TeamsInstallationStore

if TYPE_CHECKING:
    from superset.integrations.teams.adapter import TeamsInstallationEvent

logger = logging.getLogger(__name__)
blueprint = Blueprint("teams", __name__)


@blueprint.post("/api/v1/teams/events/")
@csrf.exempt
def teams_events() -> Response:
    """Accept SDK-authenticated installation events for approved teams."""
    if not feature_flag_manager.is_feature_enabled("ALERT_REPORT_TEAMS"):
        return Response(status=404)
    try:
        config = parse_teams_config(current_app.config.get("ALERT_REPORTS_TEAMS", {}))
    except TeamsConfigError:
        logger.error("Invalid Teams deployment configuration")
        return Response(status=503)
    if config is None:
        return Response(status=503)
    if not request.is_json:
        return Response(status=415)
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return Response(status=400)
    # Optional SDK imports stay behind the feature flag and deployment configuration.
    try:
        from superset.integrations.teams.adapter import process_teams_event
    except ImportError:
        logger.error("Teams SDK unavailable; install the teams dependency extra")
        return Response(status=503)
    result = process_teams_event(config, body, dict(request.headers))
    if result.status != 200 or result.event is None:
        return Response(status=result.status)
    event = result.event
    try:
        _persist_event(config, event)
    except ValueError:
        return Response(status=400)
    except SQLAlchemyError:
        logger.error("Unable to persist Teams installation event")
        return Response(status=500)
    return Response(status=200)


def _persist_event(config: TeamsConfig, event: TeamsInstallationEvent) -> None:
    """Commit one installation change, rolling back and closing on failure."""
    # A separate metadata session keeps transaction state out of Flask's session.
    # Persistence stays synchronous; the SDK event loop has already closed.
    with Session(db.engine) as session, session.begin():
        store = TeamsInstallationStore(session)
        if event.active:
            store.install(
                config.tenant_id,
                config.application_id,
                event.team_id,
                event.service_url,
            )
        else:
            store.remove(config.tenant_id, config.application_id, event.team_id)


def register_teams_api(app: Flask) -> None:
    """Register the callback without adding a blueprint-wide CSRF exemption."""
    app.register_blueprint(blueprint)
