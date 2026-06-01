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

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from flask_babel import gettext as _
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.chart.warm_up_cache import ChartWarmUpCacheCommand
from superset.dashboards.schemas import DashboardJSONMetadataSchema
from superset.errors import ErrorLevel, SupersetErrorType
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import error_msg_from_exception


@dataclass(frozen=True)
class DashboardReviewIssue:
    message: str
    level: ErrorLevel
    error_type: SupersetErrorType
    path: str | None = None
    chart_id: int | None = None
    chart_uuid: str | None = None
    extra: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "message": self.message,
            "level": self.level.value,
            "error_type": self.error_type.value,
        }
        if self.path:
            result["path"] = self.path
        if self.chart_id is not None:
            result["chart_id"] = self.chart_id
        if self.chart_uuid:
            result["chart_uuid"] = self.chart_uuid
        if self.extra:
            result["extra"] = self.extra
        return result


class DashboardReviewCommand(BaseCommand):
    """
    Read-only dashboard review for API/MCP consumers.

    The command performs structural checks without running chart queries by default.
    Runtime chart validation can be enabled with ``run_chart_queries`` and reuses the
    existing chart cache warm-up command so query errors surface consistently.
    """

    def __init__(self, dashboard: Dashboard, run_chart_queries: bool = False) -> None:
        self._dashboard = dashboard
        self._run_chart_queries = run_chart_queries
        self._issues: list[DashboardReviewIssue] = []
        self._chart_results: list[dict[str, Any]] = []

    def run(self) -> dict[str, Any]:
        self.validate()
        position = self._load_json_object(
            self._dashboard.position_json,
            "position_json",
            required=False,
        )
        metadata = self._load_json_object(
            self._dashboard.json_metadata,
            "json_metadata",
            required=False,
        )

        if metadata is not None:
            self._review_metadata(metadata)
        if position is not None:
            self._review_position(position)

        self._review_charts()
        if self._run_chart_queries:
            self._review_chart_queries()

        return {
            "dashboard_id": self._dashboard.id,
            "dashboard_uuid": str(self._dashboard.uuid)
            if self._dashboard.uuid
            else None,
            "dashboard_title": self._dashboard.dashboard_title,
            "status": self._status,
            "run_chart_queries": self._run_chart_queries,
            "chart_count": len(self._dashboard.slices),
            "issues": [issue.to_dict() for issue in self._issues],
            "chart_results": self._chart_results,
        }

    def validate(self) -> None:
        # The dashboard is access-checked by the API/DAO before this command runs.
        return None

    @property
    def _status(self) -> str:
        if any(issue.level == ErrorLevel.ERROR for issue in self._issues):
            return "error"
        if any(issue.level == ErrorLevel.WARNING for issue in self._issues):
            return "warning"
        return "pass"

    def _add_issue(
        self,
        message: str,
        level: ErrorLevel,
        error_type: SupersetErrorType,
        path: str | None = None,
        chart: Slice | None = None,
        chart_id: int | None = None,
        chart_uuid: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        if chart is not None:
            chart_id = chart.id
            chart_uuid = str(chart.uuid) if chart.uuid else None
        self._issues.append(
            DashboardReviewIssue(
                message=message,
                level=level,
                error_type=error_type,
                path=path,
                chart_id=chart_id,
                chart_uuid=chart_uuid,
                extra=extra,
            )
        )

    def _load_json_object(
        self,
        value: str | None,
        path: str,
        required: bool,
    ) -> dict[str, Any] | None:
        if not value:
            if required:
                self._add_issue(
                    message=_("%(path)s is empty.", path=path),
                    level=ErrorLevel.ERROR,
                    error_type=SupersetErrorType.INVALID_PAYLOAD_FORMAT_ERROR,
                    path=path,
                )
            return {}

        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as ex:
            self._add_issue(
                message=_("%(path)s is not valid JSON.", path=path),
                level=ErrorLevel.ERROR,
                error_type=SupersetErrorType.INVALID_PAYLOAD_FORMAT_ERROR,
                path=path,
                extra={"error": error_msg_from_exception(ex)},
            )
            return None

        if not isinstance(parsed, dict):
            self._add_issue(
                message=_("%(path)s must be a JSON object.", path=path),
                level=ErrorLevel.ERROR,
                error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                path=path,
            )
            return None

        return parsed

    def _review_metadata(self, metadata: dict[str, Any]) -> None:
        errors = DashboardJSONMetadataSchema().validate(metadata, partial=False)
        if errors:
            self._add_issue(
                message=_("Dashboard metadata failed schema validation."),
                level=ErrorLevel.ERROR,
                error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                path="json_metadata",
                extra={"errors": errors},
            )

    def _review_position(self, position: dict[str, Any]) -> None:
        attached_charts_by_id = {chart.id: chart for chart in self._dashboard.slices}
        referenced_chart_ids: set[int] = set()
        duplicate_chart_ids: dict[int, list[str]] = defaultdict(list)

        for component_id, component in position.items():
            if not isinstance(component, dict) or component.get("type") != "CHART":
                continue

            path = f"position_json.{component_id}.meta"
            meta = component.get("meta")
            if not isinstance(meta, dict):
                self._add_issue(
                    message=_("Dashboard chart component is missing metadata."),
                    level=ErrorLevel.ERROR,
                    error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                    path=path,
                    extra={"component_id": component_id},
                )
                continue

            chart_id = meta.get("chartId")
            chart_uuid = meta.get("uuid")
            if not isinstance(chart_id, int):
                self._add_issue(
                    message=_("Dashboard chart component is missing a valid chart id."),
                    level=ErrorLevel.ERROR,
                    error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                    path=f"{path}.chartId",
                    extra={"component_id": component_id},
                )
                continue

            referenced_chart_ids.add(chart_id)
            duplicate_chart_ids[chart_id].append(component_id)
            chart = attached_charts_by_id.get(chart_id)
            if chart is None:
                self._add_issue(
                    message=_(
                        "Chart is referenced by the dashboard layout but is not "
                        "attached to the dashboard."
                    ),
                    level=ErrorLevel.ERROR,
                    error_type=SupersetErrorType.OBJECT_DOES_NOT_EXIST_ERROR,
                    path=f"{path}.chartId",
                    chart_id=chart_id,
                    chart_uuid=str(chart_uuid) if chart_uuid else None,
                    extra={"component_id": component_id},
                )
                continue

            if chart_uuid and str(chart.uuid) != str(chart_uuid):
                self._add_issue(
                    message=_(
                        "Dashboard layout chart UUID does not match the attached "
                        "chart."
                    ),
                    level=ErrorLevel.WARNING,
                    error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                    path=f"{path}.uuid",
                    chart=chart,
                    extra={
                        "component_id": component_id,
                        "layout_chart_uuid": str(chart_uuid),
                    },
                )

        for chart_id, component_ids in duplicate_chart_ids.items():
            if len(component_ids) > 1:
                self._add_issue(
                    message=_("Chart appears multiple times in the dashboard layout."),
                    level=ErrorLevel.WARNING,
                    error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                    chart_id=chart_id,
                    extra={"component_ids": component_ids},
                )

        if not position and self._dashboard.slices:
            self._add_issue(
                message=_("Dashboard has attached charts but no layout metadata."),
                level=ErrorLevel.WARNING,
                error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                path="position_json",
            )

        for chart in self._dashboard.slices:
            if chart.id not in referenced_chart_ids:
                self._add_issue(
                    message=_(
                        "Chart is attached to the dashboard but is not present in "
                        "the layout."
                    ),
                    level=ErrorLevel.WARNING,
                    error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                    chart=chart,
                )

    def _review_charts(self) -> None:
        for chart in self._dashboard.slices:
            if not chart.viz_type:
                self._add_issue(
                    message=_("Chart is missing a visualization type."),
                    level=ErrorLevel.ERROR,
                    error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                    path="viz_type",
                    chart=chart,
                )
            if not chart.datasource:
                self._add_issue(
                    message=_("Chart datasource does not exist or is not accessible."),
                    level=ErrorLevel.ERROR,
                    error_type=SupersetErrorType.OBJECT_DOES_NOT_EXIST_ERROR,
                    path="datasource",
                    chart=chart,
                    extra={
                        "datasource_id": chart.datasource_id,
                        "datasource_type": chart.datasource_type,
                    },
                )
            self._review_chart_json(chart, chart.params, "params")
            self._review_chart_json(chart, chart.query_context, "query_context")

    def _review_chart_json(
        self,
        chart: Slice,
        value: str | None,
        field_name: str,
    ) -> None:
        if not value:
            return
        try:
            json.loads(value)
        except json.JSONDecodeError as ex:
            self._add_issue(
                message=_(
                    "Chart %(field_name)s is not valid JSON.",
                    field_name=field_name,
                ),
                level=ErrorLevel.ERROR,
                error_type=SupersetErrorType.INVALID_PAYLOAD_FORMAT_ERROR,
                path=field_name,
                chart=chart,
                extra={"error": error_msg_from_exception(ex)},
            )

    def _review_chart_queries(self) -> None:
        for chart in self._dashboard.slices:
            result = ChartWarmUpCacheCommand(
                chart,
                dashboard_id=self._dashboard.id,
                extra_filters=None,
            ).run()
            self._chart_results.append(result)
            if result.get("viz_error"):
                self._add_issue(
                    message=_("Chart query returned an error."),
                    level=ErrorLevel.ERROR,
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    chart=chart,
                    extra={
                        "viz_error": result.get("viz_error"),
                        "viz_status": result.get("viz_status"),
                    },
                )
