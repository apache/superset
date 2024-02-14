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
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model

from superset.commands.base import BaseCommand
from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelInvalidError,
    SSHTunnelNotFoundError,
    SSHTunnelRequiredFieldValidationError,
    SSHTunnelUpdateFailedError,
)
from superset.daos.database import SSHTunnelDAO
from superset.daos.exceptions import DAOUpdateFailedError
from superset.databases.ssh_tunnel.models import SSHTunnel

logger = logging.getLogger(__name__)


class UpdateSSHTunnelCommand(BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._properties = data.copy()
        self._model_id = model_id
        self._model: Optional[SSHTunnel] = None

    def run(self) -> Model:
        self.validate()
        try:
            if self._model is not None:  # So we dont get incompatible types error
                tunnel = SSHTunnelDAO.update(self._model, self._properties)
        except DAOUpdateFailedError as ex:
            raise SSHTunnelUpdateFailedError() from ex
        return tunnel

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = SSHTunnelDAO.find_by_id(self._model_id)
        if not self._model:
            raise SSHTunnelNotFoundError()
        private_key: Optional[str] = self._properties.get("private_key")
        private_key_password: Optional[str] = self._properties.get(
            "private_key_password"
        )
        if private_key_password and private_key is None:
            raise SSHTunnelInvalidError(
                exceptions=[SSHTunnelRequiredFieldValidationError("private_key")]
            )
