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
"""Concrete TaskContext implementation for GATF"""

from superset_core.api.types import TaskContext as CoreTaskContext

from superset.daos.async_tasks import AsyncTaskDAO
from superset.extensions import db
from superset.models.async_tasks import AsyncTask


class TaskContext(CoreTaskContext):
    """
    Concrete implementation of TaskContext for the Global Async Task Framework.

    Tasks receive a TaskContext as their first parameter, which provides access
    to the task entity and methods to update it in the metastore.

    The context fetches the latest task state from the database on each access,
    enabling tasks to check for cancellation and other status changes.
    """

    def __init__(self, task_uuid: str) -> None:
        """
        Initialize TaskContext with a task UUID.

        :param task_uuid: The UUID of the AsyncTask this context manages
        """
        self._task_uuid = task_uuid

    @property
    def task(self) -> AsyncTask:
        """
        Get the latest task entity from the metastore.

        This property refetches the task from the database each time it's accessed,
        ensuring you always have the most current status (e.g., for cancellation
        checks).

        :returns: AsyncTask entity with latest state
        :raises ValueError: If task is not found
        """
        task = AsyncTaskDAO.find_one_or_none(uuid=self._task_uuid)
        if not task:
            raise ValueError(f"Task {self._task_uuid} not found")
        return task

    def update_task(self, task: AsyncTask) -> None:
        """
        Update the task entity in the metastore.

        Use this to persist changes to the task, such as payload updates or status
        changes.

        :param task: AsyncTask entity to update
        """
        db.session.merge(task)
        db.session.commit()
