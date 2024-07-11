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

from superset.commands.base import BaseCommand
from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelDatabasePortError,
    SSHTunnelInvalidError,
    SSHTunnelNotFoundError,
    SSHTunnelRequiredFieldValidationError,
    SSHTunnelUpdateFailedError,
)
from superset.daos.database import SSHTunnelDAO
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.databases.utils import make_url_safe
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateSSHTunnelCommand(BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._properties = data.copy()
        self._model_id = model_id
        self._model: Optional[SSHTunnel] = None

    @transaction(on_error=partial(on_error, reraise=SSHTunnelUpdateFailedError))
    def run(self) -> Optional[Model]:
        self.validate()

        if self._model is None:
            return None

        # unset password if private key is provided
        if self._properties.get("private_key"):
            self._properties["password"] = None

        # unset private key and password if password is provided
        if self._properties.get("password"):
            self._properties["private_key"] = None
            self._properties["private_key_password"] = None

        return SSHTunnelDAO.update(self._model, self._properties)

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = SSHTunnelDAO.find_by_id(self._model_id)
        if not self._model:
            raise SSHTunnelNotFoundError()

        url = make_url_safe(self._model.database.sqlalchemy_uri)
        private_key: Optional[str] = self._properties.get("private_key")
        private_key_password: Optional[str] = self._properties.get(
            "private_key_password"
        )
        if private_key_password and private_key is None:
            raise SSHTunnelInvalidError(
                exceptions=[SSHTunnelRequiredFieldValidationError("private_key")]
            )
        if not url.port:
            raise SSHTunnelDatabasePortError()
