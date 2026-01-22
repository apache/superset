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
import logging
from functools import partial
from typing import Optional

from flask_babel import lazy_gettext as _
from sqlalchemy import func

from superset import db, security_manager
from superset.commands.base import BaseCommand
from superset.commands.chart.exceptions import (
    ChartDeleteFailedError,
    ChartDeleteFailedReportsExistError,
    ChartForbiddenError,
    ChartNotFoundError,
)
from superset.daos.chart import ChartDAO
from superset.daos.report import ReportScheduleDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteChartCommand(BaseCommand):
    def __init__(self, model_ids: list[int]):
        self._model_ids = model_ids
        self._models: Optional[list[Slice]] = None

    @transaction(on_error=partial(on_error, reraise=ChartDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._models
        # Clean up dashboard metadata before deleting charts
        for chart in self._models:
            self._cleanup_dashboard_metadata(chart.id)
        ChartDAO.delete(self._models)

    def validate(self) -> None:
        # Validate/populate model exists
        self._models = ChartDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise ChartNotFoundError()
        # Check there are no associated ReportSchedules
        if reports := ReportScheduleDAO.find_by_chart_ids(self._model_ids):
            report_names = [report.name for report in reports]
            raise ChartDeleteFailedReportsExistError(
                _(
                    "There are associated alerts or reports: %(report_names)s",
                    report_names=",".join(report_names),
                )
            )
        # Check ownership
        for model in self._models:
            try:
                security_manager.raise_for_ownership(model)
            except SupersetSecurityException as ex:
                raise ChartForbiddenError() from ex

    def _cleanup_dashboard_metadata(  # noqa: C901
        self, chart_id: int
    ) -> None:
        """
        Remove references to this chart from all dashboard metadata.

        When a chart is deleted, dashboards may still contain references to the
        chart ID in various metadata fields (expanded_slices, filter_scopes, etc.).
        This method cleans up those references to prevent issues during dashboard
        export/import.
        """

        # First check how many dashboards contain this chart
        dashboard_count = (
            db.session.query(func.count(Dashboard.id))
            .filter(Dashboard.slices.any(id=chart_id))  # type: ignore[attr-defined]
            .scalar()
        )

        if dashboard_count == 0:
            return

        # Log warning if cleaning up many dashboards
        if dashboard_count > 100:
            logger.warning(
                "Chart %s is on %d dashboards. "
                "Cleaning up metadata may take some time.",
                chart_id,
                dashboard_count,
            )

        # Use a reasonable limit to prevent memory issues with extremely popular charts
        if dashboard_count > (safety_limit := 1000):
            logger.error(
                "Chart %s is on %d dashboards (exceeds safety limit of %d). "
                "Skipping metadata cleanup. "
                "Manual intervention may be required for export/import.",
                chart_id,
                dashboard_count,
                safety_limit,
            )
            return

        # Query only ID and json_metadata (not full Dashboard objects)
        dashboards_to_update = (
            db.session.query(Dashboard.id, Dashboard.json_metadata)
            .filter(Dashboard.slices.any(id=chart_id))  # type: ignore[attr-defined]
            .all()
        )

        for dashboard_id, json_metadata_str in dashboards_to_update:
            if not json_metadata_str:
                continue

            try:
                metadata = json.loads(json_metadata_str)
            except (json.JSONDecodeError, TypeError):
                logger.warning(
                    "Could not parse metadata for dashboard %s", dashboard_id
                )
                continue

            modified = False

            # Clean up expanded_slices
            if "expanded_slices" in metadata:
                chart_id_str = str(chart_id)
                if chart_id_str in metadata["expanded_slices"]:
                    del metadata["expanded_slices"][chart_id_str]
                    modified = True

            # Clean up timed_refresh_immune_slices
            if "timed_refresh_immune_slices" in metadata:
                if chart_id in metadata["timed_refresh_immune_slices"]:
                    metadata["timed_refresh_immune_slices"].remove(chart_id)
                    modified = True

            # Clean up filter_scopes
            if "filter_scopes" in metadata:
                chart_id_str = str(chart_id)
                if chart_id_str in metadata["filter_scopes"]:
                    del metadata["filter_scopes"][chart_id_str]
                    modified = True
                # Also clean from immune lists
                for filter_scope in metadata["filter_scopes"].values():
                    for attributes in filter_scope.values():
                        if chart_id in attributes.get("immune", []):
                            attributes["immune"].remove(chart_id)
                            modified = True

            # Clean up default_filters
            if "default_filters" in metadata:
                default_filters = json.loads(metadata["default_filters"])
                chart_id_str = str(chart_id)
                if chart_id_str in default_filters:
                    del default_filters[chart_id_str]
                    metadata["default_filters"] = json.dumps(default_filters)
                    modified = True

            # Clean up native_filter_configuration scope exclusions
            if "native_filter_configuration" in metadata:
                for native_filter in metadata["native_filter_configuration"]:
                    scope_excluded = native_filter.get("scope", {}).get("excluded", [])
                    if chart_id in scope_excluded:
                        scope_excluded.remove(chart_id)
                        modified = True

            # Clean up chart_configuration
            if "chart_configuration" in metadata:
                chart_id_str = str(chart_id)
                if chart_id_str in metadata["chart_configuration"]:
                    del metadata["chart_configuration"][chart_id_str]
                    modified = True

            # Clean up global_chart_configuration scope exclusions
            if "global_chart_configuration" in metadata:
                scope_excluded = (
                    metadata["global_chart_configuration"]
                    .get("scope", {})
                    .get("excluded", [])
                )
                if chart_id in scope_excluded:
                    scope_excluded.remove(chart_id)
                    modified = True

            if modified:
                # Update only the json_metadata field
                db.session.query(Dashboard).filter_by(id=dashboard_id).update(
                    {"json_metadata": json.dumps(metadata)},
                    synchronize_session=False,
                )
                logger.info(
                    "Cleaned up metadata for dashboard %s after deleting chart %s",
                    dashboard_id,
                    chart_id,
                )
