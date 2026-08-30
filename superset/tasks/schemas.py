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
"""Task API schemas"""

from datetime import datetime
from typing import cast

from marshmallow import fields, Schema
from marshmallow.fields import Method
from superset_core.tasks.types import TaskProperties

# RISON/JSON schemas for query parameters
get_delete_ids_schema = {
    "type": "array",
    "items": {"type": "string"},
    "example": ["task_id_1", "task_id_2"],
}

# Field descriptions
uuid_description = "The unique identifier (UUID) of the task"
task_key_description = "The task identifier used for deduplication"
dedup_key_description = (
    "The hashed deduplication key used internally for task deduplication"
)
task_type_description = (
    "The type of task (e.g., 'sql_execution', 'thumbnail_generation')"
)
task_name_description = "Human-readable name for the task"
status_description = "Current status of the task"
created_on_description = "Timestamp when the task was created"
changed_on_description = "Timestamp when the task was last updated"
started_at_description = "Timestamp when the task started execution"
ended_at_description = "Timestamp when the task completed or failed"
created_by_description = "User who created the task"
user_id_description = "ID of the user context for task execution"
payload_description = "Task-specific data in JSON format"
properties_description = (
    "Runtime state and execution config. Public keys: is_abortable, "
    "progress_percent, progress_current, progress_total, dedupe_count, "
    "execution_mode, timeout, error_message. Internal state (a `private` bucket "
    "with `framework` orchestration/debug handles and `task`-specific handles) is "
    "included only in debug mode."
)
duration_seconds_description = (
    "Duration in seconds - for finished tasks: execution time, "
    "for running tasks: time since start, for pending: queue time"
)
scope_description = (
    "Task scope: 'private' (user-specific), 'shared' (multi-user), "
    "or 'system' (admin-only)"
)
subscriber_count_description = (
    "Number of users subscribed to this task (for shared tasks)"
)
subscribers_description = "List of users subscribed to this task (for shared tasks)"
depends_on_description = (
    "Prerequisite tasks this task depends on. The task only runs once all of "
    "them reach a terminal SUCCESS (all_success semantics)."
)
required_by_description = (
    "Downstream tasks that depend on this task (the reverse of depends_on)."
)


class UserSchema(Schema):
    """Schema for user information"""

    id = fields.Int()
    first_name = fields.String()
    last_name = fields.String()


class TaskResponseSchema(Schema):
    """
    Schema for task response.

    Used for both list and detail endpoints.
    """

    id = fields.Int(metadata={"description": "Internal task ID"})
    uuid = fields.UUID(metadata={"description": uuid_description})
    task_key = fields.String(metadata={"description": task_key_description})
    dedup_key = fields.String(metadata={"description": dedup_key_description})
    task_type = fields.String(metadata={"description": task_type_description})
    task_name = fields.String(
        metadata={"description": task_name_description}, allow_none=True
    )
    status = fields.String(metadata={"description": status_description})
    created_on = fields.DateTime(metadata={"description": created_on_description})
    created_on_delta_humanized = Method(
        "get_created_on_delta_humanized",
        metadata={"description": "Humanized time since creation"},
    )
    changed_on = fields.DateTime(metadata={"description": changed_on_description})
    changed_by = fields.Nested(UserSchema, allow_none=True)
    started_at = fields.DateTime(
        metadata={"description": started_at_description}, allow_none=True
    )
    ended_at = fields.DateTime(
        metadata={"description": ended_at_description}, allow_none=True
    )
    created_by = fields.Nested(UserSchema, allow_none=True)
    user_id = fields.Int(metadata={"description": user_id_description}, allow_none=True)
    payload = Method("get_payload_dict", metadata={"description": payload_description})
    properties = Method(
        "get_properties", metadata={"description": properties_description}
    )
    duration_seconds = Method(
        "get_duration",
        metadata={"description": duration_seconds_description},
    )
    scope = fields.String(metadata={"description": scope_description})
    subscriber_count = Method(
        "get_subscriber_count", metadata={"description": subscriber_count_description}
    )
    subscribers = Method(
        "get_subscribers", metadata={"description": subscribers_description}
    )
    depends_on = Method(
        "get_depends_on", metadata={"description": depends_on_description}
    )
    required_by = Method(
        "get_required_by", metadata={"description": required_by_description}
    )

    def get_payload_dict(self, obj: object) -> dict[str, object] | None:
        """Get payload as dictionary"""
        return obj.payload_dict  # type: ignore[attr-defined]

    def get_properties(self, obj: object) -> TaskProperties:
        """Get properties dict, stripping internal state outside debug mode."""
        from superset.tasks.utils import task_internals_visible

        properties = cast(TaskProperties, dict(obj.properties_dict))  # type: ignore[attr-defined]

        # The internal ``private`` bucket (framework orchestration + error debug +
        # task-execution handles) is surfaced only in debug mode; otherwise it is
        # stripped wholesale. ``error_message`` stays top-level (public) as the
        # consumer-facing failure reason.
        if not task_internals_visible():
            properties.pop("private", None)

        return properties

    def get_duration(self, obj: object) -> float | None:
        """Get duration in seconds"""
        return obj.duration_seconds  # type: ignore[attr-defined]

    def get_created_on_delta_humanized(self, obj: object) -> str:
        """Get humanized time since creation"""
        return obj.created_on_delta_humanized()  # type: ignore[attr-defined]

    def get_subscriber_count(self, obj: object) -> int:
        """Get number of subscribers"""
        return obj.subscriber_count  # type: ignore[attr-defined]

    def get_subscribers(self, obj: object) -> list[dict[str, object]]:
        """Get list of subscribers with user info.

        Authenticated subscribers are returned with their user profile. Embedded
        guests have no ``ab_user`` profile, so they are returned as anonymized
        entries (``is_guest`` with a stable per-task ``label`` ``G1``/``G2``/…,
        ordered by subscription time) — the Task List renders them as ``G1``/``G2``
        avatars rather than nameless blanks.
        """
        all_subs = list(obj.subscribers)  # type: ignore[attr-defined]
        # Assign stable G-ordinals to guest subscribers, ordered by subscription
        # time (then id) so the labels don't shuffle between requests.
        guest_subs = sorted(
            (s for s in all_subs if s.user_id is None),
            key=lambda s: (s.subscribed_at or datetime.min, s.id),
        )
        guest_ordinal = {s.id: i + 1 for i, s in enumerate(guest_subs)}

        subscribers = []
        for sub in all_subs:
            subscribed_at = sub.subscribed_at.isoformat() if sub.subscribed_at else None
            if sub.user_id is not None:
                subscribers.append(
                    {
                        "user_id": sub.user_id,
                        "is_guest": False,
                        "first_name": sub.user.first_name if sub.user else None,
                        "last_name": sub.user.last_name if sub.user else None,
                        "subscribed_at": subscribed_at,
                    }
                )
            else:
                subscribers.append(
                    {
                        "user_id": None,
                        "is_guest": True,
                        "label": f"G{guest_ordinal[sub.id]}",
                        "subscribed_at": subscribed_at,
                    }
                )
        return subscribers

    def get_depends_on(self, obj: object) -> list[dict[str, object]]:
        """Get prerequisite tasks (uuid, name, status) for DAG display."""
        return [
            {
                "uuid": str(prerequisite.uuid),
                "task_name": prerequisite.task_name,
                "status": prerequisite.status,
            }
            for prerequisite in obj.depends_on  # type: ignore[attr-defined]
        ]

    def get_required_by(self, obj: object) -> list[dict[str, object]]:
        """Get downstream tasks (uuid, name, status) for DAG display."""
        return [
            {
                "uuid": str(dependent.uuid),
                "task_name": dependent.task_name,
                "status": dependent.status,
            }
            for dependent in obj.required_by  # type: ignore[attr-defined]
        ]


