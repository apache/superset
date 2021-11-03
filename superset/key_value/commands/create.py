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
from typing import Any, Dict, List

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.key_value.commands.exceptions import KeyValueCreateFailedError
from superset.key_value.dao import KeyValueDAO
from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAOCreateFailedError

logger = logging.getLogger(__name__)


class CreateKeyValueCommand(BaseCommand):
    def __init__(self, user: User, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()

    def run(self) -> Model:
        try:
            keyValue = KeyValueDAO.create(self._properties['uuid'], self._properties['value'])
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise KeyValueCreateFailedError() from ex
        return keyValue

    def validate(self) -> None:
        return
