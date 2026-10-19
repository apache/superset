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

from flask import current_app
from sqlalchemy.orm import Session

from superset.extensions import db, feature_flag_manager
from superset.integrations.teams.config import (
    parse_teams_config,
    TeamsConfig,
    TeamsConfigError,
)
from superset.integrations.teams.store import TeamsInstallationStore


def configured_teams() -> TeamsConfig | None:
    """Resolve an enabled integration without exposing configuration errors."""
    if not feature_flag_manager.is_feature_enabled("ALERT_REPORT_TEAMS"):
        return None
    try:
        return parse_teams_config(current_app.config.get("ALERT_REPORTS_TEAMS", {}))
    except TeamsConfigError:
        return None


def list_teams_destinations() -> list[dict[str, str | bool]]:
    """Expose labels, keys and installation availability, with no routing or secrets."""
    config = configured_teams()
    if config is None:
        return []
    with Session(db.engine) as session:
        store = TeamsInstallationStore(session)
        return [
            {
                "key": destination.key,
                "label": destination.label,
                "available": store.get_active(
                    tenant_id=config.tenant_id,
                    application_id=config.application_id,
                    team_id=destination.team_id,
                )
                is not None,
            }
            for destination in config.destinations
        ]
