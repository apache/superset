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
"""AsyncTask REST API"""

import logging

from flask import Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.async_tasks.filters import AsyncTaskFilter
from superset.async_tasks.schemas import (
    AsyncTaskCancelResponseSchema,
    AsyncTaskResponseSchema,
    AsyncTaskStatusResponseSchema,
    openapi_spec_methods_override,
)
from superset.commands.async_tasks.cancel import CancelAsyncTaskCommand
from superset.commands.async_tasks.exceptions import (
    AsyncTaskCancelFailedError,
    AsyncTaskForbiddenError,
    AsyncTaskNotFoundError,
)
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.async_tasks import AsyncTaskDAO
from superset.extensions import event_logger
from superset.models.async_tasks import AsyncTask
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class AsyncTaskRestApi(BaseSupersetModelRestApi):
    """REST API for async task management"""

    datamodel = SQLAInterface(AsyncTask)
    resource_name = "async_task"
    allow_browser_login = True

    class_permission_name = "AsyncTask"

    # Map cancel and status to write/read permissions
    method_permission_name = {
        **MODEL_API_RW_METHOD_PERMISSION_MAP,
        "cancel": "write",
        "status": "read",
    }

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "cancel",
        "status",
    }

    list_columns = [
        "id",
        "uuid",
        "task_id",
        "task_type",
        "task_name",
        "status",
        "created_on",
        "changed_on",
        "changed_on_delta_humanized",
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
        "is_cancelled",
    ]

    list_select_columns = list_columns + ["created_by_fk", "changed_by_fk"]

    show_columns = list_columns

    order_columns = [
        "task_type",
        "status",
        "created_on",
        "changed_on",
        "started_at",
        "ended_at",
    ]

    search_columns = [
        "task_id",
        "task_type",
        "task_name",
        "status",
        "created_by",
        "created_on",
    ]

    base_order = ("created_on", "desc")

    base_filters = [["id", AsyncTaskFilter, lambda: []]]

    show_model_schema = AsyncTaskResponseSchema()
    list_model_schema = AsyncTaskResponseSchema()

    openapi_spec_tag = "Async Tasks"
    openapi_spec_component_schemas = (
        AsyncTaskResponseSchema,
        AsyncTaskCancelResponseSchema,
        AsyncTaskStatusResponseSchema,
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
        """Get an async task.
        ---
        get:
          summary: Get an async task
          parameters:
          - in: path
            schema:
              type: string
            name: uuid_or_id
            description: The UUID or ID of the async task
          responses:
            200:
              description: Async task detail
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/AsyncTaskResponseSchema'
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
                task = AsyncTaskDAO.find_one_or_none(uuid=uuid_or_id)
            else:
                task = AsyncTaskDAO.find_by_id(int(uuid_or_id))

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
        """Get only the status of an async task (lightweight for polling).
        ---
        get:
          summary: Get async task status
          parameters:
          - in: path
            schema:
              type: string
            name: uuid_or_id
            description: The UUID or ID of the async task
          responses:
            200:
              description: Async task status
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
                task = AsyncTaskDAO.find_one_or_none(uuid=uuid_or_id)
            else:
                task = AsyncTaskDAO.find_by_id(int(uuid_or_id))

            if not task:
                return self.response_404()

            return self.response(200, status=task.status)
        except (ValueError, TypeError):
            return self.response_404()

    @expose("/<uuid_or_id>/cancel", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.cancel",
        log_to_statsd=False,
    )
    def cancel(self, uuid_or_id: str) -> Response:
        """Cancel an async task.
        ---
        post:
          summary: Cancel an async task
          parameters:
          - in: path
            schema:
              type: string
            name: uuid_or_id
            description: The UUID or ID of the async task to cancel
          responses:
            200:
              description: Task cancelled successfully
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/AsyncTaskCancelResponseSchema'
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
                task = AsyncTaskDAO.find_by_id(uuid_or_id)
                if not task:
                    return self.response_404()
                task_uuid = task.uuid

            # Execute cancel command
            updated_task = CancelAsyncTaskCommand(task_uuid).run()
            result = {
                "message": "Task cancelled successfully",
                "task": self.show_model_schema.dump(updated_task),
            }
            return self.response(200, **result)

        except AsyncTaskNotFoundError:
            return self.response_404()
        except AsyncTaskForbiddenError:
            return self.response_403()
        except AsyncTaskCancelFailedError as ex:
            logger.error(
                "Error cancelling task %s: %s",
                uuid_or_id,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
        except (ValueError, TypeError):
            return self.response_404()
