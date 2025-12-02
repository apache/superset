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

from marshmallow import fields, Schema
from superset_core.api.async_tasks import TaskStatus

# Query parameter schemas
cancel_task_schema = {
    "type": "object",
    "properties": {
        "task_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of task IDs to cancel",
        }
    },
    "required": ["task_ids"],
}

get_task_status_schema = {
    "type": "object",
    "properties": {
        "task_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of task IDs to get status for",
        }
    },
    "required": ["task_ids"],
}

cleanup_tasks_schema = {
    "type": "object",
    "properties": {
        "older_than_hours": {
            "type": "integer",
            "description": "Remove completed/cancelled tasks older than this many hours",  # noqa: E501
            "minimum": 1,
        }
    },
    "required": ["older_than_hours"],
}


class AsyncTaskSchema(Schema):
    """Schema for async task response"""

    id = fields.String(metadata={"description": "Task ID"})
    task_name = fields.String(metadata={"description": "Name of the task"})
    status = fields.String(
        metadata={"description": "Task status"},
        validate=fields.validate.OneOf([status.value for status in TaskStatus]),
    )
    user_id = fields.Integer(
        metadata={"description": "ID of user who created the task"}, allow_none=True
    )
    created_at = fields.DateTime(metadata={"description": "Task creation timestamp"})
    updated_at = fields.DateTime(metadata={"description": "Task last update timestamp"})
    started_at = fields.DateTime(
        metadata={"description": "Task start timestamp"}, allow_none=True
    )
    completed_at = fields.DateTime(
        metadata={"description": "Task completion timestamp"}, allow_none=True
    )
    progress = fields.Float(
        metadata={"description": "Task progress (0.0 to 1.0)"}, allow_none=True
    )
    result = fields.Raw(metadata={"description": "Task result data"}, allow_none=True)
    error = fields.String(
        metadata={"description": "Error message if task failed"}, allow_none=True
    )


class AsyncTaskListResponseSchema(Schema):
    """Schema for async task list response"""

    result = fields.List(
        fields.Nested(AsyncTaskSchema), metadata={"description": "List of async tasks"}
    )
    count = fields.Integer(metadata={"description": "Total number of tasks"})


class AsyncTaskResponseSchema(Schema):
    """Schema for single async task response"""

    result = fields.Nested(
        AsyncTaskSchema, metadata={"description": "Async task details"}
    )


class TaskStatusResponseSchema(Schema):
    """Schema for task status response"""

    result = fields.Dict(
        keys=fields.String(),
        values=fields.String(),
        metadata={"description": "Task ID to status mapping"},
    )


class CancelTaskResponseSchema(Schema):
    """Schema for task cancellation response"""

    result = fields.Dict(
        keys=fields.String(),
        values=fields.Boolean(),
        metadata={"description": "Task ID to cancellation success mapping"},
    )


class CleanupTasksResponseSchema(Schema):
    """Schema for task cleanup response"""

    result = fields.Dict(
        values=[fields.Integer(metadata={"description": "Number of tasks removed"})],
        metadata={"description": "Cleanup operation result"},
    )
