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
from __future__ import annotations

import logging

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseNotFoundError,
    UserNotFoundError,
)
from superset.commands.database.utils import ping
from superset.daos.database import DatabaseDAO
from superset.tasks.permissions import sync_database_permissions

logger = logging.getLogger(__name__)


class SyncPermissionsAsyncCommand(BaseCommand):
    """
    Command to trigger an async task to sync database permissions.
    """

    def __init__(
        self,
        model_id: int,
        username: str | None,
        old_db_connection_name: str | None = None,
    ):
        """
        Constructor method.
        """
        self.db_connection_id = model_id
        self.username = username
        self.old_db_connection_name = old_db_connection_name

    def validate(self) -> None:
        """
        Validates the command before triggering the async task.

        Confirms both the DB connection user exist. Also tests the DB connection.
        """
        database = DatabaseDAO.find_by_id(self.db_connection_id)
        if not database:
            raise DatabaseNotFoundError()

        if not self.old_db_connection_name:
            self.old_db_connection_name = database.database_name

        if not self.username or not security_manager.get_user_by_username(
            self.username
        ):
            raise UserNotFoundError()

        with database.get_sqla_engine() as engine:
            # Make sure the connection works before delegating the task
            try:
                alive = ping(engine)
            except Exception as err:
                logger.error("Could not stablish a DB connection")
                raise DatabaseConnectionFailedError() from err

        if not alive:
            logger.error("Could not stablish a DB connection")
            raise DatabaseConnectionFailedError()

    def trigger_task(self) -> None:
        """
        Triggers the async task.

        Delegates Celery to trigger the permission sync using the SyncPermissionsCommand
        command.
        """
        sync_database_permissions.delay(
            self.db_connection_id,
            self.username,
            self.old_db_connection_name,
        )

    def run(self) -> None:
        """
        Triggers the command validation, and if successful, triggers the async task.
        """
        self.validate()
        self.trigger_task()
