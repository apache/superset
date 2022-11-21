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
from superset.databases.dao import DatabaseDAO
from superset.databases.ssh_tunnel.commands.exceptions import SSHTunnelCreateFailedError
from superset.databases.ssh_tunnel.dao import SSHTunnelDAO

logger = logging.getLogger(__name__)


class CreateSSHTunnelCommand(BaseCommand):
    def __init__(self, database_id: int, data: Dict[str, Any]):
        self._properties = data.copy()
        self._properties["database_id"] = database_id

    def run(self) -> Model:
        self.validate()

        try:
            tunnel = SSHTunnelDAO.create(self._properties, commit=False)
        except DAOCreateFailedError as ex:
            raise SSHTunnelCreateFailedError() from ex

        return tunnel

    def validate(self) -> None:
        # check to make sure the server port is not localhost
        db_id = self._properties["database_id"]
        db = DatabaseDAO.find_by_id(db_id)
        pass
