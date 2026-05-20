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
from uuid import UUID

from flask import Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.commands.tasks.cancel import CancelTaskCommand
from superset.commands.tasks.exceptions import (
    TaskAbortFailedError,
    TaskForbiddenError,
    TaskNotAbortableError,
    TaskNotFoundError,
    TaskPermissionDeniedError,
)
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.models.tasks import Task
from superset.tasks.filters import TaskFilter
from superset.tasks.schemas import (
    openapi_spec_methods_override,
    TaskCancelRequestSchema,
    TaskCancelResponseSchema,
    TaskResponseSchema,
    TaskStatusResponseSchema,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners

logger = logging.getLogger(__name__)


class TaskRestApi(BaseSupersetModelRestApi):
    """REST API for task management"""

    datamodel = SQLAInterface(Task)
    resource_name = "task"
    allow_browser_login = True

    class_permission_name = "Task"

    # Map cancel and status to write/read permissions
    method_permission_name = {
        **MODEL_API_RW_METHOD_PERMISSION_MAP,
        "cancel": "write",
        "status": "read",
    }

    # Only allow read operations - no create/update/delete through REST API
    # Tasks are created via SubmitTaskCommand, cancelled via /cancel endpoint
    include_route_methods = {
        RouteMethod.GET,
        RouteMethod.GET_LIST,
        RouteMethod.INFO,
        "cancel",
        "status",
        "related_subscribers",
        "related",
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
        "payload",
        "properties",
        "duration_seconds",
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

    # Related field configuration for filter dropdowns
    allowed_rel_fields = {"created_by"}
    related_field_filters = {
        "created_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }
    base_related_field_filters = {
        "created_by": [["id", BaseFilterRelatedUsers, lambda: []]],
    }

    show_model_schema = TaskResponseSchema()
    list_model_schema = TaskResponseSchema()
    cancel_request_schema = TaskCancelRequestSchema()

    openapi_spec_tag = "Tasks"
    openapi_spec_component_schemas = (
        TaskResponseSchema,
        TaskCancelRequestSchema,
        TaskCancelResponseSchema,
        TaskStatusResponseSchema,
    )
    openapi_spec_methods = openapi_spec_methods_override

    @expose("/<task_uuid>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, task_uuid: str) -> Response:
        """Get a task.
        ---
        get:
          summary: Get a task
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: task_uuid
            description: The UUID of the task
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
        from superset.daos.tasks import TaskDAO

        try:
            uuid = UUID(task_uuid)
            task = TaskDAO.find_one_or_none(uuid=uuid)

            if not task:
                return self.response_404()

            result = self.show_model_schema.dump(task)
            return self.response(200, result=result)
        except (ValueError, TypeError):
            return self.response_404()

    @expose("/<task_uuid>/status", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.status",
        log_to_statsd=False,
    )
    def status(self, task_uuid: str) -> Response:
        """Get only the status of a task (lightweight for polling).
        ---
        get:
          summary: Get task status
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: task_uuid
            description: The UUID of the task
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
        from superset.daos.tasks import TaskDAO

        try:
            uuid = UUID(task_uuid)
            status = TaskDAO.get_status(uuid)

            if status is None:
                return self.response_404()

            return self.response(200, status=status)
        except (ValueError, TypeError):
            return self.response_404()

    @expose("/<task_uuid>/cancel", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.cancel",
        log_to_statsd=False,
    )
    def cancel(self, task_uuid: str) -> Response:
        """Cancel a task.
        ---
        post:
          summary: Cancel a task
          description: >
            Cancel a task. The behavior depends on task scope and subscriber
            count:

            - **Private tasks**: Aborts the task
            - **Shared tasks (single subscriber)**: Aborts the task
            - **Shared tasks (multiple subscribers)**: Removes current user's
              subscription; the task continues for other subscribers
            - **Shared tasks with force=true (admin only)**: Aborts task for
              all subscribers

            The `action` field in the response indicates what happened:
            - `aborted`: Task was terminated
            - `unsubscribed`: User was removed from task (task continues)
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: task_uuid
            description: The UUID of the task to cancel
          requestBody:
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/TaskCancelRequestSchema'
          responses:
            200:
              description: Task cancelled successfully
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/TaskCancelResponseSchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        return self._execute_cancel(task_uuid)

    def _execute_cancel(self, task_uuid_str: str) -> Response:
        """Execute the cancel operation with error handling."""
        try:
            task_uuid = UUID(task_uuid_str)

            command, updated_task = self._run_cancel_command(task_uuid)
            return self._build_cancel_response(command, updated_task)

        except TaskNotFoundError:
            return self.response_404()
        except (TaskForbiddenError, TaskPermissionDeniedError) as ex:
            if isinstance(ex, TaskPermissionDeniedError):
                logger.warning(
                    "Permission denied cancelling task %s: %s",
                    task_uuid_str,
                    str(ex),
                )
            return self.response_403()
        except TaskNotAbortableError as ex:
            logger.warning("Task %s is not cancellable: %s", task_uuid_str, str(ex))
            return self.response_422(message=str(ex))
        except TaskAbortFailedError as ex:
            logger.error(
                "Error cancelling task %s: %s", task_uuid_str, str(ex), exc_info=True
            )
            return self.response_422(message=str(ex))
        except (ValueError, TypeError):
            return self.response_404()

    def _run_cancel_command(self, task_uuid: UUID) -> tuple[CancelTaskCommand, "Task"]:
        """Parse request and run the cancel command."""
        from flask import request

        force = False
        # Use get_json with silent=True to handle missing Content-Type gracefully
        json_data = request.get_json(silent=True)
        if json_data:
            parsed = self.cancel_request_schema.load(json_data)
            force = parsed.get("force", False)

        command = CancelTaskCommand(task_uuid, force=force)
        updated_task = command.run()
        return command, updated_task

    def _build_cancel_response(
        self, command: CancelTaskCommand, updated_task: "Task"
    ) -> Response:
        """Build the response for a successful cancel operation."""
        action = command.action_taken
        message = (
            "Task cancelled"
            if action == "aborted"
            else "You have been removed from this task"
        )
        result = {
            "message": message,
            "action": action,
            "task": self.show_model_schema.dump(updated_task),
        }
        return self.response(200, **result)

    @expose("/related/subscribers", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".related_subscribers",
        log_to_statsd=False,
    )
    def related_subscribers(self) -> Response:
        """Get users who are subscribers to tasks.
        ---
        get:
          summary: Get related subscribers
          description: >
            Returns a list of users who are subscribed to tasks, for use in filter
            dropdowns. Results can be filtered by a search query parameter.
          parameters:
          - in: query
            schema:
              type: string
            name: q
            description: Search query to filter subscribers by name
          responses:
            200:
              description: List of subscribers
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: integer
                        description: Total number of matching subscribers
                      result:
                        type: array
                        items:
                          type: object
                          properties:
                            value:
                              type: integer
                              description: User ID
                            text:
                              type: string
                              description: User display name
            401:
              $ref: '#/components/responses/401'
        """
        from flask import request

        from superset import db, security_manager
        from superset.models.task_subscribers import TaskSubscriber

        # Get search query

        # Get user model
        user_model = security_manager.user_model

        # Query distinct users who are task subscribers
        query = (
            db.session.query(user_model.id, user_model.first_name, user_model.last_name)
            .join(TaskSubscriber, user_model.id == TaskSubscriber.user_id)
            .distinct()
        )

        # Apply search filter if provided
        if search_query := request.args.get("q", ""):
            like_value = f"%{search_query}%"
            query = query.filter(
                (user_model.first_name + " " + user_model.last_name).ilike(like_value)
                | user_model.username.ilike(like_value)
            )

        # Order by name
        query = query.order_by(user_model.first_name, user_model.last_name)

        # Limit results
        query = query.limit(100)

        # Execute and format results
        results = query.all()

        return self.response(
            200,
            count=len(results),
            result=[
                {
                    "value": user_id,
                    "text": f"{first_name or ''} {last_name or ''}".strip()
                    or str(user_id),
                }
                for user_id, first_name, last_name in results
            ],
        )
