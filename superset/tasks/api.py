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
"""Task REST API"""

import logging
from typing import TYPE_CHECKING

from flask import Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.commands.tasks.abort import AbortTaskCommand
from superset.commands.tasks.bulk_abort import BulkAbortTasksCommand
from superset.commands.tasks.exceptions import (
    TaskAbortFailedError,
    TaskForbiddenError,
    TaskInvalidError,
    TaskNotFoundError,
    TaskPermissionDeniedError,
    TaskUpdateFailedError,
)
from superset.commands.tasks.unsubscribe import UnsubscribeFromTaskCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.models.tasks import Task
from superset.tasks.filters import TaskFilter
from superset.tasks.schemas import (
    openapi_spec_methods_override,
    TaskAbortResponseSchema,
    TaskBulkAbortResponseSchema,
    TaskResponseSchema,
    TaskStatusResponseSchema,
)
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class TaskRestApi(BaseSupersetModelRestApi):
    """REST API for task management"""

    datamodel = SQLAInterface(Task)
    resource_name = "task"
    allow_browser_login = True

    class_permission_name = "Task"

    # Map bulk_abort, abort, unsubscribe, and status to write/read permissions
    method_permission_name = {
        **MODEL_API_RW_METHOD_PERMISSION_MAP,
        "bulk_abort": "write",
        "abort": "write",
        "unsubscribe": "write",
        "status": "read",
    }

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "bulk_abort",
        "abort",
        "unsubscribe",
        "status",
    }

    list_columns = [
        "id",
        "uuid",
        "task_type",
        "task_key",
        "task_name",
        "scope",
        "status",
        "created_on",
        "created_on_delta_humanized",
        "changed_on",
        "changed_by.first_name",
        "changed_by.last_name",
        "started_at",
        "ended_at",
        "created_by.id",
        "created_by.first_name",
        "created_by.last_name",
        "user_id",
        "database_id",
        "error_message",
        "payload",
        "duration_seconds",
        "is_finished",
        "is_successful",
        "is_aborted",
        "subscriber_count",
        "subscribers",
    ]

    list_select_columns = list_columns + ["created_by_fk", "changed_by_fk"]

    show_columns = list_columns

    order_columns = [
        "task_type",
        "scope",
        "status",
        "created_on",
        "changed_on",
        "started_at",
        "ended_at",
    ]

    search_columns = [
        "task_type",
        "task_key",
        "task_name",
        "scope",
        "status",
        "created_by",
        "created_on",
    ]

    base_order = ("created_on", "desc")
    base_filters = [["id", TaskFilter, lambda: []]]

    show_model_schema = TaskResponseSchema()
    list_model_schema = TaskResponseSchema()

    openapi_spec_tag = "Tasks"
    openapi_spec_component_schemas = (
        TaskResponseSchema,
        TaskAbortResponseSchema,
        TaskBulkAbortResponseSchema,
        TaskStatusResponseSchema,
    )
    openapi_spec_methods = openapi_spec_methods_override

    @expose("/<uuid_or_id>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, uuid_or_id: str) -> Response:
        """Get a task.
        ---
        get:
          summary: Get a task
          parameters:
          - in: path
            schema:
              type: string
            name: uuid_or_id
            description: The UUID or ID of the task
          responses:
            200:
              description: Task detail
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/TaskResponseSchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            # Try to find by UUID first, then by ID
            if len(uuid_or_id) == 36 or "-" in uuid_or_id:
                # Lazy import to avoid circular dependency
                from superset.daos.tasks import TaskDAO

                task = TaskDAO.find_one_or_none(uuid=uuid_or_id)
            else:
                # Lazy import to avoid circular dependency
                from superset.daos.tasks import TaskDAO

                task = TaskDAO.find_by_id(int(uuid_or_id))

            if not task:
                return self.response_404()

            result = self.show_model_schema.dump(task)
            return self.response(200, result=result)
        except (ValueError, TypeError):
            return self.response_404()

    @expose("/<uuid_or_id>/status", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.status",
        log_to_statsd=False,
    )
    def status(self, uuid_or_id: str) -> Response:
        """Get only the status of a task (lightweight for polling).
        ---
        get:
          summary: Get task status
          parameters:
          - in: path
            schema:
              type: string
            name: uuid_or_id
            description: The UUID or ID of the task
          responses:
            200:
              description: Task status
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                        description: Current status of the task
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            # Try to find by UUID first, then by ID
            if len(uuid_or_id) == 36 or "-" in uuid_or_id:
                # Lazy import to avoid circular dependency
                from superset.daos.tasks import TaskDAO

                task = TaskDAO.find_one_or_none(uuid=uuid_or_id)
            else:
                # Lazy import to avoid circular dependency
                from superset.daos.tasks import TaskDAO

                task = TaskDAO.find_by_id(int(uuid_or_id))

            if not task:
                return self.response_404()

            return self.response(200, status=task.status)
        except (ValueError, TypeError):
            return self.response_404()

    @expose("/<uuid_or_id>/abort", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.abort",
        log_to_statsd=False,
    )
    def abort(self, uuid_or_id: str) -> Response:
        """Abort a task.
        ---
        post:
          summary: Abort a task
          parameters:
          - in: path
            schema:
              type: string
            name: uuid_or_id
            description: The UUID or ID of the task to abort
          responses:
            200:
              description: Task aborted successfully
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/TaskAbortResponseSchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            # Resolve UUID or ID
            if len(uuid_or_id) == 36 or "-" in uuid_or_id:
                task_uuid = uuid_or_id
            else:
                # Lazy import to avoid circular dependency
                from superset.daos.tasks import TaskDAO

                task = TaskDAO.find_by_id(uuid_or_id)
                if not task:
                    return self.response_404()
                task_uuid = task.uuid

            # Execute abort command
            updated_task = AbortTaskCommand(task_uuid).run()
            result = {
                "message": "Task aborted successfully",
                "task": self.show_model_schema.dump(updated_task),
            }
            return self.response(200, **result)

        except TaskNotFoundError:
            return self.response_404()
        except TaskForbiddenError:
            return self.response_403()
        except TaskAbortFailedError as ex:
            logger.error(
                "Error aborting task %s: %s",
                uuid_or_id,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except (ValueError, TypeError):
            return self.response_404()

    @expose("/bulk_abort", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_abort",
        log_to_statsd=False,
    )
    def bulk_abort(self) -> Response:
        """Bulk abort tasks.
        ---
        post:
          summary: Abort multiple tasks
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    task_uuids:
                      type: array
                      items:
                        type: string
                      description: List of task UUIDs to abort
          responses:
            200:
              description: Tasks aborted successfully (including partial success)
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/TaskBulkAbortResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            from flask import request

            # Get task_uuids from request body
            if not request.json or "task_uuids" not in request.json:
                return self.response_400(message="task_uuids is required")

            task_uuids = request.json.get("task_uuids", [])

            if not isinstance(task_uuids, list):
                return self.response_400(message="task_uuids must be an array")

            if not task_uuids:
                return self.response_400(
                    message="At least one task UUID must be provided"
                )

            # Execute bulk abort command
            aborted_count, total_requested = BulkAbortTasksCommand(task_uuids).run()

            failed_count = total_requested - aborted_count

            # Build response message
            if aborted_count == total_requested:
                message = f"Successfully aborted {aborted_count} task(s)"
            elif aborted_count > 0:
                message = (
                    f"Partially successful: aborted {aborted_count} "
                    f"out of {total_requested} task(s)"
                )
            else:
                message = "No tasks were aborted"

            result = {
                "message": message,
                "aborted_count": aborted_count,
                "failed_count": failed_count,
            }
            return self.response(200, **result)

        except TaskInvalidError as ex:
            logger.error(
                "Invalid bulk abort request: %s",
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except TaskForbiddenError:
            return self.response_403()
        except Exception as ex:
            logger.error(
                "Error during bulk abort: %s",
                str(ex),
                exc_info=True,
            )
            return self.response_500(message="Internal server error")

    @expose("/<uuid_or_id>/unsubscribe", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.unsubscribe",
        log_to_statsd=False,
    )
    def unsubscribe(self, uuid_or_id: str) -> Response:
        """Unsubscribe from a shared task.
        ---
        post:
          summary: Unsubscribe from a shared task
          description: >
            Remove current user's subscription from a shared task.
            If this is the last subscriber, the task will be automatically aborted.
            Only applicable to shared tasks.
          parameters:
          - in: path
            schema:
              type: string
            name: uuid_or_id
            description: The UUID or ID of the task to unsubscribe from
          responses:
            200:
              description: Successfully unsubscribed from task
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
                        description: Success message
                      task:
                        $ref: '#/components/schemas/TaskResponseSchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            # Resolve UUID or ID
            if len(uuid_or_id) == 36 or "-" in uuid_or_id:
                task_uuid = uuid_or_id
            else:
                # Lazy import to avoid circular dependency
                from superset.daos.tasks import TaskDAO

                task = TaskDAO.find_by_id(uuid_or_id)
                if not task:
                    return self.response_404()
                task_uuid = task.uuid

            # Execute unsubscribe command
            updated_task = UnsubscribeFromTaskCommand(task_uuid).run()
            result = {
                "message": "Successfully unsubscribed from task",
                "task": self.show_model_schema.dump(updated_task),
            }
            return self.response(200, **result)

        except TaskNotFoundError:
            return self.response_404()
        except (TaskPermissionDeniedError, TaskForbiddenError):
            return self.response_403()
        except TaskUpdateFailedError as ex:
            logger.error(
                "Error unsubscribing from task %s: %s",
                uuid_or_id,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except (ValueError, TypeError):
            return self.response_404()
