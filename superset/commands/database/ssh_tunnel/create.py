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
from functools import partial
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelCreateFailedError,
    SSHTunnelDatabasePortError,
    SSHTunnelInvalidError,
    SSHTunnelRequiredFieldValidationError,
)
from superset.daos.database import SSHTunnelDAO
from superset.databases.utils import make_url_safe
from superset.extensions import event_logger
from superset.models.core import Database
from superset.utils.decorators import on_error, transaction
from superset.utils.ssh_tunnel import get_default_port

logger = logging.getLogger(__name__)


class CreateSSHTunnelCommand(BaseCommand):
    _database: Database

    def __init__(self, database: Database, data: dict[str, Any]):
        self._properties = data.copy()
        self._properties["database"] = database
        self._database = database

    @transaction(on_error=partial(on_error, reraise=SSHTunnelCreateFailedError))
    def run(self) -> Model:
        """
        Create an SSH tunnel.

        :returns: The SSH tunnel model
        :raises SSHTunnelCreateFailedError: If the model creation fails
        :raises SSHTunnelInvalidError: If the configuration are invalid
        """

        self.validate()
        return SSHTunnelDAO.create(attributes=self._properties)

    def validate(self) -> None:
        # TODO(hughhh): check to make sure the server port is not localhost
        # using the config.SSH_TUNNEL_MANAGER

        exceptions: list[ValidationError] = []
        server_address: Optional[str] = self._properties.get("server_address")
        server_port: Optional[int] = self._properties.get("server_port")
        username: Optional[str] = self._properties.get("username")
        password: Optional[str] = self._properties.get("password")
        private_key: Optional[str] = self._properties.get("private_key")
        private_key_password: Optional[str] = self._properties.get(
            "private_key_password"
        )
        url = make_url_safe(self._database.sqlalchemy_uri)
        backend = url.get_backend_name()
        port = url.port or get_default_port(backend)
        if not port:
            raise SSHTunnelDatabasePortError()
        if not server_address:
            exceptions.append(SSHTunnelRequiredFieldValidationError("server_address"))
        if not server_port:
            exceptions.append(SSHTunnelRequiredFieldValidationError("server_port"))
        if not username:
            exceptions.append(SSHTunnelRequiredFieldValidationError("username"))
        if not private_key and not password:
            exceptions.append(SSHTunnelRequiredFieldValidationError("password"))
        if private_key_password and private_key is None:
            exceptions.append(SSHTunnelRequiredFieldValidationError("private_key"))
        if exceptions:
            exception = SSHTunnelInvalidError()
            exception.extend(exceptions)
            event_logger.log_with_context(
                # pylint: disable=consider-using-f-string
                action="ssh_tunnel_creation_failed.{}.{}".format(
                    exception.__class__.__name__,
                    ".".join(exception.get_list_classnames()),
                )
            )
            raise exception
