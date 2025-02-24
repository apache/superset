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
from functools import partial

from superset import app, security_manager
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseConnectionSyncPermissionsError,
    DatabaseNotFoundError,
    UserNotFoundInSessionError,
)
from superset.commands.database.utils import ping
from superset.daos.database import DatabaseDAO
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.models.core import Database
from superset.tasks.permissions import sync_database_permissions
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class SyncPermissionsCommand(BaseCommand):
    """
    Command to sync database permissions.
    """

    def __init__(
        self,
        model_id: int,
        username: str | None,
        old_db_connection_name: str | None = None,
        db_connection: Database | None = None,
        ssh_tunnel: SSHTunnel | None = None,
    ):
        """
        Constructor method.
        """
        self.db_connection_id = model_id
        self.username = username
        self.old_db_connection_name: str | None = old_db_connection_name
        self.db_connection: Database | None = db_connection
        self.db_connection_ssh_tunnel: SSHTunnel | None = ssh_tunnel

        self.async_mode: bool = app.config["SYNC_DB_PERMISSIONS_IN_ASYNC_MODE"]

    def validate(self) -> None:
        self.db_connection = (
            self.db_connection
            if self.db_connection
            else DatabaseDAO.find_by_id(self.db_connection_id)
        )
        if not self.db_connection:
            raise DatabaseNotFoundError()

        if not self.db_connection_ssh_tunnel:
            self.db_connection_ssh_tunnel = DatabaseDAO.get_ssh_tunnel(
                self.db_connection_id
            )

        self.old_db_connection_name = (
            self.old_db_connection_name
            if self.old_db_connection_name
            else self.db_connection.database_name
        )

        # Need user info to impersonate for OAuth2 connections
        if not self.username or not security_manager.get_user_by_username(
            self.username
        ):
            raise UserNotFoundInSessionError()

        with self.db_connection.get_sqla_engine(
            override_ssh_tunnel=self.db_connection_ssh_tunnel
        ) as engine:
            try:
                alive = ping(engine)
            except Exception as err:
                raise DatabaseConnectionFailedError() from err

        if not alive:
            raise DatabaseConnectionFailedError()

    def _run(self) -> None:
        """
        Triggers the perm sync in sync or async mode.
        """
        self.validate()
        args = [self.db_connection_id, self.username, self.old_db_connection_name]
        if self.async_mode:
            sync_database_permissions.delay(*args)
        else:
            sync_database_permissions(*args)

    # This command can be called either via its dedicated endpoint, or as part of
    # another command. In the latter, we don't want to start a nested transaction
    # to ensure an atomic operation, so ``run_without_transaction`` should be used.
    run = transaction(
        on_error=partial(on_error, reraise=DatabaseConnectionSyncPermissionsError)
    )(_run)
    run_without_transaction = _run
