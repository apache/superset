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

from superset import app, is_feature_enabled
from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAOUpdateFailedError
from superset.databases.ssh_tunnel.commands.exceptions import (
    SSHTunnelDeleteFailedError,
    SSHTunnelInvalidError,
    SSHTunnelNotFoundError,
    SSHTunnelUpdateFailedError,
)
from superset.databases.ssh_tunnel.dao import SSHTunnelDAO
from superset.databases.ssh_tunnel.models import SSHTunnel

logger = logging.getLogger(__name__)

config = app.config
ssh_tunnel_manager = config["SSH_TUNNEL_MANAGER"]


class UpdateSSHTunnelCommand(BaseCommand):
    def __init__(self, model_id: int, data: Dict[str, Any]):
        self._properties = data.copy()
        self._model_id = model_id
        self._model: Optional[SSHTunnel] = None

    def run(self) -> Model:
        self.validate()
        try:
            tunnel = SSHTunnelDAO.update(self._model, self._properties)
        except DAOUpdateFailedError as ex:
            raise SSHTunnelUpdateFailedError() from ex
        return tunnel

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = SSHTunnelDAO.find_by_id(self._model_id)
        if not self._model:
            raise SSHTunnelNotFoundError()

        if is_feature_enabled("SSH_TUNNELING") and ssh_tunnel_manager:
            ssh_tunnel_manager.validate(self._properties)
