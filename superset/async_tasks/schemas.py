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
"""AsyncTask API schemas"""

from marshmallow import fields, Schema
from marshmallow.fields import Method

# RISON/JSON schemas for query parameters
get_delete_ids_schema = {"type": "array", "items": {"type": "string"}}

# Field descriptions
uuid_description = "The unique identifier (UUID) of the async task"
task_key_description = "The task identifier used for deduplication"
task_type_description = (
    "The type of async task (e.g., 'sql_execution', 'thumbnail_generation')"
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
progress_description = "Task progress as a float between 0.0 and 1.0 (null if not set)"
duration_seconds_description = "Duration of task execution in seconds"
is_finished_description = "Whether the task has finished (success, failure, or aborted)"
is_successful_description = "Whether the task completed successfully"
is_aborted_description = "Whether the task was aborted"


class UserSchema(Schema):
    """Schema for user information"""

    id = fields.Int()
    first_name = fields.String()
    last_name = fields.String()


class AsyncTaskResponseSchema(Schema):
    """
    Schema for async task response.

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
    progress = fields.Float(
        metadata={"description": progress_description}, allow_none=True
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

    def get_created_on_delta_humanized(self, obj: object) -> str:
        """Get humanized time since creation"""
        return obj.created_on_delta_humanized()  # type: ignore[attr-defined]


class AsyncTaskStatusResponseSchema(Schema):
    """Schema for async task status response (lightweight for polling)"""

    status = fields.String(metadata={"description": status_description})


class AsyncTaskAbortResponseSchema(Schema):
    """Schema for async task abortion response"""

    message = fields.String(metadata={"description": "Success or error message"})
    task = fields.Nested(AsyncTaskResponseSchema, allow_none=True)


class AsyncTaskBulkAbortResponseSchema(Schema):
    """Schema for bulk async task abortion response"""

    message = fields.String(metadata={"description": "Status message"})
    aborted_count = fields.Int(
        metadata={"description": "Number of tasks successfully aborted"}
    )
    failed_count = fields.Int(
        metadata={"description": "Number of tasks that could not be aborted"}
    )


openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get an async task detail"}},
    "get_list": {
        "get": {
            "summary": "Get a list of async tasks",
            "description": "Gets a list of async tasks for the current user. "
            "Use Rison or JSON query parameters for filtering, sorting, "
            "pagination and for selecting specific columns and metadata.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}