class TaskStatusResponseSchema(Schema):
    """Schema for task status response (lightweight for polling)"""

    status = fields.String(metadata={"description": status_description})


class TaskStatusChangeSchema(Schema):
    """Schema for a single task's entry in a status-changes poll."""

    status = fields.String(metadata={"description": status_description})
    progress = fields.Float(
        allow_none=True,
        metadata={
            "description": "Progress as a 0.0-1.0 fraction, or null when unknown"
        },
    )


class TaskStatusChangesResponseSchema(Schema):
    """Schema for the ``/status_changes`` polling response."""

    statuses = fields.Dict(
        keys=fields.String(),
        values=fields.Nested(TaskStatusChangeSchema),
        metadata={"description": "Map of task UUID to its status and progress"},
    )
    cursor = fields.String(
        allow_none=True,
        metadata={"description": "Watermark to pass as ``cursor`` on the next poll"},
    )


class TaskCancelRequestSchema(Schema):
    """Schema for task cancellation request"""

    force = fields.Boolean(
        load_default=False,
        metadata={
            "description": "Force cancel the task for all subscribers (admin only). "
            "Only applicable for shared tasks with multiple subscribers."
        },
    )
    tab_id = fields.String(
        required=False,
        allow_none=True,
        load_default=None,
        metadata={
            "description": "Opaque per-client (browser tab) id. For task types with "
            "a per-client subscription policy (e.g. chart-data), a cancel from one "
            "tab detaches only that tab; the task keeps running while the "
            "principal has other tabs watching it. Ignored otherwise. Must match "
            "^[A-Za-z0-9_-]{1,64}$; a value failing that is dropped at ingress."
        },
    )


class TaskCancelResponseSchema(Schema):
    """Schema for task cancellation response"""

    message = fields.String(metadata={"description": "Success or status message"})
    action = fields.String(
        metadata={
            "description": "The action taken: 'aborted' (task terminated), "
            "'unsubscribed' (principal removed from a shared task), or 'detached' "
            "(one client/tab of the principal stopped watching; the task continues)"
        }
    )
    task = fields.Nested(TaskResponseSchema, allow_none=True)


openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a task detail"}},
    "get_list": {
        "get": {
            "summary": "Get a list of tasks",
            "description": "Gets a list of tasks for the current user. "
            "Use Rison or JSON query parameters for filtering, sorting, "
            "pagination and for selecting specific columns and metadata.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}
