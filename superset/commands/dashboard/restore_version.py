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
"""Restore dashboard to a previous version."""

from functools import partial
from typing import Optional

from flask_appbuilder.models.sqla import Model

from superset import db, security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardRestoreFailedError,
    DashboardVersionNotFoundError,
)
from superset.daos.dashboard import DashboardDAO
from superset.daos.dashboard_version import DashboardVersionDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard, dashboard_slices
from superset.models.dashboard_version import DashboardVersion
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.decorators import on_error, transaction


def _persist_dashboard_slices(dashboard_id: int, slices: list[Slice]) -> None:
    """
    Explicitly update dashboard_slices so the dashboard only has these slices.
    Ensures that when we restore a version that removed a chart, the chart
    is no longer linked and will not be loaded by the API.
    """
    db.session.execute(
        dashboard_slices.delete().where(dashboard_slices.c.dashboard_id == dashboard_id)
    )
    for slc in slices:
        db.session.execute(
            dashboard_slices.insert().values(dashboard_id=dashboard_id, slice_id=slc.id)
        )


class RestoreDashboardVersionCommand(BaseCommand):
    """Restore a dashboard to a previous version snapshot."""

    def __init__(self, dashboard_id: int, version_id: int) -> None:
        self._dashboard_id = dashboard_id
        self._version_id = version_id
        self._dashboard: Optional[Dashboard] = None
        self._version: Optional[DashboardVersion] = None

    @transaction(on_error=partial(on_error, reraise=DashboardRestoreFailedError))
    def run(self) -> Model:
        self.validate()
        assert self._dashboard is not None
        assert self._version is not None

        dashboard = DashboardDAO.update(
            self._dashboard,
            {
                "position_json": self._version.position_json,
                "json_metadata": self._version.json_metadata,
            },
        )
        self._sync_slices_from_layout(dashboard)
        self._remove_orphaned_chart_components(dashboard)
        return dashboard

    @staticmethod
    def _sync_slices_from_layout(dashboard: Dashboard) -> None:
        """
        Sync dashboard.slices to match chart ids in position_json.
        - Version that removed a chart: layout has no CHART → slices = [] (chart gone).
        - Version that has a chart: layout has CHART → slices includes it (chart shown).
        Persist by updating dashboard_slices table so the API returns correct slices.
        """
        if not dashboard.position_json:
            _persist_dashboard_slices(dashboard.id, [])
            return
        try:
            positions = json.loads(dashboard.position_json)
        except (TypeError, ValueError):
            return
        slice_ids = [
            value.get("meta", {}).get("chartId")
            for value in positions.values()
            if isinstance(value, dict) and value.get("type") == "CHART"
        ]
        slice_ids = [sid for sid in slice_ids if sid is not None]
        if not slice_ids:
            _persist_dashboard_slices(dashboard.id, [])
        else:
            current_slices = (
                db.session.query(Slice).filter(Slice.id.in_(slice_ids)).all()
            )
            _persist_dashboard_slices(dashboard.id, current_slices)
        db.session.expire(dashboard, ["slices"])

    @staticmethod
    def _remove_orphaned_chart_components(dashboard: Dashboard) -> None:
        """
        Remove CHART components from the layout that reference a slice not in
        dashboard.slices (e.g. chart was deleted from DB). Prevents MissingChart.
        """
        if not dashboard.position_json or not dashboard.slices:
            return
        valid_slice_ids = {s.id for s in dashboard.slices}
        try:
            positions = json.loads(dashboard.position_json)
        except (TypeError, ValueError):
            return
        to_remove = []
        for comp_id, comp in positions.items():
            if not isinstance(comp, dict) or comp.get("type") != "CHART":
                continue
            chart_id = comp.get("meta", {}).get("chartId")
            if chart_id is not None and chart_id not in valid_slice_ids:
                to_remove.append(comp_id)
        for comp_id in to_remove:
            comp = positions.pop(comp_id, None)
            if comp and comp.get("parents"):
                parent_id = comp["parents"][-1] if comp["parents"] else None
                if (
                    parent_id
                    and parent_id in positions
                    and "children" in positions[parent_id]
                ):
                    positions[parent_id]["children"] = [
                        c for c in positions[parent_id]["children"] if c != comp_id
                    ]
        if to_remove:
            dashboard.position_json = json.dumps(
                positions, indent=None, separators=(",", ":"), sort_keys=True
            )

    def validate(self) -> None:
        self._dashboard = DashboardDAO.find_by_id(self._dashboard_id)
        if not self._dashboard:
            from superset.commands.dashboard.exceptions import (
                DashboardNotFoundError,
            )

            raise DashboardNotFoundError(str(self._dashboard_id))

        try:
            security_manager.raise_for_ownership(self._dashboard)
        except SupersetSecurityException as ex:
            raise DashboardForbiddenError() from ex

        self._version = DashboardVersionDAO.get_by_id(self._version_id)
        if not self._version:
            raise DashboardVersionNotFoundError(str(self._version_id))
        if self._version.dashboard_id != self._dashboard.id:
            raise DashboardVersionNotFoundError(str(self._version_id))
