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
from typing import Any, Dict, List, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAOCreateFailedError
from superset.databases.ssh_tunnel.commands.exceptions import (
    SSHTunnelCreateFailedError,
    SSHTunnelInvalidError,
    SSHTunnelRequiredFieldValidationError,
)
from superset.databases.ssh_tunnel.dao import SSHTunnelDAO
from superset.extensions import db, event_logger

logger = logging.getLogger(__name__)


class CreateSSHTunnelCommand(BaseCommand):
    def __init__(self, database_id: int, data: Dict[str, Any]):
        self._properties = data.copy()
        self._properties["database_id"] = database_id

    def run(self) -> Model:
        try:
            # Start nested transaction since we are always creating the tunnel
            # through a DB command (Create or Update). Without this, we cannot
            # safely rollback changes to databases if any, i.e, things like
            # test_do_not_create_database_if_ssh_tunnel_creation_fails test will fail
            db.session.begin_nested()
            self.validate()
            tunnel = SSHTunnelDAO.create(self._properties, commit=False)
        except DAOCreateFailedError as ex:
            # Rollback nested transaction
            db.session.rollback()
            raise SSHTunnelCreateFailedError() from ex
        except SSHTunnelInvalidError as ex:
            # Rollback nested transaction
            db.session.rollback()
            raise ex

        return tunnel

    def validate(self) -> None:
        # TODO(hughhh): check to make sure the server port is not localhost
        # using the config.SSH_TUNNEL_MANAGER
        exceptions: List[ValidationError] = []
        database_id: Optional[int] = self._properties.get("database_id")
        server_address: Optional[str] = self._properties.get("server_address")
        server_port: Optional[int] = self._properties.get("server_port")
        username: Optional[str] = self._properties.get("username")
        private_key: Optional[str] = self._properties.get("private_key")
        private_key_password: Optional[str] = self._properties.get(
            "private_key_password"
        )
        if not database_id:
            exceptions.append(SSHTunnelRequiredFieldValidationError("database_id"))
        if not server_address:
            exceptions.append(SSHTunnelRequiredFieldValidationError("server_address"))
        if not server_port:
            exceptions.append(SSHTunnelRequiredFieldValidationError("server_port"))
        if not username:
            exceptions.append(SSHTunnelRequiredFieldValidationError("username"))
        if private_key_password and private_key is None:
            exceptions.append(SSHTunnelRequiredFieldValidationError("private_key"))
        if exceptions:
            exception = SSHTunnelInvalidError()
            exception.add_list(exceptions)
            event_logger.log_with_context(
                action="ssh_tunnel_creation_failed.{}.{}".format(
                    exception.__class__.__name__,
                    ".".join(exception.get_list_classnames()),
                )
            )
            raise exception
