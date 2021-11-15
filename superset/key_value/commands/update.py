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
from datetime import datetime, timedelta
from typing import Any, Dict, List

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAOException
from superset.key_value.commands.exceptions import KeyValueUpdateFailedError
from superset.key_value.dao import KeyValueDAO

logger = logging.getLogger(__name__)


class UpdateKeyValueCommand(BaseCommand):
    def __init__(self, user: User, key: str, data: Dict[str, Any]):
        self._actor = user
        self._key = key
        self._properties = data.copy()

    def run(self) -> Model:
        try:
            model = KeyValueDAO.find_by_id(self._key)
            if not model:
                return None
            duration_ms = self._properties.get("duration_ms")
            if duration_ms:
                setattr(
                    model,
                    "expires_on",
                    datetime.now() + timedelta(milliseconds=duration_ms),
                )
            setattr(model, "retrieved_on", datetime.now())
            setattr(model, "value", self._properties.get("value"))
            setattr(model, "duration_ms", duration_ms)
            KeyValueDAO.update(model)
            return model
        except DAOException as ex:
            logger.exception(ex.exception)
            raise KeyValueUpdateFailedError() from ex

    def validate(self) -> None:
        pass
