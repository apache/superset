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
database_id_description = "ID of the database associated with the task"
error_message_description = "Error message if the task failed"
payload_description = "Task-specific data in JSON format"
progress_percent_description = (
    "Task progress as a percentage (0.0-1.0). Set when using percentage-only mode "
    "or auto-computed from progress_current/progress_total"
)
progress_current_description = (
    "Current iteration count. Set when reporting count-only or count+total progress"
)
progress_total_description = (
    "Total iterations (if known). Set when reporting count+total progress"
)
duration_seconds_description = (
    "Duration in seconds - for finished tasks: execution time, "
    "for running tasks: time since start, for pending: queue time"
)
is_finished_description = "Whether the task has finished (success, failure, or aborted)"
is_successful_description = "Whether the task completed successfully"
is_aborted_description = "Whether the task was aborted"
is_aborting_description = "Whether the task is in the process of being aborted"
is_abortable_description = (
    "Whether the task can be aborted. null for pending tasks (always abortable), "
    "false when in progress without abort handler, true when in progress with handler"
)
can_be_aborted_description = (
    "Whether the task can be aborted based on current status and is_abortable flag"
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
    uuid = fields.String(metadata={"description": uuid_description})
    task_key = fields.String(metadata={"description": task_key_description})
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
    database_id = fields.Int(
        metadata={"description": database_id_description}, allow_none=True
    )
    error_message = fields.String(
        metadata={"description": error_message_description}, allow_none=True
    )
    payload = Method("get_payload_dict", metadata={"description": payload_description})
    progress_percent = fields.Float(
        metadata={"description": progress_percent_description}, allow_none=True
    )
    progress_current = fields.Int(
        metadata={"description": progress_current_description}, allow_none=True
    )
    progress_total = fields.Int(
        metadata={"description": progress_total_description}, allow_none=True
    )
    duration_seconds = Method(
        "get_duration",
        metadata={"description": duration_seconds_description},
    )
    is_finished = Method(
        "get_is_finished", metadata={"description": is_finished_description}
    )
    is_successful = Method(
        "get_is_successful", metadata={"description": is_successful_description}
    )
    is_aborted = Method(
        "get_is_aborted", metadata={"description": is_aborted_description}
    )
    is_aborting = Method(
        "get_is_aborting", metadata={"description": is_aborting_description}
    )
    is_abortable = fields.Boolean(
        metadata={"description": is_abortable_description}, allow_none=True
    )
    can_be_aborted = Method(
        "get_can_be_aborted", metadata={"description": can_be_aborted_description}
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
        return obj.get_payload()  # type: ignore[attr-defined]

    def get_duration(self, obj: object) -> float | None:
        """Get duration in seconds"""
        return obj.duration_seconds  # type: ignore[attr-defined]

    def get_is_finished(self, obj: object) -> bool:
        """Check if task is finished"""
        return obj.is_finished  # type: ignore[attr-defined]

    def get_is_successful(self, obj: object) -> bool:
        """Check if task is successful"""
        return obj.is_successful  # type: ignore[attr-defined]

    def get_is_aborted(self, obj: object) -> bool:
        """Check if task is aborted"""
        return obj.is_aborted  # type: ignore[attr-defined]

    def get_is_aborting(self, obj: object) -> bool:
        """Check if task is aborting"""
        return obj.is_aborting  # type: ignore[attr-defined]

    def get_can_be_aborted(self, obj: object) -> bool:
        """Check if task can be aborted"""
        return obj.can_be_aborted  # type: ignore[attr-defined]

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


class TaskAbortResponseSchema(Schema):
    """Schema for task abortion response"""

    message = fields.String(metadata={"description": "Success or error message"})
    task = fields.Nested(TaskResponseSchema, allow_none=True)


class TaskBulkAbortResponseSchema(Schema):
    """Schema for bulk task abortion response"""

    message = fields.String(metadata={"description": "Status message"})
    aborted_count = fields.Int(
        metadata={"description": "Number of tasks successfully aborted"}
    )
    failed_count = fields.Int(
        metadata={"description": "Number of tasks that could not be aborted"}
    )


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
