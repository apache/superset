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
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import humanize
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import and_, desc, or_
from sqlalchemy.sql import functions as func

from superset import db
from superset.daos.base import BaseDAO
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import get_user_id
from superset.utils.dates import datetime_to_epoch

COALESCE_WINDOW = timedelta(minutes=5)
VALID_ADMIN_ACTIVITY_TYPES = {"view", "edit", "export", "chart_interaction"}

ADMIN_ACTION_CATEGORIES: dict[str, set[str]] = {
    "view": {
        "dashboard",
        "mount_dashboard",
        "DashboardRestApi.get",
        "DashboardRestApi.get_list",
    },
    "edit": {
        "DashboardRestApi.put",
        "DashboardRestApi.post",
        "DashboardRestApi.delete",
        "force_refresh_dashboard",
    },
    "export": {
        "DashboardRestApi.export",
        "export_csv_dashboard_chart",
    },
    "chart_interaction": {
        "explore_json",
        "ChartRestApi.data",
        "mount_explorer",
    },
}

ADMIN_ACTION_DISPLAY = {
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
}


class LogDAO(BaseDAO[Log]):
    @staticmethod
    def _serialize_datetime(value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()

    @staticmethod
    def get_recent_activity(
        actions: list[str],
        distinct: bool,
        page: int,
        page_size: int,
    ) -> list[dict[str, Any]]:
        user_id = get_user_id()
        has_subject_title = or_(
            and_(
                Dashboard.dashboard_title is not None,
                Dashboard.dashboard_title != "",
            ),
            and_(Slice.slice_name is not None, Slice.slice_name != ""),
        )

        if distinct:
            one_year_ago = datetime.today() - timedelta(days=365)
            subqry = (
                db.session.query(
                    Log.dashboard_id,
                    Log.slice_id,
                    Log.action,
                    func.max(Log.dttm).label("dttm"),
                )
                .group_by(Log.dashboard_id, Log.slice_id, Log.action)
                .filter(
                    and_(
                        Log.action == "log",
                        Log.user_id == user_id,
                        or_(
                            *{
                                Log.json.contains(f'"event_name": "{action}"')
                                for action in actions
                            },
                        ),
                        # limit to one year of data to improve performance
                        Log.dttm > one_year_ago,
                        or_(Log.dashboard_id.isnot(None), Log.slice_id.isnot(None)),
                    )
                )
                .subquery()
            )
            qry = (
                db.session.query(
                    subqry,
                    Dashboard.slug.label("dashboard_slug"),
                    Dashboard.dashboard_title,
                    Slice.slice_name,
                )
                .outerjoin(Dashboard, Dashboard.id == subqry.c.dashboard_id)
                .outerjoin(
                    Slice,
                    Slice.id == subqry.c.slice_id,
                )
                .filter(has_subject_title)
                .order_by(subqry.c.dttm.desc())
                .limit(page_size)
                .offset(page * page_size)
            )
        else:
            qry = (
                db.session.query(
                    Log.dttm,
                    Log.action,
                    Log.dashboard_id,
                    Log.slice_id,
                    Dashboard.slug.label("dashboard_slug"),
                    Dashboard.dashboard_title,
                    Slice.slice_name,
                )
                .outerjoin(Dashboard, Dashboard.id == Log.dashboard_id)
                .outerjoin(Slice, Slice.id == Log.slice_id)
                .filter(has_subject_title)
                .filter(
                    Log.action == "log",
                    Log.user_id == user_id,
                    or_(
                        *{
                            Log.json.contains(f'"event_name": "{action}"')
                            for action in actions
                        },
                    ),
                )
                .order_by(Log.dttm.desc())
                .limit(page_size)
                .offset(page * page_size)
            )

        payload = []
        for log in qry.all():
            item_url = None
            item_title = None
            item_type = None
            if log.dashboard_id:
                item_type = "dashboard"
                item_url = Dashboard.get_url(log.dashboard_id, log.dashboard_slug)
                item_title = log.dashboard_title
            elif log.slice_id:
                item_type = "slice"
                item_url = Slice.build_explore_url(log.slice_id)
                item_title = log.slice_name or "<empty>"

            payload.append(
                {
                    "action": log.action,
                    "item_type": item_type,
                    "item_url": item_url,
                    "item_title": item_title,
                    "time": datetime_to_epoch(log.dttm),
                    "time_delta_humanized": humanize.naturaltime(
                        datetime.utcnow() - log.dttm
                    ),
                }
            )
        return payload

    @staticmethod
    def get_admin_activity(
        action_types: list[str],
        page: int,
        page_size: int,
        days: int,
        coalesce: bool,
    ) -> tuple[list[dict[str, Any]], int]:
        cutoff = datetime.utcnow() - timedelta(days=days)
        rows = (
            db.session.query(Log, User, Dashboard, Slice)
            .outerjoin(User, Log.user_id == User.id)
            .outerjoin(Dashboard, Dashboard.id == Log.dashboard_id)
            .outerjoin(Slice, Slice.id == Log.slice_id)
            .filter(Log.dttm >= cutoff)
            .order_by(desc(Log.dttm), desc(Log.id))
            .all()
        )

        filtered_types = set(action_types).intersection(VALID_ADMIN_ACTIVITY_TYPES)
        if not filtered_types:
            filtered_types = {"view", "edit", "export"}

        events: list[dict[str, Any]] = []
        dashboard_cache: dict[int, Dashboard | None] = {}
        chart_cache: dict[int, Slice | None] = {}

        for log, user, dashboard, slice_obj in rows:
            effective_action = LogDAO._effective_action(log.action, log.json)
            category = LogDAO._categorize_action(effective_action)
            if category not in filtered_types:
                continue

            payload = LogDAO._parse_payload(log.json)
            resolved_dashboard_id, resolved_slice_id = LogDAO._resolve_object_ids(
                log.dashboard_id,
                log.slice_id,
                payload,
            )

            if dashboard is None and resolved_dashboard_id is not None:
                if resolved_dashboard_id not in dashboard_cache:
                    dashboard_cache[resolved_dashboard_id] = db.session.get(
                        Dashboard,
                        resolved_dashboard_id,
                    )
                dashboard = dashboard_cache[resolved_dashboard_id]

            if slice_obj is None and resolved_slice_id is not None:
                if resolved_slice_id not in chart_cache:
                    chart_cache[resolved_slice_id] = db.session.get(
                        Slice,
                        resolved_slice_id,
                    )
                slice_obj = chart_cache[resolved_slice_id]

            object_type: str | None = None
            object_id: int | None = None
            object_title: str | None = None
            object_url: str | None = None

            if dashboard is not None:
                object_type = "dashboard"
                object_id = resolved_dashboard_id or dashboard.id
                object_title = dashboard.dashboard_title
                object_url = Dashboard.get_url(dashboard.id, dashboard.slug)
            elif slice_obj is not None:
                object_type = "chart"
                object_id = resolved_slice_id or slice_obj.id
                object_title = slice_obj.slice_name
                object_url = Slice.build_explore_url(slice_obj.id)

            if object_title in (None, ""):
                object_title = "<untitled>"

            timestamp = log.dttm or datetime.utcnow()
            serialized_timestamp = LogDAO._serialize_datetime(timestamp)
            action_display = LogDAO._get_action_display(effective_action, category)
            events.append(
                {
                    "id": log.id,
                    "actor": {
                        "id": log.user_id,
                        "username": user.username if user else "Anonymous",
                        "first_name": user.first_name if user else None,
                        "last_name": user.last_name if user else None,
                    },
                    "action": action_display,
                    "action_category": category,
                    "object_type": object_type,
                    "object_id": object_id,
                    "object_title": object_title,
                    "object_url": object_url,
                    "timestamp": serialized_timestamp,
                    "first_seen": serialized_timestamp,
                    "last_seen": serialized_timestamp,
                    "event_count": 1,
                    "_timestamp": timestamp,
                    "_coalesce_key": (
                        log.user_id,
                        category,
                        action_display,
                        object_type,
                        object_id,
                    ),
                }
            )

        grouped = LogDAO._coalesce_admin_activity(events) if coalesce else events
        total = len(grouped)
        start = page * page_size
        end = start + page_size

        payload = [
            {
                key: value
                for key, value in event.items()
                if key not in {"_timestamp", "_coalesce_key"}
            }
            for event in grouped[start:end]
        ]
        return payload, total

    @staticmethod
    def _coalesce_admin_activity(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        grouped: list[dict[str, Any]] = []
        for event in events:
            if not grouped:
                grouped.append(event)
                continue

            current = grouped[-1]
            same_key = current["_coalesce_key"] == event["_coalesce_key"]
            within_window = (
                current["_timestamp"] - event["_timestamp"]
            ) <= COALESCE_WINDOW
            if same_key and within_window:
                current["event_count"] += 1
                current["first_seen"] = event["timestamp"]
                continue

            grouped.append(event)
        return grouped

    @staticmethod
    def _effective_action(action: str | None, payload: str | None) -> str:
        if action == "log" and payload:
            try:
                parsed = json.loads(payload)
                if isinstance(parsed, dict):
                    event_name = parsed.get("event_name")
                    if isinstance(event_name, str) and event_name:
                        return event_name
            except (TypeError, ValueError):
                return action or "unknown"
        return action or "unknown"

    @staticmethod
    def _categorize_action(action: str) -> str:
        for category, actions in ADMIN_ACTION_CATEGORIES.items():
            if action in actions:
                return category
        if LogDAO._is_export_action(action):
            return "export"
        return "other"

    @staticmethod
    def _is_export_action(action: str) -> bool:
        lowered = action.lower()
        return (
            action.startswith("export_")
            or ".export" in action
            or "download" in lowered
            or lowered.endswith("_csv")
            or lowered.endswith("_xlsx")
        )

    @staticmethod
    def _get_action_display(action: str, category: str) -> str:
        if action in ADMIN_ACTION_DISPLAY:
            return ADMIN_ACTION_DISPLAY[action]
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
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_int(value: Any) -> int | None:
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return None

    @staticmethod
    def _resolve_object_ids(
        dashboard_id: int | None,
        slice_id: int | None,
        payload: dict[str, Any] | None,
    ) -> tuple[int | None, int | None]:
        resolved_dashboard_id = dashboard_id
        resolved_slice_id = slice_id

        if payload:
            if resolved_dashboard_id is None:
                resolved_dashboard_id = LogDAO._to_int(
                    payload.get("dashboard_id")
                ) or LogDAO._to_int(payload.get("source_id"))
            if resolved_slice_id is None:
                resolved_slice_id = LogDAO._to_int(payload.get("slice_id"))
            if resolved_dashboard_id is None and isinstance(payload.get("rison"), list):
                for value in payload["rison"]:
                    resolved_dashboard_id = LogDAO._to_int(value)
                    if resolved_dashboard_id is not None:
                        break
            if resolved_dashboard_id is None and isinstance(payload.get("q"), str):
                if match := re.search(r"\d+", payload["q"]):
                    resolved_dashboard_id = int(match.group(0))

        return resolved_dashboard_id, resolved_slice_id
