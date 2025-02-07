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
from contextlib import closing
from sqlite3 import ProgrammingError

from flask import current_app as app
from sqlalchemy.engine import Engine

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseConnectionNotWorkingError,
    DatabaseNotFoundError,
    UserNotFoundError,
)
from superset.models.core import Database
from superset.utils.core import timeout

logger = logging.getLogger(__name__)


class ResyncPermissionsCommand(BaseCommand):
    def __init__(self, model: Database | None, username: str):
        self._model = model
        self._username = username

    def run(self) -> None:
        self.validate()

    def validate(self) -> None:
        """
        Validates the command.
        """
        if not self._model:
            raise DatabaseNotFoundError()

        # If OAuth2 connection, we need to impersonate
        # the current user to trigger the resync
        if self._model.is_oauth2_enabled():
            if not security_manager.get_user_by_username(self._username):
                raise UserNotFoundError()

        # Make sure the connection works before delegating the task
        def ping(engine: Engine) -> bool:
            with closing(engine.raw_connection()) as conn:
                return engine.dialect.do_ping(conn)

        with self._model.get_sqla_engine() as engine:
            try:
                time_delta = app.config["TEST_DATABASE_CONNECTION_TIMEOUT"]
                with timeout(int(time_delta.total_seconds())):
                    alive = ping(engine)
            except (ProgrammingError, RuntimeError):
                logger.warning("Raw connection failed, retrying with engine")
                alive = engine.dialect.do_ping(engine)
            except Exception as err:
                logger.error("Could not stablish a DB connection")
                raise DatabaseConnectionNotWorkingError() from err

        if not alive:
            logger.error("Could not stablish a DB connection")
            raise DatabaseConnectionNotWorkingError()
