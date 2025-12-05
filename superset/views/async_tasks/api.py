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

import logging
from typing import Any

from flask import request
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset import event_logger, security_manager
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.daos.async_task import AsyncTaskDAO
from superset.exceptions import SupersetSecurityException
from superset.models.async_task import AsyncTask
from superset.superset_typing import FlaskResponse
from superset.utils.core import get_user_id
from superset.views.async_tasks.schemas import (
    AsyncTaskListResponseSchema,
    AsyncTaskResponseSchema,
    AsyncTaskSchema,
    cancel_task_schema,
    CancelTaskResponseSchema,
    cleanup_tasks_schema,
    CleanupTasksResponseSchema,
    get_task_status_schema,
    TaskStatusResponseSchema,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_json,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class AsyncTaskRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(AsyncTask)
    include_route_methods = {"get_list", "get", "status", "cancel", "cleanup"}

    class_permission_name = "AsyncTask"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    resource_name = "async_tasks"
    allow_browser_login = True

    list_columns = [
        "id",
        "task_name",
        "status",
        "user_id",
        "created_on",
        "changed_on",
        "started_at",
        "completed_at",
        "progress",
    ]

    show_columns = [
        "id",
        "task_name",
        "status",
        "user_id",
        "created_on",
        "changed_on",
        "started_at",
        "completed_at",
        "progress",
        "result",
        "error",
    ]

    search_columns = [
        "task_name",
        "status",
        "user_id",
        "created_on",
        "changed_on",
    ]

    page_size = 20

    apispec_parameter_schemas = {
        "cancel_task_schema": cancel_task_schema,
        "get_task_status_schema": get_task_status_schema,
        "cleanup_tasks_schema": cleanup_tasks_schema,
    }

    openapi_spec_component_schemas = (
        AsyncTaskSchema,
        AsyncTaskListResponseSchema,
        AsyncTaskResponseSchema,
        TaskStatusResponseSchema,
        CancelTaskResponseSchema,
        CleanupTasksResponseSchema,
    )

    def _apply_user_filter(self, query: Any) -> Any:
        """Apply user-based filtering to only show user's own tasks or admin access"""
        if security_manager.is_admin():
            return query

        current_user_id = get_user_id()
        if current_user_id is None:
            # Anonymous users can't see any tasks
            return query.filter(AsyncTask.id == -1)  # Filter that returns no results

        return query.filter(AsyncTask.user_id == current_user_id)

    def get_list_headless(self, **kwargs: Any) -> FlaskResponse:
        """Override to apply user filtering"""
        # Apply user filter to the base query
        original_datamodel_query = self.datamodel.query
        self.datamodel.query = lambda *args, **kwargs: self._apply_user_filter(
            original_datamodel_query(*args, **kwargs)
        )

        try:
            return super().get_list_headless(**kwargs)
        finally:
            # Restore original query method
            self.datamodel.query = original_datamodel_query

    def get_headless(self, pk: str, **kwargs: Any) -> FlaskResponse:
        """Override to apply user filtering for individual task access"""
        task = AsyncTaskDAO.find_by_id(pk)
        if not task:
            return self.response_404()

        # Check if user can access this task
        if not security_manager.is_admin() and task.user_id != get_user_id():
            return self.response_403()

        return super().get_headless(pk, **kwargs)

    @expose("/status", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.status",
        log_to_statsd=False,
    )
    def status(self) -> FlaskResponse:
        """Get status for multiple async tasks.
        ---
        post:
          summary: Get status for multiple async tasks
          requestBody:
            description: Task IDs to get status for
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_task_status_schema'
          responses:
            200:
              description: Task status mapping
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/TaskStatusResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            task_ids = request.json.get("task_ids", [])
            if not task_ids:
                return self.response_400(message="task_ids parameter is required")

            # Get tasks and apply user filtering
            tasks = AsyncTaskDAO.find_by_ids(task_ids)
            current_user_id = get_user_id()

            # Filter tasks based on user permissions
            if not security_manager.is_admin():
                tasks = [task for task in tasks if task.user_id == current_user_id]

            # Build status mapping
            status_map = {task.id: task.status.value for task in tasks}

            return self.response(200, result=status_map)

        except Exception as ex:
            logger.exception("Error getting task status")
            return self.response_500(message=str(ex))

    @expose("/cancel", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.cancel",
        log_to_statsd=False,
    )
    def cancel(self) -> FlaskResponse:
        """Cancel multiple async tasks.
        ---
        post:
          summary: Cancel multiple async tasks
          requestBody:
            description: Task IDs to cancel
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/cancel_task_schema'
          responses:
            200:
              description: Task cancellation results
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/CancelTaskResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            task_ids = request.json.get("task_ids", [])
            if not task_ids:
                return self.response_400(message="task_ids parameter is required")

            # Get tasks and apply user filtering
            tasks = AsyncTaskDAO.find_by_ids(task_ids)
            current_user_id = get_user_id()

            cancellation_results = {}

            for task in tasks:
                # Check if user can cancel this task
                if not security_manager.is_admin() and task.user_id != current_user_id:
                    cancellation_results[task.id] = False
                    continue

                try:
                    success = AsyncTaskDAO.cancel_task(task.uuid)
                    cancellation_results[task.id] = success
                except Exception as ex:
                    logger.warning("Failed to cancel task %s: %s", task.id, ex)
                    cancellation_results[task.id] = False

            return self.response(200, result=cancellation_results)

        except Exception as ex:
            logger.exception("Error cancelling tasks")
            return self.response_500(message=str(ex))

    @expose("/cleanup", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.cleanup",
        log_to_statsd=False,
    )
    def cleanup(self) -> FlaskResponse:
        """Clean up old completed/cancelled async tasks.
        ---
        delete:
          summary: Clean up old completed/cancelled async tasks
          requestBody:
            description: Cleanup parameters
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/cleanup_tasks_schema'
          responses:
            200:
              description: Cleanup results
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/CleanupTasksResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        # Only admins can perform cleanup
        try:
            security_manager.raise_for_access()
        except SupersetSecurityException as ex:
            return self.response(403, message=str(ex))

        try:
            older_than_hours = request.json.get("older_than_hours")
            if not older_than_hours or older_than_hours < 1:
                return self.response_400(
                    message="older_than_hours must be a positive integer"
                )

            removed_count = AsyncTaskDAO.cleanup_old_tasks(older_than_hours)

            return self.response(200, result={"removed_count": removed_count})

        except Exception as ex:
            logger.exception("Error cleaning up tasks")
            return self.response_500(message=str(ex))
