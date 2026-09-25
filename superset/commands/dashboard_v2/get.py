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
from __future__ import annotations

from typing import Any

from superset.commands.base import BaseCommand
from superset.commands.dashboard_v2.exceptions import (
    DashboardV2ForbiddenError,
    DashboardV2NotFoundError,
)
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.dashboard_v2.document import load_stored_document
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard


def resolve_dashboard(ref: str) -> Dashboard | None:
    """
    A dashboard by embedded uuid, dashboard uuid, or integer pk (in that
    order) — the one address shape every block endpoint accepts.
    """
    if (embedded := EmbeddedDashboardDAO.find_by_id(ref)) is not None:
        return embedded.dashboard
    return Dashboard.get(ref)


def load_v2_dashboard(ref: str) -> tuple[Dashboard, dict[str, Any]]:
    """
    Resolve ``ref`` to an accessible v2 dashboard and its stored document.

    Looks the row up directly and gates it with ``raise_for_access`` — the
    same object-level check for guests and logged-in users alike; the list
    base filter is not an access check for a single dashboard.
    """
    dashboard = resolve_dashboard(ref)
    if dashboard is None:
        raise DashboardV2NotFoundError(ref)
    try:
        dashboard.raise_for_access()
    except SupersetSecurityException as ex:
        raise DashboardV2ForbiddenError() from ex
    stored = load_stored_document(dashboard.json_metadata)
    if stored is None:
        raise DashboardV2NotFoundError(ref)
    return dashboard, stored


def serialize_dashboard(dashboard: Dashboard, stored: dict[str, Any]) -> dict[str, Any]:
    embedded = dashboard.embedded[0] if dashboard.embedded else None
    return {
        "id": dashboard.id,
        "uuid": str(dashboard.uuid),
        "dashboard_title": dashboard.dashboard_title,
        "changed_on": dashboard.changed_on,
        "document": stored,
        "embedded": (
            {"uuid": str(embedded.uuid), "allowed_domains": embedded.allowed_domains}
            if embedded
            else None
        ),
    }


class GetDashboardV2Command(BaseCommand):
    """Load a v2 dashboard by embedded uuid, dashboard uuid, or pk."""

    def __init__(self, ref: str) -> None:
        self._ref = ref

    def run(self) -> dict[str, Any]:
        dashboard, stored = load_v2_dashboard(self._ref)
        return serialize_dashboard(dashboard, stored)

    def validate(self) -> None:
        pass
