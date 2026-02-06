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

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from flask_appbuilder.security.sqla.models import User
from sqlalchemy import and_, desc, or_

from superset import db
from superset.commands.base import BaseCommand
from superset.dashboards.activity.schemas import VALID_ACTIVITY_ACTION_TYPES
from superset.models.core import Log
from superset.utils import json

COALESCE_WINDOW = timedelta(minutes=5)
EXPORT_ACTIONS = {
    "DashboardRestApi.export",
    "export_csv_dashboard_chart",
}

ACTION_CATEGORIES: dict[str, list[str]] = {
    "view": [
        "dashboard",
        "mount_dashboard",
        "DashboardRestApi.get",
        "DashboardRestApi.get_list",
    ],
    "edit": [
        "DashboardRestApi.put",
        "DashboardRestApi.post",
        "DashboardRestApi.delete",
        "force_refresh_dashboard",
    ],
    "export": [
        "DashboardRestApi.export",
        "export_csv_dashboard_chart",
    ],
    "chart_interaction": [
        "explore_json",
        "ChartRestApi.data",
        "mount_explorer",
        "load_chart",
        "execute_sql",
        "load_into_dataframe",
        "ChartDataRestApi.data",
        "ChartDataRestApi.json_dumps",
        "_get_data_response",
        "QueryObject.post_processing",
        "render_chart",
    ],
}

ACTION_DISPLAY_NAMES = {
    "dashboard": "Viewed dashboard",
    "mount_dashboard": "Viewed dashboard",
    "DashboardRestApi.get": "Viewed dashboard",
    "DashboardRestApi.get_list": "Listed dashboards",
    "DashboardRestApi.put": "Updated dashboard",
    "DashboardRestApi.post": "Created dashboard",
    "DashboardRestApi.delete": "Deleted dashboard",
    "DashboardRestApi.export": "Exported dashboard",
    "export_csv_dashboard_chart": "Exported chart CSV",
    "force_refresh_dashboard": "Refreshed dashboard",
    "explore_json": "Loaded chart data",
    "ChartRestApi.data": "Loaded chart data",
    "mount_explorer": "Opened chart",
    "load_chart": "Loaded chart",
    "execute_sql": "Executed SQL",
    "load_into_dataframe": "Loaded into dataframe",
    "ChartDataRestApi.data": "Loaded chart data",
    "ChartDataRestApi.json_dumps": "Serialized chart data",
    "_get_data_response": "Received chart data response",
    "QueryObject.post_processing": "Post-processed query results",
    "render_chart": "Rendered chart",
}

DETAIL_KEYS = (
    "slice_name",
    "slice_id",
    "viz_type",
    "datasource_name",
    "dashboard_id",
)


@dataclass
class ActivityItem:
    id: int
    action: str
    action_category: str
    action_display: str
    user_id: int | None
    username: str
    user_first_name: str | None
    user_last_name: str | None
    timestamp: datetime
    first_seen: datetime
    last_seen: datetime
    event_count: int
    dashboard_id: int | None
    slice_id: int | None
    duration_ms: float | None
    details: dict[str, Any] | None

    @staticmethod
    def _serialize_datetime(value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "action": self.action,
            "action_category": self.action_category,
            "action_display": self.action_display,
            "user": {
                "id": self.user_id,
                "username": self.username,
                "first_name": self.user_first_name,
                "last_name": self.user_last_name,
            },
            "timestamp": self._serialize_datetime(self.timestamp),
            "first_seen": self._serialize_datetime(self.first_seen),
            "last_seen": self._serialize_datetime(self.last_seen),
            "event_count": self.event_count,
            "duration_ms": self.duration_ms,
            "details": self.details,
        }


