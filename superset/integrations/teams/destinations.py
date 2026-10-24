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
"""Browser-safe discovery of operator-approved Teams destinations."""

from uuid import UUID

from flask import current_app
from sqlalchemy import select
from sqlalchemy.orm import Session

from superset.extensions import db, feature_flag_manager
from superset.integrations.teams.config import (
    parse_teams_config,
    TeamsConfig,
    TeamsConfigError,
)
from superset.integrations.teams.dependencies import is_teams_sdk_installed
from superset.integrations.teams.models import TeamsInstallation


def configured_teams() -> TeamsConfig | None:
    """Resolve an enabled, configured integration with its optional SDK installed."""
    if not feature_flag_manager.is_feature_enabled("ALERT_REPORT_TEAMS"):
        return None
    try:
        config = parse_teams_config(current_app.config.get("ALERT_REPORTS_TEAMS", {}))
    except TeamsConfigError:
        return None
    return config if config is not None and is_teams_sdk_installed() else None


def list_teams_destinations() -> list[dict[str, str | bool]]:
    """Expose labels, keys and installation availability, with no routing or secrets."""
    config = configured_teams()
    if config is None:
        return []
    with Session(db.engine) as session:
        active_teams = set(
            session.scalars(
                select(TeamsInstallation.team_id).where(
                    TeamsInstallation.tenant_id == UUID(config.tenant_id),
                    TeamsInstallation.application_id == UUID(config.application_id),
                    TeamsInstallation.active.is_(True),
                    TeamsInstallation.team_id.in_(
                        {destination.team_id for destination in config.destinations}
                    ),
                )
            )
        )
    return [
        {
            "key": destination.key,
            "label": destination.label,
            "available": destination.team_id in active_teams,
        }
        for destination in config.destinations
    ]
