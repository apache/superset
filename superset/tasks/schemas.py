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

from marshmallow import fields, Schema
from marshmallow.fields import Method

# RISON/JSON schemas for query parameters
get_delete_ids_schema = {"type": "array", "items": {"type": "string"}}

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
    "Runtime state and execution config. Contains: is_abortable, progress_percent, "
    "progress_current, progress_total, error_message, exception_type, stack_trace, "
    "timeout"
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

    def get_payload_dict(self, obj: object) -> dict[str, object] | None:
        """Get payload as dictionary"""
        return obj.payload_dict  # type: ignore[attr-defined]

    def get_properties(self, obj: object) -> dict[str, object]:
        """Get properties dict, filtering stack_trace if SHOW_STACKTRACE is disabled."""
        from flask import current_app

        properties = dict(obj.properties_dict)  # type: ignore[attr-defined]

        # Remove stack_trace unless SHOW_STACKTRACE is enabled
        if not current_app.config.get("SHOW_STACKTRACE", False):
            properties.pop("stack_trace", None)

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
        """Get list of subscribers with user info"""
        subscribers = []
        for sub in obj.subscribers:  # type: ignore[attr-defined]
            subscribers.append(
                {
                    "user_id": sub.user_id,
                    "first_name": sub.user.first_name if sub.user else None,
                    "last_name": sub.user.last_name if sub.user else None,
                    "subscribed_at": sub.subscribed_at.isoformat()
                    if sub.subscribed_at
                    else None,
                }
            )
        return subscribers


class TaskStatusResponseSchema(Schema):
    """Schema for task status response (lightweight for polling)"""

    status = fields.String(metadata={"description": status_description})


class TaskCancelRequestSchema(Schema):
    """Schema for task cancellation request"""

    force = fields.Boolean(
        load_default=False,
        metadata={
            "description": "Force cancel the task for all subscribers (admin only). "
            "Only applicable for shared tasks with multiple subscribers."
        },
    )


class TaskCancelResponseSchema(Schema):
    """Schema for task cancellation response"""

    message = fields.String(metadata={"description": "Success or status message"})
    action = fields.String(
        metadata={
            "description": "The action taken: 'aborted' (task terminated) or "
            "'unsubscribed' (user removed from shared task)"
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