class GetDashboardActivityCommand(BaseCommand):
    def __init__(
        self,
        dashboard_id: int,
        page: int = 0,
        page_size: int = 25,
        action_type: str = "all",
        days: int = 30,
        summary_only: bool = False,
    ):
        self.dashboard_id = dashboard_id
        self.page = page
        self.page_size = page_size
        self.action_type = action_type
        self.days = days
        self.summary_only = summary_only

    def run(self) -> dict[str, Any]:
        self.validate()
        if self.summary_only:
            return self._get_summary()
        return self._get_activity_feed()

    def validate(self) -> None:
        if self.page < 0:
            raise ValueError("`page` must be >= 0")
        if self.page_size < 1 or self.page_size > 100:
            raise ValueError("`page_size` must be between 1 and 100")
        if self.days < 1 or self.days > 365:
            raise ValueError("`days` must be between 1 and 365")
        if self.action_type not in VALID_ACTIVITY_ACTION_TYPES:
            raise ValueError("`action_type` has an invalid value")

    def _get_base_query(self) -> Any:
        cutoff = datetime.utcnow() - timedelta(days=self.days)
        return (
            db.session.query(Log, User)
            .outerjoin(User, Log.user_id == User.id)
            .filter(
                and_(
                    Log.dttm >= cutoff,
                    or_(
                        Log.dashboard_id == self.dashboard_id,
                        Log.action == "DashboardRestApi.export",
                        and_(
                            Log.action == "log",
                            Log.json.ilike('%"event_name": "export%'),
                        ),
                    ),
                )
            )
            .order_by(desc(Log.dttm), desc(Log.id))
        )

    def _get_base_rows(
        self,
        *,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[tuple[Log, User | None]]:
        query = self._get_base_query()
        if offset:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def _get_activity_feed(self) -> dict[str, Any]:
        start = self.page * self.page_size
        end = start + self.page_size
        chunk_size = max(self.page_size * 5, 100)
        row_offset = 0
        grouped: list[ActivityItem] = []
        has_more = False

        while True:
            rows = self._get_base_rows(limit=chunk_size, offset=row_offset)
            if not rows:
                break

            normalized = self._build_activity_items(rows)
            grouped = self._coalesce_activity_items([*grouped, *normalized])
            row_offset += len(rows)

            if len(grouped) > end:
                has_more = True
                break

            if len(rows) < chunk_size:
                break

        visible = grouped[start:end]
        total = end + 1 if has_more else len(grouped)
        activities = [item.to_dict() for item in visible]

        return {
            "activities": activities,
            "count": total,
            "has_more": has_more,
            "page": self.page,
            "page_size": self.page_size,
        }

    def _get_summary(self) -> dict[str, Any]:
        normalized = self._build_activity_items(
            self._get_base_rows(),
            apply_action_filter=False,
            include_chart_interaction=True,
        )
        view_events = [event for event in normalized if event.action_category == "view"]

        total_views = len(view_events)
        unique_viewers = len(
            {event.user_id for event in view_events if event.user_id is not None}
        )

        today = datetime.utcnow().date()
        views_today = len(
            [event for event in view_events if event.timestamp.date() == today]
        )

        editors: list[str] = []
        seen_editors: set[str] = set()
        for event in normalized:
            if event.action_category != "edit":
                continue
            if not event.username or event.username in seen_editors:
                continue
            seen_editors.add(event.username)
            editors.append(event.username)
            if len(editors) == 5:
                break

        return {
            "total_views": total_views,
            "unique_viewers": unique_viewers,
            "views_today": views_today,
            "recent_editors": editors,
            "period_days": self.days,
        }

    def _build_activity_items(
        self,
        rows: list[tuple[Log, User | None]],
        apply_action_filter: bool = True,
        include_chart_interaction: bool = False,
    ) -> list[ActivityItem]:
        items: list[ActivityItem] = []

        for log, user in rows:
            timestamp = log.dttm or datetime.utcnow()
            payload = self._parse_payload(log.json)
            resolved_dashboard_id = self._resolve_dashboard_id(log, payload)
            if resolved_dashboard_id != self.dashboard_id:
                continue
            effective_action = self._effective_action(log.action, payload)
            action_category = self._categorize_action(effective_action)

            if apply_action_filter:
                if self.action_type == "all":
                    if (
                        not include_chart_interaction
                        and action_category == "chart_interaction"
                    ):
                        continue
                elif action_category != self.action_type:
                    continue

            details = self._extract_details(payload)
            if log.slice_id is not None and details.get("slice_id") is None:
                details["slice_id"] = log.slice_id
            if details.get("dashboard_id") is None:
                details["dashboard_id"] = resolved_dashboard_id

            items.append(
                ActivityItem(
                    id=log.id,
                    action=effective_action,
                    action_category=action_category,
                    action_display=self._get_action_display(
                        effective_action, action_category
                    ),
                    user_id=log.user_id,
                    username=user.username if user else "Anonymous",
                    user_first_name=user.first_name if user else None,
                    user_last_name=user.last_name if user else None,
                    timestamp=timestamp,
                    first_seen=timestamp,
                    last_seen=timestamp,
                    event_count=1,
                    dashboard_id=resolved_dashboard_id,
                    slice_id=log.slice_id,
                    duration_ms=float(log.duration_ms)
                    if log.duration_ms is not None
                    else None,
                    details=details or None,
                )
            )

        return items

    @staticmethod
    def _resolve_dashboard_id(log: Log, payload: dict[str, Any] | None) -> int | None:
        if log.dashboard_id is not None:
            return log.dashboard_id
        if not payload:
            return None

        for key in ("dashboard_id", "source_id"):
            if dashboard_id := GetDashboardActivityCommand._as_int(payload.get(key)):
                return dashboard_id

        rison_values = payload.get("rison")
        if isinstance(rison_values, list):
            for value in rison_values:
                if dashboard_id := GetDashboardActivityCommand._as_int(value):
                    return dashboard_id

        q_value = payload.get("q")
        if isinstance(q_value, str):
            if match := re.search(r"\d+", q_value):
                return int(match.group(0))

        return None

    @staticmethod
    def _as_int(value: Any) -> int | None:
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return None

    def _coalesce_activity_items(self, items: list[ActivityItem]) -> list[ActivityItem]:
        grouped: list[ActivityItem] = []
        for item in items:
            if grouped and self._should_coalesce(grouped[-1], item):
                grouped[-1].event_count += 1
                grouped[-1].first_seen = item.timestamp
            else:
                grouped.append(item)
        return grouped

    @staticmethod
    def _should_coalesce(current: ActivityItem, incoming: ActivityItem) -> bool:
        if current.user_id != incoming.user_id:
            return False
        if current.action_category != incoming.action_category:
            return False
        if current.action_display != incoming.action_display:
            return False
        if current.dashboard_id != incoming.dashboard_id:
            return False
        if current.slice_id != incoming.slice_id:
            return False

        return (current.first_seen - incoming.timestamp) <= COALESCE_WINDOW

    @staticmethod
    def _effective_action(action: str | None, payload: dict[str, Any] | None) -> str:
        if action == "log" and payload:
            event_name = payload.get("event_name")
            if isinstance(event_name, str) and event_name:
                return event_name
        return action or "unknown"

    @staticmethod
    def _categorize_action(action: str) -> str:
        for category, actions in ACTION_CATEGORIES.items():
            if action in actions:
                return category
        if GetDashboardActivityCommand._is_export_action(action):
            return "export"
        return "other"

    @staticmethod
    def _is_export_action(action: str) -> bool:
        lowered = action.lower()
        return (
            action in EXPORT_ACTIONS
            or action.startswith("export_")
            or ".export" in action
            or "download" in lowered
            or lowered.endswith("_csv")
            or lowered.endswith("_xlsx")
        )

    @staticmethod
    def _get_action_display(action: str, category: str) -> str:
        if action in ACTION_DISPLAY_NAMES:
            return ACTION_DISPLAY_NAMES[action]
        # Keep unknown actions understandable in UI instead of showing generic "other".
        if normalized := action.replace("_", " ").replace(".", " ").strip():
            return normalized.capitalize()
        return category.replace("_", " ").capitalize()

    @staticmethod
    def _parse_payload(payload: str | None) -> dict[str, Any] | None:
        if not payload:
            return None
        try:
            parsed = json.loads(payload)
            return parsed if isinstance(parsed, dict) else None
        except Exception:  # pylint: disable=broad-exception-caught
            return None

    @staticmethod
    def _extract_details(payload: dict[str, Any] | None) -> dict[str, Any]:
        if not payload:
            return {}
        return {key: payload[key] for key in DETAIL_KEYS if key in payload}
